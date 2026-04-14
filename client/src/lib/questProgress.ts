/**
 * Quest Progress System
 * デッキ別クエスト進捗管理（localStorage + Supabase）
 */
import { supabase } from './supabase';
import { getAuth, isAdmin, isGuest } from './auth';

// ===== Types =====

export type DeckKey = 'napoleon' | 'amazon' | 'qinshi' | 'galileo' | 'jeanne' | 'murasaki' | 'mandela' | 'davinci';
export type QuestDifficulty = 'beginner' | 'challenger' | 'master' | 'legend';

export interface QuestDifficultyProgress {
  correctCount: number;   // 累計正解数
  cleared: boolean;       // 5問正解でクリア
}

export interface DeckQuestProgress {
  beginner: QuestDifficultyProgress;
  challenger: QuestDifficultyProgress;
  master: QuestDifficultyProgress;
  legend: QuestDifficultyProgress;
}

export type QuestProgressData = Record<DeckKey, DeckQuestProgress>;

// ===== Monitor Mode =====

/** モニター期間中は全デッキ・全SSR解放 */
export const MONITOR_MODE = import.meta.env.VITE_MONITOR_MODE === 'true';

/** 管理者モードかどうかを動的に判定（auth.ts の isAdmin() に委譲） */
export function isAdminMode(): boolean {
  return isAdmin();
}

// ===== Constants =====

export const DECK_KEYS: DeckKey[] = ['napoleon', 'amazon', 'qinshi', 'galileo', 'jeanne', 'murasaki', 'mandela', 'davinci'];

export const QUEST_DIFFICULTIES: QuestDifficulty[] = ['beginner', 'challenger', 'master', 'legend'];

export const CLEAR_THRESHOLD = 5; // 5問正解でクリア

/** デッキ key → starter deck id マッピング */
export const DECK_KEY_TO_STARTER_ID: Record<DeckKey, string> = {
  napoleon: 'starter-napoleon',
  amazon:   'starter-amazon',
  qinshi:   'starter-heritage',
  galileo:  'starter-galileo',
  jeanne:   'starter-jeanne',
  murasaki: 'starter-murasaki',
  mandela:  'starter-mandela',
  davinci:  'starter-davinci',
};

/** デッキ表示情報 */
export const DECK_QUEST_INFO: Record<DeckKey, { icon: string; name: string; color: string }> = {
  napoleon: { icon: '⚔️', name: 'ナポレオン', color: '#ef4444' },
  amazon:   { icon: '🌿', name: 'アマゾン',   color: '#22c55e' },
  qinshi:   { icon: '🏛️', name: '始皇帝',    color: '#8b5cf6' },
  galileo:  { icon: '🔭', name: 'ガリレオ',   color: '#3b82f6' },
  jeanne:   { icon: '🗡️', name: 'ジャンヌ',   color: '#f59e0b' },
  murasaki: { icon: '📖', name: '紫式部',     color: '#ec4899' },
  mandela:  { icon: '🌍', name: 'マンデラ',   color: '#f97316' },
  davinci:  { icon: '🎨', name: 'ダ・ヴィンチ', color: '#eab308' },
};

/** 難易度表示情報 */
export const DIFFICULTY_INFO: Record<QuestDifficulty, {
  label: string; stars: number; color: string;
  timeLimit: number | null; altPerCorrect: number;
}> = {
  beginner:   { label: 'ビギナー',       stars: 1, color: '#22c55e', timeLimit: null, altPerCorrect: 5 },
  challenger: { label: 'チャレンジャー', stars: 2, color: '#3b82f6', timeLimit: 30,   altPerCorrect: 10 },
  master:     { label: 'マスター',       stars: 3, color: '#a855f7', timeLimit: 20,   altPerCorrect: 15 },
  legend:     { label: 'レジェンド',     stars: 4, color: '#ffd700', timeLimit: 15,   altPerCorrect: 20 },
};

/** 各デッキの SSR 解放対象カード名 */
export const DECK_SSR_CARDS: Record<DeckKey, string[]> = {
  napoleon: [],                   // SSR なし（今後追加可能）
  amazon:   ['大蛇の巫師'],
  qinshi:   ['焚書坑儒'],
  galileo:  [],                   // SSR なし
  jeanne:   [],                   // SSR なし
  murasaki: [],                   // SSR なし
  mandela:  ['虹の国'],           // レジェンドクリアで虹の国(SR)解放
  davinci:  [],                   // SSR なし（今後追加可能）
};

// ===== Default Progress =====

function createDefaultDiffProgress(): QuestDifficultyProgress {
  return { correctCount: 0, cleared: false };
}

function createDefaultDeckProgress(): DeckQuestProgress {
  return {
    beginner: createDefaultDiffProgress(),
    challenger: createDefaultDiffProgress(),
    master: createDefaultDiffProgress(),
    legend: createDefaultDiffProgress(),
  };
}

export function createDefaultProgress(): QuestProgressData {
  const data: Partial<QuestProgressData> = {};
  for (const key of DECK_KEYS) {
    data[key] = createDefaultDeckProgress();
  }
  return data as QuestProgressData;
}

// ===== LocalStorage =====

const LS_KEY = 'trail-quest-progress';

// Guest sessions: in-memory only. Reset on page reload.
let guestProgressCache: QuestProgressData | null = null;

export function loadQuestProgress(): QuestProgressData {
  if (isGuest()) {
    if (!guestProgressCache) guestProgressCache = createDefaultProgress();
    return guestProgressCache;
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw);
    // Merge with defaults (forward-compatible if new decks added)
    const defaults = createDefaultProgress();
    for (const key of DECK_KEYS) {
      if (!parsed[key]) parsed[key] = defaults[key];
      for (const diff of QUEST_DIFFICULTIES) {
        if (!parsed[key][diff]) parsed[key][diff] = createDefaultDiffProgress();
      }
    }
    return parsed;
  } catch {
    return createDefaultProgress();
  }
}

export function saveQuestProgress(data: QuestProgressData): void {
  if (isGuest()) {
    // Guest: in-memory only. Skip localStorage and Supabase entirely.
    guestProgressCache = data;
    return;
  }
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — silently ignore */ }
  // Admin: skip Supabase sync (test data)
  if (isAdminMode()) return;
  // Fire-and-forget Supabase sync
  syncToSupabase(data).catch(() => {});
}

// ===== Progress Queries =====

/** 難易度が解放されているか（管理者・モニターモードは全解放） */
export function isDifficultyUnlocked(
  progress: QuestProgressData,
  deck: DeckKey,
  diff: QuestDifficulty,
): boolean {
  if (MONITOR_MODE || isAdminMode()) return true;
  switch (diff) {
    case 'beginner':   return true;
    case 'challenger': return progress[deck].beginner.cleared;
    case 'master':     return progress[deck].challenger.cleared;
    case 'legend':     return progress[deck].master.cleared;
  }
}

/** デッキが使用可能か（マスタークリア or ランダムデッキ / モニターモード or 管理者なら常にtrue） */
export function isDeckUnlocked(progress: QuestProgressData, deckKey: DeckKey): boolean {
  if (MONITOR_MODE || isAdminMode()) return true;
  return progress[deckKey].master.cleared;
}

/** SSR が解放されているか（モニターモード or 管理者なら常にtrue） */
export function isSSRUnlocked(progress: QuestProgressData, deckKey: DeckKey): boolean {
  if (MONITOR_MODE || isAdminMode()) return true;
  return progress[deckKey].legend.cleared;
}

/** 全デッキの解放済み SSR カード名リスト（モニターモード or 管理者なら全SSR） */
export function getUnlockedSSRCardNames(progress: QuestProgressData): string[] {
  const names: string[] = [];
  for (const key of DECK_KEYS) {
    if (MONITOR_MODE || isAdminMode() || isSSRUnlocked(progress, key)) {
      names.push(...DECK_SSR_CARDS[key]);
    }
  }
  return names;
}

/** クイズ結果を記録し、クリア判定を更新 */
export function recordQuizResult(
  progress: QuestProgressData,
  deck: DeckKey,
  diff: QuestDifficulty,
  correctCount: number,
): QuestProgressData {
  const next = structuredClone(progress);
  const dp = next[deck][diff];
  dp.correctCount += correctCount;
  if (dp.correctCount >= CLEAR_THRESHOLD) {
    dp.cleared = true;
  }
  return next;
}

// ===== Supabase Sync =====

async function syncToSupabase(data: QuestProgressData): Promise<void> {
  const auth = getAuth();
  if (!auth.childId || auth.childId.startsWith('user-')) return;

  // Upsert each deck×difficulty row
  const rows: { child_id: string; category: string; difficulty: string; correct_count: number; cleared: boolean }[] = [];
  for (const deck of DECK_KEYS) {
    for (const diff of QUEST_DIFFICULTIES) {
      rows.push({
        child_id: auth.childId,
        category: deck,
        difficulty: diff,
        correct_count: data[deck][diff].correctCount,
        cleared: data[deck][diff].cleared,
      });
    }
  }
  await supabase.from('quest_progress').upsert(rows, { onConflict: 'child_id,category,difficulty' });
}

export async function loadFromSupabase(): Promise<QuestProgressData | null> {
  const auth = getAuth();
  if (!auth.childId || auth.childId.startsWith('user-')) return null;

  const { data, error } = await supabase
    .from('quest_progress')
    .select('category, difficulty, correct_count, cleared')
    .eq('child_id', auth.childId);

  if (error || !data || data.length === 0) return null;

  const progress = createDefaultProgress();
  for (const row of data) {
    const deck = row.category as DeckKey;
    const diff = row.difficulty as QuestDifficulty;
    if (progress[deck] && progress[deck][diff]) {
      progress[deck][diff].correctCount = row.correct_count;
      progress[deck][diff].cleared = row.cleared;
    }
  }
  return progress;
}
