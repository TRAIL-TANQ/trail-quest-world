/**
 * Combo bonus system — Phase 1 (連続破壊コンボ + フィニッシャーレアリティ + 倍率).
 *
 * This module is pure — it takes snapshots of tracked state and returns a
 * structured breakdown (items[] + total). The engine stores the result on
 * `GameState.lastRoundBonuses` at `advanceToNextRound` time, and the UI reads
 * it for the TrophyBonusBreakdown overlay.
 *
 * Later phases append to `computeRoundBonuses` (perfect / comeback / special /
 * legendary). Each phase function takes the engine snapshot and contributes
 * its own `BonusItem[]`; the combine site concatenates them in chronological
 * order (the spec requires 発動順 display).
 */
import type { BattleCard } from './knowledgeCards';
import type { Side } from './knowledgeEngine';

export const BONUS_THRESHOLDS = {
  COMEBACK_FAN_DIFF: -20,
  DECK_LOW_THRESHOLD: 3,
  BENCH_EMPTY: 0,
  BOOK_BURNING_5: 5,
  BOOK_BURNING_8: 8,
} as const;

export interface BonusItem {
  key: string;        // unique per item (used as React key)
  icon: string;       // leading emoji
  label: string;      // 日本語ラベル
  amount: number;     // award delta (always positive in Phase 1)
  legendary?: boolean; // true for Phase 4 超絶コンボ
}

export interface RoundBonuses {
  items: BonusItem[];
  total: number;
  isLegendary: boolean;
  /** Which side earned these bonuses (winner of the round). */
  winnerSide: Side;
}

/** Phase 1-1: 連続破壊コンボ (N >= 2 で発動, N=1 は 0)。 */
export function comboBonus(n: number): number {
  if (n < 2) return 0;
  return Math.ceil((n * (n - 1)) / 2 * 1.5);
}

const RARITY_BONUS: Record<string, number> = { N: 0, R: 2, SR: 5, SSR: 10 };

/** Phase 1-2: フィニッシャーレアリティ（カード null / N は 0）。 */
export function finisherRarityBonus(rarity: string | undefined | null): number {
  if (!rarity) return 0;
  return RARITY_BONUS[rarity] ?? 0;
}

/** Phase 1-3: フィニッシャー × コンボ倍率（streak による段階）。 */
export function finisherMultiplier(streak: number): number {
  if (streak >= 10) return 5.0;
  if (streak >= 7)  return 3.0;
  if (streak >= 5)  return 2.0;
  if (streak >= 3)  return 1.5;
  return 1.0;
}

const RARITY_ICON: Record<string, string> = { N: '✨', R: '💎', SR: '🔥', SSR: '🌟' };

/**
 * Phase 1 bonus calculator. Returns an empty items[] when nothing applies.
 *
 * Chronological order (per kk spec "発動順"):
 *   1. 連続破壊コンボ (streak が 2 以上)
 *   2. フィニッシャーレアリティ (finisher が winner 側 && rarity > N)
 *   3. ボーナス倍率 (streak が 3 以上 かつ フィニッシャーボーナス > 0)
 */
export function computePhase1Bonuses(
  roundWinner: Side,
  streak: number,
  finisherCard: BattleCard | null,
  finisherSide: Side | null,
): RoundBonuses {
  const items: BonusItem[] = [];

  // 1. Combo
  const combo = comboBonus(streak);
  if (combo > 0) {
    items.push({
      key: 'combo',
      icon: '⚡',
      label: `${streak}連続コンボ`,
      amount: combo,
    });
  }

  // Finisher only counts if it belongs to the round winner.
  const finisherIsWinner = finisherCard && finisherSide === roundWinner;
  const finRarity = finisherIsWinner ? (finisherCard.rarity ?? 'N') : 'N';
  const finBonus = finisherIsWinner ? finisherRarityBonus(finRarity) : 0;

  // 2. Finisher rarity
  if (finBonus > 0) {
    items.push({
      key: 'finisher',
      icon: RARITY_ICON[finRarity] ?? '✨',
      label: `${finRarity}フィニッシャー`,
      amount: finBonus,
    });
  }

  // 3. Multiplier (only when multiplier > 1.0 AND a finisher bonus exists)
  const mult = finisherMultiplier(streak);
  if (mult > 1.0 && finBonus > 0) {
    const multBonus = Math.round(finBonus * mult);
    items.push({
      key: 'multiplier',
      icon: '💥',
      label: `ボーナス倍率 x${mult.toFixed(1)}`,
      amount: multBonus,
    });
  }

  const total = items.reduce((s, it) => s + it.amount, 0);
  return { items, total, isLegendary: false, winnerSide: roundWinner };
}

/**
 * Snapshot of fan totals captured at the start of each round. Used for comeback
 * detection (Phase 2): "ファン差-20以上から逆転".
 *
 * Note: deck/bench counts are NOT snapshotted — kk spec Q4/Q5 updated to use
 * "勝利瞬間" values (current state at round_end), not round-start values.
 */
export interface RoundStartSnapshot {
  playerFans: number;
  aiFans: number;
}

/**
 * Phase 2 bonus calculator — perfect / comeback / last-draw decisive.
 *
 * Chronological display order (per 発動順 spec):
 *   1. 🎯 パーフェクトラウンド
 *   2. 💀 ギリギリ勝利 (deck <= 3 at win moment)
 *   3. 🌟 ベンチ空から勝利 (bench == 0 at win moment)
 *   4. 🔥 劣勢逆転 (fan diff <= -20 at round start)
 *   5. ⚡ 最後のドロー決定打 (last card used for winning reveal)
 *   6. 🏆 フルゲームパーフェクト (final round + zero total destructions)
 */
export function computePhase2Bonuses(params: {
  roundWinner: Side;
  cardsLostByWinnerThisRound: number;
  roundFinisherLastDraw: boolean;
  /** 勝利瞬間の勝者デッキ残数（kk Q4: 勝利瞬間で判定） */
  winnerDeckAtWin: number;
  /** 勝利瞬間の勝者ベンチ数（kk Q5: 勝利瞬間で判定） */
  winnerBenchAtWin: number;
  /** ラウンド開始時のファン差（勝者視点）— 負なら勝者が劣勢スタート */
  winnerFanDiffAtRoundStart: number;
  /** 最終ラウンドかどうか（nextRound > totalRounds） */
  isFinalRound: boolean;
  /** バトル全体通算で勝者が失ったカード数 */
  totalCardsLostByWinner: number;
}): BonusItem[] {
  const items: BonusItem[] = [];

  // 1. パーフェクトラウンド
  if (params.cardsLostByWinnerThisRound === 0) {
    items.push({ key: 'perfect_round', icon: '🎯', label: 'パーフェクトラウンド', amount: 15 });
  }

  // 2. ギリギリ勝利（デッキ残 N 以下）
  if (params.winnerDeckAtWin <= BONUS_THRESHOLDS.DECK_LOW_THRESHOLD) {
    items.push({ key: 'deck_low', icon: '💀', label: 'ギリギリ勝利', amount: 8 });
  }

  // 3. ベンチ空から勝利
  if (params.winnerBenchAtWin <= BONUS_THRESHOLDS.BENCH_EMPTY) {
    items.push({ key: 'bench_empty', icon: '🌟', label: 'ベンチ空から勝利', amount: 10 });
  }

  // 4. 劣勢逆転（ラウンド開始時にファン差-20以上）
  if (params.winnerFanDiffAtRoundStart <= BONUS_THRESHOLDS.COMEBACK_FAN_DIFF) {
    items.push({ key: 'comeback', icon: '🔥', label: '劣勢逆転', amount: 12 });
  }

  // 5. 最後のドロー決定打
  if (params.roundFinisherLastDraw) {
    items.push({ key: 'last_draw', icon: '⚡', label: '最後のドロー決定打', amount: 15 });
  }

  // 6. フルゲームパーフェクト（最終ラウンド勝利 + 通算0破壊）
  if (params.isFinalRound && params.totalCardsLostByWinner === 0) {
    items.push({ key: 'perfect_game', icon: '🏆', label: 'フルゲームパーフェクト', amount: 30 });
  }

  return items;
}
