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
import type { RoundBonuses, RoundStartSnapshot } from './knowledgeBonuses';
import { computePhase1Bonuses, computePhase2Bonuses } from './knowledgeBonuses';

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

export interface DefeatFanContributor {
  /** どの層のカードか（UI animation での色分け＋発射位置決定に使う） */
  role: 'attacker' | 'defender' | 'defender_supporter';
  cardName: string;
  rarity: string;
  fans: number;
}

export interface SubBattleResult {
  idx: number;
  defenderSide: Side;
  defenderCard: BattleCard;
  attackerSide: Side;
  attackCards: BattleCard[];
  attackPower: number;
  defeatFans: number;  // total card defeat fans earned by attacker (β3: attacker + defender + defender quarantine rarities summed)
  defeatFansBreakdown: DefeatFanContributor[];  // per-card breakdown for UI animation
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
  exile: { player: BattleCard[]; ai: BattleCard[] };          // round-scoped removed cards (returned to deck at advanceToNextRound)
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
  usedElixir:     { player: boolean; ai: boolean }; // 不老不死の薬（1バトル=1試合1回、ラウンド跨ぎで保持）
  effectSuppressed: { player: boolean; ai: boolean }; // 聖女ジャンヌ「神の啓示」で相手効果をこのラウンド無効化
  // ===== Combo bonus tracking (Phase 1) =====
  // 連続破壊コンボ — 攻撃失敗 or ラウンド終了でリセット。side 別。
  consecutiveKillStreak: { player: number; ai: number };
  // そのラウンドで最後に破壊を起こした攻撃カード（round_end 時点のものが「フィニッシャー」）
  roundFinisherCard: BattleCard | null;
  roundFinisherSide: Side | null;
  // advanceToNextRound で計算される直前ラウンドのボーナス内訳。UI が TrophyBonusBreakdown で読む。
  lastRoundBonuses: RoundBonuses | null;
  // ===== Phase 2 bonus tracking (perfect / comeback / last-draw) =====
  // ラウンド中に各 side が失ったカード数（防御時に破壊された回数）。advanceToNextRound で 0 リセット。
  cardsLostThisRound: { player: number; ai: number };
  // バトル全体通算で失ったカード数（game_over まで保持、フルゲームパーフェクト判定用）。
  totalCardsLost: { player: number; ai: number };
  // ラウンド開始時のファン値スナップショット（劣勢逆転判定用）。
  roundStartSnapshot: RoundStartSnapshot | null;
  // そのラウンドで「最後のドロー」が決定打になったか（resolveSubBattleWin で検出）。
  roundFinisherLastDraw: boolean;
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
    usedElixir:     { player: false, ai: false },
    effectSuppressed: { player: false, ai: false },
    consecutiveKillStreak: { player: 0, ai: 0 },
    roundFinisherCard: null,
    roundFinisherSide: null,
    lastRoundBonuses: null,
    cardsLostThisRound: { player: 0, ai: 0 },
    totalCardsLost: { player: 0, ai: 0 },
    roundStartSnapshot: { playerFans: 0, aiFans: 0 },
    roundFinisherLastDraw: false,
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

/** (removed) 十二単 no longer provides exile protection — now serves as defense buff reference */

/** Check if 安土城 is protecting 織田信長 from exile on the given side */
function hasAzuchiProtection(state: GameState, protectedSide: Side): boolean {
  const my = protectedSide === 'player' ? state.player : state.ai;
  const sealed = state.sealedBenchNames[protectedSide];
  return my.bench.some((b) => b.name === '安土城' && !sealed.includes(b.name));
}

/** Filter out protected cards from exile list (ロベン島 → マンデラ, 安土城 → 信長) */
function filterExileWithRobbenIsland(cards: BattleCard[], state: GameState, targetSide: Side): { exiled: BattleCard[]; protected: BattleCard[] } {
  const robben = hasRobbenIslandProtection(state, targetSide);
  const azuchi = hasAzuchiProtection(state, targetSide);
  if (!robben && !azuchi) {
    return { exiled: cards, protected: [] };
  }
  const exiled: BattleCard[] = [];
  const saved: BattleCard[] = [];
  for (const c of cards) {
    if (robben && c.name === 'ネルソン・マンデラ') saved.push(c);
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
      // 信長の威光: ベンチに本能寺の変があれば、デッキ底へ送り返す（歴史的介入）。
      // honnoji は自デッキ 1 枚制限（MAX_SAME_NAME_OVERRIDE）なので返却先は常に 1 枚分のみ。
      {
        const myAfter = side === 'player' ? next.player : next.ai;
        const sealedAfter = next.sealedBenchNames[side];
        const honnojiSlot = myAfter.bench.find((b) => b.name === '本能寺の変' && !sealedAfter.includes(b.name));
        if (honnojiSlot) {
          const newBench = removeOneFromBench(myAfter.bench, '本能寺の変');
          const newDeck = [...myAfter.deck, honnojiSlot.card];
          next = applySide(next, side, { ...myAfter, bench: newBench, deck: newDeck });
          telop = { text: `${telop?.text ?? '🔥信長天下布武！'} + 👑本能寺を退けた`, color };
          console.log('[特殊効果] 織田信長: ベンチの本能寺の変をデッキ底へ送還');
        }
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
      // kk spec 2026-04-20: ピラニアバフはベンチにアマゾン川がある時のみ発動。
      //   封印されたアマゾン川は無効。不在時は静かにスキップせず、ヒントテロップを出す。
      //   ピラニア count 側の封印考慮は別 commit のスコープ外（現状維持）。
      if (role === 'attacker') {
        const myState = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasAmazonRiver = myState.bench.some(
          (b) => b.name === 'アマゾン川' && !sealed.includes(b.name),
        );
        const same = myState.bench.find((b) => b.name === card.name);
        const copies = same?.count ?? 0;
        console.log(`[Engine]   piranha check: role=${role}, amazonRiver=${hasAmazonRiver}, benchMatch="${same?.name ?? 'none'}", copies=${copies}, bench=[${myState.bench.map(b => `${b.name}×${b.count}`).join(', ')}]`);
        if (hasAmazonRiver && copies > 0) {
          bonusAttack += copies;
          telop = { text: `🐟ピラニアの群れの猛攻！攻撃+${copies}`, color };
        } else if (!hasAmazonRiver) {
          telop = { text: '🐟ピラニア…アマゾン川がなく群れは動かず', color };
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
      // 焚書坑儒 (spec v7): X = 自ベンチの紙 + 自ベンチの始皇帝の勅令
      // 相手デッキトップから X 枚、自デッキトップから X 枚を除外。
      // 「始皇帝ベンチで×2」条項は撤廃。
      const oppState = opp  === 'player' ? next.player : next.ai;
      const myState  = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const paperCount  = myState.bench.find((b) => b.name === '紙' && !sealed.includes(b.name))?.count ?? 0;
      const decreeCount = myState.bench.find((b) => b.name === '始皇帝の勅令' && !sealed.includes(b.name))?.count ?? 0;
      const X = paperCount + decreeCount;
      console.log(`[Engine][book_burning] side=${side} role=${role} paper=${paperCount} decree=${decreeCount} X=${X} myBench=[${myState.bench.map(b=>b.name+'x'+b.count).join(',')}] oppDeckTop=${oppState.deck.slice(0,X).map(c=>c.name).join(',')} myDeckTop=${myState.deck.slice(0,X).map(c=>c.name).join(',')}`);

      if (X <= 0) {
        telop = { text: '📚 焚書坑儒（ベンチに紙・勅令がありません）', color };
        break;
      }

      // 相手デッキトップから X 枚（ロベン島保護あり）
      const oppCandidates = oppState.deck.slice(0, X);
      const oppRemaining  = oppState.deck.slice(X);
      const { exiled: oppExiled, protected: oppSaved } = filterExileWithRobbenIsland(oppCandidates, next, opp);
      next = applySide(next, opp, { ...oppState, deck: [...oppSaved, ...oppRemaining] });
      if (oppExiled.length > 0) {
        next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], ...oppExiled] } };
      }

      // 自デッキトップから X 枚（自ベンチにロベン島があれば保護）
      const myStateNow  = side === 'player' ? next.player : next.ai;
      const myCandidates = myStateNow.deck.slice(0, X);
      const myRemaining  = myStateNow.deck.slice(X);
      const { exiled: myExiled, protected: mySaved } = filterExileWithRobbenIsland(myCandidates, next, side);
      next = applySide(next, side, { ...myStateNow, deck: [...mySaved, ...myRemaining] });
      if (myExiled.length > 0) {
        next = { ...next, exile: { ...next.exile, [side]: [...next.exile[side], ...myExiled] } };
      }

      const glow: string[] = [];
      if (paperCount  > 0) glow.push('紙');
      if (decreeCount > 0) glow.push('始皇帝の勅令');
      if (glow.length > 0) next = withBenchGlow(next, side, glow);

      const protectMsg = (oppSaved.length + mySaved.length) > 0 ? '（ロベン島が守った！）' : '';
      telop = {
        text: `📚 思想統制！紙${paperCount}＋勅令${decreeCount}=${X}枚ずつ除外（相手${oppExiled.length}・自分${myExiled.length}）${protectMsg}`,
        color,
      };
      console.log(`[特殊効果] 焚書坑儒: X=${X} (紙${paperCount}+勅令${decreeCount}) opp=${oppExiled.length} my=${myExiled.length}`);
      break;
    }
    case 'elixir': {
      // 不老不死の薬 (spec v7):
      // 攻撃時（1バトル1回、ラウンド跨ぎ保持）、除外の始皇帝をデッキトップに戻す。
      // ガード順: role / 使用済み / 除外に始皇帝存在。
      const myElixirDbg = side === 'player' ? next.player : next.ai;
      console.log(`[Engine][elixir] side=${side} role=${role} used=${next.usedElixir[side]} exile=[${next.exile[side].map(c=>c.name).join(',')}] bench=[${myElixirDbg.bench.map(b=>b.name).join(',')}]`);
      if (role !== 'attacker') {
        console.log(`[Engine][elixir] skip: not attacker`);
        telop = { text: '💊 不老不死の薬（攻撃時のみ発動）', color };
        break;
      }
      if (next.usedElixir[side]) {
        console.log(`[Engine][elixir] skip: already used this battle`);
        telop = { text: '💊 不老不死の薬（このバトルでは使用済み）', color };
        break;
      }
      const exileList = next.exile[side];
      const emperorIdx = exileList.findIndex((c) => c.name === '始皇帝');
      if (emperorIdx < 0) {
        console.log(`[Engine][elixir] skip: no 始皇帝 in exile`);
        telop = { text: '💊 不老不死の薬（除外に始皇帝なし）', color };
        break;
      }
      console.log(`[Engine][elixir] FIRE: revive 始皇帝 from exile to deck top`);
      const emperorCard = exileList[emperorIdx];
      const newExile = [...exileList.slice(0, emperorIdx), ...exileList.slice(emperorIdx + 1)];
      const myElixirState = side === 'player' ? next.player : next.ai;
      const newDeck = [emperorCard, ...myElixirState.deck];
      next = applySide(next, side, { ...myElixirState, deck: newDeck });
      next = {
        ...next,
        exile:       { ...next.exile,      [side]: newExile },
        usedElixir:  { ...next.usedElixir, [side]: true },
      };
      telop = { text: '💊 不老不死の薬！始皇帝をデッキトップへ復活！', color: '#ffd700' };
      console.log('[特殊効果] 不老不死の薬: 除外→デッキトップ、usedElixir=true');
      break;
    }
    case 'photosynthesis': {
      // 光合成「密林の再生」: デッキから植物カード1枚をデッキトップに置く（現在対象なし）
      // 将来の植物デッキ用に先行実装
      const plantNames = new Set<string>(); // 植物カード未定義
      const my = side === 'player' ? next.player : next.ai;
      const idx = my.deck.findIndex((c) => plantNames.has(c.name));
      if (idx > 0) {
        const newDeck = [...my.deck];
        const [moved] = newDeck.splice(idx, 1);
        newDeck.unshift(moved);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: `🌿 密林の再生！${moved.name}をデッキトップへ`, color };
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
      // 兵馬俑 (spec v7): 公開時（任意・自動発動）、除外の秦の兵士 1 枚をデッキトップに戻す。
      // 死者の兵を蘇らせるテーマ。発動源が「ベンチ」から「除外」に変わった。
      const myTcState = side === 'player' ? next.player : next.ai;
      const exileList = next.exile[side];
      console.log(`[Engine][terracotta] side=${side} role=${role} exile=[${exileList.map(c=>c.name).join(',')}] bench=[${myTcState.bench.map(b=>b.name).join(',')}]`);
      const soldierIdx = exileList.findIndex((c) => c.name === '秦の兵士');
      if (soldierIdx < 0) {
        console.log(`[Engine][terracotta] skip: no 秦の兵士 in exile`);
        telop = { text: '🗿 兵馬俑（除外に秦の兵士なし）', color };
        break;
      }
      console.log(`[Engine][terracotta] FIRE: 秦の兵士 exile→deck top`);
      const soldierCard = exileList[soldierIdx];
      const newExile = [...exileList.slice(0, soldierIdx), ...exileList.slice(soldierIdx + 1)];
      const newDeck = [soldierCard, ...myTcState.deck];
      next = applySide(next, side, { ...myTcState, deck: newDeck });
      next = { ...next, exile: { ...next.exile, [side]: newExile } };
      telop = { text: '🗿 兵馬俑！除外の秦の兵士をデッキトップへ！', color };
      console.log(`[Engine] 兵馬俑: 除外→デッキトップ`);
      break;
    }
    case 'qinshi': {
      // 始皇帝:
      //  - 防御時（自動）、ベンチに万里の長城があれば防御+2
      //  - 公開時（任意発動）、ベンチの焚書坑儒をデッキトップに戻す（AI自動 / プレイヤーはUIで選択）
      const myBefore = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];

      // 防御バフ（自動）
      if (role === 'defender') {
        const hasWall = myBefore.bench.some((b) => b.name === '万里の長城' && !sealed.includes(b.name));
        if (hasWall) {
          next = { ...next, defenderBonus: next.defenderBonus + 2 };
          next = withBenchGlow(next, side, ['万里の長城']);
          telop = { text: '👑始皇帝天下統一！万里の長城の守りで防御+2！', color };
        } else {
          telop = { text: '👑始皇帝', color };
        }
      } else {
        telop = { text: '👑始皇帝', color };
      }

      // 公開時（任意発動）: 焚書坑儒をデッキトップに戻す
      const myNow = side === 'player' ? next.player : next.ai;
      const burnSlot = myNow.bench.find((b) => b.name === '焚書坑儒' && !sealed.includes(b.name));
      if (burnSlot) {
        if (side === 'ai') {
          const newBench = removeOneFromBench(myNow.bench, '焚書坑儒');
          const newDeck = [burnSlot.card, ...myNow.deck];
          next = applySide(next, side, { ...myNow, bench: newBench, deck: newDeck });
          telop = { text: '👑始皇帝！焚書坑儒をデッキトップへ！', color };
          console.log('[Engine] 始皇帝: 焚書坑儒をベンチ→デッキトップへ (AI)');
        } else {
          // Player: UIが waitCardSelect で選択処理
          telop = { text: '👑始皇帝！焚書坑儒を回収中...', color };
        }
      }
      break;
    }
    case 'great_wall': {
      // 万里の長城: ベンチ常駐効果のテロップのみ（実処理はcomputeAttackerAura）
      telop = { text: '🏯万里の長城！鉄壁の防壁', color };
      break;
    }
    case 'amazon_river': {
      // 密林の大河: ベンチ常駐（アマゾン生物の防御+1）— テロップのみ、実効果はapplyDefenderAura
      telop = { text: '🏞️ 密林の大河！アマゾン生物の防御を強化', color };
      break;
    }
    case 'anaconda': {
      // 締めつけ: ベンチ常駐（相手防御バフ-2）— テロップのみ、実効果はapplyDefenderAura
      telop = { text: '🐍 アナコンダ！ベンチで相手の防御バフを打ち消す', color };
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
        if (slotAtk === 2) atk2Count += slot.count;
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
      // 大蛇の巫師: ベンチにアマゾン川+アナコンダがあれば、アナコンダ除外→大蛇をデッキトップに召喚
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasRiver = my.bench.some((b) => b.name === 'アマゾン川' && !sealed.includes(b.name));
      const hasAnaconda = my.bench.some((b) => b.name === 'アナコンダ' && !sealed.includes(b.name));
      if (hasRiver && hasAnaconda) {
        const giantSnakeTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '大蛇');
        if (giantSnakeTemplate) {
          // Exile one アナコンダ from bench
          const newBench = removeOneFromBench(my.bench, 'アナコンダ');
          const anacondaCard = my.bench.find((b) => b.name === 'アナコンダ')!.card;
          // Summon 大蛇 to deck top
          const summoned: BattleCard = { ...giantSnakeTemplate, id: `summoned-giant-snake-${Date.now()}` };
          const newDeck = [summoned, ...my.deck];
          next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
          next = { ...next, exile: { ...next.exile, [side]: [...next.exile[side], anacondaCard] } };
          next = withBenchGlow(next, side, ['アマゾン川', 'アナコンダ']);
          telop = { text: '🐍 大蛇の巫師！アナコンダを捧げ、大蛇を召喚！', color: '#ffd700' };
          console.log('[Engine] 大蛇の巫師 → アナコンダ除外、大蛇をデッキトップに召喚');
        }
      } else {
        const missing = !hasRiver && !hasAnaconda ? 'アマゾン川とアナコンダ' : !hasRiver ? 'アマゾン川' : 'アナコンダ';
        telop = { text: `🐍 大蛇の巫師（ベンチに${missing}がいません）`, color };
      }
      break;
    }
    case 'pink_dolphin': {
      // ピンクイルカ: ベンチまたは除外の大蛇の巫師をデッキトップに戻す
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const benchHunter = my.bench.find((b) => b.name === '大蛇の巫師' && !sealed.includes(b.name));
      const exileHunter = next.exile[side].find((c) => c.name === '大蛇の巫師');
      if (benchHunter || exileHunter) {
        if (side === 'ai') {
          // AI: prefer bench (free), then exile
          if (benchHunter) {
            const newBench = removeOneFromBench(my.bench, '大蛇の巫師');
            const newDeck = [benchHunter.card, ...my.deck];
            next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
            next = withBenchGlow(next, side, ['大蛇の巫師']);
            telop = { text: '🐬 ピンクイルカ！大蛇の巫師をベンチからデッキトップへ！', color: '#ffd700' };
          } else if (exileHunter) {
            const newExile = next.exile[side].filter((c) => c.id !== exileHunter.id);
            const newDeck = [exileHunter, ...my.deck];
            next = applySide(next, side, { ...my, deck: newDeck });
            next = { ...next, exile: { ...next.exile, [side]: newExile } };
            telop = { text: '🐬 ピンクイルカ！大蛇の巫師を除外からデッキトップへ！', color: '#ffd700' };
          }
        } else {
          // Player: UI handles selection
          telop = { text: '🐬 ピンクイルカ！大蛇の巫師を回収...', color: '#ffd700' };
        }
      } else {
        telop = { text: '🐬 ピンクイルカ（大蛇の巫師がいません）', color };
      }
      break;
    }
    case 'poison_frog': {
      // 毒矢カエル: 防御時のみ、相手ベンチ1枚を除外（任意発動）
      if (role !== 'defender') {
        telop = { text: '🐸 毒矢カエル（防御時のみ効果発動）', color };
        break;
      }
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
    case 'banner': {
      // 軍旗: 公開時（任意発動）、デッキのジャンヌ・ダルクをデッキトップに置く
      const my = side === 'player' ? next.player : next.ai;
      const jeanneIdx = my.deck.findIndex((c) => c.name === 'ジャンヌ・ダルク');
      if (jeanneIdx >= 0) {
        if (side === 'ai') {
          const jeanneCard = my.deck[jeanneIdx];
          const newDeck = [jeanneCard, ...my.deck.slice(0, jeanneIdx), ...my.deck.slice(jeanneIdx + 1)];
          next = applySide(next, side, { ...my, deck: newDeck });
          telop = { text: '🚩進軍の号令！ジャンヌをデッキトップへ！', color: '#ffd700' };
        } else {
          telop = { text: '🚩進軍の号令！ジャンヌをサーチ中...', color: '#ffd700' };
        }
      } else {
        telop = { text: '🚩軍旗（デッキにジャンヌがいません）', color };
      }
      break;
    }
    case 'jeanne': {
      // ジャンヌ・ダルク: 攻撃時+聖剣ベンチ→攻撃+2、防御時+白百合の盾ベンチ→防御+2
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const hasSword = my.bench.some((b) => b.name === '聖剣' && !sealed.includes(b.name));
      const hasLily = my.bench.some((b) => b.name === '白百合の盾' && !sealed.includes(b.name));
      const glowNames: string[] = [];
      if (role === 'attacker' && hasSword) {
        bonusAttack += 2;
        glowNames.push('聖剣');
        telop = { text: '⚔️聖剣の加護！ジャンヌ攻撃+2！', color };
      } else if (role === 'defender' && hasLily) {
        next = { ...next, defenderBonus: next.defenderBonus + 2 };
        glowNames.push('白百合の盾');
        telop = { text: '🛡️百合の守り！ジャンヌ防御+2！', color };
      } else {
        telop = { text: '⚜️ジャンヌ・ダルク！', color };
      }
      if (glowNames.length > 0) next = withBenchGlow(next, side, glowNames);
      break;
    }
    case 'burning_stake': {
      // 殉教の炎: ベンチにジャンヌ・ダルクがいる時、そのジャンヌを除外する（任意発動）
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      console.log(`[Engine][burning_stake] side=${side} role=${role} bench=[${my.bench.map(b=>b.name).join(',')}] exile_before=[${next.exile[side].map(c=>c.name).join(',')}]`);
      const jeanneSlot = my.bench.find((b) => b.name === 'ジャンヌ・ダルク' && !sealed.includes(b.name));
      if (!jeanneSlot) {
        console.log(`[Engine][burning_stake] skip: no ジャンヌ on bench`);
        telop = { text: '🔥 火刑（ベンチにジャンヌがいません）', color };
        break;
      }
      console.log(`[Engine][burning_stake] FIRE: move ジャンヌ from bench to exile`);
      // ベンチからジャンヌを1枚除外
      const newBench = removeOneFromBench(my.bench, 'ジャンヌ・ダルク');
      next = applySide(
        { ...next, exile: { ...next.exile, [side]: [...next.exile[side], jeanneSlot.card] } },
        side,
        { ...my, bench: newBench },
      );
      telop = { text: '🔥 殉教の炎！ジャンヌが炎に包まれた…', color: '#ff6600' };
      console.log(`[Engine] 火刑 → ベンチのジャンヌ・ダルクを除外`);
      break;
    }
    case 'saint_jeanne': {
      // 救国の祈り (v2 spec, kk 2026-04-19):
      //   - 公開時: 味方の除外カードを全てデッキに戻す
      //   - 防御時（passive）: そのサブバトルの相手1枚目の attacker reveal の
      //     攻撃値バフを無効化 → 判定は revealNextAttackCard 側で完結
      //   - ベンチシナジー: 聖剣で攻撃+2、白百合の盾で防御+3（ジャンヌと同等）
      // 旧仕様の「相手防御-3 / roundAttackBonus[opp]-3」は撤廃（累積して相手攻撃を
      // 過度に削る副作用があったため）。
      const exiledForSide = next.exile[side];
      const recoveredCount = exiledForSide.length;
      if (recoveredCount > 0) {
        next = { ...next, exile: { ...next.exile, [side]: [] } };
        const mySideNow = side === 'player' ? next.player : next.ai;
        next = applySide(next, side, { ...mySideNow, deck: [...mySideNow.deck, ...exiledForSide] });
      }
      // ベンチの聖剣・白百合の盾による強化（ジャンヌと同じ条件）
      const mySJ = side === 'player' ? next.player : next.ai;
      const sealedSJ = next.sealedBenchNames[side];
      const hasSwordSJ = mySJ.bench.some((b) => b.name === '聖剣' && !sealedSJ.includes(b.name));
      const hasLilySJ = mySJ.bench.some((b) => b.name === '白百合の盾' && !sealedSJ.includes(b.name));
      const sjGlow: string[] = [];
      if (role === 'attacker' && hasSwordSJ) {
        bonusAttack += 2;
        sjGlow.push('聖剣');
      } else if (role === 'defender' && hasLilySJ) {
        next = { ...next, defenderBonus: next.defenderBonus + 3 };
        sjGlow.push('白百合の盾');
      }
      if (sjGlow.length > 0) next = withBenchGlow(next, side, sjGlow);
      telop = { text: `✨ 救国の祈り！除外${recoveredCount}枚回収`, color: '#ffd700' };
      console.log(`[Engine] 聖女ジャンヌ → 除外回収=${recoveredCount}枚 (バフ無効化は defender スロット配置中に発動)`);
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
      // 山札残りも exile に退避（次ラウンドで信長デッキ全体を復帰させるため）
      for (const c of my.deck) newExileSelf.push(c);
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
    case 'stackable_weapon_buff': {
      // kk spec v7 Phase 3 (2026-04-20): 武器スタックバフ
      //   攻撃時、既に attackRevealed に積まれている同名カード数 × +1 を加算。
      //   nextCard は revealNextAttackCard 内で attackRevealed に push 済み
      //   （knowledgeEngine.ts L2781 参照）なので、-1 して自身を除外する。
      //   1 枚目 → priorInStack=0、バフなし。2 枚目 → +1、3 枚目 → +2。
      //   サブバトル終了で attackRevealed は解決されるため自動リセット。
      if (role === 'attacker') {
        const priorInStack = next.attackRevealed.filter((c) => c.name === card.name).length - 1;
        if (priorInStack > 0) {
          bonusAttack += priorInStack;
          telop = { text: `🔫${card.name}スタック${priorInStack + 1}！攻撃+${priorInStack}`, color };
        } else {
          telop = { text: `🔫${card.name}構え！`, color };
        }
      }
      break;
    }
    case 'rakuichi': {
      // 楽市楽座: ベンチの足軽1枚をデッキトップに戻す（自動発動、複数時は先頭採用）
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const ashigaruSlot = my.bench.find((b) => b.name === '足軽' && !sealed.includes(b.name));
      if (ashigaruSlot) {
        const newBench = removeOneFromBench(my.bench, '足軽');
        const newDeck = [ashigaruSlot.card, ...my.deck];
        next = applySide(next, side, { ...my, bench: newBench, deck: newDeck });
        next = withBenchGlow(next, side, ['足軽']);
        telop = { text: '🏪 楽市楽座！足軽1枚をデッキトップへ', color };
      } else {
        telop = { text: '🏪 楽市楽座（ベンチに足軽がいません）', color };
      }
      console.log('[特殊効果] 楽市楽座: 足軽1枚をデッキトップへ');
      break;
    }
    case 'nagashino': {
      // 長篠の陣: 公開時、ベンチに鉄砲が3枚以上で攻撃+2（固定値、スケールしない）
      // Phase 4 でトークン鉄砲も合算予定
      if (role === 'attacker') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const teppoCount = my.bench
          .filter((b) => b.name === '鉄砲' && !sealed.includes(b.name))
          .reduce((sum, b) => sum + b.count, 0);
        if (teppoCount >= 3) {
          bonusAttack += 2;
          next = withBenchGlow(next, side, ['鉄砲']);
          telop = { text: `🔫 長篠の陣！鉄砲${teppoCount}枚で攻撃+2`, color: '#ffd700' };
        } else {
          telop = { text: `🔫 長篠の陣（鉄砲${teppoCount}/3枚）`, color };
        }
        console.log(`[特殊効果] 長篠の陣: 鉄砲${teppoCount}枚 → ${teppoCount >= 3 ? '攻撃+2' : '条件未達'}`);
      } else {
        telop = { text: '🔫 長篠の陣！', color };
      }
      break;
    }
    case 'bafousaku': {
      // 馬防柵: passive defender デバフ（実処理は revealNextAttackCard）。
      // reveal 時はテロップで配備宣言のみ。
      telop = { text: '🏯 馬防柵を配備！相手の初撃を-1', color };
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
      // 秦の兵士: 防御時、ベンチに万里の長城があれば防御+2
      if (role === 'defender') {
        const my = side === 'player' ? next.player : next.ai;
        const sealed = next.sealedBenchNames[side];
        const hasWall = my.bench.some((b) => b.name === '万里の長城' && !sealed.includes(b.name));
        if (hasWall) {
          next = { ...next, defenderBonus: next.defenderBonus + 2 };
          next = withBenchGlow(next, side, ['万里の長城']);
          telop = { text: '⚔️ 皇帝の尖兵！万里の長城の守りで防御+2！', color };
        } else {
          telop = { text: '⚔️ 秦の兵士（万里の長城なし）', color };
        }
      }
      break;
    }
    case 'imperial_decree': {
      // 始皇帝の勅令: デッキの紙または焚書坑儒を選んでデッキトップに配置（任意発動）
      const my = side === 'player' ? next.player : next.ai;
      const hasPaper = my.deck.some((c) => c.name === '紙');
      const hasBurn = my.deck.some((c) => c.name === '焚書坑儒');
      if ((hasPaper || hasBurn) && side === 'ai') {
        // AI: 焚書坑儒を優先、なければ紙をデッキトップへ
        const targetName = hasBurn ? '焚書坑儒' : '紙';
        let newDeck = [...my.deck];
        const idx = newDeck.findIndex((c) => c.name === targetName);
        const [card] = newDeck.splice(idx, 1);
        newDeck.unshift(card);
        next = applySide(next, side, { ...my, deck: newDeck });
        telop = { text: `📜 天子の命！${targetName}をデッキトップへ！`, color: '#ffd700' };
      } else if (hasPaper || hasBurn) {
        // Player: UI側で waitCardSelect 処理
        telop = { text: '📜 天子の命！サーチ中...', color: '#ffd700' };
      } else {
        telop = { text: '📜 天子の命（対象カードがありません）', color };
      }
      break;
    }
    case 'prayer_light': {
      // 祈りの光: 除外されたジャンヌ・ダルクを聖女ジャンヌとしてデッキの一番上に置く（任意発動）
      const myPrayerDbg = side === 'player' ? next.player : next.ai;
      console.log(`[Engine][prayer_light] side=${side} role=${role} exile=[${next.exile[side].map(c=>c.name).join(',')}] bench=[${myPrayerDbg.bench.map(b=>b.name).join(',')}]`);
      const exiledJeanne = next.exile[side].find((c) => c.name === 'ジャンヌ・ダルク');
      if (exiledJeanne) {
        console.log(`[Engine][prayer_light] found exiled Jeanne, side=${side}, will ${side === 'ai' ? 'FIRE (AI branch)' : 'delegate to UI (player branch)'}`);
        const saintTemplate = ALL_BATTLE_CARDS.find((c) => c.name === '聖女ジャンヌ');
        if (saintTemplate) {
          if (side === 'ai') {
            // 元ジャンヌは除外に残し、聖女ジャンヌだけをデッキトップに生成する（spec: kk 2026-04-19）
            const saintCard: BattleCard = { ...saintTemplate, id: `saint-jeanne-prayer-${Date.now()}` };
            const my = next.ai;
            next = applySide(next, side, { ...my, deck: [saintCard, ...my.deck] });
            telop = { text: '✨ 聖なる祈り！ジャンヌが聖女として蘇る！', color: '#ffd700' };
            console.log(`[Engine] 祈りの光 → 除外のジャンヌ・ダルクはそのまま、聖女ジャンヌをデッキトップへ`);
          } else {
            telop = { text: '✨ 聖なる祈り！ジャンヌが聖女として蘇る...', color: '#ffd700' };
          }
        } else {
          telop = { text: '✨ 聖なる祈り（聖女ジャンヌが見つかりません）', color };
        }
      } else {
        console.log(`[Engine][prayer_light] skip: no ジャンヌ・ダルク in exile (side=${side})`);
        telop = { text: '✨ 聖なる祈り（除外にジャンヌがいません）', color };
      }
      break;
    }
    case 'holy_banner': {
      // 聖女の旗印: デッキにあるジャンヌ・ダルクをデッキの1番上に戻す（任意発動）
      const my = side === 'player' ? next.player : next.ai;
      const jeanneIdx = my.deck.findIndex((c) => c.name === 'ジャンヌ・ダルク');
      if (jeanneIdx >= 0) {
        if (side === 'ai') {
          const jeanneCard = my.deck[jeanneIdx];
          const newDeck = [jeanneCard, ...my.deck.slice(0, jeanneIdx), ...my.deck.slice(jeanneIdx + 1)];
          next = applySide(next, side, { ...my, deck: newDeck });
          telop = { text: '🏳️ 聖女の導き！ジャンヌ・ダルクをデッキトップへ！', color: '#ffd700' };
          console.log(`[Engine] 聖女の旗印 → デッキ内のジャンヌ・ダルクをデッキトップに移動`);
        } else {
          telop = { text: '🏳️ 聖女の導き！ジャンヌをサーチ中...', color: '#ffd700' };
        }
      } else {
        telop = { text: '🏳️ 聖女の導き（デッキにジャンヌがいません）', color };
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
    // ===== 紫式部・清少納言デッキ =====
    case 'murasaki':
    case 'sei_shonagon': {
      // 交戦中、ベンチの十二単の枚数だけ防御+1
      const heroName = effId === 'murasaki' ? '紫式部' : '清少納言';
      const my = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const junihitoeSlot = my.bench.find((b) => b.name === '十二単' && !sealed.includes(b.name));
      const jCount = junihitoeSlot?.count ?? 0;
      if (junihitoeSlot) next = withBenchGlow(next, side, ['十二単']);
      if (role === 'defender' && jCount > 0) {
        next = { ...next, defenderBonus: next.defenderBonus + jCount };
        telop = { text: `👘${heroName} 十二単の加護！防御+${jCount}`, color };
      } else if (jCount > 0) {
        telop = { text: `👘${heroName} 十二単${jCount}枚（防御時に効果発動）`, color };
      } else {
        telop = { text: `📖${heroName}（十二単なし）`, color };
      }
      break;
    }
    case 'genji': {
      // 公開時（任意発動）: ベンチの和歌の枚数をX、自分のベンチからX枚までデッキボトムに戻す
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const wakaSlot = myState.bench.find((b) => b.name === '和歌' && !sealed.includes(b.name));
      const wakaCount = wakaSlot?.count ?? 0;
      if (wakaCount > 0 && myState.bench.length > 0) {
        if (side === 'ai') {
          // AI: 弱いカードからX枚まで自動選択してデッキボトムへ
          const candidates = myState.bench.filter((b) => !sealed.includes(b.name));
          const sorted = [...candidates].sort((a, b) => {
            const aPow = (a.card.attackPower ?? a.card.power) + (a.card.defensePower ?? a.card.power);
            const bPow = (b.card.attackPower ?? b.card.power) + (b.card.defensePower ?? b.card.power);
            return aPow - bPow;
          });
          let remaining = wakaCount;
          let newBench = [...myState.bench];
          const newDeck = [...myState.deck];
          const returned: string[] = [];
          for (const slot of sorted) {
            if (remaining <= 0) break;
            const toReturn = Math.min(slot.count, remaining);
            for (let i = 0; i < toReturn; i++) {
              newBench = removeOneFromBench(newBench, slot.name);
              newDeck.push(slot.card);
              returned.push(slot.name);
              remaining--;
            }
          }
          if (returned.length > 0) {
            next = applySide(next, side, { ...myState, bench: newBench, deck: newDeck });
            telop = { text: `📖源氏物語！${returned.length}枚をデッキに戻した`, color };
          } else {
            telop = { text: '📖源氏物語（対象なし）', color };
          }
        } else {
          // Player: UI側で複数選択ハンドリング
          telop = { text: `📖源氏物語！和歌${wakaCount}枚分、ベンチからデッキに戻せる`, color };
        }
      } else {
        telop = { text: '📖源氏物語（和歌なし）', color };
      }
      break;
    }
    case 'makura_no_soshi': {
      // 公開時（任意発動）: ベンチの筆の枚数をX、相手ベンチからX枚まで除外
      const myState = side === 'player' ? next.player : next.ai;
      const sealed = next.sealedBenchNames[side];
      const fudeSlot = myState.bench.find((b) => b.name === '筆' && !sealed.includes(b.name));
      const fudeCount = fudeSlot?.count ?? 0;
      const oppState = opp === 'player' ? next.player : next.ai;
      if (fudeCount > 0 && oppState.bench.length > 0) {
        if (fudeSlot) next = withBenchGlow(next, side, ['筆']);
        if (side === 'ai') {
          // AI: 相手ベンチから強いカード順にX枚まで除外
          let candidates = [...oppState.bench];
          if (hasRobbenIslandProtection(next, opp)) {
            candidates = candidates.filter((b) => b.name !== 'ネルソン・マンデラ');
          }
          const sorted = candidates.sort((a, b) => {
            const aPow = (a.card.attackPower ?? a.card.power) + (a.card.defensePower ?? a.card.power);
            const bPow = (b.card.attackPower ?? b.card.power) + (b.card.defensePower ?? b.card.power);
            return bPow - aPow;
          });
          let remaining = fudeCount;
          let newOppBench = [...oppState.bench];
          const exiled: BattleCard[] = [];
          for (const slot of sorted) {
            if (remaining <= 0) break;
            const toExile = Math.min(slot.count, remaining);
            for (let i = 0; i < toExile; i++) {
              newOppBench = removeOneFromBench(newOppBench, slot.name);
              exiled.push(slot.card);
              remaining--;
            }
          }
          if (exiled.length > 0) {
            next = applySide(next, opp, { ...oppState, bench: newOppBench });
            next = { ...next, exile: { ...next.exile, [opp]: [...next.exile[opp], ...exiled] } };
            telop = { text: `📝枕草子！相手${exiled.length}枚を除外！`, color };
          } else {
            telop = { text: '📝枕草子（対象なし）', color };
          }
        } else {
          // Player: UI側で複数選択ハンドリング
          telop = { text: `📝枕草子！筆${fudeCount}枚分、相手ベンチから除外できる`, color };
        }
      } else {
        telop = { text: `📝枕草子（${fudeCount === 0 ? '筆なし' : '相手ベンチなし'}）`, color };
      }
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
  // 軍旗: ベンチオーラ廃止（公開時任意発動→ジャンヌサーチに変更）
  // アマゾン川: no longer a bench aura (changed to on-reveal deck search)
  if (sunflower >= 2) { bonus += 1; details.push({ benchCardName: 'ひまわり', atkBonus: 1, defBonus: 0 }); }
  // Opponent 万里の長城: 各サブバトルで最初の攻撃カードの攻撃-1（最低1）
  const opp = otherSide(attackerSide);
  const oppMe = opp === 'player' ? state.player : state.ai;
  const oppSealed = state.sealedBenchNames[opp];
  const oppHasGreatWall = oppMe.bench.some((b) => b.name === '万里の長城' && !oppSealed.includes(b.name));
  if (oppHasGreatWall && priorRevealCount === 0) {
    const baseAtk = getBaseAttack(card);
    if (baseAtk > 1) {
      bonus -= 1;
      details.push({ benchCardName: '万里の長城', atkBonus: -1, defBonus: 0 });
    }
  }
  // Opponent 万有引力: 2枚目以降の攻撃 -1
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
  // アマゾン川 bench aura: アマゾン生物の防御+1
  const AMAZON_CREATURES = new Set(['アナコンダ', 'ピラニア', '毒矢カエル', 'ジャガー', 'ピンクイルカ', '大蛇', '大蛇の巫師']);
  if (names.has('アマゾン川') && state.defenseCard && AMAZON_CREATURES.has(state.defenseCard.name)) {
    bonus += 1; details.push({ benchCardName: 'アマゾン川', atkBonus: 0, defBonus: 1 });
  }
  // アナコンダ bench debuff: 相手側のベンチにアナコンダがあれば防御バフを打ち消す
  const attackerSide = otherSide(defenderSide);
  const atkMe = attackerSide === 'player' ? state.player : state.ai;
  const atkSealed = state.sealedBenchNames[attackerSide];
  const anacondaSlot = atkMe.bench.find((b) => b.name === 'アナコンダ' && !atkSealed.includes(b.name));
  if (anacondaSlot && bonus > 0) {
    const reduction = anacondaSlot.count * 2;
    const actualReduction = Math.min(bonus, reduction);
    if (actualReduction > 0) {
      bonus -= actualReduction;
      details.push({ benchCardName: 'アナコンダ', atkBonus: 0, defBonus: -actualReduction });
    }
  }
  if (bonus === 0 && details.length === 0) return { state, details: [] };
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
  const baseDef = getBaseDefense(defender);
  console.log(`[Engine] startBattle: defender="${defender.name}" (effect=${defender.effect?.id ?? 'none'}) | flagHolder=${state.flagHolder} | baseDef=${baseDef}`);
  if (defender.effect) {
    const eff = applyRevealEffect(next, defender, state.flagHolder, 'defender');
    next = withTelop(eff.state, eff.telop);
    console.log(`[Engine]   defender effect "${defender.effect.id}" applied → defenderBonus=${next.defenderBonus}`);
  }
  const defAura = applyDefenderAura(next, state.flagHolder);
  next = defAura.state;
  if (defAura.details.length > 0) {
    next = { ...next, benchBoostDetails: defAura.details };
    for (const d of defAura.details) {
      console.log(`[ベンチ効果-防御] ${d.benchCardName} → ${defender.name} 防御+${d.defBonus}`);
    }
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

  console.log(`[防御計算] ${defender.name} 基本:${baseDef} + ベンチ:${next.defenderBonus} = 最終:${baseDef + next.defenderBonus}`);
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
      // Attacker failed → their combo streak breaks. Defender's streak is preserved.
      consecutiveKillStreak: {
        ...state.consecutiveKillStreak,
        [attackerSide]: 0,
      },
    };
  }

  const [nextCard, ...rest] = attacker.deck;
  const updatedAttacker: PlayerState = { ...attacker, deck: rest };

  // Pre-compute buffs BEFORE consuming pending
  const roundBonus = state.roundAttackBonus[attackerSide];
  const pendingBonus = state.pendingAttackBonus[attackerSide];

  // ===== 聖女ジャンヌ (passive defender) — kk spec v2 2026-04-19 =====
  //   - defender が聖女ジャンヌで、かつサブバトルの 1 枚目の reveal である場合
  //   - そのカードの「攻撃値バフ」をすべて無効化（base attack のみ計上）
  //   - カード効果の state 変更（デッキ操作等）は発動するが、bonusAttack は捨てる
  //   - ラウンドバフ / pending / NPC stage bonus / bench aura もすべて無視
  //   - pendingAttackBonus は通常通り「消費」（次の reveal に残らないように clear）
  // 判定条件は state.attackRevealed.length === 0（= 今サブバトル最初の reveal）。
  // サブバトル終了（resolveSubBattleWin / 攻撃失敗）で attackRevealed が [] にリセット
  // されるので、2 枚目以降は通常通りバフが乗る。
  const nullifyBuffs =
    state.defenseCard?.name === '聖女ジャンヌ' && state.attackRevealed.length === 0;

  let next: GameState = {
    ...state,
    player: attackerSide === 'player' ? updatedAttacker : state.player,
    ai: attackerSide === 'ai' ? updatedAttacker : state.ai,
    attackRevealed: [...state.attackRevealed, nextCard],
    // Consume pending buff (even when nullified — pending shouldn't leak to next reveal)
    pendingAttackBonus: { ...state.pendingAttackBonus, [attackerSide]: 0 },
  };

  // Base attack is always counted. All bonuses are gated by !nullifyBuffs.
  let addedPower = getBaseAttack(nextCard);
  if (!nullifyBuffs) {
    addedPower += roundBonus + pendingBonus;
  }

  // NPC stage bonus (attack) — skipped when nullifyBuffs
  if (!nullifyBuffs && attackerSide === 'ai' && state.stageRules) {
    const r = state.stageRules;
    if (r.npcAttackBonus && r.npcAttackBonusFilter) {
      if (nextCard.category === r.npcAttackBonusFilter) addedPower += r.npcAttackBonus;
    } else if (r.npcAttackBonus) {
      addedPower += r.npcAttackBonus;
    }
  }

  // Card-specific on-reveal effect (skippable when the attacker chose "効果なしで出す").
  // Under nullifyBuffs: effect's state mutations still apply (deck manipulation, exile, etc.)
  // but bonusAttack is discarded.
  const myBench = (attackerSide === 'player' ? next.player : next.ai).bench;
  console.log(`[Engine] revealNextAttackCard: "${nextCard.name}" (effect=${nextCard.effect?.id ?? 'none'}, skipEffect=${opts?.skipEffect ?? false}${nullifyBuffs ? ', nullifyBuffs=true (聖女ジャンヌ)' : ''}) | attacker=${attackerSide} | bench=[${myBench.map(b => `${b.name}×${b.count}`).join(', ')}]`);
  if (nextCard.effect && !opts?.skipEffect) {
    const eff = applyRevealEffect(next, nextCard, attackerSide, 'attacker');
    next = withTelop(eff.state, eff.telop);
    if (!nullifyBuffs) {
      addedPower += eff.bonusAttack;
      console.log(`[Engine]   effect "${nextCard.effect.id}" → bonusAttack=${eff.bonusAttack}, telop="${eff.telop?.text ?? 'none'}"`);
    } else {
      console.log(`[Engine]   effect "${nextCard.effect.id}" → bonusAttack=${eff.bonusAttack} DISCARDED (聖女ジャンヌ passive), state changes applied`);
    }
  }

  // Bench auras from passive cards — skipped when nullifyBuffs
  const aura = computeAttackerAura(next, attackerSide, nextCard, state.attackRevealed.length);
  if (!nullifyBuffs) {
    addedPower += aura.bonus;
    if (aura.bonus !== 0) console.log(`[Engine]   bench aura → bonus=${aura.bonus}, details=[${aura.details.map(d => `${d.benchCardName}:atk${d.atkBonus}`).join(', ')}]`);
  } else if (aura.bonus !== 0) {
    console.log(`[Engine]   bench aura bonus=${aura.bonus} DISCARDED (聖女ジャンヌ passive)`);
  }

  // ===== 馬防柵 (defender bench passive) — kk spec v7 Phase 2 2026-04-20 =====
  //   - defender 側ベンチに馬防柵があり、かつサブバトル1枚目の reveal なら addedPower -= 1
  //   - 最低 1 にクランプ（addedPower = Math.max(1, addedPower - 1)）
  //   - 万里の長城 (computeAttackerAura 内) との違い:
  //       * 万里: base atk == 1 の時は debuff スキップ
  //       * 馬防柵: 常時 -1 + final clamp（kk が明示的に指定）
  //   - ジャンヌ nullifyBuffs と同時発動 OK（base atk のみ → さらに -1 → max(1,...)）
  //   - 判定は state.attackRevealed.length === 0（jeanne と同じシグナル）
  const opp_bafou = otherSide(attackerSide);
  const opp_state_bafou = opp_bafou === 'player' ? next.player : next.ai;
  const opp_sealed_bafou = next.sealedBenchNames[opp_bafou];
  const defenderHasBafousaku = opp_state_bafou.bench.some(
    (b) => b.name === '馬防柵' && !opp_sealed_bafou.includes(b.name),
  );
  if (defenderHasBafousaku && state.attackRevealed.length === 0) {
    const beforeBafou = addedPower;
    addedPower = Math.max(1, addedPower - 1);
    if (beforeBafou !== addedPower) {
      console.log(`[Engine]   bafousaku debuff: ${beforeBafou} → ${addedPower} (defender bench 馬防柵, sub-battle 1st reveal)`);
    } else {
      console.log(`[Engine]   bafousaku: clamp at 1 (no change, addedPower already ${addedPower})`);
    }
  }

  // Override telop with saint-jeanne banner when nullified (overwrites card's own telop).
  if (nullifyBuffs) {
    next = withTelop(next, { text: '🕊️ 聖女ジャンヌ！バフ効果を無効化', color: '#60a5fa' });
  }

  const newPower = state.attackCurrentPower + addedPower;
  console.log(`[Engine]   total addedPower=${addedPower} (base=${getBaseAttack(nextCard)}${nullifyBuffs ? ', buffs nullified' : ''}) → cumulative=${newPower}`);
  return {
    ...next,
    attackCurrentPower: newPower,
    lastRevealPowerAdded: addedPower,
    // Under nullifyBuffs, suppress bench-boost animation details too.
    benchBoostDetails: (!nullifyBuffs && aura.details.length > 0) ? aura.details : null,
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
  // 不老不死の薬: 始皇帝をベンチではなくデッキ底に戻す
  if (defenderCard.name === '始皇帝' && dBenchNamesSet.has('不老不死の薬')) {
    reroutedDefender = true;
    defenderToDeckBottom = true;
    console.log('[Engine] 不老不死の薬発動！始皇帝をデッキ底に戻す');
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

  // Apply leave-trigger quarantine additions (糸杉 reroute defender, ケーキ quarantines opp deck top).
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

  // Card defeat fans (β3): attacker earns rarity-summed fans for
  //   (1) all attack cards revealed this sub-battle,
  //   (2) the defender card that was broken,
  //   (3) the defender's quarantine cards (supporter layer) flushed through this sub-battle.
  // 凱旋門ボーナス（ナポレオン攻撃 + 凱旋門ベンチ）は既存通り +2 を上乗せ。
  const rarityFan = (r: string): number => CARD_DEFEAT_FANS[r] ?? 1;
  const breakdown: DefeatFanContributor[] = [];
  // (1) attacker cards
  for (const c of state.attackRevealed) {
    breakdown.push({ role: 'attacker', cardName: c.name, rarity: c.rarity, fans: rarityFan(c.rarity) });
  }
  // (2) defender card
  breakdown.push({ role: 'defender', cardName: defenderCard.name, rarity: defenderCard.rarity, fans: rarityFan(defenderCard.rarity) });
  // (3) defender's supporter quarantine
  for (const c of state.quarantine[defenderSide]) {
    breakdown.push({ role: 'defender_supporter', cardName: c.name, rarity: c.rarity, fans: rarityFan(c.rarity) });
  }
  let defeatFans = breakdown.reduce((sum, b) => sum + b.fans, 0);
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
  console.log(
    `[Engine] β3 defeat fans: ${attackerSide} earns +${defeatFans} total ` +
    `(attacker=${breakdown.filter((b) => b.role === 'attacker').reduce((s, b) => s + b.fans, 0)}, ` +
    `defender=${breakdown.filter((b) => b.role === 'defender').reduce((s, b) => s + b.fans, 0)}, ` +
    `supporter=${breakdown.filter((b) => b.role === 'defender_supporter').reduce((s, b) => s + b.fans, 0)})`,
  );
  for (const b of breakdown) {
    console.log(`[Engine]   · ${b.role} ${b.rarity} "${b.cardName}" → +${b.fans}`);
  }

  const result: SubBattleResult = {
    idx: state.history.length + 1,
    defenderSide,
    defenderCard,
    attackerSide,
    attackCards,
    attackPower: state.attackCurrentPower,
    defeatFans,
    defeatFansBreakdown: breakdown,
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
    // Combo bonus tracking (Phase 1):
    // Attacker won → their streak++ and they become the current finisher candidate.
    consecutiveKillStreak: {
      ...state.consecutiveKillStreak,
      [attackerSide]: state.consecutiveKillStreak[attackerSide] + 1,
    },
    roundFinisherCard: lastAttackCard,
    roundFinisherSide: attackerSide,
    // Phase 2 tracking:
    //   - defender lost their card → increment cardsLostThisRound + totalCardsLost
    //   - if attacker's deck is now empty, this sub-battle win was a "last-draw decisive"
    cardsLostThisRound: {
      ...state.cardsLostThisRound,
      [defenderSide]: state.cardsLostThisRound[defenderSide] + 1,
    },
    totalCardsLost: {
      ...state.totalCardsLost,
      [defenderSide]: state.totalCardsLost[defenderSide] + 1,
    },
    roundFinisherLastDraw: state.roundFinisherLastDraw || attackerStateForTrim.deck.length === 0,
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

  // ===== Phase 1 combo bonus =====
  // Compute winner's round bonuses (combo + finisher rarity + multiplier). Loser gets no bonus.
  const winnerStreak = state.consecutiveKillStreak[state.roundWinner];
  const phase1 = computePhase1Bonuses(
    state.roundWinner,
    winnerStreak,
    state.roundFinisherCard,
    state.roundFinisherSide,
  );

  // ===== Phase 2 bonuses (perfect / comeback / last-draw) =====
  const winnerLivingState = state.roundWinner === 'player' ? state.player : state.ai;
  const willBeFinalRound = state.round + 1 > state.totalRounds;
  const fanDiffAtStart = state.roundStartSnapshot
    ? (state.roundWinner === 'player'
        ? state.roundStartSnapshot.playerFans - state.roundStartSnapshot.aiFans
        : state.roundStartSnapshot.aiFans - state.roundStartSnapshot.playerFans)
    : 0;
  const phase2Items = computePhase2Bonuses({
    roundWinner: state.roundWinner,
    cardsLostByWinnerThisRound: state.cardsLostThisRound[state.roundWinner],
    roundFinisherLastDraw: state.roundFinisherLastDraw,
    winnerDeckAtWin: winnerLivingState.deck.length,
    winnerBenchAtWin: winnerLivingState.bench.length,
    winnerFanDiffAtRoundStart: fanDiffAtStart,
    isFinalRound: willBeFinalRound,
    totalCardsLostByWinner: state.totalCardsLost[state.roundWinner],
  });

  // Merge Phase 1 + Phase 2 into a single RoundBonuses (発動順で連結)
  const allItems = [...phase1.items, ...phase2Items];
  const bonusTotal = allItems.reduce((s, it) => s + it.amount, 0);
  const roundBonuses: RoundBonuses = {
    items: allItems,
    total: bonusTotal,
    isLegendary: false,
    winnerSide: state.roundWinner,
  };
  if (bonusTotal > 0) {
    console.log(`[Engine] Round bonuses: ${state.roundWinner} earns +${bonusTotal} extra fans (items=${allItems.map(i => `${i.label}+${i.amount}`).join(', ')})`);
  }

  const newPlayerFans = state.roundWinner === 'player' ? state.playerFans + trophyFanBonus + bonusTotal : state.playerFans;
  const newAiFans = state.roundWinner === 'ai' ? state.aiFans + trophyFanBonus + bonusTotal : state.aiFans;

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
      lastRoundBonuses: roundBonuses,
      message: `最終結果: あなた ${newPlayerFans} ファン vs 相手 ${newAiFans} ファン`,
    };
  }

  // Advance to next round: collect ALL cards back to deck, reset bench/quarantine/exile.
  // ベンチ + 隔離 + 防御カード + 攻撃中カード + 除外 → 全てデッキに回収してシャッフル
  // 進化/派生カードはラウンド内限定のため、消滅または元のカードに戻す
  const revertEvolution = (card: BattleCard): BattleCard | null => {
    // 召喚された大蛇はデッキ外カードなので回収時に除外する
    if (card.name === '大蛇' && card.id.startsWith('summoned-giant-snake-')) {
      console.log('[Engine] 召喚された大蛇をデッキ外に戻す (ラウンド終了)');
      return null;
    }
    if (card.name === '万能の天才' && card.id.startsWith('evolved-genius-')) {
      const davinci = ALL_BATTLE_CARDS.find((c) => c.name === 'レオナルド・ダ・ヴィンチ');
      if (davinci) {
        console.log('[Engine] 万能の天才 → レオナルド・ダ・ヴィンチに戻す (ラウンド終了)');
        return { ...davinci, id: `reverted-davinci-${Date.now()}` };
      }
    }
    // 聖女ジャンヌ（祈りの光で生成）はラウンド限定の派生カード。
    // exile round-scoped 化により、元のジャンヌ・ダルクは除外からデッキに戻るため、
    // 聖女ジャンヌ本体は消滅させる。
    if (card.name === '聖女ジャンヌ' && card.id.startsWith('saint-jeanne-prayer-')) {
      console.log('[Engine] 聖女ジャンヌ（祈りの光派生）をデッキ外に戻す (ラウンド終了)');
      return null;
    }
    // 明智ルート（本能寺の変で再構成された 明智光秀/愛宕百韻/天王山/三日天下）も
    // ラウンド内限定の派生カード。次ラウンドでは消滅する。
    if (card.id.startsWith('evolved-akechi-')) {
      console.log(`[Engine] 明智ルート派生 ${card.name} をデッキ外に戻す (ラウンド終了)`);
      return null;
    }
    return card;
  };

  const collectCards = (ps: PlayerState, side: Side): BattleCard[] => {
    const cards: BattleCard[] = [];
    for (const c of ps.deck) { const r = revertEvolution(c); if (r) cards.push(r); }
    for (const slot of ps.bench) {
      for (let i = 0; i < slot.count; i++) { const r = revertEvolution(slot.card); if (r) cards.push(r); }
    }
    for (const c of state.quarantine[side]) { const r = revertEvolution(c); if (r) cards.push(r); }
    if (state.defenseCard && state.flagHolder === side) { const r = revertEvolution(state.defenseCard); if (r) cards.push(r); }
    if (otherSide(state.flagHolder) === side) {
      for (const c of state.attackRevealed) { const r = revertEvolution(c); if (r) cards.push(r); }
    }
    // 除外プールも次ラウンドへ戻す（round-scoped 仕様）。派生カードは revertEvolution で消滅
    for (const c of state.exile[side]) { const r = revertEvolution(c); if (r) cards.push(r); }
    return cards;
  };

  const playerDeck = shuffleDeck(collectCards(state.player, 'player'));
  const aiDeck = shuffleDeck(collectCards(state.ai, 'ai'));

  console.log(`[Engine] advanceToNextRound: player deck ${state.player.deck.length}→${playerDeck.length} (exile ${state.exile.player.length}→0), ai deck ${state.ai.deck.length}→${aiDeck.length} (exile ${state.exile.ai.length}→0)`);

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
    exile: { player: [], ai: [] }, // round-scoped: contents returned to deck via collectCards
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
    // ===== Combo bonus reset (Phase 1) =====
    consecutiveKillStreak: { player: 0, ai: 0 },
    roundFinisherCard: null,
    roundFinisherSide: null,
    lastRoundBonuses: roundBonuses, // UI reads this at cineStep=trophy_breakdown, cleared next advance
    // ===== Phase 2 reset =====
    // cardsLostThisRound はラウンド毎リセット、totalCardsLost は累積保持。
    // roundStartSnapshot は次ラウンド開始時のファン値を記録（劣勢逆転判定用）。
    cardsLostThisRound: { player: 0, ai: 0 },
    roundStartSnapshot: { playerFans: newPlayerFans, aiFans: newAiFans },
    roundFinisherLastDraw: false,
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
  const baseDef = getBaseDefense(defender);
  console.log(`[Engine] continueAfterResolve: defender="${defender.name}" (effect=${defender.effect?.id ?? 'none'}) | flagHolder=${state.flagHolder} | baseDef=${baseDef}`);
  if (defender.effect) {
    const eff = applyRevealEffect(next, defender, state.flagHolder, 'defender');
    next = withTelop(eff.state, eff.telop);
    console.log(`[Engine]   defender effect "${defender.effect.id}" applied (sub-battle transition) → defenderBonus=${next.defenderBonus}`);
  }
  const defAura = applyDefenderAura(next, state.flagHolder);
  next = defAura.state;
  if (defAura.details.length > 0) {
    next = { ...next, benchBoostDetails: defAura.details };
    for (const d of defAura.details) {
      console.log(`[ベンチ効果-防御] ${d.benchCardName} → ${defender.name} 防御+${d.defBonus}`);
    }
  }
  console.log(`[防御計算] ${defender.name} 基本:${baseDef} + ベンチ:${next.defenderBonus} = 最終:${baseDef + next.defenderBonus}`);
  return next;
}
