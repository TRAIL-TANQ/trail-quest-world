/**
 * Knowledge Challenger - Game Engine (Phase 1: 5-round trophy model, 1v1)
 *
 * - 5 rounds. Each round has a trophy with a "fans" value rolled from a per-round range.
 * - Each round, both sides reveal one card. Effects apply automatically (no in-battle quiz).
 *   Higher effective power wins the round and earns the trophy fans.
 * - Both revealed cards are then placed on their owner's bench (same-named cards stack).
 * - If a side tries to place a 6th DISTINCT card name on the bench -> that side instantly loses.
 * - After 5 rounds, the side with more total fans wins. Ties break to the player.
 * - Deck phase (between rounds) is handled in the UI layer and adds cards to `player.deck`.
 */
import type { BattleCard } from './knowledgeCards';

export const BENCH_MAX_SLOTS = 6;
export const TOTAL_ROUNDS = 5;

// Trophy fan ranges per round: [min, max] inclusive
export const TROPHY_FAN_RANGES: Array<[number, number]> = [
  [2, 3],   // Round 1
  [3, 5],   // Round 2
  [5, 7],   // Round 3
  [7, 9],   // Round 4
  [9, 11],  // Round 5
];

export function rollTrophyFans(round: number): number {
  const range = TROPHY_FAN_RANGES[round - 1];
  if (!range) return 0;
  const [min, max] = range;
  return min + Math.floor(Math.random() * (max - min + 1));
}

export interface BenchSlot {
  name: string;
  card: BattleCard;
  count: number;
}

export interface PlayerState {
  deck: BattleCard[];
  bench: BenchSlot[];
  isAI: boolean;
}

export type GamePhase =
  | 'round_intro'   // showing round banner + trophy
  | 'reveal'        // both cards revealed, effects resolving
  | 'round_end'     // trophy awarded, cards going to bench
  | 'deck_phase'    // between rounds, player picks new cards via quiz
  | 'game_over';

export interface RoundResult {
  round: number;
  playerCard: BattleCard;
  aiCard: BattleCard;
  playerPower: number;
  aiPower: number;
  winner: 'player' | 'ai' | 'draw';
  trophyFans: number;
}

export interface GameState {
  phase: GamePhase;
  round: number;                    // 1..TOTAL_ROUNDS
  trophyFans: number[];             // rolled fan values per round, length TOTAL_ROUNDS
  playerFans: number;
  aiFans: number;
  player: PlayerState;
  ai: PlayerState;
  // Current round reveal
  playerCard: BattleCard | null;
  aiCard: BattleCard | null;
  playerPower: number;
  aiPower: number;
  roundWinner: 'player' | 'ai' | 'draw' | null;
  history: RoundResult[];
  winner: 'player' | 'ai' | null;
  message: string;
}

function shuffleDeck(deck: BattleCard[]): BattleCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function initGameState(playerDeck: BattleCard[], aiDeck: BattleCard[]): GameState {
  const trophyFans = Array.from({ length: TOTAL_ROUNDS }, (_, i) => rollTrophyFans(i + 1));
  return {
    // 正しい順序（変更: deck_phase → battle → next round deck_phase → ...）
    // まずデッキフェイズで 5 枚提示 → 2 枚選択 → バトル開始
    phase: 'deck_phase',
    round: 1,
    trophyFans,
    playerFans: 0,
    aiFans: 0,
    player: { deck: shuffleDeck(playerDeck), bench: [], isAI: false },
    ai: { deck: shuffleDeck(aiDeck), bench: [], isAI: true },
    playerCard: null,
    aiCard: null,
    playerPower: 0,
    aiPower: 0,
    roundWinner: null,
    history: [],
    winner: null,
    message: 'デッキフェイズ：カードを選ぼう',
  };
}

// ===== Bench helpers =====
function distinctCount(bench: BenchSlot[]): number {
  return bench.length;
}

function canAddToBench(bench: BenchSlot[], card: BattleCard): boolean {
  if (bench.some(s => s.name === card.name)) return true; // stack
  return distinctCount(bench) < BENCH_MAX_SLOTS;
}

function addToBench(bench: BenchSlot[], card: BattleCard): BenchSlot[] {
  const existing = bench.find(s => s.name === card.name);
  if (existing) {
    return bench.map(s => s.name === card.name ? { ...s, count: s.count + 1 } : s);
  }
  return [...bench, { name: card.name, card, count: 1 }];
}

function cloneBench(bench: BenchSlot[]): BenchSlot[] {
  return bench.map(s => ({ ...s }));
}

// ===== Power calculation =====
export function getBaseAttack(card: BattleCard): number {
  return card.attackPower ?? card.power;
}
export function getBaseDefense(card: BattleCard): number {
  return card.defensePower ?? card.power;
}

/**
 * Phase 1: no in-battle quiz. Card effects fire automatically on reveal.
 * We use the average of attack/defense as the "duel power" for one-reveal-per-round combat.
 * Category/rarity synergies with the current bench still apply.
 */
function calculateRevealPower(card: BattleCard, bench: BenchSlot[]): number {
  const base = Math.round((getBaseAttack(card) + getBaseDefense(card)) / 2);
  let power = base + card.correctBonus;

  const { category, rarity } = card;
  if (category === 'great_person') {
    const sameCount = bench.filter(s => s.card.category === 'great_person').reduce((sum, s) => sum + s.count, 0);
    if (rarity === 'R') power += sameCount * 1;
    else if (rarity === 'SR') power += sameCount * 2;
    else if (rarity === 'SSR') power += bench.reduce((sum, s) => sum + s.count, 0) * 1;
  } else if (category === 'creature') {
    if (rarity === 'SR') {
      const emptySlots = BENCH_MAX_SLOTS - bench.length;
      if (emptySlots <= 2) power += 4;
    }
  } else if (category === 'heritage') {
    if (rarity === 'R') power += 2;
    else if (rarity === 'SR') power += 3;
    else if (rarity === 'SSR') power += 5;
  } else if (category === 'invention') {
    if (rarity === 'R') power += 1;
  } else if (category === 'discovery') {
    if (rarity === 'R') power += 2;
    else if (rarity === 'SR') power += 3;
  }
  return power;
}

// ===== Round flow =====

/**
 * Begin the reveal phase of the current round. Both sides draw the top card of their deck
 * and effective powers are computed. If either side can't draw (empty deck), that side loses
 * the round automatically (power = 0, card = null on that side is represented as a draw loss).
 */
export function revealRound(state: GameState): GameState {
  if (state.phase !== 'round_intro') return state;

  const playerDeck = [...state.player.deck];
  const aiDeck = [...state.ai.deck];
  const playerCard = playerDeck.shift() ?? null;
  const aiCard = aiDeck.shift() ?? null;

  const playerPower = playerCard ? calculateRevealPower(playerCard, state.player.bench) : 0;
  const aiPower = aiCard ? calculateRevealPower(aiCard, state.ai.bench) : 0;

  let roundWinner: 'player' | 'ai' | 'draw';
  if (!playerCard && !aiCard) roundWinner = 'draw';
  else if (!playerCard) roundWinner = 'ai';
  else if (!aiCard) roundWinner = 'player';
  else if (playerPower > aiPower) roundWinner = 'player';
  else if (aiPower > playerPower) roundWinner = 'ai';
  else roundWinner = 'player'; // tie breaks to player

  return {
    ...state,
    phase: 'reveal',
    player: { ...state.player, deck: playerDeck },
    ai: { ...state.ai, deck: aiDeck },
    playerCard,
    aiCard,
    playerPower,
    aiPower,
    roundWinner,
    message: roundWinner === 'player'
      ? 'あなたの勝ち！トロフィー獲得！'
      : roundWinner === 'ai'
        ? '相手の勝ち...トロフィーを奪われた'
        : '引き分け',
  };
}

/**
 * Award trophy, send both cards to their benches, advance round (or end game).
 * Instant-lose check: if adding to bench would produce a 6th DISTINCT name on that side,
 * that side immediately loses the whole match.
 */
export function endRound(state: GameState): GameState {
  if (state.phase !== 'reveal') return state;

  const trophy = state.trophyFans[state.round - 1] ?? 0;
  let playerFans = state.playerFans;
  let aiFans = state.aiFans;
  if (state.roundWinner === 'player') playerFans += trophy;
  else if (state.roundWinner === 'ai') aiFans += trophy;

  // Record history
  const history: RoundResult[] = [
    ...state.history,
    {
      round: state.round,
      playerCard: state.playerCard!,
      aiCard: state.aiCard!,
      playerPower: state.playerPower,
      aiPower: state.aiPower,
      winner: state.roundWinner ?? 'draw',
      trophyFans: trophy,
    },
  ];

  // Send cards to benches (with overflow check)
  let playerBench = cloneBench(state.player.bench);
  let aiBench = cloneBench(state.ai.bench);

  if (state.playerCard) {
    if (!canAddToBench(playerBench, state.playerCard)) {
      return {
        ...state,
        phase: 'game_over',
        winner: 'ai',
        history,
        playerFans,
        aiFans,
        message: 'あなたのベンチが満杯！6種類目のカードで敗北...',
      };
    }
    playerBench = addToBench(playerBench, state.playerCard);
  }
  if (state.aiCard) {
    if (!canAddToBench(aiBench, state.aiCard)) {
      return {
        ...state,
        phase: 'game_over',
        winner: 'player',
        history,
        playerFans,
        aiFans,
        message: '相手のベンチが満杯！あなたの勝利！',
      };
    }
    aiBench = addToBench(aiBench, state.aiCard);
  }

  const isLastRound = state.round >= TOTAL_ROUNDS;
  if (isLastRound) {
    const winner: 'player' | 'ai' = playerFans >= aiFans ? 'player' : 'ai';
    return {
      ...state,
      phase: 'game_over',
      player: { ...state.player, bench: playerBench },
      ai: { ...state.ai, bench: aiBench },
      playerFans,
      aiFans,
      history,
      winner,
      message: winner === 'player'
        ? `5ラウンド終了！${playerFans} vs ${aiFans} であなたの勝利！`
        : `5ラウンド終了...${playerFans} vs ${aiFans} で敗北`,
    };
  }

  return {
    ...state,
    phase: 'round_end',
    player: { ...state.player, bench: playerBench },
    ai: { ...state.ai, bench: aiBench },
    playerFans,
    aiFans,
    history,
  };
}

/**
 * Legacy: kept as a no-op compat shim. Use advanceToNextRound or startCurrentRound.
 * （旧設計: round_end → deck_phase。新設計では advanceToNextRound が直接遷移する）
 */
export function startDeckPhase(state: GameState): GameState {
  if (state.phase !== 'round_end') return state;
  return {
    ...state,
    phase: 'deck_phase',
    message: 'デッキフェイズ：新しいカードを選ぼう！',
  };
}

/**
 * Add a card to the player's deck during the deck phase.
 * (Swap UI for >15 is handled in the caller.)
 */
export function addCardToDeck(state: GameState, card: BattleCard): GameState {
  return {
    ...state,
    player: { ...state.player, deck: [...state.player.deck, card] },
  };
}

/**
 * Replace a card in the player's deck with a new one (for swap UI when deck > max).
 */
export function swapCardInDeck(state: GameState, removeIndex: number, newCard: BattleCard): GameState {
  const deck = [...state.player.deck];
  deck.splice(removeIndex, 1);
  deck.push(newCard);
  return {
    ...state,
    player: { ...state.player, deck },
  };
}

/**
 * Give the AI two random cards between rounds (Phase 1: simple mirror growth).
 */
export function aiDeckGrowth(state: GameState, newCards: BattleCard[]): GameState {
  return {
    ...state,
    ai: { ...state.ai, deck: [...state.ai.deck, ...newCards] },
  };
}

/**
 * デッキフェイズ終了 → 現在ラウンドのバトル開始。
 * ラウンド番号は増やさない（deck_phase は常に対応する round のバトル前に行われる）。
 */
export function startCurrentRound(state: GameState): GameState {
  if (state.phase !== 'deck_phase') return state;
  return {
    ...state,
    phase: 'round_intro',
    playerCard: null,
    aiCard: null,
    playerPower: 0,
    aiPower: 0,
    roundWinner: null,
    message: `ラウンド${state.round}開始！トロフィー: ${state.trophyFans[state.round - 1]}ファン`,
  };
}

/**
 * バトル終了 (round_end) → 次のラウンドのデッキフェイズへ。
 * round をインクリメントしてから deck_phase に遷移する。
 * 最終ラウンド後はそもそも endRound が game_over に飛ばすのでこの関数は呼ばれない。
 */
export function advanceToNextRound(state: GameState): GameState {
  if (state.phase !== 'round_end') return state;
  const nextRound = state.round + 1;
  if (nextRound > TOTAL_ROUNDS) return state;
  return {
    ...state,
    phase: 'deck_phase',
    round: nextRound,
    playerCard: null,
    aiCard: null,
    playerPower: 0,
    aiPower: 0,
    roundWinner: null,
    message: `ラウンド${nextRound} デッキフェイズ：カードを選ぼう`,
  };
}
