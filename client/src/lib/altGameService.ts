/**
 * ALTゲーム共通サービス
 *
 * - 1日5回の獲得制限管理（localStorage、JST基準）
 * - Supabase への alt_game_scores 保存
 * - child_status.alt_points の更新（既存 updateChildStatus を呼ぶ）
 *
 * ゲスト/管理者/モニターは Supabase 書き込みをスキップ（既存パターンに準拠）。
 */
import { supabase } from './supabase';
import { updateChildStatus } from './quizService';
import { isGuest, isAdmin, isMonitor } from './auth';
import { getTodayKeyJST } from './altDailyLimit';

export type AltGameType =
  | 'keisan_battle'
  | 'hikaku_battle'
  | 'bunsu_battle'
  | 'shousuu_battle'
  | 'kanji_flash'
  | 'yojijukugo'
  | 'kotowaza_puzzle'
  | 'bunsho_narabe'
  | 'todofuken_touch'
  | 'kenchou_quiz'
  | 'kokki_flash'
  | 'nihonichi';

export const ALT_GAME_DAILY_MAX = 5;

function countKey(childId: string, gameType: AltGameType, date: string): string {
  return `alt_game_count_${childId}_${gameType}_${date}`;
}

export function getGameDailyCount(childId: string, gameType: AltGameType): number {
  try {
    const raw = localStorage.getItem(countKey(childId, gameType, getTodayKeyJST()));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function getGameDailyRemaining(childId: string, gameType: AltGameType): number {
  return Math.max(0, ALT_GAME_DAILY_MAX - getGameDailyCount(childId, gameType));
}

export function canEarnGameAlt(childId: string, gameType: AltGameType): boolean {
  return getGameDailyRemaining(childId, gameType) > 0;
}

/** プレイ完了時に +1。6回目以降も呼んでOK（呼び出し側でALTを0にする） */
export function incrementGameDailyCount(childId: string, gameType: AltGameType): number {
  try {
    const key = countKey(childId, gameType, getTodayKeyJST());
    const cur = getGameDailyCount(childId, gameType);
    const next = cur + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return getGameDailyCount(childId, gameType) + 1;
  }
}

export interface AltGameScoreRecord {
  childId: string;
  gameType: AltGameType;
  score: number;
  difficulty: number; // 1-5
  maxLevel?: number;
  maxCombo?: number;
  altEarned: number;
}

/** alt_game_scores にレコードを追加（ゲスト/管理者/モニターはスキップ） */
export async function saveAltGameScore(record: AltGameScoreRecord): Promise<void> {
  if (isGuest() || isAdmin() || isMonitor()) return;
  try {
    const { error } = await supabase.from('alt_game_scores').insert({
      child_id: record.childId,
      game_type: record.gameType,
      difficulty: record.difficulty,
      score: record.score,
      max_level: record.maxLevel ?? null,
      max_combo: record.maxCombo ?? null,
      alt_earned: record.altEarned,
    });
    if (error) {
      console.warn('[AltGameService] insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[AltGameService] saveAltGameScore threw:', err);
  }
}

/**
 * ゲーム終了時の統合処理:
 * 1. 1日5回制限を判定して実際の獲得量を決定（難易度問わずゲーム単位で共通）
 * 2. 回数カウントを+1
 * 3. child_status と alt_game_scores を更新
 * 4. 実際に加算した ALT を返す
 */
export async function finalizeAltGame(params: {
  childId: string;
  gameType: AltGameType;
  difficulty: number;
  rawAltEarned: number;
  score: number;
  maxLevel?: number;
  maxCombo?: number;
}): Promise<{ altEarned: number; limited: boolean }> {
  const { childId, gameType, difficulty, rawAltEarned, score, maxLevel, maxCombo } = params;
  const canEarn = canEarnGameAlt(childId, gameType);
  const altEarned = canEarn ? Math.max(0, rawAltEarned) : 0;

  incrementGameDailyCount(childId, gameType);

  if (altEarned > 0) {
    await updateChildStatus(childId, altEarned, 0);
  }

  await saveAltGameScore({ childId, gameType, difficulty, score, maxLevel, maxCombo, altEarned });

  return { altEarned, limited: !canEarn };
}
