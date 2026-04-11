/**
 * Knowledge Challenger - Game Engine
 *
 * === Correct battle model (attack/defense auto-loop) ===
 *
 * 1. Deck phase (one time at the start): player picks 2 of 5 offered cards via quizzes.
 *    Player's deck becomes 10 (starter) + up to 2 = 12 cards.
 * 2. Battle phase: entirely automatic. The engine runs a loop of sub-battles.
 *
 *    Each sub-battle:
 *      a. flagHolder draws top of their deck as the defense card (uses defensePower)
 *      b. The attacker (the other side) reveals cards from the top of their deck one by one
 *         - each reveal adds card.attackPower to attackCurrentPower
 *      c. When attackCurrentPower >= defenseCard.defensePower the attacker wins the sub-battle
 *      d. Resolution:
 *          - defense card → defender's bench (check overflow)
 *          - all attack cards except the last → attacker's bench (check overflow)
 *          - last attack card becomes the new defender (held by the new flag holder)
 *          - flagHolder swaps to the old attacker
 *          - next sub-battle begins with the same defender card, new attacker draws from their deck
 *      e. If the attacker runs out of cards before beating the defender: game over,
 *         defender wins the match (deck-out condition)
 *      f. If any bench would overflow (>6 distinct card names): that side loses the match
 *
 * 3. Winner:
 *      - side whose opponent ran out of deck / bench first
 *      - ties are broken in favour of the player (ties cannot really happen in this model)
 *
 * === The player only interacts during the deck phase. ===
 * Battle is purely cinematic. The UI calls revealNextAttackCard() on a timer and
 * resolveBattleStep() when the attacker has accumulated enough power.
 */
import type { BattleCard } from './knowledgeCards';

export const BENCH_MAX_SLOTS = 6;

// Legacy exports kept for compatibility with ratingService, stages, etc.
// The real battle model no longer uses rounds or trophy fans, but some UI
// copy still refers to "round" as a display label for the current sub-battle.
export const TOTAL_ROUNDS = 5;
export const TROPHY_FAN_RANGES: Array<[number, number]> = [
  [2, 3], [3, 5], [5, 7], [7, 9], [9, 11],
];
export function rollTrophyFans(round: number): number {
  const range = TROPHY_FAN_RANGES[round - 1];
  if (!range) return 0;
  const [min, max] = range;
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ---------- Types ----------

export type Side = 'player' | 'ai';

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
  | 'deck_phase'      // player picks cards via quiz (one-time at game start)
  | 'battle_intro'    // turn banner "あなたの攻撃！" / "あなたが防御中！"
  | 'battle'          // attacker reveal loop, UI drives per-card reveals
  | 'battle_resolve'  // sub-battle ended: benches updated, about to swap roles
  | 'game_over';

export interface SubBattleResult {
  idx: number;
  defenderSide: Side;
  defenderCard: BattleCard;
  attackerSide: Side;
  attackCards: BattleCard[];
  attackPower: number;
  winner: Side;  // always the attacker (defender cannot win a sub-battle, they can only run out the attacker's deck → game over)
}

export interface GameState {
  phase: GamePhase;
  // Legacy: round counter, mostly for display and compatibility.
  // Incremented once per completed sub-battle.
  round: number;
  // Trophy fans kept as legacy display flavour; the real winner is whoever
  // doesn't fail first.
  trophyFans: number[];
  playerFans: number;
  aiFans: number;
  player: PlayerState;
  ai: PlayerState;
  // ===== Battle state =====
  flagHolder: Side;                     // side currently defending the flag
  defenseCard: BattleCard | null;       // defender card on the field
  attackRevealed: BattleCard[];         // cards revealed in the current attack
  attackCurrentPower: number;           // cumulative attack power so far
  lastSubBattle: SubBattleResult | null; // last resolved sub-battle (for outcome banner)
  // ===== Result =====
  history: SubBattleResult[];
  winner: Side | null;
  message: string;
}

// ---------- Utilities ----------

function shuffleDeck(deck: BattleCard[]): BattleCard[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getBaseAttack(card: BattleCard): number {
  return card.attackPower ?? card.power;
}
export function getBaseDefense(card: BattleCard): number {
  return card.defensePower ?? card.power;
}

function distinctCount(bench: BenchSlot[]): number {
  return bench.length;
}

function canAddToBench(bench: BenchSlot[], card: BattleCard): boolean {
  if (bench.some((s) => s.name === card.name)) return true; // stack same-name
  return distinctCount(bench) < BENCH_MAX_SLOTS;
}

function addToBench(bench: BenchSlot[], card: BattleCard): BenchSlot[] {
  const existing = bench.find((s) => s.name === card.name);
  if (existing) {
    return bench.map((s) => (s.name === card.name ? { ...s, count: s.count + 1 } : s));
  }
  return [...bench, { name: card.name, card, count: 1 }];
}

function otherSide(side: Side): Side {
  return side === 'player' ? 'ai' : 'player';
}

// ---------- Initial state ----------

export function initGameState(playerDeck: BattleCard[], aiDeck: BattleCard[]): GameState {
  const trophyFans = Array.from({ length: TOTAL_ROUNDS }, (_, i) => rollTrophyFans(i + 1));
  return {
    phase: 'deck_phase',
    round: 1,
    trophyFans,
    playerFans: 0,
    aiFans: 0,
    player: { deck: shuffleDeck(playerDeck), bench: [], isAI: false },
    ai: { deck: shuffleDeck(aiDeck), bench: [], isAI: true },
    flagHolder: 'player',  // player starts as flag holder (AI attacks first)
    defenseCard: null,
    attackRevealed: [],
    attackCurrentPower: 0,
    lastSubBattle: null,
    history: [],
    winner: null,
    message: 'デッキフェイズ：カードを選ぼう',
  };
}

// ---------- Deck phase helpers (kept from previous version) ----------

export function addCardToDeck(state: GameState, card: BattleCard): GameState {
  return {
    ...state,
    player: { ...state.player, deck: [...state.player.deck, card] },
  };
}

export function swapCardInDeck(state: GameState, removeIndex: number, newCard: BattleCard): GameState {
  const deck = [...state.player.deck];
  deck.splice(removeIndex, 1);
  deck.push(newCard);
  return {
    ...state,
    player: { ...state.player, deck },
  };
}

// kept for stages.ts compatibility
export function aiDeckGrowth(state: GameState, newCards: BattleCard[]): GameState {
  return {
    ...state,
    ai: { ...state.ai, deck: [...state.ai.deck, ...newCards] },
  };
}

// ---------- Battle transitions ----------

/**
 * deck_phase → battle_intro.
 * Draws the initial defense card from the flag holder's deck.
 */
export function startBattle(state: GameState): GameState {
  if (state.phase !== 'deck_phase') return state;
  const holder = state.flagHolder === 'player' ? state.player : state.ai;
  if (holder.deck.length === 0) {
    return {
      ...state,
      phase: 'game_over',
      winner: otherSide(state.flagHolder),
      message: `${state.flagHolder === 'player' ? 'あなた' : '相手'}のデッキが空！敗北`,
    };
  }
  const [defender, ...rest] = holder.deck;
  const updatedHolder: PlayerState = { ...holder, deck: rest };
  return {
    ...state,
    phase: 'battle_intro',
    player: state.flagHolder === 'player' ? updatedHolder : state.player,
    ai: state.flagHolder === 'ai' ? updatedHolder : state.ai,
    defenseCard: defender,
    attackRevealed: [],
    attackCurrentPower: 0,
    message: state.flagHolder === 'player' ? 'あなたが防御中！' : 'あなたの攻撃！',
  };
}

/**
 * battle_intro → battle. No state change beyond phase (the UI uses this
 * transition to know when to start the reveal loop).
 */
export function beginAttackLoop(state: GameState): GameState {
  if (state.phase !== 'battle_intro') return state;
  return { ...state, phase: 'battle' };
}

/**
 * Reveal the top card of the attacker's deck. Adds it to attackRevealed and
 * bumps attackCurrentPower by the card's attackPower.
 *
 * If the attacker's deck is empty and they haven't beaten the defender,
 * transitions to game_over with the defender as winner (deck-out rule).
 */
export function revealNextAttackCard(state: GameState): GameState {
  if (state.phase !== 'battle') return state;
  const attackerSide = otherSide(state.flagHolder);
  const attacker = attackerSide === 'player' ? state.player : state.ai;

  if (attacker.deck.length === 0) {
    // Attacker ran out of cards. They lose the match.
    return {
      ...state,
      phase: 'game_over',
      winner: state.flagHolder,
      message: `${attackerSide === 'player' ? 'あなた' : '相手'}のデッキ切れ！敗北`,
    };
  }

  const [nextCard, ...rest] = attacker.deck;
  const updatedAttacker: PlayerState = { ...attacker, deck: rest };
  const newPower = state.attackCurrentPower + getBaseAttack(nextCard);

  return {
    ...state,
    player: attackerSide === 'player' ? updatedAttacker : state.player,
    ai: attackerSide === 'ai' ? updatedAttacker : state.ai,
    attackRevealed: [...state.attackRevealed, nextCard],
    attackCurrentPower: newPower,
    message: `${attackerSide === 'player' ? 'あなたの' : '相手の'}攻撃パワー ${newPower}`,
  };
}

/**
 * True if the attacker has accumulated enough power to beat the current defender.
 */
export function hasAttackSucceeded(state: GameState): boolean {
  if (!state.defenseCard) return false;
  return state.attackCurrentPower >= getBaseDefense(state.defenseCard);
}

/**
 * Resolve a successful sub-battle:
 *  - defender card → defender's bench (overflow → game over, attacker wins match)
 *  - all attack cards except the last → attacker's bench (overflow → game over, defender wins)
 *  - last attack card becomes the new defender
 *  - flagHolder swaps to the old attacker
 *  - phase → battle_resolve (UI shows outcome banner then calls continueAfterResolve)
 */
export function resolveSubBattleWin(state: GameState): GameState {
  if (state.phase !== 'battle' || !state.defenseCard || state.attackRevealed.length === 0) return state;

  const defenderSide: Side = state.flagHolder;
  const attackerSide: Side = otherSide(defenderSide);
  const defenderCard = state.defenseCard;

  // defender card → defender's bench
  const defenderState = defenderSide === 'player' ? state.player : state.ai;
  if (!canAddToBench(defenderState.bench, defenderCard)) {
    return {
      ...state,
      phase: 'game_over',
      winner: attackerSide,
      message: `${defenderSide === 'player' ? 'あなた' : '相手'}のベンチが満杯！6種類目のカードで敗北`,
    };
  }
  const newDefenderBench = addToBench(defenderState.bench, defenderCard);

  // Split attack cards: all except last go to attacker's bench, last becomes new defender
  const attackCards = state.attackRevealed;
  const lastAttackCard = attackCards[attackCards.length - 1];
  const otherAttackCards = attackCards.slice(0, -1);

  const attackerState = attackerSide === 'player' ? state.player : state.ai;
  let newAttackerBench = attackerState.bench;
  for (const card of otherAttackCards) {
    if (!canAddToBench(newAttackerBench, card)) {
      return {
        ...state,
        phase: 'game_over',
        winner: defenderSide,
        message: `${attackerSide === 'player' ? 'あなた' : '相手'}のベンチが満杯！6種類目のカードで敗北`,
      };
    }
    newAttackerBench = addToBench(newAttackerBench, card);
  }

  const result: SubBattleResult = {
    idx: state.history.length + 1,
    defenderSide,
    defenderCard,
    attackerSide,
    attackCards,
    attackPower: state.attackCurrentPower,
    winner: attackerSide,
  };

  // Award legacy trophy fans (cosmetic) to the attacker
  const trophy = state.trophyFans[Math.min(state.round - 1, state.trophyFans.length - 1)] ?? 0;
  const newPlayerFans = attackerSide === 'player' ? state.playerFans + trophy : state.playerFans;
  const newAiFans = attackerSide === 'ai' ? state.aiFans + trophy : state.aiFans;

  return {
    ...state,
    phase: 'battle_resolve',
    player: {
      ...state.player,
      bench: defenderSide === 'player' ? newDefenderBench : newAttackerBench,
    },
    ai: {
      ...state.ai,
      bench: defenderSide === 'ai' ? newDefenderBench : newAttackerBench,
    },
    // Role swap: new flag holder is the old attacker. New defense card is the last attack card.
    flagHolder: attackerSide,
    defenseCard: lastAttackCard,
    attackRevealed: [],
    attackCurrentPower: 0,
    lastSubBattle: result,
    history: [...state.history, result],
    round: state.round + 1,
    playerFans: newPlayerFans,
    aiFans: newAiFans,
    message: `${attackerSide === 'player' ? 'あなた' : '相手'}がフラッグ奪取！`,
  };
}

/**
 * battle_resolve → battle_intro for the next sub-battle.
 * The new flag holder keeps the defense card (= last attack card from previous sub-battle).
 * So we skip the "draw defender" step and go straight into the attacker intro.
 */
export function continueAfterResolve(state: GameState): GameState {
  if (state.phase !== 'battle_resolve') return state;
  // Sanity check: defender must already be set (from resolveSubBattleWin)
  if (!state.defenseCard) {
    // Shouldn't happen; draw from flag holder's deck as fallback
    return startBattle({ ...state, phase: 'deck_phase' });
  }
  return {
    ...state,
    phase: 'battle_intro',
    message: state.flagHolder === 'player' ? 'あなたが防御中！' : 'あなたの攻撃！',
  };
}
