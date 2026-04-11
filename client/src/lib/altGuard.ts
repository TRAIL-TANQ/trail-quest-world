/**
 * ALT 消費ガード（変更18）
 *
 * ALT を「消費」できる正規の用途を列挙型で固定し、将来の機能追加で
 * ALT 減算が増殖するのを防ぐ。
 *
 * 使い方:
 *   // NG: updateAlt(-100) を直接呼ぶ
 *   // OK: assertAltSpendReason('gacha_normal'); updateAlt(-100);
 *   //     または spendAlt(store, 100, 'gacha_normal')
 *
 * 許可リストに無い reason でこの関数を呼ぶと、開発時は例外を投げ、
 * 本番ビルドでは console.error で警告のみ（ガード漏れでゲームが止まらないように）。
 */

/** ALT 消費の正規用途。追加する場合はここに明示的に列挙すること。 */
export const ALT_SPEND_REASONS = [
  'gacha_normal',      // ノーマルガチャ 1連
  'gacha_normal_10',   // ノーマルガチャ 10連
  'gacha_premium',     // プレミアムガチャ 1連
  'gacha_premium_10',  // プレミアムガチャ 10連
  'shop_skin',         // ショップでのアバタースキン購入
  'shop_title',        // ショップでの称号購入（旧機能、モック）
  'shop_item',         // ショップでのアイテム購入（旧機能、モック）
] as const;

export type AltSpendReason = (typeof ALT_SPEND_REASONS)[number];

const allowedSet = new Set<string>(ALT_SPEND_REASONS);

/**
 * 消費理由が許可リストに含まれるか検証。
 * 含まれない場合は dev では例外、prod では console.error。
 */
export function assertAltSpendReason(reason: string): asserts reason is AltSpendReason {
  if (allowedSet.has(reason)) return;
  const msg = `[altGuard] 許可されていない ALT 消費理由: "${reason}". ALT_SPEND_REASONS に追加してください。`;
  if (import.meta.env.DEV) {
    throw new Error(msg);
  }
  console.error(msg);
}

/**
 * ALT 消費の統合関数。
 * 理由を明示して amount 分だけ updateAlt(-amount) を実行する。
 * 戻り値: 実行できたら true、理由違反や金額不正なら false。
 *
 * 注意: これはローカル store 更新のみ。Supabase との整合は呼び出し側で
 * updateChildStatus / spendAltForGacha 等を別途呼ぶこと。
 */
export function spendAlt(
  updateAlt: (delta: number) => void,
  amount: number,
  reason: AltSpendReason,
): boolean {
  if (amount <= 0) {
    console.error(`[altGuard] spendAlt: amount must be positive, got ${amount}`);
    return false;
  }
  assertAltSpendReason(reason);
  updateAlt(-amount);
  return true;
}
