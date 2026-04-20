/**
 * QuizPracticePage - デッキ別クイズ (5問)
 * URL: /games/quiz/:deck/:difficulty
 * クイズ → 結果画面 → クエスト進捗更新
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useUserStore, useAltStore, useCollectionStore } from '@/lib/stores';
import { processQuizResult, fetchChildStatus } from '@/lib/quizService';
import { getStarterDeckCardNames } from '@/lib/myDecks';
import { COLLECTION_CARDS } from '@/lib/cardData';
import {
  type DeckKey,
  type QuestDifficulty,
  DECK_QUEST_INFO,
  DIFFICULTY_INFO,
  CLEAR_THRESHOLD,
  isDeckUnlocked,
  isSSRUnlocked,
  loadQuestProgress,
  saveQuestProgress,
  recordQuizResult,
  DECK_SSR_CARDS,
} from '@/lib/questProgress';
import { getQuizPoolForMode, shuffleQuizChoices, type QuestQuiz } from '@/lib/questQuizData';
import { incrementTodayAltCount, getRemainingAltCount } from '@/lib/altDailyLimit';

const QUESTIONS_PER_SESSION = 10;
const ALL_CORRECT_BONUS_ALT = 10; // 全問正解ボーナス（全難易度共通）

type Phase = 'playing' | 'result';

interface AnswerRecord {
  quiz: QuestQuiz;
  selectedIndex: number;
  isCorrect: boolean;
}

export default function QuizPracticePage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/games/quiz/:deck/:difficulty');
  const deckKey = (params?.deck || 'napoleon') as DeckKey;
  const diffKey = (params?.difficulty || 'beginner') as QuestDifficulty;

  const deckInfo = DECK_QUEST_INFO[deckKey] || DECK_QUEST_INFO.napoleon;
  const diffInfo = DIFFICULTY_INFO[diffKey] || DIFFICULTY_INFO.beginner;
  const timeLimit = diffInfo.timeLimit;

  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const userId = useUserStore((s) => s.user.id);
  const addCollectionCards = useCollectionStore((s) => s.addCards);

  const [phase, setPhase] = useState<Phase>('playing');
  const [questions, setQuestions] = useState<QuestQuiz[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timer, setTimer] = useState(timeLimit ?? 999);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [totalAltEarned, setTotalAltEarned] = useState(0);
  const [altBalance, setAltBalance] = useState<number | null>(null);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [wrongShake, setWrongShake] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  // Reward states
  const [deckJustUnlocked, setDeckJustUnlocked] = useState(false);
  const [ssrJustUnlocked, setSsrJustUnlocked] = useState(false);
  // kk spec 2026-04-21 DECK_QUEST_SPEC §3.3: 結果画面で「敵デッキ戦へ挑戦」ボタンを出すフラグ。
  // クイズ累計5正解 (cleared=true) で true に固定（過去にクリア済でも true）。
  const [questBattleEligible, setQuestBattleEligible] = useState(false);

  // 1日3回ALT制限: セッション開始時点で「今回ALT獲得できるか」を固定。
  const [earnAltThisSession, setEarnAltThisSession] = useState(false);
  const [remainingAfterSession, setRemainingAfterSession] = useState(0);

  useEffect(() => { return () => { unmountedRef.current = true; }; }, []);

  // Fetch ALT balance
  useEffect(() => {
    fetchChildStatus(userId).then((status) => {
      if (status) setAltBalance(status.alt_points);
    });
  }, [userId]);

  // Generate questions on mount
  useEffect(() => {
    const pool = getQuizPoolForMode(deckKey, diffKey);
    const shuffled = [...pool].sort(() => Math.random() - 0.5).map(shuffleQuizChoices);
    setQuestions(shuffled.slice(0, QUESTIONS_PER_SESSION));
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowResult(false);
    setTimer(timeLimit ?? 999);
    setConsecutiveCorrect(0);
    setMaxStreak(0);
    setTotalAltEarned(0);
    // Lock-in today's ALT earn-eligibility for this session
    const remaining = getRemainingAltCount(userId, deckKey, diffKey);
    setEarnAltThisSession(remaining > 0);
    setRemainingAfterSession(Math.max(0, remaining - 1));
    setPhase('playing');
  }, [deckKey, diffKey, timeLimit, userId]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing' || showResult || timeLimit === null) return;
    timerRef.current = setInterval(() => {
      setTimer((t) => {
        if (t <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, currentIndex, showResult, timeLimit]);

  const handleTimeout = useCallback(() => {
    if (selectedAnswer !== null) return;
    const q = questions[currentIndex];
    if (!q) return;
    setSelectedAnswer(-1);
    setShowResult(true);
    setConsecutiveCorrect(0);
    setWrongShake(true);
    setTimeout(() => setWrongShake(false), 500);

    setAnswers((prev) => [...prev, { quiz: q, selectedIndex: -1, isCorrect: false }]);

    processQuizResult({
      childId: userId,
      quizId: `quest-${deckKey}-${diffKey}-${currentIndex}-timeout`,
      selectedIndex: -1,
      isCorrect: false,
      consecutiveCorrect: 0,
      cardRarity: 'N',
    });

    setTimeout(() => advanceQuestion(), 2000);
  }, [questions, currentIndex, selectedAnswer, userId, deckKey, diffKey]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (selectedAnswer !== null || !questions[currentIndex]) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[currentIndex];
    const correct = answerIndex === q.correctIndex;
    setSelectedAnswer(answerIndex);
    setShowResult(true);

    const newStreak = correct ? consecutiveCorrect + 1 : 0;
    setConsecutiveCorrect(newStreak);
    if (newStreak > maxStreak) setMaxStreak(newStreak);

    if (correct) {
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 600);
      if (earnAltThisSession) {
        const altEarned = diffInfo.altPerCorrect;
        setTotalAltEarned((prev) => prev + altEarned);
        addTotalAlt(altEarned);
      }
    } else {
      setWrongShake(true);
      setTimeout(() => setWrongShake(false), 500);
    }

    setAnswers((prev) => [...prev, { quiz: q, selectedIndex: answerIndex, isCorrect: correct }]);

    processQuizResult({
      childId: userId,
      quizId: `quest-${deckKey}-${diffKey}-${currentIndex}`,
      selectedIndex: answerIndex,
      isCorrect: correct,
      consecutiveCorrect: newStreak,
      cardRarity: diffKey === 'legend' ? 'SSR' : diffKey === 'master' ? 'SR' : diffKey === 'challenger' ? 'R' : 'N',
    }).then((reward) => {
      if (reward) setAltBalance(reward.newAltTotal);
    });

    setTimeout(() => advanceQuestion(), 2000);
  }, [questions, currentIndex, selectedAnswer, consecutiveCorrect, maxStreak, diffInfo, userId, addTotalAlt, deckKey, diffKey]);

  const advanceQuestion = useCallback(() => {
    if (currentIndex + 1 >= QUESTIONS_PER_SESSION) {
      // Save progress + apply all-correct bonus
      setAnswers((prev) => {
        const finalCorrect = prev.filter((a) => a.isCorrect).length;
        // All-correct bonus (+10 ALT, 全難易度共通) — 練習モード時は付与なし
        if (earnAltThisSession && finalCorrect === QUESTIONS_PER_SESSION) {
          setTotalAltEarned((p) => p + ALL_CORRECT_BONUS_ALT);
          addTotalAlt(ALL_CORRECT_BONUS_ALT);
        }
        // ALT獲得セッションの場合のみ、1日3回カウンタを進める
        if (earnAltThisSession) {
          incrementTodayAltCount(userId, deckKey, diffKey);
        }
        // Record quest progress
        const oldProgress = loadQuestProgress();
        const wasDeckUnlocked = isDeckUnlocked(oldProgress, deckKey);
        const wasSSRUnlocked = isSSRUnlocked(oldProgress, deckKey);
        const newProgress = recordQuizResult(oldProgress, deckKey, diffKey, finalCorrect);
        saveQuestProgress(newProgress);

        if (!wasDeckUnlocked && isDeckUnlocked(newProgress, deckKey)) {
          setDeckJustUnlocked(true);
          // デッキ解放時: そのデッキのカードをコレクションに追加
          const deckCardNames = getStarterDeckCardNames(deckKey);
          const deckCardIds = COLLECTION_CARDS
            .filter((c) => deckCardNames.includes(c.name))
            .map((c) => c.id);
          addCollectionCards(deckCardIds);
        }
        if (!wasSSRUnlocked && isSSRUnlocked(newProgress, deckKey)) {
          setSsrJustUnlocked(true);
        }
        // クエスト戦エントリー判定: ビギナークリア済なら結果画面で「敵デッキ戦へ」ボタンを出す
        if (newProgress[deckKey].beginner.cleared) {
          setQuestBattleEligible(true);
        }
        return prev;
      });
      setPhase('result');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimer(timeLimit ?? 999);
    }
  }, [currentIndex, deckKey, diffKey, timeLimit, answers, addTotalAlt, earnAltThisSession, userId]);

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongQuizzes = answers.filter((a) => !a.isCorrect);

  // ===================== RESULT SCREEN =====================
  if (phase === 'result') {
    const scorePercent = Math.round((correctCount / QUESTIONS_PER_SESSION) * 100);
    const medal = scorePercent >= 100 ? '🏆' : scorePercent >= 80 ? '🥈' : scorePercent >= 60 ? '🥉' : '💪';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-5" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 100%)' }}>
        {scorePercent >= 100 && <div className="qp-confetti" />}
        <div
          className="rounded-2xl p-5 w-full max-w-sm text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `2px solid ${deckInfo.color}50`,
            boxShadow: `inset 0 0 30px ${deckInfo.color}08, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          <span className="text-4xl block mb-2 qp-result-bounce">{medal}</span>
          <h2 className="text-xl font-black mb-0.5" style={{ color: deckInfo.color, textShadow: `0 0 20px ${deckInfo.color}40` }}>
            {deckInfo.icon} {deckInfo.name}
          </h2>
          <p className="text-amber-200/50 text-xs mb-3">{diffInfo.label}モード</p>

          {/* Score */}
          <div className="flex items-center justify-center gap-6 mb-3">
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">正解数</p>
              <span className="text-2xl font-black" style={{ color: correctCount >= 4 ? '#22c55e' : correctCount >= 3 ? '#ffd700' : '#ef4444' }}>
                {correctCount}
              </span>
              <span className="text-base text-amber-200/50 font-bold"> / {QUESTIONS_PER_SESSION}</span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">獲得ALT</p>
              {earnAltThisSession ? (
                <span className="text-2xl font-black" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                  +{totalAltEarned}
                </span>
              ) : (
                <span className="text-sm font-bold text-amber-200/50">練習モード</span>
              )}
            </div>
          </div>

          {/* Daily ALT limit status */}
          {earnAltThisSession ? (
            <div className="mb-3 rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
              <p className="text-[11px] font-bold" style={{ color: '#ffd700' }}>
                +{totalAltEarned} ALT 獲得！
                <span className="text-amber-200/60 ml-1">（本日 残り{remainingAfterSession}回）</span>
              </p>
            </div>
          ) : (
            <div className="mb-3 rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.25)' }}>
              <p className="text-[11px] font-bold text-slate-300">練習モード（ALTなし）</p>
              <p className="text-[9px] text-slate-400 mt-0.5">明日0:00（JST）にリセット</p>
            </div>
          )}

          {/* Unlock banners */}
          {deckJustUnlocked && (
            <div className="rounded-lg p-3 mb-3 text-center" style={{ background: 'rgba(34,197,94,0.15)', border: '1.5px solid rgba(34,197,94,0.4)' }}>
              <span className="text-lg">🎉</span>
              <p className="text-sm font-bold text-green-400 mt-1">{deckInfo.name}デッキ解放！</p>
              <p className="text-[10px] text-green-300/60 mt-0.5">バトルで使用可能になりました</p>
            </div>
          )}
          {ssrJustUnlocked && (
            <div className="rounded-lg p-3 mb-3 text-center" style={{ background: 'rgba(255,215,0,0.12)', border: '1.5px solid rgba(255,215,0,0.4)' }}>
              <span className="text-lg">👑</span>
              <p className="text-sm font-bold" style={{ color: '#ffd700' }}>SSRカード解放！</p>
              {DECK_SSR_CARDS[deckKey].length > 0 && (
                <p className="text-[10px] text-amber-200/60 mt-0.5">
                  {DECK_SSR_CARDS[deckKey].join('・')}が最終回戦で提示されるようになりました
                </p>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <div className="px-3 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[8px] text-amber-200/35">最大連続正解</p>
              <span className="text-xs font-bold text-orange-400">🔥 {maxStreak}</span>
            </div>
            <div className="px-3 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[8px] text-amber-200/35">正答率</p>
              <span className="text-xs font-bold text-amber-100">{scorePercent}%</span>
            </div>
          </div>

          {/* Wrong quizzes */}
          {wrongQuizzes.length > 0 && (
            <div className="rounded-lg p-2.5 mb-3 text-left" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[10px] font-bold text-red-400 mb-1.5">📝 復習ポイント</p>
              <div className="space-y-1.5">
                {wrongQuizzes.map((a, i) => (
                  <div key={i}>
                    <p className="text-[10px] text-amber-200/50" dangerouslySetInnerHTML={{ __html: a.quiz.question }} />
                    <p className="text-[9px] text-green-400 mt-0.5">
                      正解: <span dangerouslySetInnerHTML={{ __html: a.quiz.choices[a.quiz.correctIndex] }} />
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          {questBattleEligible && (
            <button
              onClick={() => navigate(`/games/knowledge-challenger?mode=quest&enemyDeck=${deckKey}`)}
              className="w-full rounded-xl font-black text-base py-3 mb-2 active:scale-[0.97] transition-transform"
              style={{
                minHeight: 52,
                background: `linear-gradient(135deg, ${deckInfo.color}, ${deckInfo.color}cc)`,
                color: '#0b1128',
                boxShadow: `0 4px 16px ${deckInfo.color}66`,
                border: `2px solid ${deckInfo.color}`,
              }}
            >
              ⚔️ {deckInfo.name}デッキ戦へ挑戦
            </button>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/games/quiz/${deckKey}/${diffKey}`)}
              className="rpg-btn rpg-btn-blue flex-1 py-2.5"
            >
              🔄 もう一度
            </button>
            <button
              onClick={() => navigate('/games/quest-board')}
              className="rpg-btn rpg-btn-gold flex-1 py-2.5"
            >
              📋 デッキクエストへ
            </button>
          </div>
        </div>

        <style>{`
          .qp-result-bounce { animation: qpBounce 0.8s ease-out; }
          @keyframes qpBounce { 0% { transform: scale(0); } 50% { transform: scale(1.3); } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
          .qp-confetti { position: fixed; inset: 0; pointer-events: none; z-index: 50; background-image:
            radial-gradient(circle, #ffd700 1px, transparent 1px),
            radial-gradient(circle, #ef4444 1px, transparent 1px),
            radial-gradient(circle, #22c55e 1px, transparent 1px),
            radial-gradient(circle, #3b82f6 1px, transparent 1px);
          background-size: 30px 30px, 40px 40px, 35px 35px, 45px 45px;
          background-position: 0 0, 15px 15px, 5px 25px, 25px 5px;
          animation: qpConfettiFall 3s ease-out forwards; opacity: 0.6; }
          @keyframes qpConfettiFall { 0% { transform: translateY(-100%); opacity: 0.8; } 100% { transform: translateY(100vh); opacity: 0; } }
        `}</style>
      </div>
    );
  }

  // ===================== PLAYING SCREEN =====================
  const q = questions[currentIndex];
  if (!q) return null;

  return (
    <div className={`min-h-screen flex flex-col relative ${wrongShake ? 'qp-shake' : ''}`} style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>
      {correctFlash && <div className="qp-correct-flash" />}

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.98), rgba(16,22,48,0.95))',
          borderBottom: `2px solid ${deckInfo.color}30`,
        }}
      >
        <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); navigate('/games/quest-board'); }} className="text-amber-200/40 text-sm">✕</button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{deckInfo.icon}</span>
          <span className="text-sm font-bold" style={{ color: deckInfo.color }}>{deckInfo.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: `${diffInfo.color}20`, color: diffInfo.color, border: `1px solid ${diffInfo.color}40` }}>
            {diffInfo.label}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-amber-200/40">ALT </span>
          <span className="text-sm font-bold" style={{ color: '#ffd700' }}>{altBalance !== null ? altBalance.toLocaleString() : '---'}</span>
        </div>
      </div>

      {/* Practice-mode banner (no ALT today) */}
      {!earnAltThisSession && (
        <div className="px-4 py-1.5 shrink-0 text-center" style={{ background: 'rgba(148,163,184,0.12)', borderBottom: '1px solid rgba(148,163,184,0.25)' }}>
          <p className="text-[10.5px] font-bold text-slate-300">
            🔕 本日の ALT 獲得上限に到達 — ALTはもらえませんが挑戦できます
          </p>
        </div>
      )}

      {/* Progress (gold bar, Manus mock) */}
      <div className="px-4 py-2.5 flex items-center gap-3 shrink-0" style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,215,0,0.08)' }}>
        <span className="tqw-hud-pill text-[11px]">
          <span className="hud-label">Q</span>
          <span className="hud-value">{currentIndex + 1}/{QUESTIONS_PER_SESSION}</span>
        </span>
        <div className="flex-1 tqw-progress-track">
          <div className="tqw-progress-bar" style={{ width: `${((currentIndex + 1) / QUESTIONS_PER_SESSION) * 100}%` }} />
        </div>
        <div className="flex items-center gap-1.5">
          {consecutiveCorrect >= 2 && (
            <span className="tqw-hud-pill text-[11px]" style={{ borderColor: 'rgba(255,170,0,0.35)', color: '#ffaa00' }}>
              🔥{consecutiveCorrect}
            </span>
          )}
          {timeLimit !== null && (
            <span className={`tqw-hud-pill text-[11px] ${timer <= 5 ? 'qp-timer-pulse' : ''}`}
              style={{ color: timer <= 5 ? '#ef4444' : timer <= 10 ? '#f97316' : '#ffe066', borderColor: timer <= 5 ? 'rgba(239,68,68,0.5)' : 'rgba(255,215,0,0.25)' }}>
              ⏱️{timer}s
            </span>
          )}
        </div>
      </div>

      {/* Timer Bar */}
      {timeLimit !== null && (
        <div className="h-1 shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div
            className="h-full transition-all duration-1000"
            style={{
              width: `${(timer / timeLimit) * 100}%`,
              background: timer <= 5 ? '#ef4444' : timer <= 10 ? '#f97316' : deckInfo.color,
            }}
          />
        </div>
      )}

      {/* Question Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4 overflow-auto py-4">
        {/* Question (tqw-card-panel, Manus mock) */}
        <div
          className="tqw-card-panel w-full max-w-sm p-4 tqw-animate-fadeIn"
          style={{ borderColor: `${deckInfo.color}40` }}
        >
          <p
            className="text-amber-100 text-sm font-bold mb-4 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: q.question }}
          />

          <div className="space-y-2.5">
            {q.choices.map((choice, i) => {
              let btnBg = 'rgba(255,255,255,0.05)';
              let btnBorder = 'rgba(255,255,255,0.1)';
              let textColor = 'rgba(255,255,255,0.8)';

              if (showResult) {
                if (i === q.correctIndex) {
                  btnBg = 'rgba(34,197,94,0.25)';
                  btnBorder = 'rgba(34,197,94,0.6)';
                  textColor = '#22c55e';
                } else if (i === selectedAnswer && i !== q.correctIndex) {
                  btnBg = 'rgba(239,68,68,0.25)';
                  btnBorder = 'rgba(239,68,68,0.6)';
                  textColor = '#ef4444';
                }
              }

              const isCorrectReveal = showResult && i === q.correctIndex;
              const isWrongPick = showResult && i === selectedAnswer && i !== q.correctIndex;
              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                  className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98] flex items-center gap-3 ${isCorrectReveal ? 'qp-correct-pulse' : ''} ${isWrongPick ? 'qp-wrong-shake' : ''}`}
                  style={{
                    background: btnBg,
                    border: `2px solid ${btnBorder}`,
                    color: textColor,
                    boxShadow: isCorrectReveal
                      ? '0 0 24px rgba(34,197,94,0.55), inset 0 0 12px rgba(34,197,94,0.15)'
                      : isWrongPick
                      ? '0 0 18px rgba(239,68,68,0.45)'
                      : '0 2px 8px rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                    style={{
                      background: showResult && isCorrectReveal
                        ? 'rgba(34,197,94,0.35)'
                        : isWrongPick
                        ? 'rgba(239,68,68,0.35)'
                        : 'rgba(255,215,0,0.15)',
                      color: isCorrectReveal ? '#22c55e' : isWrongPick ? '#ef4444' : '#ffd700',
                      border: `1px solid ${isCorrectReveal ? 'rgba(34,197,94,0.5)' : isWrongPick ? 'rgba(239,68,68,0.5)' : 'rgba(255,215,0,0.3)'}`,
                    }}
                  >
                    {['A', 'B', 'C', 'D'][i]}
                  </span>
                  <span className="flex-1" dangerouslySetInnerHTML={{ __html: choice }} />
                  {isCorrectReveal && <span className="text-lg">✓</span>}
                  {isWrongPick && <span className="text-lg">✗</span>}
                </button>
              );
            })}
          </div>

          {/* Answer feedback */}
          {showResult && (
            <div className="mt-3 text-center">
              {selectedAnswer === q.correctIndex ? (
                <div>
                  <span className="text-sm font-bold text-green-400">🎉 正解！</span>
                  {earnAltThisSession ? (
                    <span className="text-xs ml-2 font-bold" style={{ color: '#ffd700' }}>+{diffInfo.altPerCorrect} ALT</span>
                  ) : (
                    <span className="text-xs ml-2 font-bold text-slate-400">（練習）</span>
                  )}
                </div>
              ) : (
                <span className="text-sm font-bold text-red-400">
                  {selectedAnswer === -1 ? '⏰ 時間切れ...' : '😢 不正解...'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Score summary */}
        <div className="flex items-center gap-4 text-center">
          <div>
            <p className="text-[8px] text-amber-200/30">正解</p>
            <span className="text-sm font-bold text-green-400">{correctCount}</span>
          </div>
          <div>
            <p className="text-[8px] text-amber-200/30">不正解</p>
            <span className="text-sm font-bold text-red-400">{answers.length - correctCount}</span>
          </div>
          <div>
            <p className="text-[8px] text-amber-200/30">獲得ALT</p>
            <span className="text-sm font-bold" style={{ color: '#ffd700' }}>+{totalAltEarned}</span>
          </div>
        </div>
      </div>

      <style>{`
        .qp-correct-flash { position: fixed; inset: 0; z-index: 50; pointer-events: none; animation: qpFlashGreen 0.6s ease-out forwards; }
        @keyframes qpFlashGreen { 0% { background: rgba(34,197,94,0.3); } 100% { background: transparent; } }
        .qp-shake { animation: qpShake 0.5s ease-out; }
        @keyframes qpShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-6px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(4px); } }
        .qp-timer-pulse { animation: qpTimerPulse 1s ease-in-out infinite; }
        @keyframes qpTimerPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .qp-correct-pulse { animation: qpCorrectPulse 0.6s ease-out; }
        @keyframes qpCorrectPulse {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(34,197,94,0); }
          40% { transform: scale(1.03); box-shadow: 0 0 32px rgba(34,197,94,0.7), inset 0 0 16px rgba(34,197,94,0.2); }
          100% { transform: scale(1); box-shadow: 0 0 24px rgba(34,197,94,0.55), inset 0 0 12px rgba(34,197,94,0.15); }
        }
        .qp-wrong-shake { animation: qpWrongShake 0.5s ease-out; }
        @keyframes qpWrongShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}
