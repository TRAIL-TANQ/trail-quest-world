/**
 * Gacha Service - Supabase 連携（変更7）
 *
 * テーブル:
 *   gacha_pulls : 全引き履歴
 *   gacha_pity  : 天井カウンタ (normal / premium)
 *
 * 責務:
 *   - 天井カウンタの fetch / upsert
 *   - ALT 減算を Supabase 側（child_status）で実行
 *   - 引き結果を gacha_pulls に保存
 */
import { supabase } from './supabase';
import { updateChildStatus, fetchChildStatus } from './quizService';
import type { CollectionRarity } from './types';
import { isGuest, isAdmin } from './auth';

// ---------- Types ----------
export interface GachaPityRow {
  child_id: string;
  normal_pity: number;
  premium_pity: number;
  updated_at?: string;
}

export interface GachaPullRecord {
  child_id: string;
  card_id: string;
  rarity: CollectionRarity;
  gacha_type: 'normal' | 'premium';
  pity_count: number;
}

export interface GachaSpendResult {
  ok: boolean;
  reason?: 'insufficient_alt' | 'db_error';
  newAltBalance?: number;
}

// ---------- Pity ----------

/** 天井行を取得。無ければ 0,0 で新規作成。 */
export async function fetchPity(childId: string): Promise<GachaPityRow> {
  if (isGuest() || isAdmin()) return { child_id: childId, normal_pity: 0, premium_pity: 0 };
  const { data, error } = await supabase
    .from('gacha_pity')
    .select('child_id, normal_pity, premium_pity')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) {
    console.error('[GachaService] fetchPity error:', error);
    return { child_id: childId, normal_pity: 0, premium_pity: 0 };
  }
  if (!data) {
    const { error: insErr } = await supabase
      .from('gacha_pity')
      .insert({ child_id: childId, normal_pity: 0, premium_pity: 0 });
    if (insErr) console.error('[GachaService] pity insert error:', insErr);
    return { child_id: childId, normal_pity: 0, premium_pity: 0 };
  }
  return data as GachaPityRow;
}

/** 天井カウンタを上書き更新。resetPity / incrementPity の結果を書き込む用途。 */
export async function savePity(childId: string, normal: number, premium: number): Promise<boolean> {
  if (isGuest() || isAdmin()) return true; // skip for guests/admin
  const { error } = await supabase
    .from('gacha_pity')
    .upsert(
      { child_id: childId, normal_pity: normal, premium_pity: premium, updated_at: new Date().toISOString() },
      { onConflict: 'child_id' },
    );
  if (error) {
    console.error('[GachaService] savePity error:', error);
    return false;
  }
  return true;
}

// ---------- ALT spend ----------

/** ALT を減算。残高不足なら db_error なしで insufficient_alt を返す。管理者はスキップ。 */
export async function spendAltForGacha(childId: string, cost: number): Promise<GachaSpendResult> {
  if (isAdmin()) return { ok: true, newAltBalance: 99999 };
  const current = await fetchChildStatus(childId);
  if (!current) return { ok: false, reason: 'db_error' };
  if (current.alt_points < cost) return { ok: false, reason: 'insufficient_alt' };
  const updated = await updateChildStatus(childId, -cost, 0);
  if (!updated) return { ok: false, reason: 'db_error' };
  return { ok: true, newAltBalance: updated.alt_points };
}

// ---------- Record pulls ----------

/** 複数引き（1連でも10連でも）の結果をまとめて gacha_pulls に保存。 */
export async function recordPulls(records: GachaPullRecord[]): Promise<boolean> {
  if (isGuest() || isAdmin()) return true; // skip for guests/admin
  if (records.length === 0) return true;
  const { error } = await supabase.from('gacha_pulls').insert(records);
  if (error) {
    console.error('[GachaService] recordPulls error:', error);
    return false;
  }
  return true;
}

/** 直近の履歴を新しい順で取得（UI表示用）。 */
export async function fetchRecentPulls(childId: string, limit = 100): Promise<GachaPullRecord[]> {
  const { data, error } = await supabase
    .from('gacha_pulls')
    .select('child_id, card_id, rarity, gacha_type, pity_count, pulled_at')
    .eq('child_id', childId)
    .order('pulled_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[GachaService] fetchRecentPulls error:', error);
    return [];
  }
  return (data ?? []) as GachaPullRecord[];
}
