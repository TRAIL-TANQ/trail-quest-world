/**
 * PIN verification via Supabase
 *
 * Looks up a 4-digit PIN in the pin_codes table and returns the
 * associated child_id / child_name if the PIN is active.
 */
import { supabase } from './supabase';

export interface PinLookupResult {
  success: boolean;
  childId?: string;
  childName?: string;
  error?: string;
}

export async function verifyPin(pin: string): Promise<PinLookupResult> {
  try {
    const { data, error } = await supabase
      .from('pin_codes')
      .select('child_id, child_name, is_active')
      .eq('pin', pin)
      .single();

    if (error || !data) {
      return { success: false, error: 'PINコードが見つかりません' };
    }
    if (!data.is_active) {
      return { success: false, error: 'このPINコードは無効です' };
    }
    return { success: true, childId: data.child_id, childName: data.child_name };
  } catch {
    return { success: false, error: '接続エラー' };
  }
}

export async function ensureChildStatus(childId: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('child_status')
      .select('child_id')
      .eq('child_id', childId)
      .single();

    if (!data) {
      await supabase.from('child_status').insert({
        child_id: childId,
        level: 1,
        xp: 0,
        alt_points: 0,
        rating: 1000,
      });
    }
  } catch {
    // non-critical — game will still function with localStorage fallback
  }
}

// ===== Registration =====

export interface RegisterInput {
  name: string;           // 2-10 chars
  pin: string;            // 4 digits
  birthYear: number;      // 2010-2020
  birthMonth: number;     // 1-12
  birthDay: number;       // 1-31
}

export interface RegisterResult {
  success: boolean;
  childId?: string;
  error?: string;
}

function generateChildId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `child-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * 新規登録: PIN 重複チェック → pin_codes + child_status に挿入
 */
export async function registerChild(input: RegisterInput): Promise<RegisterResult> {
  const { name, pin, birthYear, birthMonth, birthDay } = input;
  // Client-side validation
  if (name.length < 2 || name.length > 10) {
    return { success: false, error: '名前は2〜10文字で入力してね' };
  }
  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: 'PINは4桁の数字にしてね' };
  }
  try {
    // Check PIN uniqueness
    const { data: existing } = await supabase
      .from('pin_codes')
      .select('pin')
      .eq('pin', pin)
      .maybeSingle();
    if (existing) {
      return { success: false, error: 'このPINは使われています。別の番号にしてね' };
    }

    // Insert new pin_codes row
    const childId = generateChildId();
    const { error: pinError } = await supabase.from('pin_codes').insert({
      pin,
      child_id: childId,
      child_name: name,
      birth_year: birthYear,
      birth_month: birthMonth,
      birth_day: birthDay,
      is_active: true,
    });
    if (pinError) {
      console.error('[pinService] register pin_codes error:', pinError);
      return { success: false, error: '登録に失敗しました。通信をご確認ください' };
    }

    // Ensure child_status row
    await ensureChildStatus(childId);

    return { success: true, childId };
  } catch (e) {
    console.error('[pinService] register exception:', e);
    return { success: false, error: '接続エラーが発生しました' };
  }
}

/**
 * 生年月日から学年を自動計算（4月区切り、4月1日時点の学年）
 * 2026-04 時点の基準で計算し、-1 〜 中学3年 を返す。
 */
export function calcGrade(birthYear: number, birthMonth: number, birthDay: number, now: Date = new Date()): string {
  // 日本式学年: 4/2〜翌4/1生まれが同一学年。小1はその4月に満6→7歳。
  const nowMonth = now.getMonth() + 1;
  const academicYear = nowMonth >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const isEarly = birthMonth < 4 || (birthMonth === 4 && birthDay === 1);
  let grade = academicYear - birthYear - 6;
  if (isEarly) grade += 1;
  if (grade < 1) return '未就学';
  if (grade <= 6) return `小${grade}`;
  if (grade <= 9) return `中${grade - 6}`;
  return '中学生以上';
}
