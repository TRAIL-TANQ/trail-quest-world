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
