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
import { finishBattle } from './battleService';
import type { BattleState, BattleWinner } from './battle/battleTypes';

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

// ============================================================================
// カードバトル v2.0-launch 専用の結果処理
// ============================================================================

/**
 * カードバトル v2 の ALT 配分定数。
 * v2.0.1 以降でコンボ/ボス等の係数を導入する余地あり。
 */
export const ALT_BATTLE_WIN = 10;
export const ALT_BATTLE_LOSE = 2;

export interface ProcessBattleResultParams {
  childId: string;
  sessionId: number;       // synthetic (< 0) なら DB 書込をスキップ
  winner: BattleWinner;    // 'p1' = プレイヤー勝ち / 'p2' = AI 勝ち / 'draw'
  turnCount: number;
  durationSeconds: number;
  finalState: BattleState; // battle_sessions.state_snapshot へ保存
}

/**
 * バトル終了時の統合処理 (v2.0-launch カードバトル専用)。
 *
 * 1. 勝敗から ALT を算出: 勝ち=ALT_BATTLE_WIN(10) / 負け/引き分け=ALT_BATTLE_LOSE(2)
 * 2. child_status.alt_points を +ALT 更新 (updateChildStatus が
 *    ゲスト/管理者/モニターの localStorage-only 分岐を内部で処理)
 * 3. battle_sessions に winner / turn_count / duration_seconds /
 *    alt_earned / state_snapshot を UPDATE (battleService.finishBattle 経由、
 *    ゲスト/管理者/モニター/synthetic id は no-op)
 *
 * 注: AltGameType 系のデイリー 5 回制限とは独立。バトルには回数制限なし。
 */
export async function processBattleResult(
  params: ProcessBattleResultParams,
): Promise<{ altEarned: number }> {
  const isWinner = params.winner === 'p1';
  const altEarned = isWinner ? ALT_BATTLE_WIN : ALT_BATTLE_LOSE;

  // ALT 残高 + level 更新 (updateChildStatus がゲスト/管理者分岐を吸収)
  await updateChildStatus(params.childId, altEarned, 0);

  // battle_sessions UPDATE (書込スキップ判定は finishBattle 内部)
  await finishBattle(params.sessionId, {
    winner: params.winner,
    turnCount: params.turnCount,
    durationSeconds: params.durationSeconds,
    altEarned,
    finalState: params.finalState,
  });

  return { altEarned };
}
