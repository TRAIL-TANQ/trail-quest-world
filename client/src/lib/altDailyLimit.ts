/**
 * デッキ×難易度ごとの「1日3回までALT獲得」制限。
 * 4回目以降も挑戦はできるが ALT は 0（= 練習モード）。
 * JST 0:00 リセット（キーに日付を含めるので古いキーは放置）。
 * localStorage のみ（Supabase に保存しない）。
 */
import type { DeckKey, QuestDifficulty } from './questProgress';

export const ALT_DAILY_MAX = 3;

/** 現在時刻を JST に変換して YYYY-MM-DD を返す */
export function getTodayKeyJST(): string {
  const now = new Date();
  // UTC → JST (+9h)
  const jst = new Date(now.getTime() + (now.getTimezoneOffset() + 9 * 60) * 60000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function storageKey(childId: string, deck: DeckKey, diff: QuestDifficulty, date: string): string {
  return `quiz_alt_count_${childId}_${deck}_${diff}_${date}`;
}

/** 今日の獲得回数を取得（0 origin） */
export function getTodayAltCount(childId: string, deck: DeckKey, diff: QuestDifficulty): number {
  try {
    const raw = localStorage.getItem(storageKey(childId, deck, diff, getTodayKeyJST()));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 今日の残り回数（0〜ALT_DAILY_MAX） */
export function getRemainingAltCount(childId: string, deck: DeckKey, diff: QuestDifficulty): number {
  return Math.max(0, ALT_DAILY_MAX - getTodayAltCount(childId, deck, diff));
}

/** 今日のカウントを +1 して新しい値を返す（上限超過後もカウントは進めるが、呼び出し側で報酬を0にする想定） */
export function incrementTodayAltCount(childId: string, deck: DeckKey, diff: QuestDifficulty): number {
  try {
    const key = storageKey(childId, deck, diff, getTodayKeyJST());
    const cur = getTodayAltCount(childId, deck, diff);
    const next = cur + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return getTodayAltCount(childId, deck, diff) + 1;
  }
}

/** そのセッションで ALT を獲得できるか（= 開始時点で残り回数 > 0） */
export function canEarnAlt(childId: string, deck: DeckKey, diff: QuestDifficulty): boolean {
  return getRemainingAltCount(childId, deck, diff) > 0;
}
