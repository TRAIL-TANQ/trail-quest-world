/**
 * User Profile Service - Supabase 連携（変更17）
 *
 * テーブル:
 *   user_profile : child_id / nickname / avatar_type / updated_at
 *
 * 責務:
 *   - マウント時に Supabase から profile を読み込んで zustand store に反映
 *   - MyPage / LoginPage で変更した nickname / avatar_type を upsert で保存
 */
import { supabase } from './supabase';
import type { AvatarType } from './types';
import { isGuest, isAdmin } from './auth';

export interface UserProfileRow {
  child_id: string;
  nickname: string;
  avatar_type: AvatarType;
  updated_at?: string;
}

/** profile を取得。存在しなければデフォルト値で新規作成して返す。 */
export async function fetchUserProfile(
  childId: string,
  fallback: { nickname: string; avatarType: AvatarType },
): Promise<UserProfileRow> {
  if (isGuest() || isAdmin()) {
    return { child_id: childId, nickname: fallback.nickname, avatar_type: fallback.avatarType };
  }
  const { data, error } = await supabase
    .from('user_profile')
    .select('child_id, nickname, avatar_type')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) {
    console.error('[UserProfileService] fetch error:', error);
    return { child_id: childId, nickname: fallback.nickname, avatar_type: fallback.avatarType };
  }
  if (!data) {
    const { error: insErr } = await supabase
      .from('user_profile')
      .insert({ child_id: childId, nickname: fallback.nickname, avatar_type: fallback.avatarType });
    if (insErr) console.error('[UserProfileService] insert error:', insErr);
    return { child_id: childId, nickname: fallback.nickname, avatar_type: fallback.avatarType };
  }
  return data as UserProfileRow;
}

/** profile を upsert。nickname / avatar_type のいずれか一方の更新でも全フィールドを渡す。 */
export async function saveUserProfile(
  childId: string,
  nickname: string,
  avatarType: AvatarType,
): Promise<boolean> {
  if (isGuest() || isAdmin()) return true; // skip for guests/admin
  const { error } = await supabase
    .from('user_profile')
    .upsert(
      { child_id: childId, nickname, avatar_type: avatarType, updated_at: new Date().toISOString() },
      { onConflict: 'child_id' },
    );
  if (error) {
    console.error('[UserProfileService] save error:', error);
    return false;
  }
  return true;
}
