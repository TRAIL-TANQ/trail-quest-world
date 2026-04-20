/**
 * Quest Progress System
 * デッキ別クエスト進捗管理（localStorage + Supabase）
 */
import { supabase } from './supabase';
import { getAuth, isAdmin, isGuest } from './auth';

// ===== Types =====

export type DeckKey = 'napoleon' | 'amazon' | 'qinshi' | 'galileo' | 'jeanne' | 'murasaki' | 'mandela' | 'davinci' | 'nobunaga' | 'wolf';
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
  // kk spec 2026-04-21 DECK_QUEST_SPEC §3.1 Step 2:
  //   ビギナークリア後、敵デッキ戦に勝利したら true。
  //   この時点で MyDeck.sourceDeckKey=<deckKey> が my_decks に追加される。
  //   ビギナークリア = カード解放、battleCleared = デッキ習得（ストーリー上の到達）。
  battleCleared?: boolean;
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

/**
 * デッキの並び順（spec v6 §4.3）。
 * 上 5 つが解放済み（DECK_AVAILABILITY=true）、下 5 つが準備中。
 * この順序が UI の表示順のソースオブトゥルース:
 *   - QuestBoardPage（デッキクエスト一覧）
 *   - AdminStudentDetailPage（生徒詳細のクエスト進捗表）
 *   - その他 DECK_KEYS を順に回している箇所
 */
export const DECK_KEYS: DeckKey[] = [
  // 解放済み
  'amazon',
  'nobunaga',
  'jeanne',
  'qinshi',
  'murasaki',
  // 準備中
  'napoleon',
  'mandela',
  'wolf',
  'galileo',
  'davinci',
];

/**
 * デッキ実装可否フラグ。false は「準備中」で一般ユーザー/モニターには提供しない。
 * 管理者(9999)のみ全10デッキ使用可能。将来 true に切り替えるだけで解放。
 */
export const DECK_AVAILABILITY: Record<DeckKey, boolean> = {
  amazon:   true,
  nobunaga: true,
  jeanne:   true,
  qinshi:   true,
  murasaki: true,
  napoleon: false,
  mandela:  false,
  wolf:     false,
  galileo:  false,
  davinci:  false,
};

/** 現時点で一般ユーザーに提供中のデッキ一覧 */
export const AVAILABLE_DECK_KEYS: DeckKey[] = DECK_KEYS.filter((k) => DECK_AVAILABILITY[k]);

/**
 * 初回プレゼント + メインデッキ選択で提示する 4 デッキ（kk spec 2026-04-21 DECK_QUEST_SPEC §2.2 確定）。
 * 紫式部（murasaki）は 5 番目の解放済みデッキだが、メインデッキ候補からは除外し
 * クエストクリアで獲得する「獲得済みデッキ」扱いとする。
 *
 * 並び順: DECK_QUEST_SPEC §2.2 に準拠（戦国 → 中世仏 → 生態系 → 古代中国）。
 */
export const MAIN_DECK_KEYS: DeckKey[] = ['nobunaga', 'jeanne', 'amazon', 'qinshi'];

/**
 * 「準備中」でないか。管理者のみ常に true。
 * 注意: isDeckUnlocked（進捗ベースの解放判定）とは別軸。
 *       どのUIでも「表示する前に available をチェック」→「進捗で unlock か判定」の順で使う。
 */
export function isDeckAvailable(deckKey: DeckKey): boolean {
  if (isAdminMode()) return true;
  return DECK_AVAILABILITY[deckKey];
}

export const QUEST_DIFFICULTIES: QuestDifficulty[] = ['beginner', 'challenger', 'master', 'legend'];

export const CLEAR_THRESHOLD = 5; // ビギナー5問正解でクエストクリア判定

/**
 * 各難易度のクエストを初回クリアした際に付与する ALT ボーナス。
 * 通常のクイズ正解ボーナスとは別枠で、一度クリアしたら同じ難易度では再付与されない。
 */
export const QUEST_CLEAR_BONUS_ALT: Record<QuestDifficulty, number> = {
  beginner:   50,
  challenger: 100,
  master:     150,
  legend:     300,
};

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
  nobunaga: 'starter-nobunaga',
  wolf:     'starter-wolf',
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
  nobunaga: { icon: '🔥', name: '信長',       color: '#dc2626' },
  wolf:     { icon: '🐺', name: 'オオカミ',   color: '#6b7280' },
};

/** 難易度表示情報 */
export const DIFFICULTY_INFO: Record<QuestDifficulty, {
  label: string; stars: number; color: string;
  timeLimit: number | null; altPerCorrect: number;
}> = {
  beginner:   { label: 'ビギナー',       stars: 1, color: '#22c55e', timeLimit: null, altPerCorrect: 1 },
  challenger: { label: 'チャレンジャー', stars: 2, color: '#3b82f6', timeLimit: 30,   altPerCorrect: 2 },
  master:     { label: 'マスター',       stars: 3, color: '#a855f7', timeLimit: 20,   altPerCorrect: 3 },
  legend:     { label: 'レジェンド',     stars: 4, color: '#ffd700', timeLimit: 15,   altPerCorrect: 5 },
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
  nobunaga: [],                   // 本能寺の変は進化トリガー、SSR枠なし
  wolf:     [],                   // 月下の遠吠えは通常SSR
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

/** 難易度が解放されているか — 全難易度を常時解放（ALT稼ぎ用） */
export function isDifficultyUnlocked(
  _progress: QuestProgressData,
  _deck: DeckKey,
  _diff: QuestDifficulty,
): boolean {
  return true;
}

// ===== First Deck Gift =====

const LS_FIRST_DECK = 'first_deck_claimed';

export function getFirstDeckGift(): DeckKey | null {
  try {
    const v = localStorage.getItem(LS_FIRST_DECK);
    if (v && DECK_KEYS.includes(v as DeckKey)) return v as DeckKey;
  } catch { /* */ }
  return null;
}

export function claimFirstDeck(deckKey: DeckKey): void {
  console.log('[デッキプレゼント] 選択:', deckKey);
  try { localStorage.setItem(LS_FIRST_DECK, deckKey); } catch { /* */ }
  const progress = loadQuestProgress();
  progress[deckKey].beginner.cleared = true;
  // ゲストでもlocalStorageに直接書き込み（リロードで失われないように）
  try { localStorage.setItem(LS_KEY, JSON.stringify(progress)); } catch { /* */ }
  saveQuestProgress(progress);
  console.log('[デッキプレゼント] questProgress書き込み:', JSON.stringify(progress[deckKey]));
}

export function isFirstDeckClaimed(): boolean {
  return getFirstDeckGift() !== null;
}

/**
 * デッキがバトルで使用可能か。
 * v20 以降 (kk 2026-04-21 DECK_QUEST_SPEC): 使用可能 = メインデッキ（初回ギフト）
 *   または 敵デッキ戦勝利済み (battleCleared)。ビギナークリアだけでは解放しない。
 * 準備中デッキは管理者/モニター以外は常に false。
 */
export function isDeckUnlocked(progress: QuestProgressData, deckKey: DeckKey): boolean {
  if (MONITOR_MODE || isAdminMode()) return true;
  if (!isDeckAvailable(deckKey)) return false;              // 準備中
  if (getFirstDeckGift() === deckKey) return true;          // メインデッキ
  return progress[deckKey]?.battleCleared === true;         // 敵デッキ戦勝利
}

/** デッキのビギナークエストをクリア済みか（クエストバッジ表示用） */
export function isBeginnerCleared(progress: QuestProgressData, deckKey: DeckKey): boolean {
  return progress[deckKey]?.beginner?.cleared ?? false;
}

/**
 * 敵デッキ戦に勝利済みか（kk spec 2026-04-21 DECK_QUEST_SPEC §3.1 Step 2）
 * ビギナークリア (cards 解放) より一段上の「デッキ習得」フラグ。
 * MyDeck.sourceDeckKey=<deckKey> の所持と同義になる想定。
 */
export function isBattleCleared(progress: QuestProgressData, deckKey: DeckKey): boolean {
  return progress[deckKey]?.battleCleared === true;
}

/**
 * 敵デッキ戦勝利を記録。既に true ならノーオペで false を返す（toast 抑止用）。
 * 注: 現状は localStorage のみ。Supabase sync は battleCleared の column 追加後に対応。
 */
export function markBattleCleared(deckKey: DeckKey): boolean {
  const progress = loadQuestProgress();
  if (!progress[deckKey]) return false;
  if (progress[deckKey].battleCleared) return false;
  progress[deckKey].battleCleared = true;
  saveQuestProgress(progress);
  console.log(`[questProgress] markBattleCleared: ${deckKey} → true`);
  return true;
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
