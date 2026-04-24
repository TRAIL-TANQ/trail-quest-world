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

// ======================================================================
// 勉強ゲーム (4択 / パネル破壊) セッション管理
// ======================================================================
//
// 既存 AltGameType とは日次制限値が異なるため、別カウンタで管理する。
//   quiz_4choice : 3 セッション / 日 (STUDY_GAME_SPEC v1.2 §ALT 報酬設定)
//   panel_break  : 10 セッション / 日
// ALT 加算の正本は child_status.alt_points。本ファイルはそのトランザクションと、
// パネル破壊セッションの DB サマリ (panel_break_sessions) INSERT を担当する。
// quiz_answer_logs の per-answer INSERT は quizModeService.submitAnswer 側の責務。

export type StudyGameMode = 'quiz_4choice' | 'panel_break';

export const STUDY_GAME_SESSION_LIMITS: Record<StudyGameMode, number> = {
  quiz_4choice: 3,
  panel_break: 10,
};

export const QUIZ_4CHOICE_REWARDS = {
  CORRECT_ANSWER: 10,
  PERFECT_BONUS: 20,
} as const;

function studyGameCountKey(childId: string, mode: StudyGameMode, date: string): string {
  return `study_game_session_${childId}_${mode}_${date}`;
}

export function getStudyGameSessionCount(childId: string, mode: StudyGameMode): number {
  try {
    const raw = localStorage.getItem(studyGameCountKey(childId, mode, getTodayKeyJST()));
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function getStudyGameSessionRemaining(childId: string, mode: StudyGameMode): number {
  return Math.max(0, STUDY_GAME_SESSION_LIMITS[mode] - getStudyGameSessionCount(childId, mode));
}

export function canEarnStudyGameAlt(childId: string, mode: StudyGameMode): boolean {
  return getStudyGameSessionRemaining(childId, mode) > 0;
}

function incrementStudyGameSessionCount(childId: string, mode: StudyGameMode): number {
  try {
    const key = studyGameCountKey(childId, mode, getTodayKeyJST());
    const next = getStudyGameSessionCount(childId, mode) + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    return getStudyGameSessionCount(childId, mode) + 1;
  }
}

export interface PanelBreakSummary {
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  targetRule: string;
  panelsDestroyed: number;
  maxCombo: number;
  totalScore: number;
  durationSeconds: number;
}

export interface ProcessStudyGameResultParams {
  childId: string;
  mode: StudyGameMode;
  /** quiz_4choice: 正解数 (0〜totalCount) / panel_break: 判定対象外、0 で OK */
  correctCount: number;
  /** quiz_4choice: 総問題数 (通常 10) / panel_break: 判定対象外、0 で OK */
  totalCount: number;
  /** panel_break 専用: セッションサマリ (panel_break_sessions に INSERT) */
  panelBreak?: PanelBreakSummary;
  /** panel_break 専用: クライアント計算済みの raw ALT (コンボ倍率反映済み) */
  panelBreakRawAltEarned?: number;
}

/**
 * 勉強ゲーム セッション完了時の統合処理。
 *
 * 1. 日次制限判定 (getStudyGameSessionRemaining > 0 か)
 * 2. rawAltEarned を算出
 *    - quiz_4choice: correctCount * 10 + (全問正解なら +20 ボーナス)
 *    - panel_break:  panelBreakRawAltEarned (UI 計算) を採用
 * 3. セッションカウント +1 (制限超過後も増やす → 以降の canEarn=false 維持)
 * 4. 加算 ALT > 0 なら child_status.alt_points を更新
 * 5. panel_break の場合、panel_break_sessions に INSERT
 *
 * quiz_answer_logs の per-answer INSERT は本関数の責務ではない。
 * ゲスト/管理者/モニターは DB 書き込みをスキップ (既存 finalizeAltGame と同パターン)。
 */
export async function processStudyGameResult(
  params: ProcessStudyGameResultParams,
): Promise<{ altEarned: number; limited: boolean; rawAltEarned: number }> {
  const { childId, mode, correctCount, totalCount, panelBreak, panelBreakRawAltEarned } = params;

  const canEarn = canEarnStudyGameAlt(childId, mode);

  let rawAltEarned = 0;
  if (mode === 'quiz_4choice') {
    const base = Math.max(0, correctCount) * QUIZ_4CHOICE_REWARDS.CORRECT_ANSWER;
    const perfect =
      totalCount > 0 && correctCount === totalCount ? QUIZ_4CHOICE_REWARDS.PERFECT_BONUS : 0;
    rawAltEarned = base + perfect;
  } else {
    rawAltEarned = Math.max(0, Math.round(panelBreakRawAltEarned ?? 0));
  }

  const altEarned = canEarn ? rawAltEarned : 0;

  incrementStudyGameSessionCount(childId, mode);

  const skipDb = isGuest() || isAdmin() || isMonitor();

  if (!skipDb && altEarned > 0) {
    await updateChildStatus(childId, altEarned, 0);
  }

  if (!skipDb && mode === 'panel_break' && panelBreak) {
    try {
      const { error } = await supabase.from('panel_break_sessions').insert({
        child_id: childId,
        subject: panelBreak.subject,
        difficulty: panelBreak.difficulty,
        target_rule: panelBreak.targetRule,
        panels_destroyed: Math.max(0, Math.round(panelBreak.panelsDestroyed)),
        max_combo: Math.max(0, Math.round(panelBreak.maxCombo)),
        total_score: Math.max(0, Math.round(panelBreak.totalScore)),
        alt_earned: altEarned,
        duration_seconds: Math.max(0, Math.round(panelBreak.durationSeconds)),
      });
      if (error) {
        console.warn('[AltGameService] panel_break_sessions insert failed:', error.message);
      }
    } catch (err) {
      console.warn('[AltGameService] processStudyGameResult (panel_break) threw:', err);
    }
  }

  return { altEarned, limited: !canEarn, rawAltEarned };
}
