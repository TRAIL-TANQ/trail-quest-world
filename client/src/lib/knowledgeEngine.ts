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
import { EFFECT_COLORS } from './knowledgeCards';

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

export interface EffectTelop {
  text: string;
  color: string;
  key: number;
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
  // ===== Effect system =====
  // Per-sub-battle buffs (reset at resolveSubBattleWin)
  defenderBonus: number;                                      // ±defense for current defender
  roundAttackBonus: { player: number; ai: number };           // added to every reveal this sub-battle
  pendingAttackBonus: { player: number; ai: number };         // one-shot, consumed on next reveal
  // Persistent state
  quarantine: { player: BattleCard[]; ai: BattleCard[] };     // removed-from-play cards
  sealedBenchNames: { player: string[]; ai: string[] };       // bench names whose effects are disabled
  altBonus: number;                                           // extra ALT earned this match
  effectTelop: EffectTelop | null;                            // UI consumes & clears after 1.5s
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
    defenderBonus: 0,
    roundAttackBonus: { player: 0, ai: 0 },
    pendingAttackBonus: { player: 0, ai: 0 },
    quarantine: { player: [], ai: [] },
    sealedBenchNames: { player: [], ai: [] },
    altBonus: 0,
    effectTelop: null,
    history: [],
    winner: null,
    message: 'デッキフェイズ：カードを選ぼう',
  };
}

// ---------- Effect system ----------

type Role = 'attacker' | 'defender';

export interface EffectResult {
  state: GameState;
  bonusAttack: number;  // extra attackCurrentPower added (attacker reveals only)
  telop?: { text: string; color: string };
}

function applySide(state: GameState, side: Side, next: PlayerState): GameState {
  return side === 'player' ? { ...state, player: next } : { ...state, ai: next };
}

function removeOneFromBench(bench: BenchSlot[], name: string): BenchSlot[] {
  return bench.flatMap((s) => {
    if (s.name !== name) return [s];
    if (s.count <= 1) return [];
    return [{ ...s, count: s.count - 1 }];
  });
}

/**
 * Apply a card's on-reveal effect. Called from startBattle (defender) and
 * revealNextAttackCard (attacker). Returns new state, any bonus attack power
 * to add on top of the card's base, and an optional telop for the UI.
 */
export function applyRevealEffect(
  state: GameState,
  card: BattleCard,
  side: Side,
  role: Role,
): EffectResult {
  const effId = card.effect?.id;
  if (!effId || !card.effect) return { state, bonusAttack: 0 };
  const opp = otherSide(side);
  const color = EFFECT_COLORS[card.effect.category];
  let next = state;
  let bonusAttack = 0;
  let telop: { text: string; color: string } | undefined;

  switch (effId) {
    case 'davinci': {
      if (role === 'attacker') {
        bonusAttack += 3;
        telop = { text: '🎨ダ・ヴィンチの万能の天才！攻撃+3', color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + 3 };
        telop = { text: '🎨ダ・ヴィンチの万能の天才！防御+3', color };
      }
      break;
    }
    case 'einstein': {
      if (role === 'attacker') {
        next = { ...next, defenderBonus: next.defenderBonus - 2 };
        telop = { text: '🧠アインシュタインの相対性理論！敵防御-2', color };
      } else {
        const oppState = opp === 'player' ? next.player : next.ai;
        if (oppState.deck.length > 0) {
          let bestIdx = 0;
          for (let i = 1; i < oppState.deck.length; i++) {
            if (getBaseAttack(oppState.deck[i]) > getBaseAttack(oppState.deck[bestIdx])) bestIdx = i;
          }
          const target = oppState.deck[bestIdx];
          const weakened: BattleCard = {
            ...target,
            attackPower: Math.max(0, getBaseAttack(target) - 2),
          };
          const newDeck = [...oppState.deck];
          newDeck[bestIdx] = weakened;
          next = applySide(next, opp, { ...oppState, deck: newDeck });
          telop = { text: '🧠アインシュタインの相対性理論！敵最強-2', color };
        }
      }
      break;
    }
    case 'curie': {
      next = {
        ...next,
        roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 1 },
      };
      telop = { text: '☢️キュリー夫人の放射能！味方攻撃+1 (ラウンド中)', color };
      break;
    }
    case 'napoleon': {
      if (role === 'attacker') {
        bonusAttack += 3;
        telop = { text: '⚡ナポレオンの電撃戦！攻撃+3', color };
      }
      break;
    }
    case 'cleopatra': {
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.deck.length > 0) {
        const [top, ...rest] = oppState.deck;
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], top] } },
          opp,
          { ...oppState, deck: rest },
        );
        telop = { text: '💋クレオパトラの魅了！敵デッキ上を隔離', color };
      }
      break;
    }
    case 'nobunaga': {
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.bench.length > 0) {
        const strongest = [...oppState.bench].sort(
          (a, b) => getBaseAttack(b.card) - getBaseAttack(a.card),
        )[0];
        next = {
          ...next,
          sealedBenchNames: {
            ...next.sealedBenchNames,
            [opp]: [...next.sealedBenchNames[opp], strongest.name],
          },
        };
        telop = { text: `🔥織田信長の天下布武！${strongest.name}を封印`, color };
      } else {
        telop = { text: '🔥織田信長の天下布武！対象なし', color };
      }
      break;
    }
    case 'mozart': {
      next = {
        ...next,
        pendingAttackBonus: {
          ...next.pendingAttackBonus,
          [side]: next.pendingAttackBonus[side] + 2,
        },
      };
      telop = { text: '🎵モーツァルトの天才の旋律！次味方攻撃+2', color };
      break;
    }
    case 'galileo': {
      const myState = side === 'player' ? next.player : next.ai;
      const oppState = opp === 'player' ? next.player : next.ai;
      const sumOf = (bench: BenchSlot[]) =>
        bench.reduce((s, b) => s + getBaseAttack(b.card) * b.count, 0);
      if (sumOf(oppState.bench) > sumOf(myState.bench)) {
        const mine = { ...myState, bench: oppState.bench };
        const theirs = { ...oppState, bench: myState.bench };
        next = applySide(applySide(next, side, mine), opp, theirs);
        telop = { text: '🌍ガリレオの地動説！ベンチ入れ替え', color };
      } else {
        telop = { text: '🌍ガリレオの地動説！入れ替え見送り', color };
      }
      break;
    }
    case 'piranha': {
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const same = myState.bench.find((b) => b.name === card.name);
        const copies = same?.count ?? 0;
        if (copies > 0) {
          bonusAttack += copies;
          telop = { text: `🐟ピラニアの群れの猛攻！攻撃+${copies}`, color };
        }
      }
      break;
    }
    case 'dolphin': {
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.deck.length >= 2) {
        const [a, b, ...restDeck] = oppState.deck;
        const aStronger = getBaseAttack(a) >= getBaseAttack(b);
        const stronger = aStronger ? a : b;
        const weaker = aStronger ? b : a;
        const newDeck = [weaker, ...restDeck, stronger];
        next = applySide(next, opp, { ...oppState, deck: newDeck });
        telop = { text: '🐬イルカのエコーロケーション！敵強カード底送り', color };
      }
      break;
    }
    case 'internet': {
      const myState = side === 'player' ? next.player : next.ai;
      if (myState.bench.length > 0) {
        const pick = myState.bench[Math.floor(Math.random() * myState.bench.length)];
        const newBench = removeOneFromBench(myState.bench, pick.name);
        next = applySide(
          {
            ...next,
            quarantine: { ...next.quarantine, [side]: [...next.quarantine[side], pick.card] },
          },
          side,
          { ...myState, bench: newBench },
        );
        telop = { text: `🌐インターネットの情報革命！${pick.name}を隔離`, color };
      } else {
        telop = { text: '🌐インターネットの情報革命！対象なし', color };
      }
      break;
    }
    case 'phone': {
      telop = { text: '📞電話の通信！次デッキフェイズ強化', color };
      break;
    }
    case 'telescope': {
      telop = { text: '🔭望遠鏡の先見！敵デッキを予見', color };
      break;
    }
    case 'gunpowder': {
      if (role === 'attacker') {
        bonusAttack += getBaseAttack(card); // effectively 2x this card's attack
        telop = { text: '💥火薬の爆発！攻撃パワー2倍', color };
      }
      break;
    }
    case 'compass': {
      const myState = side === 'player' ? next.player : next.ai;
      if (myState.deck.length >= 2) {
        const top3 = myState.deck.slice(0, 3);
        const sortedTop = [...top3].sort((a, b) => getBaseAttack(b) - getBaseAttack(a));
        const newDeck = [...sortedTop, ...myState.deck.slice(3)];
        next = applySide(next, side, { ...myState, deck: newDeck });
        telop = { text: '🧭羅針盤の航海術！デッキ上3枚を並べ替え', color };
      }
      break;
    }
    case 'penicillin': {
      const myState = side === 'player' ? next.player : next.ai;
      if (myState.bench.length > 0) {
        const strongest = [...myState.bench].sort(
          (a, b) => getBaseAttack(b.card) - getBaseAttack(a.card),
        )[0];
        const newBench = removeOneFromBench(myState.bench, strongest.name);
        const newDeck = [...myState.deck, strongest.card];
        next = applySide(next, side, { ...myState, bench: newBench, deck: newDeck });
        telop = { text: `💊ペニシリンの治療！${strongest.name}をデッキへ`, color };
      } else {
        telop = { text: '💊ペニシリンの治療！対象なし', color };
      }
      break;
    }
    case 'paper': {
      next = { ...next, altBonus: next.altBonus + 5 };
      telop = { text: '📜紙の記録！+5 ALT', color };
      break;
    }
  }

  return { state: next, bonusAttack, telop };
}

function withTelop(state: GameState, telop?: { text: string; color: string }): GameState {
  if (!telop) return state;
  return { ...state, effectTelop: { ...telop, key: Date.now() + Math.floor(Math.random() * 1000) } };
}

// ---------- Deck phase helpers (kept from previous version) ----------

export function addCardToDeck(state: GameState, card: BattleCard): GameState {
  return {
    ...state,
    player: { ...state.player, deck: [...state.player.deck, card] },
  };
}

export function removeCardFromDeck(state: GameState, removeIndex: number): GameState {
  const deck = [...state.player.deck];
  deck.splice(removeIndex, 1);
  return {
    ...state,
    player: { ...state.player, deck },
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
  let next: GameState = {
    ...state,
    phase: 'battle_intro',
    player: state.flagHolder === 'player' ? updatedHolder : state.player,
    ai: state.flagHolder === 'ai' ? updatedHolder : state.ai,
    defenseCard: defender,
    attackRevealed: [],
    attackCurrentPower: 0,
    message: state.flagHolder === 'player' ? 'あなたが防御中！' : 'あなたの攻撃！',
  };

  // Defender reveal triggers effect
  if (defender.effect) {
    const eff = applyRevealEffect(next, defender, state.flagHolder, 'defender');
    next = withTelop(eff.state, eff.telop);
  }
  return next;
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

  // Pre-compute buffs BEFORE consuming pending
  const roundBonus = state.roundAttackBonus[attackerSide];
  const pendingBonus = state.pendingAttackBonus[attackerSide];

  let next: GameState = {
    ...state,
    player: attackerSide === 'player' ? updatedAttacker : state.player,
    ai: attackerSide === 'ai' ? updatedAttacker : state.ai,
    attackRevealed: [...state.attackRevealed, nextCard],
    // Consume pending buff
    pendingAttackBonus: { ...state.pendingAttackBonus, [attackerSide]: 0 },
  };

  let addedPower = getBaseAttack(nextCard) + roundBonus + pendingBonus;

  // Card-specific on-reveal effect
  if (nextCard.effect) {
    const eff = applyRevealEffect(next, nextCard, attackerSide, 'attacker');
    next = withTelop(eff.state, eff.telop);
    addedPower += eff.bonusAttack;
  }

  const newPower = state.attackCurrentPower + addedPower;
  return {
    ...next,
    attackCurrentPower: newPower,
    message: `${attackerSide === 'player' ? 'あなたの' : '相手の'}攻撃パワー ${newPower}`,
  };
}

/**
 * True if the attacker has accumulated enough power to beat the current defender.
 */
export function hasAttackSucceeded(state: GameState): boolean {
  if (!state.defenseCard) return false;
  const effectiveDefense = Math.max(0, getBaseDefense(state.defenseCard) + state.defenderBonus);
  return state.attackCurrentPower >= effectiveDefense;
}

/**
 * Resolve a successful sub-battle (2026-04 quarantine rules):
 *  - Defender loses: defender card → defender's bench, AND defender's existing
 *    quarantine flows into defender's bench (cumulative flush).
 *    If the flush overflows (>BENCH_MAX_SLOTS distinct names) → game over, attacker wins.
 *  - Attacker wins: all non-last attack cards → attacker's quarantine (NOT bench).
 *    Last attack card → new defender.
 *  - flagHolder swaps to the old attacker.
 *  - phase → battle_resolve (UI shows summary then calls continueAfterResolve).
 *
 * Quarantine is a temporary holding zone: it does NOT count as bench space
 * while the player still holds the flag, but one lost defense dumps the
 * whole backlog onto the bench. High-risk / high-reward.
 */
export function resolveSubBattleWin(state: GameState): GameState {
  if (state.phase !== 'battle' || !state.defenseCard || state.attackRevealed.length === 0) return state;

  const defenderSide: Side = state.flagHolder;
  const attackerSide: Side = otherSide(defenderSide);
  const defenderCard = state.defenseCard;

  // Defender's bench receives: (old defender card) + (flushed quarantine).
  const defenderState = defenderSide === 'player' ? state.player : state.ai;
  const flushedCards = [defenderCard, ...state.quarantine[defenderSide]];
  let newDefenderBench = defenderState.bench;
  for (const c of flushedCards) {
    if (!canAddToBench(newDefenderBench, c)) {
      return {
        ...state,
        phase: 'game_over',
        winner: attackerSide,
        message: `${defenderSide === 'player' ? 'あなた' : '相手'}のベンチが満杯！隔離スペースの一斉流入で敗北`,
      };
    }
    newDefenderBench = addToBench(newDefenderBench, c);
  }

  // Split attack cards: all except last → attacker's quarantine; last becomes new defender.
  const attackCards = state.attackRevealed;
  const lastAttackCard = attackCards[attackCards.length - 1];
  const otherAttackCards = attackCards.slice(0, -1);
  const newAttackerQuarantine = [...state.quarantine[attackerSide], ...otherAttackCards];

  // Update quarantine map: defender's cleared (flushed to bench), attacker's appended.
  const newQuarantine = {
    ...state.quarantine,
    [defenderSide]: [] as BattleCard[],
    [attackerSide]: newAttackerQuarantine,
  };

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
    // Attacker's bench is untouched; only the defender's bench grows.
    player: {
      ...state.player,
      bench: defenderSide === 'player' ? newDefenderBench : state.player.bench,
    },
    ai: {
      ...state.ai,
      bench: defenderSide === 'ai' ? newDefenderBench : state.ai.bench,
    },
    quarantine: newQuarantine,
    // Role swap: new flag holder is the old attacker. New defense card is the last attack card.
    flagHolder: attackerSide,
    defenseCard: lastAttackCard,
    attackRevealed: [],
    attackCurrentPower: 0,
    // Reset per-sub-battle buffs
    defenderBonus: 0,
    roundAttackBonus: { player: 0, ai: 0 },
    pendingAttackBonus: { player: 0, ai: 0 },
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
