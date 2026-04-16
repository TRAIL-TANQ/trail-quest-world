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
import { EFFECT_COLORS, ALL_BATTLE_CARDS } from './knowledgeCards';
import type { StageRules } from './stages';

export const BENCH_MAX_SLOTS = 6;

// 2026-04 rework: rounds (回戦) each contain a full battle phase.
// Each round ends when one side deck-outs or bench-overflows.
// After all rounds, fan totals decide the overall winner.
// NPC mode: fixed 3 rounds. PvP: selectable 3/5/7.
export const TOTAL_ROUNDS = 3;
// Round victory fan rewards per round-count mode
export const ROUND_VICTORY_FANS_BY_TOTAL: Record<number, number[]> = {
  3: [15, 20, 25],
  5: [10, 12, 14, 15, 20],
  7: [8, 10, 12, 14, 15, 18, 20],
};
// Legacy alias (3-round default for NPC)
export const ROUND_VICTORY_FANS = ROUND_VICTORY_FANS_BY_TOTAL[3];
// Card defeat fan rewards by rarity
export const CARD_DEFEAT_FANS: Record<string, number> = { N: 1, R: 2, SR: 3, SSR: 5 };

// Legacy: trophy fans (now uses ROUND_VICTORY_FANS instead)
export const TROPHY_FAN_RANGES: Array<[number, number]> = [
  [10, 10], [12, 12], [14, 14], [15, 15], [20, 20],
];
export function rollTrophyFans(round: number, totalRounds: number = 5): number {
  const arr = ROUND_VICTORY_FANS_BY_TOTAL[totalRounds] ?? ROUND_VICTORY_FANS_BY_TOTAL[5];
  return arr[round - 1] ?? 0;
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
  | 'deck_phase'      // player picks cards via quiz (at the start of each round)
  | 'battle_intro'    // turn banner "あなたの攻撃！" / "あなたが防御中！"
  | 'battle'          // attacker reveal loop, UI drives per-card reveals
  | 'battle_resolve'  // sub-battle ended: benches updated, about to swap roles
  | 'round_end'       // one side lost this round (deck-out or bench-overflow)
  | 'game_over';

export interface SubBattleResult {
  idx: number;
  defenderSide: Side;
  defenderCard: BattleCard;
  attackerSide: Side;
  attackCards: BattleCard[];
  attackPower: number;
  defeatFans: number;  // card defeat fans earned by attacker
  winner: Side;  // always the attacker (defender cannot win a sub-battle, they can only run out the attacker's deck → game over)
}

export interface BenchBoostDetail {
  benchCardName: string;
  atkBonus: number;
  defBonus: number;
}

export interface EffectTelop {
  text: string;
  color: string;
  key: number;
}

export interface GameState {
  phase: GamePhase;
  // Total rounds for this match (3, 5, or 7). NPC mode is always 5.
  totalRounds: number;
  // Round counter (1..totalRounds). Only incremented in advanceToNextRound, NOT per sub-battle.
  round: number;
  // Sub-battle counter within the current round. Resets to 0 at each round start.
  subBattleCount: number;
  // Trophy fans: fan bonus awarded to the round winner per round.
  trophyFans: number[];
  // Trophy count: number of rounds won (0..5).
  playerTrophies: number;
  aiTrophies: number;
  // Fan totals: cumulative (card defeat fans + trophy fans).
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
  quarantine: { player: BattleCard[]; ai: BattleCard[] };     // temporarily removed cards (flush to bench on sub-battle resolve)
  exile: { player: BattleCard[]; ai: BattleCard[] };          // permanently removed from game (persists across rounds)
  sealedBenchNames: { player: string[]; ai: string[] };       // bench names whose effects are disabled
  altBonus: number;                                           // extra ALT earned this match
  effectTelop: EffectTelop | null;                            // UI consumes & clears after 1.5s
  // Bench glow hint: set by bench-scanning effects. UI glows matching slots for ~1.5s then clears.
  benchGlow: { side: Side; names: string[]; key: number } | null;
  // Bench boost details: which bench cards contributed what bonuses (for power-up animation).
  benchBoostDetails: BenchBoostDetail[] | null;
  // How much power the last revealed attack card added (base + effects + auras, for UI display)
  lastRevealPowerAdded: number;
  // ===== Evolution / once-per-round tracking =====
  usedGiantSnake: { player: boolean; ai: boolean }; // 大蛇の呑み込み効果（1回戦1回）
  effectSuppressed: { player: boolean; ai: boolean }; // 聖女ジャンヌ「神の啓示」で相手効果をこのラウンド無効化
  // ===== Stage rules =====
  stageRules: StageRules | null;      // null = free battle (no stage rules)
  // ===== Round result =====
  roundWinner: Side | null;           // winner of the current round (set at round_end)
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

/** Get the bench max slots for a specific side, considering stage rules */
function getBenchMax(state: GameState, side: Side): number {
  if (!state.stageRules) return BENCH_MAX_SLOTS;
  if (side === 'player') return state.stageRules.benchLimit ?? BENCH_MAX_SLOTS;
  return state.stageRules.npcBenchSlots ?? BENCH_MAX_SLOTS;
}

function canAddToBench(bench: BenchSlot[], card: BattleCard, maxSlots: number = BENCH_MAX_SLOTS): boolean {
  if (bench.some((s) => s.name === card.name)) return true; // stack same-name
  return distinctCount(bench) < maxSlots;
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

export function initGameState(
  playerDeck: BattleCard[],
  aiDeck: BattleCard[],
  stageRules?: StageRules,
  totalRounds: number = TOTAL_ROUNDS,
): GameState {
  const trophyFans = Array.from({ length: totalRounds }, (_, i) => rollTrophyFans(i + 1, totalRounds));
  return {
    phase: 'deck_phase',
    totalRounds,
    round: 1,
    subBattleCount: 0,
    trophyFans,
    playerTrophies: 0,
    aiTrophies: 0,
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
    exile: { player: [], ai: [] },
    sealedBenchNames: { player: [], ai: [] },
    altBonus: 0,
    effectTelop: null,
    benchGlow: null,
    benchBoostDetails: null,
    lastRevealPowerAdded: 0,
    usedGiantSnake: { player: false, ai: false },
    effectSuppressed: { player: false, ai: false },
    stageRules: stageRules ?? null,
    roundWinner: null,
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

export function removeOneFromBench(bench: BenchSlot[], name: string): BenchSlot[] {
  return bench.flatMap((s) => {
    if (s.name !== name) return [s];
    if (s.count <= 1) return [];
    return [{ ...s, count: s.count - 1 }];
  });
}

/** Check if ロベン島 is protecting マンデラ from exile on the given side */
function hasRobbenIslandProtection(state: GameState, protectedSide: Side): boolean {
  const my = protectedSide === 'player' ? state.player : state.ai;
  const sealed = state.sealedBenchNames[protectedSide];
  return my.bench.some((b) => b.name === 'ロベン島' && !sealed.includes(b.name));
}

/** Check if 十二単 is protecting 紫式部 from exile on the given side */
function hasJunihitoeProtection(state: GameState, protectedSide: Side): boolean {
  const my = protectedSide === 'player' ? state.player : state.ai;
  const sealed = state.sealedBenchNames[protectedSide];
  return my.bench.some((b) => b.name === '十二単' && !sealed.includes(b.name));
}

/** Check if 安土城 is protecting 織田信長 from exile on the given side */
function hasAzuchiProtection(state: GameState, protectedSide: Side): boolean {
  const my = protectedSide === 'player' ? state.player : state.ai;
  const sealed = state.sealedBenchNames[protectedSide];
  return my.bench.some((b) => b.name === '安土城' && !sealed.includes(b.name));
}

/** Filter out protected cards from exile list (ロベン島 → マンデラ, 十二単 → 紫式部, 安土城 → 信長) */
function filterExileWithRobbenIsland(cards: BattleCard[], state: GameState, targetSide: Side): { exiled: BattleCard[]; protected: BattleCard[] } {
  const robben = hasRobbenIslandProtection(state, targetSide);
  const junihitoe = hasJunihitoeProtection(state, targetSide);
  const azuchi = hasAzuchiProtection(state, targetSide);
  if (!robben && !junihitoe && !azuchi) {
    return { exiled: cards, protected: [] };
  }
  const exiled: BattleCard[] = [];
  const saved: BattleCard[] = [];
  for (const c of cards) {
    if (robben && c.name === 'ネルソン・マンデラ') saved.push(c);
    else if (junihitoe && c.name === '紫式部') saved.push(c);
    else if (azuchi && c.name === '織田信長') saved.push(c);
    else exiled.push(c);
  }
  return { exiled, protected: saved };
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
  // 神の啓示（聖女ジャンヌ）で相手効果がこのラウンド中無効化されている場合は skip
  if (state.effectSuppressed[side] && effId !== 'saint_jeanne') {
    return {
      state,
      bonusAttack: 0,
      telop: { text: '✨ 神の加護により効果が封じられた', color: '#ffffff' },
    };
  }
  const opp = otherSide(side);
  const color = EFFECT_COLORS[card.effect.category];
  let next = state;
  let bonusAttack = 0;
  let telop: { text: string; color: string } | undefined;

  switch (effId) {
    case 'davinci': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasMona = my.bench.some((b) => b.name === 'モナ・リザ' && !sealed.includes(b.name));
      const hasSupper = my.bench.some((b) => b.name === '最後の晩餐' && !sealed.includes(b.name));

      // ===== 進化判定: モナ・リザ + 最後の晩餐 両方ベンチにあれば 万能の天才 に進化 =====
      if (hasMona && hasSupper) {
        const geniusTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '万能の天才');
        if (geniusTemplate) {
          const evolved: BattleCard = { ...geniusTemplate, id: `evolved-genius-${Date.now()}` };
          const newRevealed = next.attackRevealed.map((c) => c.id === card.id ? evolved : c);
          const oldAtk = getBaseAttack(card);
          const newAtk = getBaseAttack(evolved);
          next = {
            ...next,
            attackRevealed: newRevealed,
            attackCurrentPower: next.attackCurrentPower - oldAtk + newAtk,
          };
          next = withBenchGlow(next, side, ['モナ・リザ', '最後の晩餐']);
          // ルネサンスの光 自動発動: 味方全カード攻防+2 + 相手効果封印
          next = {
            ...next,
            roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 2 },
            defenderBonus: role === 'defender' ? next.defenderBonus + 2 : next.defenderBonus,
            effectSuppressed: { ...next.effectSuppressed, [opp]: true },
          };
          telop = { text: '🎨 ルネサンスの光！万能の天才が全てを照らす！', color: '#ffd700' };
          console.log('[Engine] レオナルド・ダ・ヴィンチ → 万能の天才に進化！');
          break;
        }
      }

      // ===== 非進化時: ベンチカードからのパッシブ加算 =====
      const supperCount = my.bench.find((b) => b.name === '最後の晩餐' && !sealed.includes(b.name))?.count ?? 0;
      const monaCount = my.bench.find((b) => b.name === 'モナ・リザ' && !sealed.includes(b.name))?.count ?? 0;
      const blueprintCount = my.bench.find((b) => b.name === '設計図' && !sealed.includes(b.name))?.count ?? 0;
      const glowNames: string[] = [];
      if (monaCount > 0) glowNames.push('モナ・リザ');
      if (supperCount > 0) glowNames.push('最後の晩餐');
      if (blueprintCount > 0) glowNames.push('設計図');
      if (glowNames.length > 0) next = withBenchGlow(next, side, glowNames);

      if (role === 'attacker') {
        const atk = supperCount * 2 + blueprintCount * 1;
        bonusAttack += atk;
        if (supperCount > 0) console.log(`[ベンチ効果] 最後の晩餐 → ダ・ヴィンチ 攻撃+${supperCount * 2}`);
        if (blueprintCount > 0) console.log(`[ベンチ効果] 設計図 → ダ・ヴィンチ 攻撃+${blueprintCount}`);
        telop = { text: `🎨 ダ・ヴィンチ！攻撃+${atk}`, color };
      } else {
        const def = monaCount * 2;
        if (def > 0) {
          next = { ...next, defenderBonus: next.defenderBonus + def };
          console.log(`[ベンチ効果] モナ・リザ → ダ・ヴィンチ 防御+${def}`);
        }
        telop = { text: `🎨 ダ・ヴィンチ！防御+${def}`, color };
      }
      break;
    }
    case 'genius': {
      // 万能の天才 が素で公開された場合（進化以外の経路）もルネサンスの光を発動
      next = {
        ...next,
        roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 2 },
        defenderBonus: role === 'defender' ? next.defenderBonus + 2 : next.defenderBonus,
        effectSuppressed: { ...next.effectSuppressed, [opp]: true },
      };
      telop = { text: '🎨 ルネサンスの光！万能の天才が全てを照らす！', color: '#ffd700' };
      break;
    }
    case 'mona_lisa': {
      telop = { text: '🖼️ モナ・リザ！ベンチでダ・ヴィンチの防御を強化', color };
      break;
    }
    case 'anatomy': {
      // 公開時、デッキ内のダ・ヴィンチ系1枚をデッキトップに移動（任意発動）
      const davinciFamily = new Set(['レオナルド・ダ・ヴィンチ', 'モナ・リザ', '最後の晩餐', '設計図', '鏡文字', '万能の天才', '飛行機械', 'ウィトルウィウス的人体図']);
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => davinciFamily.has(c.name));
      if (idx > 0) {
        const target = my.deck[idx];
        const newDeck = [...my.deck];
        newDeck.splice(idx, 1);
        newDeck.unshift(target);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: `🫀 人体の探求！${target.name}をデッキトップへ`, color };
      } else {
        telop = { text: '🫀 人体の探求（対象なし）', color };
      }
      break;
    }
    case 'mirror_writing': {
      // 公開時、相手の次のカード効果を無効化。pendingEffectSuppress として相手の次の1枚を封じる。
      // 既存の effectSuppressed はラウンド全体なので、ここでは「次の1枚だけ」を別管理するのが理想だが
      // 現在の engine には単発封印フラグがないため、相手の次の reveal 1枚のみ封じる近似として
      // effectSuppressed を立て、相手が効果解決したら reveal 側で 1回で解除する仕組みは未実装。
      // 簡易版: 相手の effectSuppressed を立てる（今ラウンド中、最初の1枚で解除される想定で描画）。
      next = { ...next, effectSuppressed: { ...next.effectSuppressed, [opp]: true } };
      telop = { text: '🪞 鏡文字！相手の次の効果を無効化', color };
      break;
    }
    case 'flying_machine': {
      // 攻撃・防御共通: 相手デッキトップ1枚を除外
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.deck.length > 0) {
        const [top, ...rest] = oppState.deck;
        const { exiled, protected: saved } = filterExileWithRobbenIsland([top], next, opp);
        next = applySide(next, opp, { ...oppState, deck: [...saved, ...rest] });
        if (exiled.length > 0) {
          next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], ...exiled] } };
        }
      }
      // 防御時は設計図ごとに+2
      if (role === 'defender') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const blueprintSlot = my.bench.find((b) => b.name === '設計図' && !sealed.includes(b.name));
        const count = blueprintSlot?.count ?? 0;
        if (count > 0) {
          next = withBenchGlow({ ...next, defenderBonus: next.defenderBonus + count * 2 }, side, ['設計図']);
          telop = { text: `✈️ 飛行機械！相手デッキ除外＋設計図${count}で防御+${count * 2}`, color };
        } else {
          telop = { text: '✈️ 飛行機械！相手デッキトップ1枚を除外', color };
        }
      } else {
        telop = { text: '✈️ 飛行機械！相手デッキトップ1枚を除外', color };
      }
      break;
    }
    case 'blueprint': {
      telop = { text: '📐 設計図！ベンチでダ・ヴィンチ系の攻撃を強化（重複可能）', color };
      break;
    }
    case 'last_supper': {
      telop = { text: '🍷 最後の晩餐！ベンチでダ・ヴィンチの攻撃を強化', color };
      break;
    }
    case 'vitruvian_man': {
      const davinciFamily = new Set(['レオナルド・ダ・ヴィンチ', 'モナ・リザ', '飛行機械', '設計図', '最後の晩餐', 'ウィトルウィウス的人体図']);
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const famSlots = my.bench.filter((b) => davinciFamily.has(b.name) && !sealed.includes(b.name));
      const total = famSlots.reduce((s, b) => s + b.count, 0);
      if (total > 0) {
        next = withBenchGlow(next, side, famSlots.map((b) => b.name));
        if (role === 'attacker') bonusAttack += total;
        else next = { ...next, defenderBonus: next.defenderBonus + total };
        telop = { text: `🧍 理想の調和！ダ・ヴィンチ系${total}枚で自身+${total}`, color };
      } else {
        telop = { text: '🧍 理想の調和（対象なし）', color };
      }
      break;
    }
    case 'einstein': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasRelativity = my.bench.some((b) => b.name === '相対性理論の論文' && !sealed.includes(b.name));
      const hasLightspeed = my.bench.some((b) => b.name === '光速' && !sealed.includes(b.name));
      const einsteinGlow: string[] = [];
      if (hasRelativity) einsteinGlow.push('相対性理論の論文');
      if (hasLightspeed) einsteinGlow.push('光速');
      if (einsteinGlow.length > 0) next = withBenchGlow(next, side, einsteinGlow);
      if (role === 'attacker') {
        const atkBonus = hasRelativity ? 4 : 0;
        bonusAttack += atkBonus;
        if (hasRelativity && hasLightspeed) {
          const oppState = opp === 'player' ? next.player : next.ai;
          const weakened = oppState.deck.map((c) => ({
            ...c,
            attackPower: Math.max(0, getBaseAttack(c) - 1),
          }));
          next = applySide(next, opp, { ...oppState, deck: weakened });
        }
        telop = { text: `🧠アインシュタイン天才の頭脳！攻撃+${atkBonus}`, color };
      } else {
        const defBonus = hasLightspeed ? 3 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        if (hasRelativity && hasLightspeed) {
          const oppState = opp === 'player' ? next.player : next.ai;
          const weakened = oppState.deck.map((c) => ({
            ...c,
            attackPower: Math.max(0, getBaseAttack(c) - 1),
          }));
          next = applySide(next, opp, { ...oppState, deck: weakened });
        }
        telop = { text: `🧠アインシュタイン天才の頭脳！防御+${defBonus}`, color };
      }
      break;
    }
    case 'curie': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasRadium = my.bench.some((b) => b.name === 'ラジウム' && !sealed.includes(b.name));
      const hasNotes = my.bench.some((b) => b.name === '研究ノート' && !sealed.includes(b.name));
      const curieGlow: string[] = [];
      if (hasRadium) curieGlow.push('ラジウム');
      if (hasNotes) curieGlow.push('研究ノート');
      if (curieGlow.length > 0) next = withBenchGlow(next, side, curieGlow);
      if (role === 'attacker') {
        const atkBonus = hasRadium ? 3 : 0;
        bonusAttack += atkBonus;
        telop = { text: `☢️キュリー夫人！攻撃+${atkBonus}`, color };
      } else {
        const defBonus = hasNotes ? 3 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `☢️キュリー夫人！防御+${defBonus}`, color };
      }
      break;
    }
    case 'napoleon': {
      // ナポレオン法典1枚につき防御+1（重複可能）、大砲1枚につき攻撃+1（重複可能）
      // アウステルリッツの太陽がベンチにあればナポレオン系効果を2倍
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const codeSlot = my.bench.find((b) => b.name === 'ナポレオン法典' && !sealed.includes(b.name));
      const codeCount = codeSlot?.count ?? 0;
      const cannonSlot = my.bench.find((b) => b.name === '大砲' && !sealed.includes(b.name));
      const cannonCount = cannonSlot?.count ?? 0;
      const hasAusterlitz = my.bench.some((b) => b.name === 'アウステルリッツの太陽' && !sealed.includes(b.name));
      const mult = hasAusterlitz ? 2 : 1;
      const napoleonGlow: string[] = [];
      if (codeCount > 0) napoleonGlow.push('ナポレオン法典');
      if (cannonCount > 0) napoleonGlow.push('大砲');
      if (hasAusterlitz) napoleonGlow.push('アウステルリッツの太陽');
      if (napoleonGlow.length > 0) next = withBenchGlow(next, side, napoleonGlow);
      if (role === 'attacker') {
        const atk = cannonCount * mult;
        if (atk > 0) {
          bonusAttack += atk;
          console.log(`[ベンチ効果] 大砲 → ナポレオン 攻撃+${atk}${hasAusterlitz ? ' (太陽×2)' : ''}`);
        }
        telop = { text: `⚡皇帝の号令！大砲${cannonCount}枚→攻撃+${atk}${hasAusterlitz ? ' ☀️×2' : ''}`, color };
      } else {
        const def = codeCount * mult;
        if (def > 0) {
          next = { ...next, defenderBonus: next.defenderBonus + def };
          console.log(`[ベンチ効果] ナポレオン法典 → ナポレオン 防御+${def}${hasAusterlitz ? ' (太陽×2)' : ''}`);
        }
        telop = { text: `⚡皇帝の号令！法典${codeCount}枚→防御+${def}${hasAusterlitz ? ' ☀️×2' : ''}`, color };
      }
      break;
    }
    case 'cleopatra': {
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.deck.length > 0) {
        const [top, ...rest] = oppState.deck;
        const { exiled, protected: saved } = filterExileWithRobbenIsland([top], next, opp);
        next = applySide(next, opp, { ...oppState, deck: [...saved, ...rest] });
        if (exiled.length > 0) {
          next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], ...exiled] } };
          telop = { text: '👑 魅了！相手デッキ上1枚を除外！', color };
        } else {
          telop = { text: '🏝️ ロベン島がマンデラを守った！', color };
        }
      }
      break;
    }
    case 'nobunaga': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasGun = my.bench.some((b) => b.name === '鉄砲' && !sealed.includes(b.name));
      const hasRakuichi = my.bench.some((b) => b.name === '楽市楽座' && !sealed.includes(b.name));
      const hasAtsumori = my.bench.some((b) => b.name === '敦盛の舞' && !sealed.includes(b.name));
      const ashigaruCount = my.bench.find((b) => b.name === '足軽' && !sealed.includes(b.name))?.count ?? 0;
      const gunCount = my.bench.find((b) => b.name === '鉄砲' && !sealed.includes(b.name))?.count ?? 0;
      const hasBaboSaku = my.bench.some((b) => b.name === '馬防柵' && !sealed.includes(b.name));
      const nobunagaGlow: string[] = [];
      if (hasGun) nobunagaGlow.push('鉄砲');
      if (hasRakuichi) nobunagaGlow.push('楽市楽座');
      if (hasAtsumori) nobunagaGlow.push('敦盛の舞');
      if (hasBaboSaku) nobunagaGlow.push('馬防柵');
      if (nobunagaGlow.length > 0) next = withBenchGlow(next, side, nobunagaGlow);
      if (role === 'attacker') {
        const atsumoriBonus = hasAtsumori ? 5 : 0;
        const atkBonus = (hasGun ? 3 : 0) + atsumoriBonus;
        bonusAttack += atkBonus;
        if (hasAtsumori) console.log(`[ベンチ効果] 敦盛の舞 → 織田信長 攻撃+${atsumoriBonus}`);
        if (hasGun && hasRakuichi) {
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            const target = oppState.bench[0];
            next = {
              ...next,
              sealedBenchNames: {
                ...next.sealedBenchNames,
                [opp]: [...next.sealedBenchNames[opp], target.name],
              },
            };
          }
        }
        telop = { text: `🔥信長天下布武！攻撃+${atkBonus}${hasGun && hasRakuichi ? ' 敵封印' : ''}`, color };
      } else {
        const baboDef = hasBaboSaku ? (ashigaruCount + gunCount) : 0;
        const defBonus = (hasRakuichi ? 2 : 0) + baboDef;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        if (hasBaboSaku && baboDef > 0) console.log(`[ベンチ効果] 馬防柵 → 織田信長 防御+${baboDef} (足軽${ashigaruCount}+鉄砲${gunCount})`);
        if (hasGun && hasRakuichi) {
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            const target = oppState.bench[0];
            next = {
              ...next,
              sealedBenchNames: {
                ...next.sealedBenchNames,
                [opp]: [...next.sealedBenchNames[opp], target.name],
              },
            };
          }
        }
        telop = { text: `🔥信長天下布武！防御+${defBonus}${hasGun && hasRakuichi ? ' 敵封印' : ''}`, color };
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
      // Combo: +1/+1 per 「地動説」 on own bench (stacks).
      const myState = side === 'player' ? next.player : next.ai;
      const oppState = opp === 'player' ? next.player : next.ai;
      const heliocentricSlot = myState.bench.find((b) => b.name === '地動説');
      const heliocentricCount = heliocentricSlot?.count ?? 0;
      if (heliocentricCount > 0 && role === 'attacker') {
        bonusAttack += heliocentricCount;
        next = withBenchGlow(next, side, ['地動説']);
      }
      if (heliocentricCount > 0 && role === 'defender') {
        next = { ...next, defenderBonus: next.defenderBonus + heliocentricCount };
        next = withBenchGlow(next, side, ['地動説']);
      }
      // Original bench-swap effect (kept).
      const sumOf = (bench: BenchSlot[]) =>
        bench.reduce((s, b) => s + getBaseAttack(b.card) * b.count, 0);
      if (sumOf(oppState.bench) > sumOf(myState.bench)) {
        const mine = { ...myState, bench: oppState.bench };
        const theirs = { ...oppState, bench: myState.bench };
        next = applySide(applySide(next, side, mine), opp, theirs);
        telop = heliocentricCount > 0
          ? { text: `🌍ガリレオ + 地動説×${heliocentricCount}！パワー+${heliocentricCount} & ベンチ入替`, color }
          : { text: '🌍ガリレオの地動説！ベンチ入れ替え', color };
      } else if (heliocentricCount > 0) {
        telop = { text: `🌍ガリレオ + 地動説×${heliocentricCount}！攻防+${heliocentricCount}`, color };
      } else {
        telop = { text: '🌍ガリレオの地動説！入れ替え見送り', color };
      }
      break;
    }
    case 'heliocentric': {
      // Passive bench effect — no reveal action. The bonus is read by Galileo.
      telop = { text: '🌌コペルニクスの真理！ベンチでガリレオを強化', color };
      break;
    }
    case 'piranha': {
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const same = myState.bench.find((b) => b.name === card.name);
        const copies = same?.count ?? 0;
        console.log(`[Engine]   piranha check: role=${role}, benchMatch="${same?.name ?? 'none'}", copies=${copies}, bench=[${myState.bench.map(b => `${b.name}×${b.count}`).join(', ')}]`);
        if (copies > 0) {
          bonusAttack += copies;
          telop = { text: `🐟ピラニアの群れの猛攻！攻撃+${copies}`, color };
        }
      }
      break;
    }
    case 'lion': {
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const creatureCount = myState.bench.filter((b) => b.card.category === 'creature' && !sealed.includes(b.name)).length;
        if (creatureCount > 0) {
          bonusAttack += creatureCount;
          telop = { text: `🦁百獣の王！生き物ベンチ${creatureCount}枚で攻撃+${creatureCount}`, color };
        }
      }
      break;
    }
    case 'book_burning': {
      // 焚書坑儒: ベンチの紙の枚数分だけ相手デッキから除外、始皇帝がベンチにいれば×2
      const oppState = opp === 'player' ? next.player : next.ai;
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const paperSlot = myState.bench.find((b) => b.name === '紙' && !sealed.includes(b.name));
      const paperCount = paperSlot?.count ?? 0;
      const hasQinshi = myState.bench.some((b) => b.name === '始皇帝' && !sealed.includes(b.name));
      const exileCount = paperCount * (hasQinshi ? 2 : 1);
      if (exileCount > 0) {
        const candidates = oppState.deck.slice(0, exileCount);
        const remaining = oppState.deck.slice(exileCount);
        const { exiled: toExile, protected: saved } = filterExileWithRobbenIsland(candidates, next, opp);
        if (candidates.length > 0) {
          next = applySide(next, opp, { ...oppState, deck: [...saved, ...remaining] });
          if (toExile.length > 0) {
            next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], ...toExile] } };
          }
          const glow = ['紙']; if (hasQinshi) glow.push('始皇帝');
          next = withBenchGlow(next, side, glow);
          const protectMsg = saved.length > 0 ? `（マンデラはロベン島が守った！）` : '';
          const multi = hasQinshi ? ` (紙${paperCount}×始皇帝=2倍)` : '';
          telop = { text: `📚 思想統制！${toExile.length}枚を除外！${multi}${protectMsg}`, color };
          console.log(`[特殊効果] 焚書坑儒: 紙${paperCount}枚${hasQinshi ? '+始皇帝×2' : ''} → ${toExile.length}枚除外`);
        }
      } else {
        telop = { text: '📚 焚書坑儒（ベンチに紙がありません）', color };
      }
      break;
    }
    case 'elixir': {
      // 不老不死の薬: passive bench effect (no reveal action)
      telop = { text: '💊不老不死の薬！始皇帝の復活を守る', color };
      break;
    }
    case 'photosynthesis': {
      // 光合成「密林の再生」: ベンチのアマゾン種族1枚をデッキ一番上に戻す
      const amazonNames = new Set(['ピラニア', 'アナコンダ', '毒矢カエル', '大蛇']);
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const amazonSlot = my.bench.find((b) => amazonNames.has(b.name) && !sealed.includes(b.name));
      if (amazonSlot) {
        // Remove one copy from bench, put on top of deck
        const newBench = removeOneFromBench(my.bench, amazonSlot.name);
        const newDeck = [amazonSlot.card, ...my.deck];
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        next = withBenchGlow(next, side, [amazonSlot.name]);
        telop = { text: `🌿 密林の再生！${amazonSlot.name}をデッキ上に回収`, color };
      } else {
        telop = { text: '🌿 密林の再生（対象なし）', color };
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
      // Combo: search own deck for 地動説; if found, move it to the top.
      const myState = side === 'player' ? next.player : next.ai;
      const idx = myState.deck.findIndex((c) => c.name === '地動説');
      if (idx > 0) {
        const newDeck = [...myState.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...myState, deck: newDeck });
        telop = { text: '🔭望遠鏡の天体観測！地動説をデッキトップへ', color };
      } else if (idx === 0) {
        telop = { text: '🔭望遠鏡の天体観測！地動説は既にトップ', color };
      } else {
        telop = { text: '🔭望遠鏡の天体観測！対象なし', color };
      }
      break;
    }
    case 'gunpowder': {
      // Material card — consumed by Cannon/Dynamite on reveal. No passive effect.
      telop = { text: '💥火薬！素材カード（大砲・ダイナマイトの発動コスト）', color };
      break;
    }
    case 'dynamite': {
      // 任意発動: consume 1 火薬 from bench for +2 attack.
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const gunpowderSlot = myState.bench.find((b) => b.name === '火薬' && !sealed.includes(b.name));
        if (gunpowderSlot) {
          bonusAttack += 2;
          const newBench = removeOneFromBench(myState.bench, '火薬');
          next = applySide(
            { ...next, exile: { ...next.exile, [side]: [...next.exile[side], gunpowderSlot.card] } },
            side,
            { ...myState, bench: newBench },
          );
          next = withBenchGlow(next, side, ['火薬']);
          telop = { text: '💣ダイナマイト！火薬1枚を除外して攻撃+2', color };
        } else {
          telop = { text: '💣ダイナマイト（火薬なし）', color };
        }
      }
      break;
    }
    case 'compass': {
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => c.name === 'コロンブス' || c.name === 'マゼラン');
      if (idx > 2) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.splice(2, 0, moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: `🧭羅針盤の航海術！${moved.name}を3枚以内に`, color };
      } else if (idx >= 0) {
        telop = { text: '🧭羅針盤の航海術！既に近い', color };
      } else {
        telop = { text: '🧭羅針盤の航海術！対象なし', color };
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
      // 紙: 除外カード1枚をデッキトップに戻す（プレイヤーはUI選択、AIは自動）
      const myExile = next.exile[side];
      if (myExile.length > 0) {
        if (side === 'ai') {
          // AI: return strongest exiled card
          const best = myExile.reduce((a, b) => {
            const ap = (a.attackPower ?? a.power) + (a.defensePower ?? a.power);
            const bp = (b.attackPower ?? b.power) + (b.defensePower ?? b.power);
            return ap >= bp ? a : b;
          });
          const myState = next.ai; // side is 'ai' here
          next = applySide(next, side, { ...myState, deck: [best, ...myState.deck] });
          next = { ...next, exile: { ...next.exile, [side]: myExile.filter((c) => c.id !== best.id) } };
          telop = { text: `📜 記録の復元！${best.name}をデッキトップへ！`, color: '#ffd700' };
        } else {
          // Player: UI selection handled in battle loop
          telop = { text: '📜 紙の記録！除外カードを復元...', color };
        }
      } else {
        telop = { text: '📜 紙の記録（除外カードがありません）', color };
      }
      break;
    }
    // ===== 追加コンボ効果 =====
    case 'edison': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasBulb = my.bench.some((b) => b.name === '電球' && !sealed.includes(b.name));
      const hasPhono = my.bench.some((b) => b.name === '蓄音機' && !sealed.includes(b.name));
      const glowNames: string[] = [];
      if (hasBulb) glowNames.push('電球');
      if (hasPhono) glowNames.push('蓄音機');
      if (role === 'attacker') {
        let bonus = (hasBulb ? 1 : 0) + (hasPhono ? 1 : 0);
        if (hasBulb && hasPhono) bonus += 3;
        bonusAttack += bonus;
        if (bonus > 0) {
          next = withBenchGlow(next, side, glowNames);
          telop = { text: `📋 ${glowNames.join('・')} のベンチ効果！エジソン 攻撃+${bonus}`, color };
        }
      } else {
        if (hasPhono) {
          next = withBenchGlow({ ...next, defenderBonus: next.defenderBonus + 2 }, side, ['蓄音機']);
          telop = { text: '📋 蓄音機のベンチ効果！エジソン 防御+2', color };
        }
      }
      break;
    }
    case 'phonograph': {
      telop = { text: '🎙️蓄音機！ベンチでエジソンを強化', color };
      break;
    }
    case 'darwin': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const creatureSlots = my.bench.filter((b) => !sealed.includes(b.name) && b.card.category === 'creature');
      const creatureNamesSet: Record<string, true> = {};
      creatureSlots.forEach((b) => { creatureNamesSet[b.name] = true; });
      const creatureNames = Object.keys(creatureNamesSet);
      const n = creatureNames.length;
      const hasTortoise = creatureNames.includes('ゾウガメ');
      const hasFinch = creatureNames.includes('ダーウィンフィンチ');
      if (role === 'attacker') {
        const total = n + (hasFinch ? 2 : 0);
        bonusAttack += total;
        if (total > 0) next = withBenchGlow(next, side, creatureNames);
        telop = { text: `📋 生き物のベンチ効果！ダーウィン 攻撃+${total}`, color };
      } else {
        const total = n + (hasTortoise ? 2 : 0);
        next = { ...next, defenderBonus: next.defenderBonus + total };
        if (total > 0) next = withBenchGlow(next, side, creatureNames);
        telop = { text: `📋 生き物のベンチ効果！ダーウィン 防御+${total}`, color };
      }
      break;
    }
    case 'tortoise': case 'finch': {
      telop = { text: '🐢ガラパゴスの生き物！ダーウィンを強化', color };
      break;
    }
    case 'glider': {
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => c.name === 'ライト兄弟');
      if (idx > 2) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.splice(2, 0, moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: '🛩️グライダー！ライト兄弟を3枚以内に', color };
      } else {
        telop = { text: '🛩️グライダー！滑空試験', color };
      }
      break;
    }
    case 'wind_tunnel': {
      // 公開時：相手デッキ上2枚を除外
      const oppState = opp === 'player' ? next.player : next.ai;
      const candidates = oppState.deck.slice(0, 2);
      let windExileCount = 0;
      if (candidates.length > 0) {
        const { exiled: slice, protected: saved } = filterExileWithRobbenIsland(candidates, next, opp);
        windExileCount = slice.length;
        next = applySide(next, opp, { ...oppState, deck: [...saved, ...oppState.deck.slice(candidates.length)] });
        if (slice.length > 0) {
          next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], ...slice] } };
        }
      }
      telop = { text: `💨 風洞実験！相手デッキ上${windExileCount}枚を除外！`, color };
      break;
    }
    case 'wright_bros': {
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasGlider = my.bench.some((b) => b.name === 'グライダー' && !sealed.includes(b.name));
        const hasWT = my.bench.some((b) => b.name === '風洞' && !sealed.includes(b.name));
        let bonus = 0;
        if (hasGlider || hasWT) bonus += 3;
        if (hasWT) bonus += 2;
        bonusAttack += bonus;
        telop = { text: `✈️ライト兄弟初飛行！攻撃+${bonus}`, color };
      }
      break;
    }
    case 'plague': {
      const oppState = opp === 'player' ? next.player : next.ai;
      const names = oppState.bench.map((b) => b.name);
      next = {
        ...next,
        sealedBenchNames: {
          ...next.sealedBenchNames,
          [opp]: [...next.sealedBenchNames[opp], ...names],
        },
      };
      telop = { text: '🦠ペスト菌！相手ベンチ効果を封印', color };
      break;
    }
    case 'serum': {
      telop = { text: '💉血清！味方の防御を強化', color };
      break;
    }
    case 'kitasato': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasPlague = my.bench.some((b) => b.name === 'ペスト菌' && !sealed.includes(b.name));
      const hasSerum = my.bench.some((b) => b.name === '血清' && !sealed.includes(b.name));
      if (hasPlague && hasSerum && role === 'defender') {
        next = {
          ...next,
          defenderBonus: next.defenderBonus + 5,
          sealedBenchNames: { player: [], ai: [] },
        };
        telop = { text: '🧫北里柴三郎！防御+5 & 封印全解除', color };
      } else {
        telop = { text: '🧫北里柴三郎！医学の父', color };
      }
      break;
    }
    case 'terracotta': {
      telop = { text: '🗿兵馬俑！始皇帝を守護', color };
      break;
    }
    case 'qinshi': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const heritageCount = my.bench
        .filter((b) => !sealed.includes(b.name) && b.card.category === 'heritage')
        .reduce((s, b) => s + b.count, 0);
      if (role === 'attacker') {
        bonusAttack += heritageCount * 2;
        telop = { text: `👑始皇帝天下統一！攻撃+${heritageCount * 2}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + heritageCount };
        telop = { text: `👑始皇帝天下統一！防御+${heritageCount}`, color };
      }
      break;
    }
    case 'amazon_river': {
      // 密林の大河: デッキ内のピラニア・アナコンダ・毒矢カエルを1枚デッキトップに置く
      const amazonTargets = new Set(['ピラニア', 'アナコンダ', '毒矢カエル']);
      const myState = side === 'player' ? next.player : next.ai;
      const targetIdx = myState.deck.findIndex((c) => amazonTargets.has(c.name));
      if (targetIdx >= 0) {
        const target = myState.deck[targetIdx];
        const newDeck = [...myState.deck];
        newDeck.splice(targetIdx, 1);
        newDeck.unshift(target); // place on top
        next = applySide(next, side, { ...myState, deck: newDeck });
        telop = { text: `🏞️ 密林の大河！${target.name}をデッキトップへ！`, color: '#ffd700' };
      } else {
        telop = { text: '🏞️ 密林の大河（対象カードがありません）', color };
      }
      break;
    }
    case 'anaconda': {
      if (role === 'attacker') {
        next = { ...next, defenderBonus: next.defenderBonus - 2 };
        // Check evolution: ベンチに毒矢カエル+ピラニアの両方がいれば大蛇に進化
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const benchNames = new Set(my.bench.filter((b) => !sealed.includes(b.name)).map((b) => b.name));
        if (benchNames.has('毒矢カエル') && benchNames.has('ピラニア')) {
          // Evolve: replace アナコンダ in attackRevealed with 大蛇
          const giantSnakeTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '大蛇');
          if (giantSnakeTemplate) {
            const evolved: BattleCard = { ...giantSnakeTemplate, id: `evolved-giant-snake-${Date.now()}` };
            const newRevealed = next.attackRevealed.map((c) => c.id === card.id ? evolved : c);
            // Recalculate power: remove anaconda's attack, add giant snake's attack
            const oldAtk = getBaseAttack(card);
            const newAtk = getBaseAttack(evolved);
            next = {
              ...next,
              attackRevealed: newRevealed,
              attackCurrentPower: next.attackCurrentPower - oldAtk + newAtk,
            };
            // Glow the bench cards that triggered evolution
            next = withBenchGlow(next, side, ['毒矢カエル', 'ピラニア']);
            telop = { text: '🐍 進化！アナコンダ → 大蛇！', color: '#ffd700' };
            console.log('[Engine] アナコンダ → 大蛇に進化！');
          } else {
            telop = { text: '🐍アナコンダ締めつけ！敵防御-2', color };
          }
        } else {
          telop = { text: '🐍アナコンダ締めつけ！敵防御-2', color };
        }
      }
      break;
    }
    case 'giant_snake': {
      // 大蛇「呑み込む者」: ベンチにある攻撃力2のカード1枚につき攻撃+1/防御+1
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      let atk2Count = 0;
      for (const slot of myState.bench) {
        if (sealed.includes(slot.name)) continue;
        const slotAtk = slot.card.attackPower ?? slot.card.power;
        if (slotAtk === 2) atk2Count += slot.count; // count stacked copies individually
      }
      if (atk2Count > 0) {
        if (role === 'attacker') {
          bonusAttack += atk2Count;
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + atk2Count };
        }
        telop = { text: `🐍 呑み込む者！攻撃力2カード${atk2Count}枚 → ${role === 'attacker' ? `攻撃+${atk2Count}` : `防御+${atk2Count}`}`, color: '#ffd700' };
      } else {
        telop = { text: '🐍 呑み込む者（対象なし）', color };
      }
      break;
    }
    case 'anaconda_hunter': {
      // 蛇使い: ベンチのアナコンダ1枚をデッキの一番上に戻す
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const anacondaSlot = my.bench.find((b) => b.name === 'アナコンダ' && !sealed.includes(b.name));
      if (anacondaSlot) {
        const newBench = removeOneFromBench(my.bench, 'アナコンダ');
        const newDeck = [anacondaSlot.card, ...my.deck];
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        next = withBenchGlow(next, side, ['アナコンダ']);
        telop = { text: '🐍 蛇使い！アナコンダをデッキトップへ！', color: '#ffd700' };
      } else {
        telop = { text: '🐍 蛇使い（ベンチにアナコンダがいません）', color };
      }
      break;
    }
    case 'poison_frog': {
      // 毒矢カエル: 相手ベンチ1枚を除外（プレイヤー側はUI選択、AI側は自動選択）
      const oppState = opp === 'player' ? next.player : next.ai;
      if (oppState.bench.length > 0) {
        if (side === 'ai') {
          // AI: auto-select weakest bench card to exile (skip マンデラ if ロベン島 protects)
          let candidates = oppState.bench;
          if (hasRobbenIslandProtection(next, opp)) {
            candidates = candidates.filter((b) => b.name !== 'ネルソン・マンデラ');
          }
          if (candidates.length > 0) {
            const target = candidates.reduce((a, b) => {
              const aPow = (a.card.attackPower ?? a.card.power) + (a.card.defensePower ?? a.card.power);
              const bPow = (b.card.attackPower ?? b.card.power) + (b.card.defensePower ?? b.card.power);
              return aPow <= bPow ? a : b;
            });
            const newBench = removeOneFromBench(oppState.bench, target.name);
            next = applySide(next, opp, { ...oppState, bench: newBench });
            next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], target.card] } };
            telop = { text: `🐸 猛毒！${target.name}を除外！`, color };
          } else {
            telop = { text: '🏝️ ロベン島がマンデラを守った！', color };
          }
        } else {
          // Player: UI selection handled in battle loop
          telop = { text: '🐸 毒矢カエル！相手ベンチから除外...', color };
        }
      } else {
        telop = { text: '🐸 毒矢カエル（相手ベンチにカードがありません）', color };
      }
      break;
    }
    case 'apple': {
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => c.name === 'ニュートン');
      if (idx > 0) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: '🍎リンゴ！ニュートンをデッキ上へ', color };
      } else {
        telop = { text: '🍎リンゴ！落下', color };
      }
      break;
    }
    case 'prism': case 'gravity': {
      telop = { text: '🔮ニュートンを強化', color };
      break;
    }
    case 'newton': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasApple = my.bench.some((b) => b.name === 'リンゴ' && !sealed.includes(b.name));
      const hasPrism = my.bench.some((b) => b.name === 'プリズム' && !sealed.includes(b.name));
      const hasGrav = my.bench.some((b) => b.name === '万有引力' && !sealed.includes(b.name));
      const newtonGlow: string[] = [];
      if (hasApple) newtonGlow.push('リンゴ');
      if (hasPrism) newtonGlow.push('プリズム');
      if (hasGrav) newtonGlow.push('万有引力');
      if (newtonGlow.length > 0) next = withBenchGlow(next, side, newtonGlow);
      const types = (hasApple ? 1 : 0) + (hasPrism ? 1 : 0) + (hasGrav ? 1 : 0);
      const tier = types === 1 ? 1 : types === 2 ? 3 : types === 3 ? 5 : 0;
      if (role === 'attacker') {
        const total = tier + (hasPrism ? 2 : 0);
        bonusAttack += total;
        if (hasPrism) {
          // 相手防御効果無効：デバフ消去
          next = { ...next, defenderBonus: Math.min(0, next.defenderBonus) };
        }
        if (types === 3) {
          const oppState = opp === 'player' ? next.player : next.ai;
          next = {
            ...next,
            sealedBenchNames: {
              ...next.sealedBenchNames,
              [opp]: [...next.sealedBenchNames[opp], ...oppState.bench.map((b) => b.name)],
            },
          };
        }
        telop = { text: `🧠ニュートンプリンキピア！攻撃+${total}`, color };
      } else {
        const total = tier + (hasGrav ? 2 : 0);
        next = { ...next, defenderBonus: next.defenderBonus + total };
        telop = { text: `🧠ニュートンプリンキピア！防御+${total}`, color };
      }
      break;
    }
    case 'printing_press': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasBible = my.bench.some((b) => b.name === '聖書' && !sealed.includes(b.name));
      const n = hasBible ? 4 : 3;
      if (my.deck.length >= 2) {
        const topN = my.deck.slice(0, n);
        const sorted = [...topN].sort((a, b) => getBaseAttack(b) - getBaseAttack(a));
        next = applySide(next, side, { ...my, deck: [...sorted, ...my.deck.slice(n)] });
        telop = { text: `📖活版印刷！上${n}枚を並び替え`, color };
      }
      break;
    }
    case 'bible': {
      telop = { text: '✝️聖書！味方防御を強化', color };
      break;
    }
    case 'indulgence': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasLuther = my.bench.some((b) => b.name === 'ルター' && !sealed.includes(b.name));
      if (hasLuther) {
        telop = { text: '📜免罪符！ルターが封じた', color };
      } else if (my.bench.length > 0) {
        const strongest = [...my.bench].sort(
          (a, b) => getBaseAttack(b.card) - getBaseAttack(a.card),
        )[0];
        const newBench = removeOneFromBench(my.bench, strongest.name);
        next = applySide(next, side, { ...my, bench: newBench, deck: [...my.deck, strongest.card] });
        telop = { text: `📜免罪符！${strongest.name}をデッキへ`, color };
      }
      break;
    }
    case 'luther': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasBible = my.bench.some((b) => b.name === '聖書' && !sealed.includes(b.name));
      const hasPress = my.bench.some((b) => b.name === '活版印刷機' && !sealed.includes(b.name));
      if (hasBible && hasPress) {
        if (role === 'attacker') {
          bonusAttack += 5;
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            const target = oppState.bench[0];
            const newBench = removeOneFromBench(oppState.bench, target.name);
            next = applySide(
              {
                ...next,
                quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], target.card] },
              },
              opp,
              { ...oppState, bench: newBench },
            );
          }
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + 3 };
        }
        telop = { text: '📖ルター95ヶ条！最大強化', color };
      } else if (hasBible || hasPress) {
        if (role === 'attacker') bonusAttack += 2;
        else next = { ...next, defenderBonus: next.defenderBonus + 2 };
        telop = { text: '📖ルター！強化+2', color };
      } else {
        telop = { text: '📖ルター！宗教改革', color };
      }
      break;
    }
    case 'sunflower': case 'starry_night': case 'cypress': {
      telop = { text: '🎨ゴッホの画材', color };
      break;
    }
    case 'gogh': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasS = my.bench.some((b) => b.name === 'ひまわり' && !sealed.includes(b.name));
      const hasStar = my.bench.some((b) => b.name === '星月夜' && !sealed.includes(b.name));
      const hasCyp = my.bench.some((b) => b.name === '糸杉' && !sealed.includes(b.name));
      const goghGlow: string[] = [];
      if (hasS) goghGlow.push('ひまわり');
      if (hasStar) goghGlow.push('星月夜');
      if (hasCyp) goghGlow.push('糸杉');
      if (goghGlow.length > 0) next = withBenchGlow(next, side, goghGlow);
      const types = (hasS ? 1 : 0) + (hasStar ? 1 : 0) + (hasCyp ? 1 : 0);
      const atkTier = types === 1 ? 2 : types === 2 ? 4 : types === 3 ? 6 : 0;
      const defTier = types === 2 ? 2 : types === 3 ? 4 : 0;
      if (role === 'attacker') {
        const total = atkTier + (hasS ? 2 : 0);
        bonusAttack += total;
        if (types === 3) {
          const oppState = opp === 'player' ? next.player : next.ai;
          next = {
            ...next,
            sealedBenchNames: {
              ...next.sealedBenchNames,
              [opp]: [...next.sealedBenchNames[opp], ...oppState.bench.map((b) => b.name)],
            },
          };
        }
        telop = { text: `🎨ゴッホ炎の画家！攻撃+${total}`, color };
      } else {
        const total = defTier + (hasStar ? 2 : 0);
        next = { ...next, defenderBonus: next.defenderBonus + total };
        telop = { text: `🎨ゴッホ炎の画家！防御+${total}`, color };
      }
      break;
    }
    case 'holy_sword': case 'banner': {
      telop = { text: '⚔️ジャンヌの装備', color };
      break;
    }
    case 'lily_shield': {
      telop = { text: '🛡️百合の守り', color };
      break;
    }
    case 'jeanne': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSword = my.bench.some((b) => b.name === '聖剣' && !sealed.includes(b.name));
      const hasBanner = my.bench.some((b) => b.name === '軍旗' && !sealed.includes(b.name));
      const hasLilyShield = my.bench.some((b) => b.name === '白百合の盾' && !sealed.includes(b.name));
      const jeanneGlow: string[] = [];
      if (hasSword) jeanneGlow.push('聖剣');
      if (hasBanner) jeanneGlow.push('軍旗');
      if (hasLilyShield) jeanneGlow.push('白百合の盾');
      if (jeanneGlow.length > 0) next = withBenchGlow(next, side, jeanneGlow);
      const lilyDefBonus = hasLilyShield ? 2 : 0;
      if (hasSword && hasBanner) {
        if (role === 'attacker') {
          bonusAttack += 4;
          const oppState = opp === 'player' ? next.player : next.ai;
          if (oppState.bench.length > 0) {
            next = {
              ...next,
              sealedBenchNames: {
                ...next.sealedBenchNames,
                [opp]: [...next.sealedBenchNames[opp], oppState.bench[0].name],
              },
            };
          }
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + 4 + lilyDefBonus };
        }
        telop = { text: hasLilyShield ? `⚜️オルレアンの乙女！攻防+4＋百合の守り防御+${lilyDefBonus}` : '⚜️オルレアンの乙女！攻防+4', color };
      } else if (hasSword) {
        if (role === 'attacker') bonusAttack += 3;
        else if (lilyDefBonus > 0) next = { ...next, defenderBonus: next.defenderBonus + lilyDefBonus };
        telop = { text: '⚔️聖剣の加護！攻撃+3', color };
      } else if (hasBanner) {
        if (role === 'defender') next = { ...next, defenderBonus: next.defenderBonus + 3 + lilyDefBonus };
        telop = { text: hasLilyShield ? `🚩軍旗の加護！防御+3＋百合の守り防御+${lilyDefBonus}` : '🚩軍旗の加護！防御+3', color };
      } else {
        if (role === 'defender' && lilyDefBonus > 0) next = { ...next, defenderBonus: next.defenderBonus + lilyDefBonus };
        telop = { text: hasLilyShield ? `🛡️百合の守り！ジャンヌの防御+${lilyDefBonus}` : '⚜️ジャンヌ・ダルク！', color };
      }
      break;
    }
    case 'burning_stake': {
      // 殉教の炎: ベンチのジャンヌ・ダルクを除外して、火刑自体を聖女ジャンヌに変身させる。
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const jeanneSlot = my.bench.find((b) => b.name === 'ジャンヌ・ダルク' && !sealed.includes(b.name));
      if (!jeanneSlot) {
        telop = { text: 'ベンチにジャンヌがいません', color };
        break;
      }
      const saintTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '聖女ジャンヌ');
      if (!saintTemplate) {
        telop = { text: 'ベンチにジャンヌがいません', color };
        break;
      }
      // 1. ベンチからジャンヌを1枚除外
      const newBench = removeOneFromBench(my.bench, 'ジャンヌ・ダルク');
      next = applySide(
        { ...next, exile: { ...next.exile, [side]: [...next.exile[side], jeanneSlot.card] } },
        side,
        { ...my, bench: newBench },
      );
      // 2. 火刑自体を聖女ジャンヌに変身させる（attackRevealed 内で差し替え）
      const transformed: BattleCard = { ...saintTemplate, id: `evolved-saint-jeanne-${Date.now()}` };
      const newRevealed = next.attackRevealed.map((c) => c.id === card.id ? transformed : c);
      const oldAtk = getBaseAttack(card);
      const newAtk = getBaseAttack(transformed);
      next = {
        ...next,
        attackRevealed: newRevealed,
        attackCurrentPower: role === 'attacker' ? next.attackCurrentPower - oldAtk + newAtk : next.attackCurrentPower,
      };
      // 3. 聖女ジャンヌの効果「救国の祈り」を即座に適用
      // 3a. 味方除外カードを全てデッキに戻す
      const exiledForSide = next.exile[side];
      const recoveredCount = exiledForSide.length;
      if (recoveredCount > 0) {
        next = {
          ...next,
          exile: { ...next.exile, [side]: [] },
        };
        const mySideNow = side === 'player' ? next.player : next.ai;
        next = applySide(next, side, { ...mySideNow, deck: [...mySideNow.deck, ...exiledForSide] });
      }
      // 3b. 相手防御-3
      if (role === 'attacker') {
        next = { ...next, defenderBonus: next.defenderBonus - 3 };
      } else {
        next = {
          ...next,
          roundAttackBonus: {
            ...next.roundAttackBonus,
            [opp]: next.roundAttackBonus[opp] - 3,
          },
        };
      }
      telop = { text: '🔥 殉教の炎！ジャンヌが炎に包まれ…聖女として蘇る！', color: '#ffffff' };
      console.log(`[Engine] 火刑 → 聖女ジャンヌに変身！ジャンヌを除外、除外回収=${recoveredCount}枚`);
      break;
    }
    case 'honnoji': {
      // 本能寺の変（任意発動・ベンチに織田信長が必要）
      // 1. 自分ベンチから織田信長を除外
      // 2. 自分のベンチのみ全除外（相手ベンチは触らない）
      // 3. 自分のデッキを全削除 → 明智光秀・愛宕百韻・天王山・三日天下の4枚に再構成
      const my = side === 'player' ? next.player : next.ai;
      const nobunagaSlot = my.bench.find((b) => b.name === '織田信長' && !next.sealedBenchNames[side].includes(b.name));
      if (!nobunagaSlot) {
        telop = { text: '本能寺の変（ベンチに織田信長がいません）', color };
        break;
      }
      // Step 1+2: remove 織田信長 from bench + exile ALL own bench
      const newExileSelf = [...next.exile[side], nobunagaSlot.card];
      const benchAfterNobunaga = removeOneFromBench(my.bench, '織田信長');
      for (const slot of benchAfterNobunaga) {
        for (let i = 0; i < slot.count; i++) newExileSelf.push(slot.card);
      }
      // Step 3: rebuild own deck with 4 明智ルート cards (old deck discarded)
      const akechiNames = ['明智光秀', '愛宕百韻', '天王山', '三日天下'];
      const newDeck: BattleCard[] = [];
      const stamp = Date.now();
      for (const name of akechiNames) {
        const tmpl = ALL_BATTLE_CARDS.find((c) => c.name === name);
        if (tmpl) newDeck.push({ ...tmpl, id: `evolved-akechi-${tmpl.id}-${stamp}-${newDeck.length}` });
      }
      next = { ...next, exile: { ...next.exile, [side]: newExileSelf } };
      next = applySide(next, side, { ...my, bench: [], deck: newDeck });
      telop = { text: '⚡ 灰からの継承！本能寺で信長が散り、明智の時代が始まる！', color: '#ffd700' };
      console.log('[特殊効果] 本能寺の変: 信長+自ベンチ全除外、デッキを明智ルート4枚に再構成');
      break;
    }
    case 'akechi_mitsuhide': {
      // 明智光秀: 相手ベンチ2枚除外 + ベンチに三日天下で攻防+3
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasMikka = my.bench.some((b) => b.name === '三日天下' && !sealed.includes(b.name));
      // ベンチバフ: 愛宕百韻(+3atk) + 天王山(+2atk,+2def) + 三日天下(+3atk,+3def)
      const atagoCount = my.bench.find((b) => b.name === '愛宕百韻' && !sealed.includes(b.name))?.count ?? 0;
      const tennouzanCount = my.bench.find((b) => b.name === '天王山' && !sealed.includes(b.name))?.count ?? 0;
      const glowNames: string[] = [];
      let atkBuff = 0; let defBuff = 0;
      if (atagoCount > 0) { atkBuff += 3; glowNames.push('愛宕百韻'); }
      if (tennouzanCount > 0) { atkBuff += 2; defBuff += 2; glowNames.push('天王山'); }
      if (hasMikka) { atkBuff += 3; defBuff += 3; glowNames.push('三日天下'); }
      if (glowNames.length > 0) next = withBenchGlow(next, side, glowNames);
      if (role === 'attacker') bonusAttack += atkBuff;
      else next = { ...next, defenderBonus: next.defenderBonus + defBuff };
      // 相手ベンチから最大2枚除外
      const oppState = opp === 'player' ? next.player : next.ai;
      const removable = oppState.bench.slice(0, 2);
      let removedCount = 0;
      let oppBench = [...oppState.bench];
      const oppExile = [...next.exile[opp]];
      for (const slot of removable) {
        const newB = removeOneFromBench(oppBench, slot.name);
        if (newB.length < oppBench.length || newB.some((b) => b.name === slot.name && b.count < (oppBench.find((ob) => ob.name === slot.name)?.count ?? 0))) {
          oppExile.push(slot.card);
          oppBench = newB;
          removedCount++;
        }
      }
      next = { ...next, exile: { ...next.exile, [opp]: oppExile } };
      next = applySide(next, opp, { ...oppState, bench: oppBench });
      telop = { text: `⚔️ 明智光秀！攻+${atkBuff}/防+${defBuff}${removedCount > 0 ? ` 相手ベンチ${removedCount}枚除外` : ''}`, color: '#ffd700' };
      console.log(`[特殊効果] 明智光秀: 攻+${atkBuff}/防+${defBuff}, 相手ベンチ${removedCount}枚除外`);
      break;
    }
    case 'atago_hyakuin': {
      telop = { text: '📜 愛宕百韻！ベンチで明智光秀の攻撃+3', color };
      break;
    }
    case 'tennouzan': {
      telop = { text: '⛰️ 天王山！ベンチで明智光秀の攻防+2', color };
      break;
    }
    case 'mikka_tenka': {
      // 三日天下: ベンチの明智光秀をデッキトップに戻す（任意発動）
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const akechiSlot = my.bench.find((b) => b.name === '明智光秀' && !sealed.includes(b.name));
      if (akechiSlot) {
        const newBench = removeOneFromBench(my.bench, '明智光秀');
        const newDeck = [akechiSlot.card, ...my.deck];
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        next = withBenchGlow(next, side, ['明智光秀']);
        telop = { text: '👑 三日天下！明智光秀をデッキトップに回収', color };
      } else {
        telop = { text: '👑 三日天下（ベンチに明智光秀がいません）', color };
      }
      console.log('[特殊効果] 三日天下: 明智光秀をデッキトップに回収');
      break;
    }
    case 'austerlitz_sun': {
      // 公開時の即時効果としては「ベンチに居ればナポレオン系効果2倍」のフックを
      // napoleon case に組み込んでいるため、ここは演出のみ。
      telop = { text: '☀️ 三帝会戦の陽光！ナポレオン系の効果が倍化する！', color: '#ffd700' };
      console.log('[特殊効果] アウステルリッツの太陽: ナポレオン系効果2倍 (napoleon case でフック)');
      break;
    }
    case 'moonlit_howl': {
      // 除外オオカミ系全回収 + ベンチのオオカミ系1枚につき攻防+2
      const wolfFamily = new Set(['オオカミ', '遠吠え', '群れの掟', '縄張り', '一匹狼', '月下の遠吠え']);
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      // 1. 除外オオカミ系回収
      const exilePool = next.exile[side];
      const recovered = exilePool.filter((c) => wolfFamily.has(c.name));
      const remainingExile = exilePool.filter((c) => !wolfFamily.has(c.name));
      if (recovered.length > 0) {
        next = {
          ...next,
          exile: { ...next.exile, [side]: remainingExile },
        };
        const mySideNow = side === 'player' ? next.player : next.ai;
        next = applySide(next, side, { ...mySideNow, deck: [...mySideNow.deck, ...recovered] });
      }
      // 2. ベンチのオオカミ系カウント
      const wolfBenchCount = my.bench
        .filter((b) => wolfFamily.has(b.name) && !sealed.includes(b.name))
        .reduce((sum, b) => sum + b.count, 0);
      if (wolfBenchCount > 0) {
        const glowNames = my.bench.filter((b) => wolfFamily.has(b.name) && !sealed.includes(b.name)).map((b) => b.name);
        next = withBenchGlow(next, side, glowNames);
        const buff = wolfBenchCount * 2;
        if (role === 'attacker') bonusAttack += buff;
        else next = { ...next, defenderBonus: next.defenderBonus + buff };
      }
      telop = { text: `🌙 祖先の咆哮！回収${recovered.length}枚 / オオカミ系${wolfBenchCount}枚→自身+${wolfBenchCount * 2}`, color: '#ffd700' };
      console.log(`[特殊効果] 月下の遠吠え: オオカミ系${recovered.length}枚回収、ベンチ${wolfBenchCount}枚で自身+${wolfBenchCount * 2}`);
      break;
    }
    case 'earth_moves': {
      // 相手ベンチの効果を全封印 + このラウンド中、味方全攻撃+3
      const oppState = opp === 'player' ? next.player : next.ai;
      const allOppBenchNames = oppState.bench.map((b) => b.name);
      next = {
        ...next,
        sealedBenchNames: {
          ...next.sealedBenchNames,
          [opp]: [...next.sealedBenchNames[opp], ...allOppBenchNames],
        },
        roundAttackBonus: {
          ...next.roundAttackBonus,
          [side]: next.roundAttackBonus[side] + 3,
        },
      };
      telop = { text: '🌍 それでも地球は動いている！相手ベンチ効果を封印、味方攻撃+3', color: '#ffd700' };
      console.log(`[特殊効果] 地球は動いている: 相手ベンチ${allOppBenchNames.length}枚封印、味方攻撃+3(ラウンド中)`);
      break;
    }
    // ===== 新コンボ効果（第2弾） =====
    case 'columbus': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasCompass = my.bench.some((b) => b.name === '羅針盤' && !sealed.includes(b.name));
      if (role === 'attacker' && hasCompass) {
        bonusAttack += 3;
        next = withBenchGlow(next, side, ['羅針盤']);
      }
      // Exile 1 from top 3 of opponent deck
      const oppStateC = opp === 'player' ? next.player : next.ai;
      if (oppStateC.deck.length > 0) {
        const topN = Math.min(3, oppStateC.deck.length);
        let bestIdx = 0;
        for (let i = 1; i < topN; i++) {
          if (getBaseAttack(oppStateC.deck[i]) > getBaseAttack(oppStateC.deck[bestIdx])) bestIdx = i;
        }
        const exiled = oppStateC.deck[bestIdx];
        const newDeck = [...oppStateC.deck];
        newDeck.splice(bestIdx, 1);
        next = applySide(
          { ...next, quarantine: { ...next.quarantine, [opp]: [...next.quarantine[opp], exiled] } },
          opp, { ...oppStateC, deck: newDeck },
        );
      }
      telop = { text: hasCompass ? '🧭コロンブス新大陸発見！攻撃+3 & 敵1枚隔離' : '🌊コロンブス新大陸発見！敵1枚隔離', color };
      break;
    }
    case 'magellan': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasCompass = my.bench.some((b) => b.name === '羅針盤' && !sealed.includes(b.name));
      if (role === 'defender' && hasCompass) {
        next = { ...next, defenderBonus: next.defenderBonus + 4 };
        next = withBenchGlow(next, side, ['羅針盤']);
        telop = { text: '🌍マゼラン世界一周！防御+4', color };
      } else {
        telop = { text: '🌍マゼラン世界一周！', color };
      }
      break;
    }
    case 'caravel': case 'spice': {
      telop = { text: '⛵大航海時代の道具！', color };
      break;
    }
    case 'emc2': {
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasEinstein = my.bench.some((b) => b.name === 'アインシュタイン' && !sealed.includes(b.name));
        if (hasEinstein) {
          const baseAtk = card.attackPower ?? card.power;
          bonusAttack += baseAtk;
          next = withBenchGlow(next, side, ['アインシュタイン']);
          telop = { text: `⚛️E=mc²質量エネルギー！攻撃${baseAtk}→${baseAtk * 2}`, color };
        } else {
          telop = { text: '⚛️E=mc²！条件未達', color };
        }
      }
      break;
    }
    case 'relativity': case 'lightspeed': {
      telop = { text: '🔬アインシュタインを強化', color };
      break;
    }
    case 'gun': case 'rakuichi': {
      telop = { text: '🏯安土桃山の道具！', color };
      break;
    }
    case 'cannon': {
      // 任意発動: consume 1 火薬 from bench for +2 attack.
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const gunpowderSlot = my.bench.find((b) => b.name === '火薬' && !sealed.includes(b.name));
        if (gunpowderSlot) {
          bonusAttack += 2;
          const newBench = removeOneFromBench(my.bench, '火薬');
          next = applySide(
            { ...next, exile: { ...next.exile, [side]: [...next.exile[side], gunpowderSlot.card] } },
            side,
            { ...my, bench: newBench },
          );
          next = withBenchGlow(next, side, ['火薬']);
          telop = { text: '🏰大砲！火薬1枚を除外して攻撃+2', color };
        } else {
          telop = { text: '🏰大砲（火薬なし）', color };
        }
      } else {
        telop = { text: '🏰大砲！', color };
      }
      break;
    }
    case 'napoleon_code': {
      // ナポレオン法典: passive bench effect (read by Napoleon on reveal)
      telop = { text: '📜ナポレオン法典！ベンチでナポレオン防御強化（重複可能）', color };
      break;
    }
    case 'waterloo': {
      // ワーテルロー: デッキ残り3枚以下でベンチのナポレオンをデッキ底に戻す
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      if (my.deck.length <= 3) {
        const napoleonSlot = my.bench.find((b) => b.name === 'ナポレオン' && !sealed.includes(b.name));
        if (napoleonSlot) {
          const newBench = removeOneFromBench(my.bench, 'ナポレオン');
          const newDeck = [...my.deck, napoleonSlot.card];
          next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
          next = withBenchGlow(next, side, ['ワーテルローの戦い']);
          telop = { text: '⚔️ ワーテルロー！ナポレオンがデッキに帰還！', color: '#ffd700' };
        } else {
          telop = { text: '⚔️ ワーテルロー（ナポレオン不在）', color };
        }
      } else {
        telop = { text: '⚔️ ワーテルローの戦い（デッキ3枚超、効果なし）', color };
      }
      break;
    }
    case 'arc_de_triomphe': {
      // 凱旋門: passive bench effect (bonus fans handled in resolveSubBattleWin)
      telop = { text: '🏛️ 凱旋の門！ナポレオン撃破時に追加ファン', color };
      break;
    }
    case 'qin_soldier': {
      // 秦の兵士: ベンチに万里の長城がある時、攻撃+2
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasWall = my.bench.some((b) => b.name === '万里の長城' && !sealed.includes(b.name));
        if (hasWall) {
          bonusAttack += 2;
          next = withBenchGlow(next, side, ['万里の長城']);
          telop = { text: '⚔️ 皇帝の尖兵！万里の長城の守りのもと攻撃+2！', color };
        } else {
          telop = { text: '⚔️ 秦の兵士（万里の長城なし）', color };
        }
      }
      break;
    }
    case 'imperial_decree': {
      // 始皇帝の勅令: 紙をデッキトップ、焚書坑儒をデッキボトムに配置（任意発動）
      const my = side === 'player' ? next.player : next.ai;
      const paperIdx = my.deck.findIndex((c) => c.name === '紙');
      const burnIdx = my.deck.findIndex((c) => c.name === '焚書坑儒');
      const hasPaper = paperIdx >= 0;
      const hasBurn = burnIdx >= 0;
      if ((hasPaper || hasBurn) && side === 'ai') {
        let newDeck = [...my.deck];
        // Move 焚書坑儒 to bottom first (indices shift if paper is before burn)
        if (hasBurn) {
          const bIdx = newDeck.findIndex((c) => c.name === '焚書坑儒');
          const [burn] = newDeck.splice(bIdx, 1);
          newDeck.push(burn);
        }
        // Move 紙 to top
        if (hasPaper) {
          const pIdx = newDeck.findIndex((c) => c.name === '紙');
          const [paper] = newDeck.splice(pIdx, 1);
          newDeck.unshift(paper);
        }
        next = applySide(next, side, { ...my, deck: newDeck });
        const parts = [hasPaper ? '紙をデッキトップ' : '', hasBurn ? '焚書坑儒をデッキボトム' : ''].filter(Boolean).join('、');
        telop = { text: `📜 天子の命！${parts}へ！`, color: '#ffd700' };
      } else if (hasPaper || hasBurn) {
        telop = { text: '📜 天子の命！サーチ中...', color: '#ffd700' };
      } else {
        telop = { text: '📜 天子の命（対象カードがありません）', color };
      }
      break;
    }
    case 'prayer_light': {
      // 祈りの光: ベンチにジャンヌがいる場合、ジャンヌをデッキの一番上に戻す（任意発動）
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const jeanneSlot = my.bench.find((b) => b.name === 'ジャンヌ・ダルク' && !sealed.includes(b.name));
      if (jeanneSlot) {
        if (side === 'ai') {
          const newBench = removeOneFromBench(my.bench, 'ジャンヌ・ダルク');
          const newDeck = [jeanneSlot.card, ...my.deck];
          next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
          next = withBenchGlow(next, side, ['ジャンヌ・ダルク']);
          telop = { text: '✨ 聖なる祈り！ジャンヌをデッキトップへ！', color: '#ffd700' };
        } else {
          telop = { text: '✨ 聖なる祈り！ジャンヌをサーチ中...', color: '#ffd700' };
        }
      } else {
        telop = { text: '✨ 聖なる祈り（ベンチにジャンヌがいません）', color };
      }
      break;
    }
    case 'holy_banner': {
      // 聖女の旗印: 除外されたジャンヌ系カード1枚をデッキに戻す（任意発動）
      const jeanneFamily = ['ジャンヌ・ダルク', '聖剣', '軍旗', '祈りの光', '白百合の盾'];
      const exiled = next.exile[side].filter((c) => jeanneFamily.includes(c.name));
      if (exiled.length > 0) {
        if (side === 'ai') {
          // AI: auto-select strongest exiled jeanne-family card
          const target = exiled.reduce((a, b) => {
            const aPow = (a.attackPower ?? a.power) + (a.defensePower ?? a.power);
            const bPow = (b.attackPower ?? b.power) + (b.defensePower ?? b.power);
            return aPow >= bPow ? a : b;
          });
          const newExile = next.exile[side].filter((c) => c.id !== target.id);
          const my = next.ai;
          const newDeck = [...my.deck, target];
          next = applySide(
            { ...next, exile: { ...next.exile, [side]: newExile } },
            side, { ...my, deck: newDeck },
          );
          telop = { text: `🏳️ 聖女の導き！${target.name}をデッキへ！`, color: '#ffd700' };
        } else {
          telop = { text: '🏳️ 聖女の導き！除外カードをサーチ中...', color: '#ffd700' };
        }
      } else {
        telop = { text: '🏳️ 聖女の導き（対象カードがありません）', color };
      }
      break;
    }
    case 'radium': case 'research_notes': case 'nobel_medal': {
      telop = { text: '🔬科学研究の成果！', color };
      break;
    }
    case 'hideyoshi': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasNobunaga = my.bench.some((b) => b.name === '織田信長' && !sealed.includes(b.name));
      const hasRikyu = my.bench.some((b) => b.name === '千利休' && !sealed.includes(b.name));
      const hideyoshiGlow: string[] = [];
      if (hasNobunaga) hideyoshiGlow.push('織田信長');
      if (hasRikyu) hideyoshiGlow.push('千利休');
      if (hideyoshiGlow.length > 0) next = withBenchGlow(next, side, hideyoshiGlow);
      const atkBonus = hasNobunaga ? 3 : 0;
      const defBonus = (hasNobunaga ? 3 : 0) + (hasRikyu ? 2 : 0);
      if (role === 'attacker') {
        bonusAttack += atkBonus;
        telop = { text: `🌸秀吉天下統一！攻撃+${atkBonus}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `🌸秀吉天下統一！防御+${defBonus}`, color };
      }
      break;
    }
    case 'rikyu': {
      telop = { text: '🍵千利休！味方防御強化', color };
      break;
    }
    case 'versailles': case 'cake': {
      telop = { text: '🏰マリーの権威', color };
      break;
    }
    case 'marie': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasVers = my.bench.some((b) => b.name === 'ヴェルサイユ宮殿' && !sealed.includes(b.name));
      const hasCake = my.bench.some((b) => b.name === 'ケーキ' && !sealed.includes(b.name));
      const marieGlow: string[] = [];
      if (hasVers) marieGlow.push('ヴェルサイユ宮殿');
      if (hasCake) marieGlow.push('ケーキ');
      if (marieGlow.length > 0) next = withBenchGlow(next, side, marieGlow);
      const deckLow = my.deck.length <= 4;
      let atk = hasCake ? 3 : 0;
      let def = hasVers ? 4 : 0;
      if (hasVers && hasCake && deckLow) {
        atk += 2;
        def += 2;
      }
      if (role === 'attacker') {
        bonusAttack += atk;
        telop = { text: `👑マリー最後の女王！攻撃+${atk}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + def };
        telop = { text: `👑マリー最後の女王！防御+${def}`, color };
      }
      break;
    }
    // ===== 宝石カード + アフリカデッキ =====
    case 'diamond': {
      telop = { text: '💎ダイヤモンド不滅の輝き！防御を強化', color };
      break;
    }
    case 'ruby': {
      telop = { text: '❤️ルビー情熱の炎！攻撃を強化', color };
      break;
    }
    case 'sapphire': {
      telop = { text: '💙サファイア叡智の守り！防御を強化', color };
      break;
    }
    case 'emerald': {
      const my = side === 'player' ? next.player : next.ai;
      if (my.bench.length > 0) {
        const weakest = [...my.bench].sort(
          (a, b) => getBaseAttack(a.card) - getBaseAttack(b.card),
        )[0];
        const newBench = removeOneFromBench(my.bench, weakest.name);
        const newDeck = [...my.deck, weakest.card];
        if (newDeck.length > 0) {
          const top = newDeck[0];
          newDeck[0] = {
            ...top,
            attackPower: getBaseAttack(top) + 1,
            defensePower: getBaseDefense(top) + 1,
          };
        }
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        telop = { text: `💚エメラルド再生の力！${weakest.name}をデッキへ＋上カード強化`, color };
      } else {
        telop = { text: '💚エメラルド再生の力！対象なし', color };
      }
      break;
    }
    case 'amethyst': {
      telop = { text: '💜アメジスト精神の盾！弱体化を無効化', color };
      break;
    }
    case 'mandela': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasApartheid = my.bench.some((b) => b.name === 'アパルトヘイト' && !sealed.includes(b.name));
      const distinctBenchCount = my.bench.length;
      // 自由憲章: +2 attack per copy (stackable)
      const charterSlot = my.bench.find((b) => b.name === '自由憲章' && !sealed.includes(b.name));
      const charterBonus = (charterSlot?.count ?? 0) * 2;
      const glow: string[] = [];
      if (hasApartheid) glow.push('アパルトヘイト');
      if (charterSlot) glow.push('自由憲章');
      if (glow.length > 0) next = withBenchGlow(next, side, glow);
      // Unseal all
      next = {
        ...next,
        sealedBenchNames: { ...next.sealedBenchNames, [side]: [] },
      };
      if (role === 'attacker') {
        const atkBonus = (distinctBenchCount >= 4 ? 3 : 0) + charterBonus;
        bonusAttack += atkBonus;
        telop = { text: `✊マンデラ不屈の精神！攻撃+${atkBonus} 封印解除`, color };
      } else {
        const defBonus = hasApartheid ? 4 : 0;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `✊マンデラ不屈の精神！防御+${defBonus} 封印解除`, color };
      }
      break;
    }
    case 'apartheid': {
      telop = { text: '✊アパルトヘイト！マンデラを強化', color };
      break;
    }
    case 'robben_island': {
      // From the bench: マンデラが除外されない（除外耐性）— passive, no reveal action
      telop = { text: '🏝️ロベン島！マンデラを除外から守る', color };
      break;
    }
    case 'rainbow_nation': {
      // 公開時、除外されたカード全てをデッキに戻す（任意発動）
      const myExile = next.exile[side];
      if (myExile.length > 0) {
        if (side === 'ai' || role === 'defender') {
          // AI or defender: auto-apply (defender has no UI interaction window)
          const my = side === 'player' ? next.player : next.ai;
          const newDeck = [...my.deck, ...myExile];
          next = applySide(next, side, { ...my, deck: newDeck });
          next = { ...next, exile: { ...next.exile, [side]: [] } };
          telop = { text: `🌈 希望の虹！除外カード${myExile.length}枚が全てデッキに戻った！`, color };
        } else {
          // Player attacker: UI selection handled in battle loop (waitCardSelect with skip)
          telop = { text: '🌈 希望の虹！除外カードを復元...', color };
        }
      } else {
        telop = { text: '🌈 希望の虹（除外カードがありません）', color };
      }
      break;
    }
    case 'freedom_charter': {
      // From the bench: マンデラの攻撃+2（重複可能）— passive, read by mandela
      telop = { text: '✊自由の誓い！マンデラの攻撃を強化', color };
      break;
    }
    case 'nobel_peace': {
      // 公開時、このラウンド中味方全カードの攻防+1（任意発動）
      if (side === 'ai' || role === 'defender') {
        // AI or defender: auto-apply (defender has no UI interaction window)
        next = {
          ...next,
          roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 1 },
          defenderBonus: next.defenderBonus + 1,
        };
        telop = { text: '🏅 栄光の証！味方全カード攻防+1！', color };
      } else {
        // Player attacker: UI selection handled in battle loop
        telop = { text: '🏅 栄光の証！発動を選択...', color };
      }
      break;
    }
    case 'african_elephant': {
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasSavanna = my.bench.some((b) => b.name === 'サバンナ' && !sealed.includes(b.name));
        let bonus = 2;
        if (hasSavanna) {
          bonus += 2;
          next = withBenchGlow(next, side, ['サバンナ']);
        }
        bonusAttack += bonus;
        telop = { text: `🐘アフリカゾウ突進！攻撃+${bonus}`, color };
      }
      break;
    }
    case 'savanna': {
      telop = { text: '🌿サバンナ！生き物を強化', color };
      break;
    }
    // ===== 産業革命デッキ =====
    case 'steam_engine': {
      telop = { text: '🔧蒸気機関！科学発明を強化', color };
      break;
    }
    case 'coal': {
      telop = { text: '⛏️石炭！燃料供給', color };
      break;
    }
    case 'spinning_machine': {
      next = { ...next, altBonus: next.altBonus + 5 };
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSteam = myState.bench.some((b) => b.name === '蒸気機関' && !sealed.includes(b.name));
      if (hasSteam) {
        next = { ...next, altBonus: next.altBonus + 5 };
        next = withBenchGlow(next, side, ['蒸気機関']);
        telop = { text: '🧵紡績機！ALT+10（蒸気機関込み）', color };
      } else {
        telop = { text: '🧵紡績機！ALT+5', color };
      }
      break;
    }
    case 'steam_locomotive': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSteam = my.bench.some((b) => b.name === '蒸気機関' && !sealed.includes(b.name));
      const hasCoal = my.bench.some((b) => b.name === '石炭' && !sealed.includes(b.name));
      const wheelSlot = my.bench.find((b) => b.name === '車輪' && !sealed.includes(b.name));
      const wheelCount = wheelSlot?.count ?? 0;
      const glow: string[] = [];
      if (hasSteam) glow.push('蒸気機関');
      if (hasCoal) glow.push('石炭');
      if (wheelCount > 0) glow.push('車輪');
      if (glow.length > 0) next = withBenchGlow(next, side, glow);
      // 車輪ボーナス: +2/+2 per wheel card
      const wheelAtkBonus = wheelCount * 2;
      const wheelDefBonus = wheelCount * 2;
      if (hasSteam && hasCoal) {
        if (role === 'attacker') {
          bonusAttack += 4 + wheelAtkBonus;
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + 2 + wheelDefBonus };
        }
        const quarantined = next.quarantine[side];
        if (quarantined.length > 0) {
          const recoverCount = Math.min(2, quarantined.length);
          const recovered = quarantined.slice(-recoverCount);
          const remaining = quarantined.slice(0, quarantined.length - recoverCount);
          next = applySide(
            { ...next, quarantine: { ...next.quarantine, [side]: remaining } },
            side,
            { ...my, deck: [...my.deck, ...recovered] },
          );
        }
        const atkTotal = role === 'attacker' ? 4 + wheelAtkBonus : 0;
        const defTotal = role === 'defender' ? 2 + wheelDefBonus : 0;
        telop = { text: `🚂蒸気機関車！${role === 'attacker' ? `攻撃+${atkTotal}` : `防御+${defTotal}`}${wheelCount > 0 ? ` 車輪×${wheelCount}` : ''} 隔離回収`, color };
      } else if (wheelCount > 0) {
        // 車輪のみ（蒸気機関+石炭なし）でも車輪ボーナスは付く
        if (role === 'attacker') {
          bonusAttack += wheelAtkBonus;
          telop = { text: `🚂蒸気機関車！車輪×${wheelCount}で攻撃+${wheelAtkBonus}`, color };
        } else {
          next = { ...next, defenderBonus: next.defenderBonus + wheelDefBonus };
          telop = { text: `🚂蒸気機関車！車輪×${wheelCount}で防御+${wheelDefBonus}`, color };
        }
      } else {
        telop = { text: '🚂蒸気機関車！条件未達', color };
      }
      break;
    }
    case 'wheel': {
      telop = { text: '🛞車輪！蒸気機関車を強化', color };
      break;
    }
    case 'watt': {
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const inventionCount = my.bench
        .filter((b) => !sealed.includes(b.name) && b.card.category === 'invention')
        .reduce((s, b) => s + b.count, 0);
      const glowNames = my.bench
        .filter((b) => !sealed.includes(b.name) && b.card.category === 'invention')
        .map((b) => b.name);
      if (glowNames.length > 0) next = withBenchGlow(next, side, glowNames);
      let atkBonus = 0;
      let defBonus = 0;
      if (inventionCount >= 4) {
        atkBonus = 5; defBonus = 3;
        next = {
          ...next,
          roundAttackBonus: { ...next.roundAttackBonus, [side]: next.roundAttackBonus[side] + 1 },
        };
      } else if (inventionCount === 3) {
        atkBonus = 3; defBonus = 2;
      } else if (inventionCount === 2) {
        atkBonus = 2; defBonus = 1;
      } else if (inventionCount === 1) {
        atkBonus = 1;
      }
      if (role === 'attacker') {
        bonusAttack += atkBonus;
        telop = { text: `⚙️ワット改良の天才！科学発明${inventionCount}枚 攻撃+${atkBonus}`, color };
      } else {
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `⚙️ワット改良の天才！科学発明${inventionCount}枚 防御+${defBonus}`, color };
      }
      break;
    }
    // ===== 紫式部デッキ =====
    case 'murasaki': {
      // ベンチの文化系1枚につき防御+1。源氏物語で攻撃+3。和歌は重複可能で攻撃+1ずつ。
      const cultureNames = new Set(['紫式部', '源氏物語', '筆', '和歌', '十二単', '紙']);
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const cultureSlots = my.bench.filter((b) => !sealed.includes(b.name) && cultureNames.has(b.name));
      const cultureCount = cultureSlots.reduce((s, b) => s + b.count, 0);
      const hasGenji = my.bench.some((b) => b.name === '源氏物語' && !sealed.includes(b.name));
      const wakaSlot = my.bench.find((b) => b.name === '和歌' && !sealed.includes(b.name));
      const wakaCount = wakaSlot?.count ?? 0;
      const glow = cultureSlots.map((b) => b.name);
      if (glow.length > 0) next = withBenchGlow(next, side, glow);
      if (role === 'attacker') {
        const atkBonus = (hasGenji ? 3 : 0) + wakaCount;
        bonusAttack += atkBonus;
        telop = { text: `📜紫式部 文化の才媛！攻撃+${atkBonus}`, color };
      } else {
        const defBonus = cultureCount;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `📜紫式部 文化の才媛！防御+${defBonus}`, color };
      }
      break;
    }
    case 'genji': {
      // 公開時: デッキ内の紙・筆・和歌から1枚をデッキトップへ
      const myState = side === 'player' ? next.player : next.ai;
      const targets = new Set(['紙', '筆', '和歌']);
      const idx = myState.deck.findIndex((c) => targets.has(c.name));
      if (idx > 0) {
        const newDeck = [...myState.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...myState, deck: newDeck });
        telop = { text: `📖源氏物語！${moved.name}をデッキトップへ`, color };
      } else if (idx === 0) {
        telop = { text: '📖源氏物語！既にトップにあり', color };
      } else {
        telop = { text: '📖源氏物語（対象なし）', color };
      }
      break;
    }
    case 'fude': {
      // 公開時: 相手の次に出すカードの攻撃-1
      next = {
        ...next,
        pendingAttackBonus: {
          ...next.pendingAttackBonus,
          [opp]: next.pendingAttackBonus[opp] - 1,
        },
      };
      telop = { text: '🖌️筆 墨の一閃！相手次攻撃-1', color };
      break;
    }
    case 'waka': {
      telop = { text: '🎴和歌！ベンチで紫式部を強化', color };
      break;
    }
    case 'junihitoe': {
      telop = { text: '👘十二単！紫式部を除外から守る', color };
      break;
    }
    // ===== オオカミデッキ =====
    case 'wolf': {
      // 群れの絆: ベンチのオオカミ系カード1枚につき攻防+1
      // 群れの掟: 防御時のみ追加+2ずつ（重複可能）
      const wolfNames = new Set(['オオカミ', '遠吠え', '群れの掟', '縄張り', '一匹狼']);
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const wolfSlots = my.bench.filter((b) => !sealed.includes(b.name) && wolfNames.has(b.name));
      const wolfCount = wolfSlots.reduce((s, b) => s + b.count, 0);
      const packLawSlot = my.bench.find((b) => b.name === '群れの掟' && !sealed.includes(b.name));
      const packLawCount = packLawSlot?.count ?? 0;
      const glow = wolfSlots.map((b) => b.name);
      if (glow.length > 0) next = withBenchGlow(next, side, glow);
      if (role === 'attacker') {
        bonusAttack += wolfCount;
        telop = { text: `🐺オオカミ 群れの絆！攻撃+${wolfCount}`, color };
      } else {
        const defBonus = wolfCount + packLawCount * 2;
        next = { ...next, defenderBonus: next.defenderBonus + defBonus };
        telop = { text: `🐺オオカミ 群れの絆！防御+${defBonus}`, color };
      }
      break;
    }
    case 'howl': {
      // 公開時: デッキ内のオオカミ系1枚をデッキトップへ
      const wolfNames = new Set(['オオカミ', '遠吠え', '群れの掟', '縄張り', '一匹狼']);
      const myState = side === 'player' ? next.player : next.ai;
      const idx = myState.deck.findIndex((c) => wolfNames.has(c.name));
      if (idx > 0) {
        const newDeck = [...myState.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...myState, deck: newDeck });
        telop = { text: `🌙遠吠え！${moved.name}をデッキトップへ`, color };
      } else if (idx === 0) {
        telop = { text: '🌙遠吠え！既にトップにあり', color };
      } else {
        telop = { text: '🌙遠吠え（対象なし）', color };
      }
      break;
    }
    case 'pack_law': {
      telop = { text: '📜群れの掟！オオカミの防御強化', color };
      break;
    }
    case 'territory': {
      telop = { text: '🚩縄張り！相手生き物の攻撃-1', color };
      break;
    }
    case 'lone_wolf': {
      // 公開時: ベンチにオオカミ系0枚なら攻撃+5
      if (role === 'attacker') {
        const wolfNames = new Set(['オオカミ', '遠吠え', '群れの掟', '縄張り', '一匹狼']);
        const myState = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const wolfCount = myState.bench
          .filter((b) => !sealed.includes(b.name) && wolfNames.has(b.name))
          .reduce((s, b) => s + b.count, 0);
        if (wolfCount === 0) {
          bonusAttack += 5;
          telop = { text: '🐺一匹狼！孤高の咆哮！攻撃+5', color };
        } else {
          telop = { text: '🐺一匹狼（仲間がいて効果なし）', color };
        }
      }
      break;
    }
  }

  return { state: next, bonusAttack, telop };
}

function withTelop(state: GameState, telop?: { text: string; color: string }): GameState {
  if (!telop) return state;
  return { ...state, effectTelop: { ...telop, key: Date.now() + Math.floor(Math.random() * 1000) } };
}

function withBenchGlow(state: GameState, side: Side, names: string[]): GameState {
  if (names.length === 0) return state;
  return {
    ...state,
    benchGlow: { side, names, key: Date.now() + Math.floor(Math.random() * 1000) },
  };
}

// ===== Bench auras (passive buffs from any card on bench, not tied to a hero reveal) =====
function unsealedBenchNames(state: GameState, side: Side): { names: Set<string>; sunflower: number } {
  const me = side === 'player' ? state.player : state.ai;
  const sealed = state.sealedBenchNames[side];
  const alive = me.bench.filter((b) => !sealed.includes(b.name));
  return {
    names: new Set(alive.map((b) => b.name)),
    sunflower: alive.find((b) => b.name === 'ひまわり')?.count ?? 0,
  };
}

function computeAttackerAura(
  state: GameState,
  attackerSide: Side,
  card: BattleCard,
  priorRevealCount: number,
): { bonus: number; details: BenchBoostDetail[] } {
  const { names, sunflower } = unsealedBenchNames(state, attackerSide);
  let bonus = 0;
  const details: BenchBoostDetail[] = [];
  if (names.has('軍旗')) { bonus += 1; details.push({ benchCardName: '軍旗', atkBonus: 1, defBonus: 0 }); }
  // アマゾン川: no longer a bench aura (changed to on-reveal deck search)
  if (sunflower >= 2) { bonus += 1; details.push({ benchCardName: 'ひまわり', atkBonus: 1, defBonus: 0 }); }
  // Opponent 万有引力: 2枚目以降の攻撃 -1
  const opp = otherSide(attackerSide);
  const oppMe = opp === 'player' ? state.player : state.ai;
  const oppSealed = state.sealedBenchNames[opp];
  const oppHasGravity = oppMe.bench.some((b) => b.name === '万有引力' && !oppSealed.includes(b.name));
  if (oppHasGravity && priorRevealCount >= 1) { bonus -= 1; details.push({ benchCardName: '万有引力', atkBonus: -1, defBonus: 0 }); }
  // ルビー aura: 攻撃側全攻撃+1 (2枚以上で+2)
  const atkMe = attackerSide === 'player' ? state.player : state.ai;
  const atkSealed = state.sealedBenchNames[attackerSide];
  const rubySlot = atkMe.bench.find((b) => b.name === 'ルビー' && !atkSealed.includes(b.name));
  if (rubySlot) { const v = rubySlot.count >= 2 ? 2 : 1; bonus += v; details.push({ benchCardName: 'ルビー', atkBonus: v, defBonus: 0 }); }
  // サバンナ aura: 生き物カード攻撃+1
  if (names.has('サバンナ') && card.category === 'creature') { bonus += 1; details.push({ benchCardName: 'サバンナ', atkBonus: 1, defBonus: 0 }); }
  // 縄張り aura (opp bench): 相手の生き物カードの攻撃-1（ベンチにある間ずっと）
  if (card.category === 'creature') {
    const oppHasTerritory = oppMe.bench.some((b) => b.name === '縄張り' && !oppSealed.includes(b.name));
    if (oppHasTerritory) { bonus -= 1; details.push({ benchCardName: '縄張り', atkBonus: -1, defBonus: 0 }); }
  }
  // サバンナ combo (アマゾン川 removed from bench auras)
  // 蒸気機関 aura: 科学発明カード攻撃+1 (石炭もあれば+2)
  if (names.has('蒸気機関') && card.category === 'invention') {
    const v = names.has('石炭') ? 2 : 1;
    bonus += v;
    details.push({ benchCardName: names.has('石炭') ? '蒸気機関+石炭' : '蒸気機関', atkBonus: v, defBonus: 0 });
  }
  return { bonus, details };
}

function applyDefenderAura(state: GameState, defenderSide: Side): { state: GameState; details: BenchBoostDetail[] } {
  const { names } = unsealedBenchNames(state, defenderSide);
  let bonus = 0;
  const details: BenchBoostDetail[] = [];
  if (names.has('血清')) { bonus += 1; details.push({ benchCardName: '血清', atkBonus: 0, defBonus: 1 }); }
  if (names.has('聖書')) { const v = names.has('活版印刷機') ? 2 : 1; bonus += v; details.push({ benchCardName: names.has('活版印刷機') ? '聖書+活版印刷機' : '聖書', atkBonus: 0, defBonus: v }); }
  if (names.has('千利休')) { bonus += 1; details.push({ benchCardName: '千利休', atkBonus: 0, defBonus: 1 }); }
  if (names.has('ダイヤモンド')) { bonus += 1; details.push({ benchCardName: 'ダイヤモンド', atkBonus: 0, defBonus: 1 }); }
  const defMe = defenderSide === 'player' ? state.player : state.ai;
  const defSealed = state.sealedBenchNames[defenderSide];
  const sapphireSlot = defMe.bench.find((b) => b.name === 'サファイア' && !defSealed.includes(b.name));
  if (sapphireSlot) { const v = sapphireSlot.count >= 2 ? 2 : 1; bonus += v; details.push({ benchCardName: 'サファイア', atkBonus: 0, defBonus: v }); }
  if (names.has('サバンナ') && state.defenseCard?.category === 'creature') { bonus += 1; details.push({ benchCardName: 'サバンナ', atkBonus: 0, defBonus: 1 }); }
  const coalSlot = defMe.bench.find((b) => b.name === '石炭' && !defSealed.includes(b.name));
  if (coalSlot && coalSlot.count >= 2 && state.defenseCard?.category === 'invention') { bonus += 1; details.push({ benchCardName: '石炭', atkBonus: 0, defBonus: 1 }); }
  if (bonus === 0) return { state, details: [] };
  return { state: { ...state, defenderBonus: state.defenderBonus + bonus }, details };
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
    // Flag holder's deck is empty at battle start → other side wins this round
    const roundWinnerSide = otherSide(state.flagHolder);
    return {
      ...state,
      phase: 'round_end',
      roundWinner: roundWinnerSide,
      message: `第${state.round}回戦: ${roundWinnerSide === 'player' ? 'あなた' : '相手'}の勝利！(デッキ切れ)`,
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
  console.log(`[Engine] startBattle: defender="${defender.name}" (effect=${defender.effect?.id ?? 'none'}) | flagHolder=${state.flagHolder}`);
  if (defender.effect) {
    const eff = applyRevealEffect(next, defender, state.flagHolder, 'defender');
    next = withTelop(eff.state, eff.telop);
    console.log(`[Engine]   defender effect "${defender.effect.id}" applied`);
  }
  const defAura = applyDefenderAura(next, state.flagHolder);
  next = defAura.state;
  if (defAura.details.length > 0) {
    next = { ...next, benchBoostDetails: defAura.details };
  }

  // NPC stage bonus (defense)
  if (state.flagHolder === 'ai' && state.stageRules) {
    const r = state.stageRules;
    if (r.npcDefenseBonus && r.npcDefenseBonusFilter) {
      if (defender.category === r.npcDefenseBonusFilter) {
        next = { ...next, defenderBonus: next.defenderBonus + r.npcDefenseBonus };
      }
    } else if (r.npcDefenseBonus) {
      next = { ...next, defenderBonus: next.defenderBonus + r.npcDefenseBonus };
    }
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
export function revealNextAttackCard(
  state: GameState,
  opts?: { skipEffect?: boolean },
): GameState {
  if (state.phase !== 'battle') return state;
  const attackerSide = otherSide(state.flagHolder);
  const attacker = attackerSide === 'player' ? state.player : state.ai;

  if (attacker.deck.length === 0) {
    // Attacker ran out of cards → defender wins THIS ROUND.
    // Spec (2026-04): 攻撃失敗時は attackRevealed の全カードを攻撃側の隔離に移す。
    // 回戦終了時に advanceToNextRound で隔離はクリアされるが、ログ/状態の一貫性のため
    // この時点で正しく quarantine に積んでおく。
    const roundWinnerSide = state.flagHolder; // defender wins
    const failedAttackCards = state.attackRevealed;
    const updatedAttackerQuarantine = [...state.quarantine[attackerSide], ...failedAttackCards];
    console.log(`[Engine] デッキ切れ: ${attackerSide} のデッキが0枚 → ${roundWinnerSide} が第${state.round}回戦勝利`);
    if (failedAttackCards.length > 0) {
      console.log(`[隔離] 攻撃失敗: ${failedAttackCards.map((c) => c.name).join(', ')} → 隔離へ（現在隔離${updatedAttackerQuarantine.length}枚）`);
    }
    return {
      ...state,
      phase: 'round_end',
      roundWinner: roundWinnerSide,
      message: `第${state.round}回戦: ${roundWinnerSide === 'player' ? 'あなた' : '相手'}の勝利！(デッキ切れ)`,
      quarantine: {
        ...state.quarantine,
        [attackerSide]: updatedAttackerQuarantine,
      },
      attackRevealed: [],
      attackCurrentPower: 0,
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

  // NPC stage bonus (attack)
  if (attackerSide === 'ai' && state.stageRules) {
    const r = state.stageRules;
    if (r.npcAttackBonus && r.npcAttackBonusFilter) {
      if (nextCard.category === r.npcAttackBonusFilter) addedPower += r.npcAttackBonus;
    } else if (r.npcAttackBonus) {
      addedPower += r.npcAttackBonus;
    }
  }

  // Card-specific on-reveal effect (skippable when the attacker chose "効果なしで出す").
  const myBench = (attackerSide === 'player' ? next.player : next.ai).bench;
  console.log(`[Engine] revealNextAttackCard: "${nextCard.name}" (effect=${nextCard.effect?.id ?? 'none'}, skipEffect=${opts?.skipEffect ?? false}) | attacker=${attackerSide} | bench=[${myBench.map(b => `${b.name}×${b.count}`).join(', ')}]`);
  if (nextCard.effect && !opts?.skipEffect) {
    const eff = applyRevealEffect(next, nextCard, attackerSide, 'attacker');
    next = withTelop(eff.state, eff.telop);
    addedPower += eff.bonusAttack;
    console.log(`[Engine]   effect "${nextCard.effect.id}" → bonusAttack=${eff.bonusAttack}, telop="${eff.telop?.text ?? 'none'}"`);
  }

  // Bench auras from passive cards (any-reveal buffs from own/opponent bench)
  const aura = computeAttackerAura(next, attackerSide, nextCard, state.attackRevealed.length);
  addedPower += aura.bonus;
  if (aura.bonus !== 0) console.log(`[Engine]   bench aura → bonus=${aura.bonus}, details=[${aura.details.map(d => `${d.benchCardName}:atk${d.atkBonus}`).join(', ')}]`);

  const newPower = state.attackCurrentPower + addedPower;
  console.log(`[Engine]   total addedPower=${addedPower} (base=${getBaseAttack(nextCard)}) → cumulative=${newPower}`);
  return {
    ...next,
    attackCurrentPower: newPower,
    lastRevealPowerAdded: addedPower,
    benchBoostDetails: aura.details.length > 0 ? aura.details : null,
    message: `${attackerSide === 'player' ? 'あなたの' : '相手の'}攻撃パワー ${newPower}`,
  };
}

/**
 * True if the attacker has accumulated enough power to beat the current defender.
 */
export function hasAttackSucceeded(state: GameState): boolean {
  if (!state.defenseCard) return false;
  const baseDef = getBaseDefense(state.defenseCard);
  const effectiveDefense = Math.max(0, baseDef + state.defenderBonus);
  console.log(`[防御計算] ${state.defenseCard.name} 基本防御:${baseDef} + ベンチバフ:${state.defenderBonus} = 最終防御:${effectiveDefense} (攻撃力:${state.attackCurrentPower})`);
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

  // ===== Leave-field triggers =====
  // 糸杉: ゴッホが場を離れる時、ベンチではなく隔離へ
  // 兵馬俑: 始皇帝が場を離れる時、代わりに隔離
  // ケーキ: マリー・アントワネット が場を離れる時、相手デッキ上2枚を隔離
  const defenderState0 = defenderSide === 'player' ? state.player : state.ai;
  const defSealed0 = state.sealedBenchNames[defenderSide];
  const dBenchNamesSet = new Set(
    defenderState0.bench.filter((b) => !defSealed0.includes(b.name)).map((b) => b.name),
  );
  let reroutedDefender = false;
  let defenderToDeckBottom = false; // 不老不死の薬: 始皇帝をデッキ底に戻す
  const leaveQuarantineDefender: BattleCard[] = [];
  if (defenderCard.name === 'ゴッホ' && dBenchNamesSet.has('糸杉')) {
    reroutedDefender = true;
    leaveQuarantineDefender.push(defenderCard);
  }
  // 不老不死の薬: 始皇帝をベンチではなくデッキ底に戻す（兵馬俑より優先）
  if (defenderCard.name === '始皇帝' && dBenchNamesSet.has('不老不死の薬')) {
    reroutedDefender = true;
    defenderToDeckBottom = true;
    console.log('[Engine] 不老不死の薬発動！始皇帝をデッキ底に戻す');
  } else if (defenderCard.name === '始皇帝' && dBenchNamesSet.has('兵馬俑')) {
    reroutedDefender = true;
    leaveQuarantineDefender.push(defenderCard);
  }
  let attackerDeckTrim = 0;
  const leaveQuarantineOpp: BattleCard[] = [];
  if (defenderCard.name === 'マリー・アントワネット' && dBenchNamesSet.has('ケーキ')) {
    const atkState = attackerSide === 'player' ? state.player : state.ai;
    leaveQuarantineOpp.push(...atkState.deck.slice(0, 2));
    attackerDeckTrim = leaveQuarantineOpp.length;
  }

  // Defender's bench receives: (old defender card unless rerouted) + (flushed quarantine).
  const defenderState = defenderSide === 'player' ? state.player : state.ai;
  const flushedCards = reroutedDefender
    ? [...state.quarantine[defenderSide]]
    : [defenderCard, ...state.quarantine[defenderSide]];
  let newDefenderBench = defenderState.bench;
  // [Bench] user-readable logs
  const benchBeforeStr = newDefenderBench.map((s) => `${s.name}×${s.count}`).join(', ') || '(空)';
  console.log(`[Bench] 現在: ${benchBeforeStr} (${newDefenderBench.length}/${getBenchMax(state, defenderSide)}) — ${defenderSide} (奪取前)`);
  const movingNames = flushedCards.map((c) => c.name);
  console.log(`[Bench] 移動: ${movingNames.join(', ')} → ${defenderSide}のベンチへ`);
  const fromQuarantine = state.quarantine[defenderSide].map((c) => c.name);
  if (fromQuarantine.length > 0) {
    console.log(`[Bench] 隔離から移動: ${fromQuarantine.join(', ')}`);
    console.log(`[隔離→ベンチ] フラッグ奪取: ${fromQuarantine.join(', ')} → ${defenderSide}のベンチへ`);
  }
  // Legacy engine logs kept for debug parity
  console.log(`[Engine] resolveSubBattleWin: ${defenderSide} bench BEFORE flush: ${newDefenderBench.length}/6 slots`, newDefenderBench.map(s => `${s.name}×${s.count}`).join(', '));
  console.log(`[Engine]   flushing ${flushedCards.length} cards:`, flushedCards.map(c => c.name).join(', '));
  const unflushed: BattleCard[] = [];
  let benchOverflow = false;
  for (let fi = 0; fi < flushedCards.length; fi++) {
    const c = flushedCards[fi];
    const alreadyOnBench = newDefenderBench.some((s) => s.name === c.name);
    const slotsUsed = newDefenderBench.length;
    const defBenchMax = getBenchMax(state, defenderSide);
    if (!canAddToBench(newDefenderBench, c, defBenchMax)) {
      unflushed.push(...flushedCards.slice(fi));
      benchOverflow = true;
      console.log(`[Engine] ベンチ満杯！ ${defenderSide} bench=${slotsUsed}/${defBenchMax} slots, card="${c.name}" alreadyOnBench=${alreadyOnBench} → game_over`);
      console.log(`[Engine]   bench slots:`, newDefenderBench.map(s => `${s.name}×${s.count}`).join(', '));
      console.log(`[Engine]   flushed ${fi}/${flushedCards.length} cards, ${unflushed.length} stuck`);
      console.log(`[Bench] ⚠️ ベンチ満杯！ "${c.name}" が入らない (${slotsUsed}/${defBenchMax}) — ${defenderSide} 敗北`);
      break;
    }
    newDefenderBench = addToBench(newDefenderBench, c);
    console.log(`[Engine]   +${c.name} → bench now ${newDefenderBench.length}/6 slots`);
    const added = newDefenderBench.find((s) => s.name === c.name);
    console.log(`[Bench]   +${c.name} (${added?.count === 1 ? '新スロット' : `スタック×${added?.count}`}) — ${newDefenderBench.length}/${defBenchMax}`);
  }
  if (benchOverflow) {
    // Update state with the partial flush so result screen shows accurate bench
    const updatedDefender = { ...defenderState, bench: newDefenderBench };
    const overflowCard = unflushed[0]?.name ?? '?';
    return {
      ...state,
      phase: 'round_end',
      roundWinner: attackerSide,  // attacker wins when defender's bench overflows
      message: `第${state.round}回戦: ${attackerSide === 'player' ? 'あなた' : '相手'}の勝利！(ベンチ満杯「${overflowCard}」)`,
      player: defenderSide === 'player' ? updatedDefender : state.player,
      ai: defenderSide === 'ai' ? updatedDefender : state.ai,
      quarantine: {
        ...state.quarantine,
        [defenderSide]: unflushed,
      },
    };
  }

  console.log(`[Engine] resolveSubBattleWin: ${defenderSide} defended with "${defenderCard.name}", flushed ${flushedCards.length} cards to bench (bench now ${newDefenderBench.length}/6)`);
  console.log(`[Engine]   quarantine[${defenderSide}] was ${state.quarantine[defenderSide].length} → flushed to bench, clearing`);
  // [Bench] final state log
  const benchAfterStr = newDefenderBench.map((s) => `${s.name}×${s.count}`).join(', ') || '(空)';
  console.log(`[Bench] 現在: ${benchAfterStr} (${newDefenderBench.length}/${getBenchMax(state, defenderSide)}) — ${defenderSide} (奪取後)`);

  // Split attack cards: all except last → attacker's quarantine; last becomes new defender.
  const attackCards = state.attackRevealed;
  const lastAttackCard = attackCards[attackCards.length - 1];
  const otherAttackCards = attackCards.slice(0, -1);
  const newAttackerQuarantine = [...state.quarantine[attackerSide], ...otherAttackCards];
  console.log(`[Engine]   quarantine[${attackerSide}]: ${state.quarantine[attackerSide].length} + ${otherAttackCards.length} non-last attack cards = ${newAttackerQuarantine.length}`);

  // Apply leave-trigger quarantine additions (糸杉/兵馬俑 reroute defender, ケーキ quarantines opp deck top).
  const defenderLeaveQuarantine = [...leaveQuarantineDefender];
  const attackerLeaveQuarantine = [...leaveQuarantineOpp];
  // Update quarantine map: defender's cleared (flushed to bench), attacker's appended.
  const finalAttackerQuarantine = [...newAttackerQuarantine, ...attackerLeaveQuarantine];
  const newQuarantine = {
    ...state.quarantine,
    [defenderSide]: defenderLeaveQuarantine,
    [attackerSide]: finalAttackerQuarantine,
  };
  console.log(`[Engine]   quarantine AFTER: player=[${newQuarantine.player.map(c=>c.name).join(',')}] ai=[${newQuarantine.ai.map(c=>c.name).join(',')}]`);
  // Trim attacker deck when ケーキ triggers.
  const attackerStateForTrim = attackerSide === 'player' ? state.player : state.ai;
  const trimmedAttackerDeck = attackerDeckTrim > 0
    ? attackerStateForTrim.deck.slice(attackerDeckTrim)
    : attackerStateForTrim.deck;

  // 不老不死の薬: 始皇帝をデッキ底に戻す
  const defenderDeckForSide = (s: Side): BattleCard[] => {
    const baseDeck = s === attackerSide ? trimmedAttackerDeck : (s === 'player' ? state.player.deck : state.ai.deck);
    if (defenderToDeckBottom && s === defenderSide) {
      return [...baseDeck, defenderCard];
    }
    return baseDeck;
  };

  // Card defeat fans: attacker earns fans for defeating the defender card
  let defeatFans = CARD_DEFEAT_FANS[defenderCard.rarity] ?? 1;
  // 凱旋門ボーナス: ベンチに凱旋門があり攻撃カードにナポレオンがいれば+2
  const atkState = attackerSide === 'player' ? state.player : state.ai;
  const atkSealed = state.sealedBenchNames[attackerSide];
  const hasTriomphe = atkState.bench.some((b) => b.name === '凱旋門' && !atkSealed.includes(b.name));
  const hasNapoleonInAttack = state.attackRevealed.some((c) => c.name === 'ナポレオン');
  if (hasTriomphe && hasNapoleonInAttack) {
    defeatFans += 2;
    console.log(`[Engine] 凱旋門ボーナス: ナポレオン撃破で+2ファン追加`);
  }
  const newPlayerFans = attackerSide === 'player' ? state.playerFans + defeatFans : state.playerFans;
  const newAiFans = attackerSide === 'ai' ? state.aiFans + defeatFans : state.aiFans;
  console.log(`[Engine] Card defeat fans: ${attackerSide} earns +${defeatFans} for defeating ${defenderCard.rarity} "${defenderCard.name}"`);

  const result: SubBattleResult = {
    idx: state.history.length + 1,
    defenderSide,
    defenderCard,
    attackerSide,
    attackCards,
    attackPower: state.attackCurrentPower,
    defeatFans,
    winner: attackerSide,
  };

  return {
    ...state,
    phase: 'battle_resolve',
    playerFans: newPlayerFans,
    aiFans: newAiFans,
    message: `${attackerSide === 'player' ? 'あなた' : '相手'}がフラッグ奪取！ +${defeatFans}ファン`,
    // Attacker's bench is untouched; only the defender's bench grows.
    player: {
      ...state.player,
      bench: defenderSide === 'player' ? newDefenderBench : state.player.bench,
      deck: defenderDeckForSide('player'),
    },
    ai: {
      ...state.ai,
      bench: defenderSide === 'ai' ? newDefenderBench : state.ai.bench,
      deck: defenderDeckForSide('ai'),
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
    subBattleCount: state.subBattleCount + 1,
    lastSubBattle: result,
    history: [...state.history, result],
  };
}

/**
 * Advance to the next round after a round_end. Awards fans for the round,
 * resets bench/quarantine, and transitions to the next deck_phase or game_over.
 */
export function advanceToNextRound(state: GameState): GameState {
  if (state.phase !== 'round_end' || !state.roundWinner) return state;

  // Award trophy (round win count) and trophy fans for this round
  const trophyFanBonus = state.trophyFans[state.round - 1] ?? 0;
  const newPlayerTrophies = state.roundWinner === 'player' ? state.playerTrophies + 1 : state.playerTrophies;
  const newAiTrophies = state.roundWinner === 'ai' ? state.aiTrophies + 1 : state.aiTrophies;
  const newPlayerFans = state.roundWinner === 'player' ? state.playerFans + trophyFanBonus : state.playerFans;
  const newAiFans = state.roundWinner === 'ai' ? state.aiFans + trophyFanBonus : state.aiFans;

  const nextRound = state.round + 1;

  // After all rounds → game_over with fan totals
  if (nextRound > state.totalRounds) {
    const fanWinner: Side = newPlayerFans >= newAiFans ? 'player' : 'ai';
    return {
      ...state,
      phase: 'game_over',
      round: state.round,
      winner: fanWinner,
      playerTrophies: newPlayerTrophies,
      aiTrophies: newAiTrophies,
      playerFans: newPlayerFans,
      aiFans: newAiFans,
      message: `最終結果: あなた ${newPlayerFans} ファン vs 相手 ${newAiFans} ファン`,
    };
  }

  // Advance to next round: collect ALL cards back to deck, reset bench/quarantine.
  // ベンチ + 隔離 + 防御カード + 攻撃中カード → 全てデッキに回収してシャッフル
  // 進化カードはラウンド内限定のため、元のカードに戻す
  const revertEvolution = (card: BattleCard): BattleCard => {
    if (card.name === '大蛇' && card.id.startsWith('evolved-giant-snake-')) {
      const anaconda = ALL_BATTLE_CARDS.find((c) => c.name === 'アナコンダ');
      if (anaconda) {
        console.log('[Engine] 大蛇 → アナコンダに戻す (ラウンド終了)');
        return { ...anaconda, id: `reverted-anaconda-${Date.now()}` };
      }
    }
    if (card.name === '万能の天才' && card.id.startsWith('evolved-genius-')) {
      const davinci = ALL_BATTLE_CARDS.find((c) => c.name === 'レオナルド・ダ・ヴィンチ');
      if (davinci) {
        console.log('[Engine] 万能の天才 → レオナルド・ダ・ヴィンチに戻す (ラウンド終了)');
        return { ...davinci, id: `reverted-davinci-${Date.now()}` };
      }
    }
    // 聖女ジャンヌは火刑により変身したカード。ジャンヌ本体はすでに除外されているため
    // ラウンド終了時に戻す先がなく、聖女ジャンヌのまま残る。
    return card;
  };

  const collectCards = (ps: PlayerState, side: Side): BattleCard[] => {
    const cards: BattleCard[] = ps.deck.map(revertEvolution);
    for (const slot of ps.bench) {
      for (let i = 0; i < slot.count; i++) cards.push(revertEvolution(slot.card));
    }
    cards.push(...state.quarantine[side].map(revertEvolution));
    if (state.defenseCard && state.flagHolder === side) cards.push(revertEvolution(state.defenseCard));
    if (otherSide(state.flagHolder) === side) cards.push(...state.attackRevealed.map(revertEvolution));
    return cards;
  };

  const playerDeck = shuffleDeck(collectCards(state.player, 'player'));
  const aiDeck = shuffleDeck(collectCards(state.ai, 'ai'));

  console.log(`[Engine] advanceToNextRound: player deck ${state.player.deck.length} → ${playerDeck.length}, ai deck ${state.ai.deck.length} → ${aiDeck.length}`);

  return {
    ...state,
    phase: 'deck_phase',
    round: nextRound,
    subBattleCount: 0,
    playerTrophies: newPlayerTrophies,
    aiTrophies: newAiTrophies,
    playerFans: newPlayerFans,
    aiFans: newAiFans,
    roundWinner: null,
    player: { ...state.player, deck: playerDeck, bench: [] },
    ai: { ...state.ai, deck: aiDeck, bench: [] },
    quarantine: { player: [], ai: [] },
    exile: state.exile, // persist across rounds
    sealedBenchNames: { player: [], ai: [] },
    flagHolder: state.roundWinner,
    defenseCard: null,
    attackRevealed: [],
    attackCurrentPower: 0,
    lastSubBattle: null,
    defenderBonus: 0,
    roundAttackBonus: { player: 0, ai: 0 },
    pendingAttackBonus: { player: 0, ai: 0 },
    effectTelop: null,
    benchGlow: null,
    benchBoostDetails: null,
    lastRevealPowerAdded: 0,
    usedGiantSnake: { player: false, ai: false },
    effectSuppressed: { player: false, ai: false },
    message: `第${nextRound}回戦 デッキフェイズ：カードを選ぼう`,
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
  let next: GameState = {
    ...state,
    phase: 'battle_intro',
    message: state.flagHolder === 'player' ? 'あなたが防御中！' : 'あなたの攻撃！',
  };
  // 新しい防御カード（前回の最後の攻撃カード）に対してベンチ効果を適用
  const defender = next.defenseCard!;
  console.log(`[Engine] continueAfterResolve: defender="${defender.name}" (effect=${defender.effect?.id ?? 'none'}) | flagHolder=${state.flagHolder}`);
  if (defender.effect) {
    const eff = applyRevealEffect(next, defender, state.flagHolder, 'defender');
    next = withTelop(eff.state, eff.telop);
    console.log(`[Engine]   defender effect "${defender.effect.id}" applied (sub-battle transition)`);
  }
  const defAura = applyDefenderAura(next, state.flagHolder);
  next = defAura.state;
  if (defAura.details.length > 0) {
    next = { ...next, benchBoostDetails: defAura.details };
  }
  return next;
}
