/**
 * QuizModePage — 🎓 勉強ゲーム 4択モード (Phase A MVP)
 *
 * ルート: /quiz/:subject/:difficulty
 *
 * 10 問セッション進行:
 *   loading → ready → playing → feedback → (loop) → result
 *
 * 消費する公開 API (Commit C で整備済):
 *   - quizModeService.fetchRandomQuestions / submitAnswer / canSessionEarnAlt
 *   - altGameService.processStudyGameResult / QUIZ_4CHOICE_REWARDS /
 *     STUDY_GAME_SESSION_LIMITS / getStudyGameSessionRemaining
 *   - quizErrorPatterns.ERROR_PATTERN_LABELS / ERROR_PATTERN_EXPLANATIONS
 *
 * Phase A スコープ外:
 *   - タイマー (問題ごとの 30 秒制限) は UI 未実装 (Phase B 候補)
 *   - 「似た問題」リトライ / 復習ノートは Phase B
 *   - 音響 / パーティクルは最低限
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { useUserStore } from '@/lib/stores';
import {
  canSessionEarnAlt,
  fetchRandomQuestions,
  submitAnswer,
  type QuizAnswerResult,
  type QuizDifficulty,
  type QuizMode,
  type QuizQuestion,
  type QuizSubject,
} from '@/lib/quizModeService';
import {
  getStudyGameSessionRemaining,
  processStudyGameResult,
  QUIZ_4CHOICE_REWARDS,
  STUDY_GAME_SESSION_LIMITS,
} from '@/lib/altGameService';
import {
  ERROR_PATTERN_EXPLANATIONS,
  ERROR_PATTERN_LABELS,
  type ErrorPattern,
} from '@/lib/quizErrorPatterns';

type Phase = 'loading' | 'empty' | 'ready' | 'playing' | 'feedback' | 'result';
type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

const MODE: QuizMode = 'quiz_4choice';
const SESSION_SIZE = 10;
const CHOICE_LABELS = ['A', 'B', 'C', 'D'] as const;

const SUBJECT_LABELS: Record<QuizSubject, string> = {
  math: '算数',
  japanese: '国語',
  geography: '地理',
  science: '理科',
  social: '社会',
};

const DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
  easy: 'かんたん',
  medium: 'ふつう',
  hard: 'むずかしい',
  extreme: '超級',
};

const DIFFICULTY_ICONS: Record<QuizDifficulty, string> = {
  easy: '🟢',
  medium: '🟡',
  hard: '🟠',
  extreme: '🔴',
};

const GRADE_EMOJI: Record<Grade, string> = {
  S: '🏆',
  A: '🥇',
  B: '🥈',
  C: '🥉',
  D: '📘',
};

const GRADE_MESSAGE: Record<Grade, string> = {
  S: 'パーフェクト！てんさい！',
  A: 'すごい！よくできました',
  B: 'いいかんじ！',
  C: 'もうすこし！',
  D: 'くじけず、もう1回！',
};

interface SessionAnswer {
  questionId: string;
  isCorrect: boolean;
  errorPattern: ErrorPattern | null;
  responseTimeMs: number;
}

function isValidSubject(v: string | undefined): v is QuizSubject {
  return v === 'math' || v === 'japanese' || v === 'geography' || v === 'science' || v === 'social';
}

function isValidDifficulty(v: string | undefined): v is QuizDifficulty {
  return v === 'easy' || v === 'medium' || v === 'hard' || v === 'extreme';
}

function shuffle<T>(arr: readonly T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function gradeScore(correctCount: number, totalCount: number): Grade {
  if (totalCount === 0) return 'D';
  const rate = correctCount / totalCount;
  if (rate >= 1) return 'S';
  if (rate >= 0.9) return 'A';
  if (rate >= 0.7) return 'B';
  if (rate >= 0.5) return 'C';
  return 'D';
}

export default function QuizModePage() {
  const [, params] = useRoute('/quiz/:subject/:difficulty');
  const [, navigate] = useLocation();
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const subject: QuizSubject | null = isValidSubject(params?.subject) ? params.subject : null;
  const difficulty: QuizDifficulty | null = isValidDifficulty(params?.difficulty) ? params.difficulty : null;

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QuizAnswerResult | null>(null);
  const [sessionAnswers, setSessionAnswers] = useState<SessionAnswer[]>([]);
  const [altEarned, setAltEarned] = useState(0);
  const [rawAltEarned, setRawAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [sessionsRemainingAtStart, setSessionsRemainingAtStart] = useState(
    STUDY_GAME_SESSION_LIMITS[MODE],
  );

  /** セッション開始時に決定する ALT 加算可否 (途中で制限判定が変わらないよう ref で固定) */
  const canEarnRef = useRef(false);
  const questionStartRef = useRef(0);
  const submittedRef = useRef(false);
  const sessionFinalizedRef = useRef(false);

  // ---------- 問題取得 ----------
  useEffect(() => {
    if (!subject || !difficulty) {
      setPhase('empty');
      return;
    }
    let cancelled = false;
    setPhase('loading');
    (async () => {
      try {
        const qs = await fetchRandomQuestions(subject, MODE, difficulty, SESSION_SIZE);
        if (cancelled) return;
        if (qs.length === 0) {
          setPhase('empty');
          return;
        }
        setQuestions(qs);
        setSessionsRemainingAtStart(getStudyGameSessionRemaining(userId, MODE));
        setPhase('ready');
      } catch (err) {
        console.warn('[QuizModePage] fetch threw:', err);
        if (!cancelled) setPhase('empty');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [subject, difficulty, userId]);

  const currentQuestion = questions[currentIndex] ?? null;

  /** 現在の問題の選択肢 (正解+誤答 3〜n 個) を表示時にシャッフル */
  const shuffledChoices = useMemo<string[]>(() => {
    if (!currentQuestion) return [];
    const all = [currentQuestion.correctAnswer, ...currentQuestion.wrongAnswers.map((w) => w.answer)];
    return shuffle(all);
  }, [currentQuestion?.id]);

  // ---------- 操作ハンドラ ----------
  const handleStart = () => {
    canEarnRef.current = canSessionEarnAlt(userId, MODE);
    setCurrentIndex(0);
    setSessionAnswers([]);
    setSelectedAnswer(null);
    setLastResult(null);
    setAltEarned(0);
    setRawAltEarned(0);
    setLimited(false);
    sessionFinalizedRef.current = false;
    questionStartRef.current = Date.now();
    submittedRef.current = false;
    setPhase('playing');
  };

  const handleSelect = async (choice: string) => {
    if (!currentQuestion || submittedRef.current) return;
    submittedRef.current = true;
    setSelectedAnswer(choice);
    const responseTimeMs = Date.now() - questionStartRef.current;
    const willBeCorrect = choice === currentQuestion.correctAnswer;
    const perAnswerAlt =
      willBeCorrect && canEarnRef.current ? QUIZ_4CHOICE_REWARDS.CORRECT_ANSWER : 0;

    const result = await submitAnswer({
      childId: userId,
      question: currentQuestion,
      selectedAnswer: choice,
      responseTimeMs,
      altEarned: perAnswerAlt,
    });
    setLastResult(result);
    setSessionAnswers((prev) => [
      ...prev,
      {
        questionId: currentQuestion.id,
        isCorrect: result.isCorrect,
        errorPattern: result.errorPattern,
        responseTimeMs,
      },
    ]);
    setPhase('feedback');
  };

  const handleNext = async () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < questions.length) {
      setCurrentIndex(nextIndex);
      setSelectedAnswer(null);
      setLastResult(null);
      submittedRef.current = false;
      questionStartRef.current = Date.now();
      setPhase('playing');
      return;
    }
    // セッション完了 — 二重発火防止
    if (sessionFinalizedRef.current) return;
    sessionFinalizedRef.current = true;
    const correctCount = sessionAnswers.filter((a) => a.isCorrect).length;
    const totalCount = questions.length;
    try {
      const r = await processStudyGameResult({
        childId: userId,
        mode: MODE,
        correctCount,
        totalCount,
      });
      setAltEarned(r.altEarned);
      setRawAltEarned(r.rawAltEarned);
      setLimited(r.limited);
      if (r.altEarned > 0) addTotalAlt(r.altEarned);
    } catch (err) {
      console.warn('[QuizModePage] processStudyGameResult threw:', err);
    }
    setPhase('result');
  };

  // ---------- 画面分岐 ----------
  if (!subject || !difficulty) {
    return <InvalidRouteView />;
  }

  const subjectLabel = SUBJECT_LABELS[subject];
  const difficultyLabel = DIFFICULTY_LABELS[difficulty];
  const difficultyIcon = DIFFICULTY_ICONS[difficulty];

  if (phase === 'loading') {
    return <LoadingView />;
  }
  if (phase === 'empty') {
    return <EmptyView subjectLabel={subjectLabel} difficultyLabel={difficultyLabel} />;
  }
  if (phase === 'ready') {
    return (
      <ReadyView
        subjectLabel={subjectLabel}
        difficultyLabel={difficultyLabel}
        difficultyIcon={difficultyIcon}
        totalCount={questions.length}
        sessionsRemaining={sessionsRemainingAtStart}
        sessionLimit={STUDY_GAME_SESSION_LIMITS[MODE]}
        onStart={handleStart}
      />
    );
  }
  if (phase === 'playing' || phase === 'feedback') {
    if (!currentQuestion) return <LoadingView />;
    return (
      <PlayingView
        subjectLabel={subjectLabel}
        difficultyLabel={difficultyLabel}
        difficultyIcon={difficultyIcon}
        currentIndex={currentIndex}
        totalCount={questions.length}
        question={currentQuestion}
        shuffledChoices={shuffledChoices}
        selectedAnswer={selectedAnswer}
        lastResult={lastResult}
        phase={phase}
        onSelect={handleSelect}
        onNext={handleNext}
      />
    );
  }
  // result
  const correctCount = sessionAnswers.filter((a) => a.isCorrect).length;
  const grade = gradeScore(correctCount, questions.length);
  return (
    <ResultView
      subjectLabel={subjectLabel}
      difficultyLabel={difficultyLabel}
      difficultyIcon={difficultyIcon}
      correctCount={correctCount}
      totalCount={questions.length}
      grade={grade}
      altEarned={altEarned}
      rawAltEarned={rawAltEarned}
      limited={limited}
      onRetry={handleStart}
      onBack={() => navigate('/alt-games')}
    />
  );
}

// ======================================================================
// サブビュー
// ======================================================================

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-full">
      <div className="relative z-10 px-4 pt-4 pb-8">{children}</div>
    </div>
  );
}

function SectionHeader({
  subjectLabel,
  difficultyLabel,
  difficultyIcon,
}: {
  subjectLabel: string;
  difficultyLabel: string;
  difficultyIcon: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #ffd700, #f0a500)',
          boxShadow: '0 0 10px rgba(255,215,0,0.3)',
        }}
      >
        <span className="text-lg">🎓</span>
      </div>
      <h1
        className="text-lg font-bold"
        style={{ color: 'var(--tqw-gold)', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}
      >
        {subjectLabel} 4択クイズ
      </h1>
      <span className="text-[11px] ml-1" style={{ color: 'rgba(255,215,0,0.65)' }}>
        {difficultyIcon} {difficultyLabel}
      </span>
      <div
        className="flex-1 h-px"
        style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }}
      />
    </div>
  );
}

function InvalidRouteView() {
  return (
    <PageContainer>
      <div className="tqw-card-panel rounded-xl p-5 text-center">
        <div className="text-4xl mb-3">🧭</div>
        <p className="text-sm text-amber-100 mb-4">URL が正しくありません</p>
        <Link href="/alt-games">
          <button
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'rgba(255,215,0,0.15)',
              border: '1.5px solid rgba(255,215,0,0.4)',
              color: 'var(--tqw-gold)',
              minHeight: 48,
            }}
          >
            ALTゲームに戻る
          </button>
        </Link>
      </div>
    </PageContainer>
  );
}

function LoadingView() {
  return (
    <PageContainer>
      <div className="flex items-center justify-center min-h-[40vh]">
        <span className="text-sm" style={{ color: 'rgba(255,215,0,0.7)' }}>
          問題を読み込んでいます…
        </span>
      </div>
    </PageContainer>
  );
}

function EmptyView({
  subjectLabel,
  difficultyLabel,
}: {
  subjectLabel: string;
  difficultyLabel: string;
}) {
  return (
    <PageContainer>
      <div className="tqw-card-panel rounded-xl p-5 text-center">
        <div className="text-4xl mb-3">📭</div>
        <h2 className="text-base font-bold mb-2" style={{ color: 'var(--tqw-gold)' }}>
          問題が用意されていません
        </h2>
        <p className="text-xs text-amber-200/60 mb-4">
          {subjectLabel}の「{difficultyLabel}」問題は後日追加されます
        </p>
        <Link href="/alt-games">
          <button
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{
              background: 'rgba(255,215,0,0.15)',
              border: '1.5px solid rgba(255,215,0,0.4)',
              color: 'var(--tqw-gold)',
              minHeight: 48,
            }}
          >
            ALTゲームに戻る
          </button>
        </Link>
      </div>
    </PageContainer>
  );
}

function ReadyView({
  subjectLabel,
  difficultyLabel,
  difficultyIcon,
  totalCount,
  sessionsRemaining,
  sessionLimit,
  onStart,
}: {
  subjectLabel: string;
  difficultyLabel: string;
  difficultyIcon: string;
  totalCount: number;
  sessionsRemaining: number;
  sessionLimit: number;
  onStart: () => void;
}) {
  const altCap = QUIZ_4CHOICE_REWARDS.CORRECT_ANSWER * SESSION_SIZE + QUIZ_4CHOICE_REWARDS.PERFECT_BONUS;
  return (
    <PageContainer>
      <SectionHeader
        subjectLabel={subjectLabel}
        difficultyLabel={difficultyLabel}
        difficultyIcon={difficultyIcon}
      />
      <div className="tqw-card-panel rounded-xl p-4 mb-3">
        <p className="text-xs text-amber-200/70 mb-2">このセッション</p>
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-3xl font-black" style={{ color: 'var(--tqw-gold)' }}>
            {totalCount}
          </span>
          <span className="text-sm text-amber-100">問</span>
          <span className="text-xs text-amber-200/60 ml-auto">
            {difficultyIcon} {difficultyLabel}
          </span>
        </div>
        <p className="text-[11px] text-amber-200/60 leading-relaxed">
          正解 +{QUIZ_4CHOICE_REWARDS.CORRECT_ANSWER} ALT ／ 全問正解ボーナス +{QUIZ_4CHOICE_REWARDS.PERFECT_BONUS} ALT
          <br />
          1日 {sessionLimit} セッションまで ALT 加算対象
        </p>
      </div>
      <div className="tqw-card-panel rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-amber-200/70">今日の残りセッション</span>
          <span className="text-sm font-bold" style={{ color: 'var(--tqw-gold)' }}>
            {sessionsRemaining} / {sessionLimit}
          </span>
        </div>
        {sessionsRemaining === 0 && (
          <p className="text-[10px] text-amber-200/50 mt-1">
            上限到達中。セッションは完走できますが、ALT 加算は 0 になります (最大 {altCap} ALT/セッション)
          </p>
        )}
      </div>
      <button
        onClick={onStart}
        className="tqw-btn-quest w-full py-4 rounded-xl font-black text-base"
        style={{ minHeight: 56 }}
      >
        はじめる
      </button>
      <div className="mt-3">
        <Link href="/alt-games">
          <button
            className="w-full py-2.5 rounded-xl text-xs"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,215,0,0.2)',
              color: 'rgba(255,215,0,0.75)',
            }}
          >
            もどる
          </button>
        </Link>
      </div>
    </PageContainer>
  );
}

function PlayingView({
  subjectLabel,
  difficultyLabel,
  difficultyIcon,
  currentIndex,
  totalCount,
  question,
  shuffledChoices,
  selectedAnswer,
  lastResult,
  phase,
  onSelect,
  onNext,
}: {
  subjectLabel: string;
  difficultyLabel: string;
  difficultyIcon: string;
  currentIndex: number;
  totalCount: number;
  question: QuizQuestion;
  shuffledChoices: string[];
  selectedAnswer: string | null;
  lastResult: QuizAnswerResult | null;
  phase: Phase;
  onSelect: (choice: string) => void;
  onNext: () => void;
}) {
  const isFeedback = phase === 'feedback';
  const progressPct = Math.min(100, ((currentIndex + (isFeedback ? 1 : 0)) / totalCount) * 100);
  return (
    <PageContainer>
      <SectionHeader
        subjectLabel={subjectLabel}
        difficultyLabel={difficultyLabel}
        difficultyIcon={difficultyIcon}
      />
      {/* Progress */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-amber-200/70">
            問題 {currentIndex + 1} / {totalCount}
          </span>
        </div>
        <div className="h-1 rounded-full" style={{ background: 'rgba(255,215,0,0.1)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, #ffd700, #f0a500)',
              boxShadow: '0 0 6px rgba(255,215,0,0.4)',
            }}
          />
        </div>
      </div>
      {/* Question */}
      <div className="tqw-card-panel rounded-xl p-5 mb-3 text-center">
        <p
          className="text-xl font-black leading-relaxed whitespace-pre-wrap"
          style={{ color: 'var(--tqw-gold)' }}
        >
          {question.questionText}
        </p>
      </div>
      {/* Choices */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {shuffledChoices.map((choice, idx) => {
          const label = CHOICE_LABELS[idx] ?? '';
          const isSelected = selectedAnswer === choice;
          const isCorrectChoice = choice === question.correctAnswer;
          let bg = 'rgba(11,17,40,0.6)';
          let borderColor = 'rgba(255,215,0,0.25)';
          let textColor = 'var(--tqw-gold)';
          if (isFeedback) {
            if (isCorrectChoice) {
              bg = 'rgba(39,174,96,0.22)';
              borderColor = 'rgba(39,174,96,0.8)';
              textColor = '#b6f3c8';
            } else if (isSelected) {
              bg = 'rgba(231,76,60,0.22)';
              borderColor = 'rgba(231,76,60,0.8)';
              textColor = '#ffd1c8';
            } else {
              bg = 'rgba(255,255,255,0.03)';
              borderColor = 'rgba(255,215,0,0.12)';
              textColor = 'rgba(255,215,0,0.45)';
            }
          }
          return (
            <button
              key={`${question.id}-${idx}-${choice}`}
              onClick={() => onSelect(choice)}
              disabled={isFeedback}
              className="rounded-xl px-3 py-4 text-left transition-all active:scale-[0.97]"
              style={{
                background: bg,
                border: `1.5px solid ${borderColor}`,
                color: textColor,
                minHeight: 72,
                opacity: isFeedback && !isCorrectChoice && !isSelected ? 0.6 : 1,
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-bold rounded-md px-1.5 py-0.5"
                  style={{
                    background: 'rgba(255,215,0,0.15)',
                    color: 'var(--tqw-gold)',
                    minWidth: 22,
                    textAlign: 'center',
                  }}
                >
                  {label}
                </span>
                <span className="text-base font-bold break-all">{choice}</span>
              </div>
            </button>
          );
        })}
      </div>
      {/* Feedback */}
      {isFeedback && lastResult && (
        <FeedbackBlock question={question} result={lastResult} onNext={onNext} />
      )}
    </PageContainer>
  );
}

function FeedbackBlock({
  question,
  result,
  onNext,
}: {
  question: QuizQuestion;
  result: QuizAnswerResult;
  onNext: () => void;
}) {
  const { isCorrect, errorPattern } = result;
  return (
    <div
      className="tqw-card-panel rounded-xl p-4 mb-3"
      style={{
        borderColor: isCorrect ? 'rgba(39,174,96,0.55)' : 'rgba(231,76,60,0.55)',
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{isCorrect ? '✅' : '❌'}</span>
        <span
          className="text-base font-black"
          style={{ color: isCorrect ? '#b6f3c8' : '#ffd1c8' }}
        >
          {isCorrect ? '正解！' : '不正解'}
        </span>
        {!isCorrect && errorPattern && (
          <span
            className="text-[10px] ml-auto px-2 py-0.5 rounded-md"
            style={{
              background: 'rgba(231,76,60,0.18)',
              color: '#ffd1c8',
              border: '1px solid rgba(231,76,60,0.35)',
            }}
          >
            {ERROR_PATTERN_LABELS[errorPattern]}
          </span>
        )}
      </div>
      {!isCorrect && (
        <p className="text-xs text-amber-100 mb-2">
          正解: <strong style={{ color: 'var(--tqw-gold)' }}>{question.correctAnswer}</strong>
        </p>
      )}
      {!isCorrect && errorPattern && (
        <p className="text-[11px] text-amber-200/80 mb-2 leading-relaxed">
          💡 {ERROR_PATTERN_EXPLANATIONS[errorPattern]}
        </p>
      )}
      {question.explanation && (
        <p
          className="text-[11px] leading-relaxed p-2 rounded-lg"
          style={{
            background: 'rgba(255,215,0,0.06)',
            border: '1px solid rgba(255,215,0,0.15)',
            color: 'rgba(255,235,180,0.9)',
          }}
        >
          {question.explanation}
        </p>
      )}
      <button
        onClick={onNext}
        className="tqw-btn-quest w-full py-3 rounded-xl font-black text-sm mt-3"
        style={{ minHeight: 52 }}
      >
        次の問題へ →
      </button>
    </div>
  );
}

function ResultView({
  subjectLabel,
  difficultyLabel,
  difficultyIcon,
  correctCount,
  totalCount,
  grade,
  altEarned,
  rawAltEarned,
  limited,
  onRetry,
  onBack,
}: {
  subjectLabel: string;
  difficultyLabel: string;
  difficultyIcon: string;
  correctCount: number;
  totalCount: number;
  grade: Grade;
  altEarned: number;
  rawAltEarned: number;
  limited: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  const ratePct = totalCount === 0 ? 0 : Math.round((correctCount / totalCount) * 100);
  return (
    <PageContainer>
      <SectionHeader
        subjectLabel={subjectLabel}
        difficultyLabel={difficultyLabel}
        difficultyIcon={difficultyIcon}
      />
      <div className="tqw-card-panel rounded-xl p-5 mb-3 text-center">
        <div className="text-5xl mb-1">{GRADE_EMOJI[grade]}</div>
        <div
          className="text-5xl font-black mb-1"
          style={{ color: 'var(--tqw-gold)', textShadow: '0 0 16px rgba(255,215,0,0.5)' }}
        >
          {grade}
        </div>
        <p className="text-xs text-amber-200/75 mb-3">{GRADE_MESSAGE[grade]}</p>
        <div className="flex items-center justify-center gap-3 mb-3">
          <div>
            <div className="text-[10px] text-amber-200/60">正答数</div>
            <div className="text-lg font-black" style={{ color: 'var(--tqw-gold)' }}>
              {correctCount} / {totalCount}
            </div>
          </div>
          <div className="h-8 w-px" style={{ background: 'rgba(255,215,0,0.2)' }} />
          <div>
            <div className="text-[10px] text-amber-200/60">正答率</div>
            <div className="text-lg font-black" style={{ color: 'var(--tqw-gold)' }}>
              {ratePct}%
            </div>
          </div>
        </div>
      </div>
      <div
        className="tqw-card-panel rounded-xl p-4 mb-4 text-center"
        style={{
          borderColor: altEarned > 0 ? 'rgba(255,215,0,0.55)' : 'rgba(255,215,0,0.2)',
        }}
      >
        <div className="text-[10px] text-amber-200/60 mb-1">獲得 ALT</div>
        <div
          className="text-3xl font-black mb-1"
          style={{ color: 'var(--tqw-gold)', textShadow: '0 0 12px rgba(255,215,0,0.35)' }}
        >
          +{altEarned}
        </div>
        {limited && (
          <p className="text-[10px] text-amber-200/70 leading-relaxed">
            今日の ALT 獲得回数上限に達しています。学習記録は保存されました
            {rawAltEarned > 0 && <> (本来 +{rawAltEarned} ALT)</>}
          </p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onRetry}
          className="tqw-btn-quest rounded-xl py-3 font-black text-sm"
          style={{ minHeight: 52 }}
        >
          もう1回
        </button>
        <button
          onClick={onBack}
          className="rounded-xl py-3 font-bold text-sm"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1.5px solid rgba(255,215,0,0.35)',
            color: 'var(--tqw-gold)',
            minHeight: 52,
          }}
        >
          ゲーム一覧へ
        </button>
      </div>
    </PageContainer>
  );
}
