/**
 * 勉強ゲーム 4択モード / パネル破壊モード 共通サービス層。
 *
 * - quiz_questions から条件に合う問題をランダム取得
 * - quiz_answer_logs に 1 回答ずつ INSERT (anon INSERT policy 経由)
 * - 選択された answer から wrong_answers JSONB の pattern を引いて error_pattern を推論
 * - 日次セッション集計 (localStorage ベース) を UI に供給
 *
 * ALT 加算と日次制限は altGameService.processStudyGameResult の責務。
 * 本サービスは per-answer の audit snapshot (alt_earned) をログに記録するのみで、
 * child_status.alt_points は更新しない。
 *
 * 依存: STUDY_GAME_SPEC v1.2 §DB スキーマ / §誤答パターン enum /
 *       supabase/migrations/0037_study_game_tables.sql
 */
import { supabase } from './supabase';
import {
  ERROR_PATTERN_LABELS,
  type ErrorPattern,
  isErrorPattern,
} from './quizErrorPatterns';
import { isAdmin, isGuest, isMonitor } from './auth';
import {
  canEarnStudyGameAlt,
  getStudyGameSessionCount,
  getStudyGameSessionRemaining,
  STUDY_GAME_SESSION_LIMITS,
} from './altGameService';
import { getTodayKeyJST } from './altDailyLimit';

// ---------- 型定義 ----------

export type QuizSubject = 'math' | 'japanese' | 'geography' | 'science' | 'social';
export type QuizMode = 'quiz_4choice' | 'panel_break';
export type QuizDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface QuizWrongAnswer {
  answer: string;
  pattern: ErrorPattern;
  detail?: string;
}

export interface QuizQuestion {
  id: string;
  subject: QuizSubject;
  mode: QuizMode;
  difficulty: QuizDifficulty;
  questionText: string;
  correctAnswer: string;
  wrongAnswers: QuizWrongAnswer[];
  explanation: string | null;
}

export interface QuizAnswerSubmission {
  childId: string;
  question: QuizQuestion;
  /** ユーザーが選んだ選択肢の answer 値。時間切れは null (error_pattern=time_out) */
  selectedAnswer: string | null;
  responseTimeMs: number;
  /** UI が session 開始時の canEarn 判定から算出した per-answer ALT スナップショット。省略時は 0 */
  altEarned?: number;
}

export interface QuizAnswerResult {
  isCorrect: boolean;
  errorPattern: ErrorPattern | null;
  errorDetail: string | null;
  patternLabel: string | null;
}

export interface StudyGameDailyStats {
  date: string;
  mode: QuizMode;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionLimit: number;
}

// ---------- 問題マスタ取得 ----------

/**
 * quiz_questions から指定条件の問題を取得し、クライアント側でシャッフルして count 件返す。
 *
 * PostgREST はランダム ORDER をサポートしないため、条件一致する問題を全取得 → シャッフル → slice。
 * is_active=true は RLS SELECT policy で自動フィルタされる。
 *
 * @param subject     教科 (Phase A は 'math' のみ運用)
 * @param mode        'quiz_4choice' / 'panel_break'
 * @param difficulty  'easy' / 'medium' / 'hard' / 'extreme'
 * @param count       取得件数 (default 10)
 */
export async function fetchRandomQuestions(
  subject: QuizSubject,
  mode: QuizMode,
  difficulty: QuizDifficulty,
  count = 10,
): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, subject, mode, difficulty, question_text, correct_answer, wrong_answers, explanation')
    .eq('subject', subject)
    .eq('mode', mode)
    .eq('difficulty', difficulty);

  if (error) {
    console.warn('[QuizModeService] fetchRandomQuestions failed:', error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  const normalized = data
    .map((row) => normalizeQuestionRow(row))
    .filter((q): q is QuizQuestion => q !== null);

  return shuffleArray(normalized).slice(0, count);
}

// ---------- 回答ログ投入 ----------

/**
 * 回答を quiz_answer_logs に INSERT する。
 *
 * - is_correct: selectedAnswer === question.correctAnswer
 * - error_pattern: resolveErrorPattern() で推論 (正解時は null)
 * - alt_earned: UI から渡る per-answer スナップショット (省略時 0)
 *
 * anon INSERT policy のみのため SELECT/UPDATE はしない。
 * ゲスト/管理者/モニターは DB 書き込みをスキップするが、
 * UI フィードバック用の判定結果は通常通り返す。
 */
export async function submitAnswer(params: QuizAnswerSubmission): Promise<QuizAnswerResult> {
  const { childId, question, selectedAnswer, responseTimeMs, altEarned = 0 } = params;
  const { errorPattern, errorDetail } = resolveErrorPattern(question, selectedAnswer);
  const isCorrect = errorPattern === null && selectedAnswer !== null;

  const result: QuizAnswerResult = {
    isCorrect,
    errorPattern,
    errorDetail,
    patternLabel: errorPattern ? ERROR_PATTERN_LABELS[errorPattern] : null,
  };

  if (isGuest() || isAdmin() || isMonitor()) return result;

  try {
    const { error } = await supabase.from('quiz_answer_logs').insert({
      child_id: childId,
      subject: question.subject,
      mode: question.mode,
      question_id: question.id,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      response_time_ms: Math.max(0, Math.round(responseTimeMs)),
      error_pattern: errorPattern,
      error_detail: errorDetail,
      alt_earned: Math.max(0, Math.round(altEarned)),
    });
    if (error) {
      console.warn('[QuizModeService] quiz_answer_logs insert failed:', error.message);
    }
  } catch (err) {
    console.warn('[QuizModeService] submitAnswer threw:', err);
  }

  return result;
}

/**
 * selectedAnswer から error_pattern / error_detail を決定する純粋関数。
 *
 * - selectedAnswer === null → time_out
 * - selectedAnswer === correct_answer → null (= 正解)
 * - wrong_answers に一致 → その pattern / detail
 * - 上記いずれでもない (問題データ不整合 or 予期せぬ入力) → 'other'
 */
export function resolveErrorPattern(
  question: QuizQuestion,
  selectedAnswer: string | null,
): { errorPattern: ErrorPattern | null; errorDetail: string | null } {
  if (selectedAnswer === null) {
    return { errorPattern: 'time_out', errorDetail: null };
  }
  if (selectedAnswer === question.correctAnswer) {
    return { errorPattern: null, errorDetail: null };
  }
  const hit = question.wrongAnswers.find((w) => w.answer === selectedAnswer);
  if (hit) {
    return { errorPattern: hit.pattern, errorDetail: hit.detail ?? null };
  }
  return { errorPattern: 'other', errorDetail: null };
}

/**
 * 1 問の選択肢 (正解 + 誤答) それぞれに紐づく error_pattern の即時参照マップ。
 * UI 層でボタンごとの pattern を即引きする用途。
 */
export function buildErrorPatternMap(question: QuizQuestion): Record<string, ErrorPattern | null> {
  const map: Record<string, ErrorPattern | null> = {};
  map[question.correctAnswer] = null;
  for (const w of question.wrongAnswers) {
    map[w.answer] = w.pattern;
  }
  return map;
}

// ---------- 日次セッション集計 ----------

/**
 * 当日 (JST) の勉強ゲーム セッション消化状況。
 *
 * DB の quiz_answer_logs は anon SELECT 不可のため、セッション単位の集計は
 * altGameService の localStorage カウンタに委ねる。
 * 将来 RPC (SECURITY DEFINER) を追加した際に DB 集計へ置き換え予定 (FU-017)。
 */
export function getDailyStats(childId: string, mode: QuizMode): StudyGameDailyStats {
  return {
    date: getTodayKeyJST(),
    mode,
    sessionsUsed: getStudyGameSessionCount(childId, mode),
    sessionsRemaining: getStudyGameSessionRemaining(childId, mode),
    sessionLimit: STUDY_GAME_SESSION_LIMITS[mode],
  };
}

/** セッション開始時の「このセッションは ALT 加算対象か」を返す薄いラッパー */
export function canSessionEarnAlt(childId: string, mode: QuizMode): boolean {
  return canEarnStudyGameAlt(childId, mode);
}

// ---------- 内部ヘルパ ----------

function normalizeQuestionRow(row: {
  id: unknown;
  subject: unknown;
  mode: unknown;
  difficulty: unknown;
  question_text: unknown;
  correct_answer: unknown;
  wrong_answers: unknown;
  explanation: unknown;
}): QuizQuestion | null {
  const id = typeof row.id === 'string' ? row.id : null;
  const subject = typeof row.subject === 'string' ? (row.subject as QuizSubject) : null;
  const mode = typeof row.mode === 'string' ? (row.mode as QuizMode) : null;
  const difficulty = typeof row.difficulty === 'string' ? (row.difficulty as QuizDifficulty) : null;
  const questionText = typeof row.question_text === 'string' ? row.question_text : null;
  const correctAnswer = typeof row.correct_answer === 'string' ? row.correct_answer : null;
  const wrongAnswers = parseWrongAnswers(row.wrong_answers);
  const explanation = typeof row.explanation === 'string' ? row.explanation : null;

  if (!id || !subject || !mode || !difficulty || !questionText || !correctAnswer) {
    console.warn('[QuizModeService] dropping malformed quiz_questions row:', row.id);
    return null;
  }

  return {
    id,
    subject,
    mode,
    difficulty,
    questionText,
    correctAnswer,
    wrongAnswers,
    explanation,
  };
}

function parseWrongAnswers(raw: unknown): QuizWrongAnswer[] {
  if (!Array.isArray(raw)) return [];
  const result: QuizWrongAnswer[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    const answer = typeof obj.answer === 'string' ? obj.answer : null;
    const pattern = isErrorPattern(obj.pattern) ? obj.pattern : null;
    if (!answer || !pattern) continue;
    const detail = typeof obj.detail === 'string' ? obj.detail : undefined;
    result.push({ answer, pattern, ...(detail !== undefined ? { detail } : {}) });
  }
  return result;
}

function shuffleArray<T>(arr: readonly T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
