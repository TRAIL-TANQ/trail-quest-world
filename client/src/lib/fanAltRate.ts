/**
 * Fan → ALT 換算レート（kk 2026-04-19 最終確定）
 *
 * 通常時は 100 FAN = 25 ALT（1:0.25）。
 * 将来のイベント時に動的に変動可能になるよう、定数を直接参照せず
 * getFanToAltRate() を経由する設計。
 */

/** 通常時の換算レート。イベント未発動時のフォールバック。 */
export const DEFAULT_FAN_TO_ALT_RATE = 0.25;

/**
 * 現在適用する fan → ALT 換算レートを返す。
 *
 * 将来対応メモ:
 *   - イベント情報を Supabase / localStorage から取得し倍率上書き
 *   - 例: `const event = getCurrentEvent(); if (event?.altBonusRate) return event.altBonusRate;`
 *   - 今回はフラグだけ通し、実装は kk 別タスクで。
 */
export function getFanToAltRate(): number {
  // TODO: イベント設定を見て変動可能に
  return DEFAULT_FAN_TO_ALT_RATE;
}

/** 端数切り捨てで ALT を算出。 */
export function fansToAlt(fans: number): number {
  return Math.floor(Math.max(0, fans) * getFanToAltRate());
}
