/**
 * Quiz Service - Supabase連携
 * クイズ結果の保存、ALTポイント・XP更新を担当
 *
 * テーブル:
 *   quiz_attempts: クイズ回答記録
 *   child_status:  ALTポイント・XP・レベル管理
 *
 * ALTポイントルール:
 *   正解: +10 ALT
 *   連続正解（2問以上連続）: さらに+5 ALT追加
 *   高難度カード（R以上）正解: +20 ALT（通常+10の代わり）
 *   不正解: +0 ALT
 *
 * XPルール:
 *   正解: +10 XP（child_status.xp に蓄積）
 *
 * レベル:
 *   レベルは lifetime ALT ベースで計算（client/src/lib/level.ts の LEVEL_TABLE）
 *   XPから計算する旧ロジック (floor(xp/100)+1) は廃止（変更15）
 *   child_status.level への書き込みは updateChildStatus から除外。
 */
import { supabase } from './supabase';
import type { CardRarity } from './knowledgeCards';
import { calculateLevel } from './level';

// ---------- localStorage fallback cache ----------
// 2026-04: Supabase が 400 / ネットワーク失敗を返してもゲームが機能し続ける
// ように、child_status を localStorage にキャッシュする。
// Supabase 成功時は常にキャッシュを書き戻すので、オフライン復帰時に自動で同期される。
const LS_PREFIX = 'kc_child_status_';

function lsKey(childId: string) {
  return `${LS_PREFIX}${childId}`;
}

function readCachedStatus(childId: string): ChildStatus | null {
  try {
    const raw = localStorage.getItem(lsKey(childId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.alt_points === 'number' &&
      typeof parsed?.xp === 'number' &&
      typeof parsed?.level === 'number'
    ) {
      return { child_id: childId, ...parsed };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedStatus(status: ChildStatus): void {
  try {
    localStorage.setItem(
      lsKey(status.child_id),
      JSON.stringify({ alt_points: status.alt_points, xp: status.xp, level: status.level }),
    );
  } catch {
    // storage full / disabled — ignore
  }
}

function initialCachedStatus(childId: string): ChildStatus {
  return { child_id: childId, alt_points: 0, xp: 0, level: 1 };
}

// ---------- Types ----------

export interface QuizAttemptRecord {
  child_id: string;
  quiz_id: string;
  selected: number;       // 選んだ選択肢のindex (0-3)
  is_correct: boolean;
  xp_earned: number;
  answered_at?: string;   // 自動: now()
}

export interface ChildStatus {
  child_id: string;
  alt_points: number;
  xp: number;
  level: number;
}

export interface QuizRewardResult {
  altEarned: number;
  xpEarned: number;
  newAltTotal: number;
  newXpTotal: number;
  newLevel: number;
  streakBonus: boolean;
  rarityBonus: boolean;
}

// ---------- ALT Calculation ----------

/**
 * クイズ正解時のALT報酬を計算
 */
export function calculateAltReward(
  isCorrect: boolean,
  consecutiveCorrect: number,
  cardRarity: CardRarity,
): { altEarned: number; streakBonus: boolean; rarityBonus: boolean } {
  if (!isCorrect) {
    return { altEarned: 0, streakBonus: false, rarityBonus: false };
  }

  // 高難度カード（R以上）は +20 ALT、それ以外は +10 ALT
  const isHighDifficulty = cardRarity === 'R' || cardRarity === 'SR' || cardRarity === 'SSR';
  let altEarned = isHighDifficulty ? 20 : 10;
  const rarityBonus = isHighDifficulty;

  // 連続正解ボーナス（2問以上連続正解）
  const streakBonus = consecutiveCorrect >= 2;
  if (streakBonus) {
    altEarned += 5;
  }

  return { altEarned, streakBonus, rarityBonus };
}

/**
 * XP報酬を計算
 */
export function calculateXpReward(isCorrect: boolean): number {
  return isCorrect ? 10 : 0;
}

// ---------- Supabase Operations ----------

/**
 * child_statusからALTポイントとXPを取得
 * レコードが存在しない場合は初期値で作成
 */
export async function fetchChildStatus(childId: string): Promise<ChildStatus | null> {
  try {
    const { data, error } = await supabase
      .from('child_status')
      .select('child_id, alt_points, xp, level')
      .eq('child_id', childId)
      .single();

    if (error) {
      // レコード無し → 作成を試みる
      if (error.code === 'PGRST116') {
        try {
          const { data: newData, error: insertError } = await supabase
            .from('child_status')
            .insert({ child_id: childId, alt_points: 0, xp: 0, level: 1 })
            .select('child_id, alt_points, xp, level')
            .single();
          if (insertError) {
            console.warn('[QuizService] insert failed, using cache:', insertError.message);
          } else if (newData) {
            const status = newData as ChildStatus;
            writeCachedStatus(status);
            return status;
          }
        } catch (insertErr) {
          console.warn('[QuizService] insert threw, using cache:', insertErr);
        }
      } else {
        console.warn('[QuizService] fetch failed, using cache:', error.message);
      }
      return readCachedStatus(childId) ?? initialCachedStatus(childId);
    }

    const status = data as ChildStatus;
    writeCachedStatus(status);
    return status;
  } catch (err) {
    console.warn('[QuizService] fetchChildStatus threw, using cache:', err);
    return readCachedStatus(childId) ?? initialCachedStatus(childId);
  }
}

/**
 * クイズ回答をquiz_attemptsテーブルに保存
 */
export async function saveQuizAttempt(attempt: QuizAttemptRecord): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('quiz_attempts')
      .insert({
        child_id: attempt.child_id,
        quiz_id: attempt.quiz_id,
        selected: attempt.selected,
        is_correct: attempt.is_correct,
        xp_earned: attempt.xp_earned,
        answered_at: attempt.answered_at ?? new Date().toISOString(),
      });

    if (error) {
      console.error('[QuizService] Failed to save quiz_attempt:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[QuizService] saveQuizAttempt error:', err);
    return false;
  }
}

/**
 * child_statusのALTポイントとXPを更新。
 * level は lifetime ALT ベース（calculateLevel）で計算して同期書き込みする。
 * 注: 現状 child_status には lifetime total_alt カラムがないため、
 *     alt_points を lifetime 相当として扱う。ショップ等の消費を考慮した
 *     厳密な lifetime 集計が必要になったら child_status に total_alt を追加する。
 */
export async function updateChildStatus(
  childId: string,
  altDelta: number,
  xpDelta: number,
): Promise<ChildStatus | null> {
  const current = (await fetchChildStatus(childId)) ?? initialCachedStatus(childId);
  const newAlt = Math.max(0, current.alt_points + altDelta);
  const newXp = Math.max(0, current.xp + xpDelta);
  const newLevel = calculateLevel(newAlt).level;
  const optimistic: ChildStatus = {
    child_id: childId,
    alt_points: newAlt,
    xp: newXp,
    level: newLevel,
  };
  // Always write the optimistic result to cache so the game stays consistent
  // even when Supabase is unreachable.
  writeCachedStatus(optimistic);

  try {
    const { data, error } = await supabase
      .from('child_status')
      .update({ alt_points: newAlt, xp: newXp, level: newLevel })
      .eq('child_id', childId)
      .select('child_id, alt_points, xp, level')
      .single();

    if (error) {
      console.warn('[QuizService] update failed, using cached value:', error.message);
      return optimistic;
    }
    const status = data as ChildStatus;
    writeCachedStatus(status);
    return status;
  } catch (err) {
    console.warn('[QuizService] updateChildStatus threw, using cached value:', err);
    return optimistic;
  }
}

/**
 * クイズ回答を処理する統合関数
 * 1. ALT/XP報酬を計算
 * 2. quiz_attemptsに保存
 * 3. child_statusを更新
 * 4. 結果を返す
 */
export async function processQuizResult(params: {
  childId: string;
  quizId: string;
  selectedIndex: number;
  isCorrect: boolean;
  consecutiveCorrect: number;
  cardRarity: CardRarity;
}): Promise<QuizRewardResult | null> {
  const { childId, quizId, selectedIndex, isCorrect, consecutiveCorrect, cardRarity } = params;

  // 1. 報酬計算
  const { altEarned, streakBonus, rarityBonus } = calculateAltReward(isCorrect, consecutiveCorrect, cardRarity);
  const xpEarned = calculateXpReward(isCorrect);

  // 2. quiz_attemptsに保存
  await saveQuizAttempt({
    child_id: childId,
    quiz_id: quizId,
    selected: selectedIndex,
    is_correct: isCorrect,
    xp_earned: xpEarned,
  });

  // 3. child_statusを更新
  const updatedStatus = await updateChildStatus(childId, altEarned, xpEarned);

  if (updatedStatus) {
    return {
      altEarned,
      xpEarned,
      newAltTotal: updatedStatus.alt_points,
      newXpTotal: updatedStatus.xp,
      newLevel: updatedStatus.level,
      streakBonus,
      rarityBonus,
    };
  }

  // DB更新失敗時もローカル計算結果は返す
  return {
    altEarned,
    xpEarned,
    newAltTotal: altEarned,
    newXpTotal: xpEarned,
    newLevel: 1,
    streakBonus,
    rarityBonus,
  };
}
