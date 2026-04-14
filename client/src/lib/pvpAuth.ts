/**
 * PvP Auth — 2人対戦セットアップ用の補助関数
 *
 * 通常の `auth.ts` / `pinService.ts` はログイン中の1ユーザーしか扱わないので、
 * 2人目のPIN検証や「特定childIdのデッキ解放状態」を取得するヘルパーをここにまとめる。
 */
import { supabase } from './supabase';
import { verifyPin as verifyPinCore, type PinLookupResult } from './pinService';
import {
  DECK_KEYS,
  DECK_KEY_TO_STARTER_ID,
  DECK_SSR_CARDS,
  QUEST_DIFFICULTIES,
  createDefaultProgress,
  type DeckKey,
  type QuestDifficulty,
  type QuestProgressData,
} from './questProgress';

export interface PvPLoginResult extends PinLookupResult {
  isAdmin?: boolean;
}

/**
 * 2人目（ゲストでない）のログイン用。管理者PINも受け付ける。
 * ログイン中ユーザーのlocalStorageは書き換えないので安全。
 */
export async function verifyPvPPin(pin: string): Promise<PvPLoginResult> {
  const adminPin = import.meta.env.VITE_ADMIN_PIN;
  if (adminPin && pin === adminPin) {
    return { success: true, childId: 'admin', childName: '管理者', isAdmin: true };
  }
  const result = await verifyPinCore(pin);
  return { ...result, isAdmin: false };
}

/**
 * 指定 childId のデッキ解放状態を Supabase から取得。
 * - admin: 全デッキ解放
 * - Supabase読み出し失敗時: 何も解放されていない扱い（安全側）
 */
export async function loadQuestProgressFor(
  childId: string,
  isAdmin: boolean,
): Promise<QuestProgressData> {
  const progress = createDefaultProgress();
  if (isAdmin) {
    for (const deck of DECK_KEYS) {
      for (const diff of QUEST_DIFFICULTIES) {
        progress[deck][diff] = { correctCount: 999, cleared: true };
      }
    }
    return progress;
  }
  try {
    const { data, error } = await supabase
      .from('quest_progress')
      .select('category, difficulty, correct_count, cleared')
      .eq('child_id', childId);
    if (error || !data) return progress;
    for (const row of data) {
      const deck = row.category as DeckKey;
      const diff = row.difficulty as QuestDifficulty;
      if (progress[deck] && progress[deck][diff]) {
        progress[deck][diff].correctCount = row.correct_count;
        progress[deck][diff].cleared = row.cleared;
      }
    }
    return progress;
  } catch {
    return progress;
  }
}

/**
 * 指定プレイヤーの解放済みSSRカード名一覧。
 * admin は全SSR、それ以外は legend クリアしたデッキの SSR のみ。
 * ログイン中のlocalStorageに依存しないバージョン（`getUnlockedSSRCardNames` の PvP版）。
 */
export function getUnlockedSSRCardNamesFor(
  progress: QuestProgressData,
  isAdmin: boolean,
): string[] {
  const names: string[] = [];
  for (const key of DECK_KEYS) {
    if (isAdmin || progress[key].legend.cleared) {
      names.push(...DECK_SSR_CARDS[key]);
    }
  }
  return names;
}

/** starterDeckId がこのプレイヤーで使えるか */
export function isStarterDeckUnlockedFor(
  starterDeckId: string,
  progress: QuestProgressData,
  isAdmin: boolean,
): boolean {
  if (isAdmin) return true;
  if (starterDeckId === 'starter-random') return true;
  const entry = Object.entries(DECK_KEY_TO_STARTER_ID).find(([, sid]) => sid === starterDeckId);
  if (!entry) return true; // unmapped starter — default open
  const deckKey = entry[0] as DeckKey;
  return progress[deckKey].master.cleared;
}
