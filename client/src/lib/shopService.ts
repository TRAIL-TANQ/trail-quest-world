/**
 * Shop Service - Supabase連携
 *
 * テーブル:
 *   shop_items    : 販売中のアバタースキン（管理者管理）
 *   owned_skins   : ユーザーが購入済みのスキン
 *   equipped_skin : ユーザーが装備中のスキン
 *
 * 購入フロー:
 *   1. level_gate チェック（unlock_level <= ユーザー現在レベル）
 *   2. child_status から ALT 残高確認、updateChildStatus で price_alt を減算
 *   3. owned_skins に INSERT
 *   4. 必要なら equipped_skin を upsert
 */
import { supabase } from './supabase';
import { updateChildStatus } from './quizService';
import { isGuest } from './auth';

// ---------- Types ----------

export interface ShopItem {
  id: string;                  // uuid
  skin_key: string;            // フロントの AVATAR_ITEMS キー
  name: string;
  description: string | null;
  price_alt: number;
  unlock_level: number;        // 0 = 制限なし
  unlock_condition: string | null;
  image_url: string;
  category: 'basic' | 'limited' | 'event';
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface OwnedSkin {
  id: string;
  child_id: string;
  item_id: string;
  purchased_at: string;
}

export interface EquippedSkin {
  child_id: string;
  item_id: string | null;
}

export interface PurchaseResult {
  ok: boolean;
  reason?: 'insufficient_alt' | 'already_owned' | 'level_locked' | 'condition_unmet' | 'db_error' | 'not_active';
  newAltBalance?: number;
}

// ---------- Read ----------

/** 販売中のスキンを sort_order 昇順で取得 */
export async function fetchShopItems(): Promise<ShopItem[]> {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('[ShopService] fetchShopItems failed:', error);
    return [];
  }
  return (data ?? []) as ShopItem[];
}

/** 特定ユーザーが所持するスキンの item_id 一覧 */
export async function fetchOwnedSkinIds(childId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('owned_skins')
    .select('item_id')
    .eq('child_id', childId);
  if (error) {
    console.error('[ShopService] fetchOwnedSkinIds failed:', error);
    return new Set();
  }
  return new Set((data ?? []).map((r: { item_id: string }) => r.item_id));
}

/** 装備中のスキンの item_id */
export async function fetchEquippedItemId(childId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('equipped_skin')
    .select('item_id')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) {
    console.error('[ShopService] fetchEquippedItemId failed:', error);
    return null;
  }
  return (data?.item_id as string | null) ?? null;
}

// ---------- Purchase ----------

/**
 * スキンを購入:
 *  - is_active と unlock_level をチェック
 *  - 所持済みなら弾く
 *  - ALT 残高を Supabase 側で減算（updateChildStatus）
 *  - owned_skins に INSERT
 */
export async function purchaseSkin(params: {
  childId: string;
  item: ShopItem;
  currentLevel: number;
}): Promise<PurchaseResult> {
  if (isGuest()) return { ok: false, reason: 'db_error' }; // guests cannot purchase
  const { childId, item, currentLevel } = params;

  if (!item.is_active) return { ok: false, reason: 'not_active' };
  if (item.unlock_level > 0 && currentLevel < item.unlock_level) {
    return { ok: false, reason: 'level_locked' };
  }

  // 重複購入防止
  const owned = await fetchOwnedSkinIds(childId);
  if (owned.has(item.id)) return { ok: false, reason: 'already_owned' };

  // ALT 減算（残高不足なら updateChildStatus 内で Math.max(0, ...) に丸められるので先にチェック）
  const { data: statusRow, error: statusErr } = await supabase
    .from('child_status')
    .select('alt_points')
    .eq('child_id', childId)
    .maybeSingle();
  if (statusErr) {
    console.error('[ShopService] status fetch failed:', statusErr);
    return { ok: false, reason: 'db_error' };
  }
  const currentAlt = statusRow?.alt_points ?? 0;
  if (currentAlt < item.price_alt) return { ok: false, reason: 'insufficient_alt' };

  const updated = await updateChildStatus(childId, -item.price_alt, 0);
  if (!updated) return { ok: false, reason: 'db_error' };

  const { error: insErr } = await supabase
    .from('owned_skins')
    .insert({ child_id: childId, item_id: item.id });
  if (insErr) {
    console.error('[ShopService] owned_skins insert failed:', insErr);
    // ALTは戻す（best effort）
    await updateChildStatus(childId, item.price_alt, 0);
    return { ok: false, reason: 'db_error' };
  }

  return { ok: true, newAltBalance: updated.alt_points };
}

// ---------- Equip ----------

/** 装備スキンを切り替え（null = 解除） */
export async function setEquippedSkin(childId: string, itemId: string | null): Promise<boolean> {
  if (isGuest()) return true; // skip for guests
  const { error } = await supabase
    .from('equipped_skin')
    .upsert({ child_id: childId, item_id: itemId }, { onConflict: 'child_id' });
  if (error) {
    console.error('[ShopService] setEquippedSkin failed:', error);
    return false;
  }
  return true;
}
