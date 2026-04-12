/**
 * QuizPracticePage - ジャンル別4択クイズ練習モード
 * 難易度選択 → 10問クイズ → 結果画面
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useUserStore, useAltStore } from '@/lib/stores';
import {
  type BattleCard,
  type Quiz,
  type CardCategory,
  CATEGORY_INFO,
  RARITY_INFO,
  ALL_BATTLE_CARDS,
} from '@/lib/knowledgeCards';
import {
  processQuizResult,
  fetchChildStatus,
} from '@/lib/quizService';

type Difficulty = 'beginner' | 'challenger' | 'master' | 'legend';

interface DifficultyInfo {
  label: string;
  stars: number;
  altPerCorrect: number;
  color: string;
  rarities: string[];
}

const DIFFICULTY_MAP: Record<Difficulty, DifficultyInfo> = {
  beginner: { label: 'ビギナー', stars: 1, altPerCorrect: 5, color: '#22c55e', rarities: ['N'] },
  challenger: { label: 'チャレンジャー', stars: 2, altPerCorrect: 10, color: '#3b82f6', rarities: ['N', 'R'] },
  master: { label: 'マスター', stars: 3, altPerCorrect: 15, color: '#a855f7', rarities: ['R', 'SR'] },
  legend: { label: 'レジェンド', stars: 4, altPerCorrect: 20, color: '#ffd700', rarities: ['SR', 'SSR'] },
};

// Map URL genre to CardCategory
const GENRE_TO_CATEGORY: Record<string, CardCategory> = {
  'great-person': 'great_person',
  'creature': 'creature',
  'heritage': 'heritage',
  'invention': 'invention',
};

const GENRE_INFO: Record<string, { emoji: string; label: string; color: string }> = {
  'great-person': { emoji: '👑', label: '偉人クエスト', color: '#f59e0b' },
  'creature': { emoji: '🐟', label: '生き物クエスト', color: '#22c55e' },
  'heritage': { emoji: '🏛️', label: '世界遺産クエスト', color: '#8b5cf6' },
  'invention': { emoji: '🔬', label: '科学発明クエスト', color: '#3b82f6' },
};

type Phase = 'difficulty' | 'playing' | 'result';

interface QuizQuestion {
  card: BattleCard;
  quiz: Quiz;
}

interface AnswerRecord {
  card: BattleCard;
  quiz: Quiz;
  selectedIndex: number;
  isCorrect: boolean;
}

export default function QuizPracticePage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/games/quiz/:genre');
  const genre = params?.genre || 'great-person';
  const genreInfo = GENRE_INFO[genre] || GENRE_INFO['great-person'];
  const category = GENRE_TO_CATEGORY[genre] || 'great_person';

  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);
  const userId = useUserStore((s) => s.user.id);

  const [phase, setPhase] = useState<Phase>('difficulty');
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [timer, setTimer] = useState(30);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [totalAltEarned, setTotalAltEarned] = useState(0);
  const [altBalance, setAltBalance] = useState<number | null>(null);
  const [correctFlash, setCorrectFlash] = useState(false);
  const [wrongShake, setWrongShake] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch ALT balance
  useEffect(() => {
    fetchChildStatus(userId).then((status) => {
      if (status) setAltBalance(status.alt_points);
    });
  }, [userId]);

  // Generate questions for selected difficulty
  const startQuiz = useCallback((diff: Difficulty) => {
    setDifficulty(diff);
    const diffInfo = DIFFICULTY_MAP[diff];

    // Filter cards by category and rarity
    let pool = ALL_BATTLE_CARDS.filter(
      (c) => c.category === category && diffInfo.rarities.includes(c.rarity)
    );

    // If pool too small, expand to include adjacent rarities
    if (pool.length < 5) {
      pool = ALL_BATTLE_CARDS.filter((c) => c.category === category);
    }

    // Also include discovery cards for invention genre to have more variety
    if (pool.length < 5) {
      const extra = ALL_BATTLE_CARDS.filter(
        (c) => diffInfo.rarities.includes(c.rarity)
      );
      pool = [...pool, ...extra];
    }

    // Shuffle and pick 10 questions (with repeats if needed)
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected: QuizQuestion[] = [];
    for (let i = 0; i < 10; i++) {
      const card = shuffled[i % shuffled.length];
      const quiz = card.quizzes[Math.floor(Math.random() * card.quizzes.length)];
      selected.push({ card, quiz });
    }

    setQuestions(selected);
    setCurrentIndex(0);
    setAnswers([]);
    setSelectedAnswer(null);
    setShowResult(false);
    setTimer(30);
    setConsecutiveCorrect(0);
    setMaxStreak(0);
    setTotalAltEarned(0);
    setPhase('playing');
  }, [category]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing' || showResult) return;
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
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, currentIndex, showResult]);

  const handleTimeout = useCallback(() => {
    if (selectedAnswer !== null) return;
    const q = questions[currentIndex];
    if (!q) return;
    setSelectedAnswer(-1);
    setShowResult(true);
    setConsecutiveCorrect(0);
    setWrongShake(true);
    setTimeout(() => setWrongShake(false), 500);

    const record: AnswerRecord = {
      card: q.card,
      quiz: q.quiz,
      selectedIndex: -1,
      isCorrect: false,
    };
    setAnswers((prev) => [...prev, record]);

    processQuizResult({
      childId: userId,
      quizId: `practice-${q.card.id}-${currentIndex}-timeout`,
      selectedIndex: -1,
      isCorrect: false,
      consecutiveCorrect: 0,
      cardRarity: q.card.rarity,
    });

    setTimeout(() => advanceQuestion(), 2000);
  }, [questions, currentIndex, selectedAnswer, userId]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (selectedAnswer !== null || !questions[currentIndex]) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const q = questions[currentIndex];
    const correct = answerIndex === q.quiz.correctIndex;
    setSelectedAnswer(answerIndex);
    setShowResult(true);

    const newStreak = correct ? consecutiveCorrect + 1 : 0;
    setConsecutiveCorrect(newStreak);
    if (newStreak > maxStreak) setMaxStreak(newStreak);

    if (correct) {
      setCorrectFlash(true);
      setTimeout(() => setCorrectFlash(false), 600);
      const diffInfo = DIFFICULTY_MAP[difficulty];
      let altEarned = diffInfo.altPerCorrect;
      // Streak bonus
      if (newStreak >= 2) altEarned += 5;
      setTotalAltEarned((prev) => prev + altEarned);
      addTotalAlt(altEarned);
    } else {
      setWrongShake(true);
      setTimeout(() => setWrongShake(false), 500);
    }

    const record: AnswerRecord = {
      card: q.card,
      quiz: q.quiz,
      selectedIndex: answerIndex,
      isCorrect: correct,
    };
    setAnswers((prev) => [...prev, record]);

    processQuizResult({
      childId: userId,
      quizId: `practice-${q.card.id}-${currentIndex}`,
      selectedIndex: answerIndex,
      isCorrect: correct,
      consecutiveCorrect: newStreak,
      cardRarity: q.card.rarity,
    }).then((reward) => {
      if (reward) setAltBalance(reward.newAltTotal);
    });

    setTimeout(() => advanceQuestion(), 2000);
  }, [questions, currentIndex, selectedAnswer, consecutiveCorrect, maxStreak, difficulty, userId, addTotalAlt]);

  const advanceQuestion = useCallback(() => {
    if (currentIndex + 1 >= 10) {
      setPhase('result');
    } else {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      setTimer(30);
    }
  }, [currentIndex]);

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const wrongCards = answers.filter((a) => !a.isCorrect);

  // ===================== DIFFICULTY SELECT =====================
  if (phase === 'difficulty') {
    return (
      <div className="min-h-screen flex flex-col px-4 pt-6 pb-24" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>
        <button onClick={() => navigate('/games/quest-board')} className="text-amber-200/40 text-sm mb-4 self-start hover:text-amber-200/70 transition-colors">
          ← ジャンル選択へ
        </button>

        <div className="text-center mb-6">
          <span className="text-4xl block mb-2">{genreInfo.emoji}</span>
          <h1 className="text-xl font-bold mb-1" style={{ color: genreInfo.color, textShadow: `0 0 15px ${genreInfo.color}40` }}>
            {genreInfo.label}
          </h1>
          <p className="text-amber-200/50 text-xs">難易度を選んでクイズスタート！</p>
        </div>

        <div className="space-y-3 max-w-sm mx-auto w-full">
          {(Object.entries(DIFFICULTY_MAP) as [Difficulty, DifficultyInfo][]).map(([key, info]) => (
            <button
              key={key}
              onClick={() => startQuiz(key)}
              className="w-full rounded-xl p-4 text-left transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))`,
                border: `2px solid ${info.color}40`,
                boxShadow: `0 4px 16px rgba(0,0,0,0.3), inset 0 0 20px ${info.color}08`,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <span key={i} className="text-sm" style={{ color: i < info.stars ? info.color : 'rgba(255,255,255,0.1)' }}>
                          {i < info.stars ? '⭐' : '☆'}
                        </span>
                      ))}
                    </div>
                    {key === 'legend' && <span className="text-sm">👑</span>}
                  </div>
                  <h3 className="text-base font-bold text-amber-100">{info.label}</h3>
                  <p className="text-[11px] text-amber-200/40 mt-0.5">10問 / 制限時間30秒</p>
                </div>
                <div className="text-right">
                  <div className="px-3 py-1.5 rounded-lg" style={{ background: `${info.color}20`, border: `1px solid ${info.color}40` }}>
                    <span className="text-sm font-black" style={{ color: info.color }}>+{info.altPerCorrect}</span>
                    <span className="text-[10px] ml-1" style={{ color: `${info.color}cc` }}>ALT/正解</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ===================== RESULT SCREEN =====================
  if (phase === 'result') {
    const scorePercent = Math.round((correctCount / 10) * 100);
    const medal = scorePercent >= 90 ? '🏆' : scorePercent >= 70 ? '🥈' : scorePercent >= 50 ? '🥉' : '💪';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 100%)' }}>
        {scorePercent >= 90 && <div className="qp-confetti" />}
        <div
          className="rounded-2xl p-6 w-full max-w-sm text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `2px solid ${genreInfo.color}50`,
            boxShadow: `inset 0 0 30px ${genreInfo.color}08, 0 8px 32px rgba(0,0,0,0.5)`,
          }}
        >
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2" style={{ borderColor: `${genreInfo.color}60` }} />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2" style={{ borderColor: `${genreInfo.color}60` }} />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2" style={{ borderColor: `${genreInfo.color}60` }} />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2" style={{ borderColor: `${genreInfo.color}60` }} />

          <span className="text-5xl block mb-2 qp-result-bounce">{medal}</span>
          <h2 className="text-2xl font-black mb-1" style={{ color: genreInfo.color, textShadow: `0 0 20px ${genreInfo.color}40` }}>
            {genreInfo.label}
          </h2>
          <p className="text-amber-200/50 text-xs mb-4">{DIFFICULTY_MAP[difficulty].label}モード</p>

          {/* Score */}
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">正解数</p>
              <span className="text-3xl font-black" style={{ color: correctCount >= 7 ? '#22c55e' : correctCount >= 5 ? '#ffd700' : '#ef4444' }}>
                {correctCount}
              </span>
              <span className="text-lg text-amber-200/50 font-bold"> / 10</span>
            </div>
            <div className="text-center">
              <p className="text-[9px] text-amber-200/35 mb-1">獲得ALT</p>
              <span className="text-3xl font-black" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
                +{totalAltEarned}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[8px] text-amber-200/35">最大連続正解</p>
              <span className="text-sm font-bold text-orange-400">🔥 {maxStreak}</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)' }}>
              <p className="text-[8px] text-amber-200/35">正答率</p>
              <span className="text-sm font-bold text-amber-100">{scorePercent}%</span>
            </div>
          </div>

          {/* Wrong cards list */}
          {wrongCards.length > 0 && (
            <div className="rounded-lg p-3 mb-4 text-left" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <p className="text-[10px] font-bold text-red-400 mb-2">📝 苦手カード</p>
              <div className="space-y-1.5">
                {wrongCards.map((a, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {a.card.imageUrl && (
                      <img src={a.card.imageUrl} alt="" className="w-7 h-7 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-amber-100 font-bold truncate">{a.card.name}</p>
                      <p className="text-[9px] text-amber-200/40 truncate">{a.quiz.question}</p>
                    </div>
                    <span className="text-[9px] text-green-400 flex-shrink-0">
                      正解: {a.quiz.choices[a.quiz.correctIndex]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => startQuiz(difficulty)}
              className="rpg-btn rpg-btn-blue flex-1 py-3"
            >
              🔄 もう一度
            </button>
            <button
              onClick={() => { setPhase('difficulty'); }}
              className="rpg-btn rpg-btn-gold flex-1 py-3"
            >
              📋 別の難易度
            </button>
          </div>
          <button
            onClick={() => navigate('/games/quest-board')}
            className="text-amber-200/35 text-xs hover:text-amber-200/60 transition-colors py-2 mt-2 block w-full"
          >
            ← ジャンル選択へ戻る
          </button>
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
  const diffInfo = DIFFICULTY_MAP[difficulty];

  return (
    <div className={`min-h-screen flex flex-col relative ${wrongShake ? 'qp-shake' : ''}`} style={{ background: 'linear-gradient(180deg, #0b1128 0%, #131b38 50%, #0e1430 100%)' }}>
      {correctFlash && <div className="qp-correct-flash" />}

      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between shrink-0"
        style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.98), rgba(16,22,48,0.95))',
          borderBottom: `2px solid ${genreInfo.color}30`,
        }}
      >
        <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setPhase('difficulty'); }} className="text-amber-200/40 text-sm">✕</button>
        <div className="flex items-center gap-2">
          <span className="text-lg">{genreInfo.emoji}</span>
          <span className="text-sm font-bold" style={{ color: genreInfo.color }}>{genreInfo.label}</span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-amber-200/40">ALT </span>
          <span className="text-sm font-bold" style={{ color: '#ffd700' }}>{altBalance !== null ? altBalance.toLocaleString() : '---'}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 flex items-center gap-3 shrink-0" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <span className="text-sm font-bold text-amber-100">Q{currentIndex + 1}/10</span>
        <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${((currentIndex + 1) / 10) * 100}%`, background: `linear-gradient(90deg, ${genreInfo.color}, ${genreInfo.color}88)` }} />
        </div>
        <div className="flex items-center gap-2">
          {consecutiveCorrect >= 2 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,170,0,0.2)', color: '#ffaa00', border: '1px solid rgba(255,170,0,0.3)' }}>
              🔥{consecutiveCorrect}
            </span>
          )}
          <span className={`text-sm font-bold ${timer <= 5 ? 'text-red-400 qp-timer-pulse' : timer <= 10 ? 'text-orange-400' : 'text-amber-100'}`}>
            ⏱️{timer}s
          </span>
        </div>
      </div>

      {/* Timer Bar */}
      <div className="h-1 shrink-0" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <div
          className="h-full transition-all duration-1000"
          style={{
            width: `${(timer / 30) * 100}%`,
            background: timer <= 5 ? '#ef4444' : timer <= 10 ? '#f97316' : genreInfo.color,
          }}
        />
      </div>

      {/* Card & Quiz Area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4 overflow-auto py-4">
        {/* Card display */}
        <div className="flex items-center gap-3 w-full max-w-sm">
          <div
            className={`w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 relative ${showResult && selectedAnswer === q.quiz.correctIndex ? 'qp-card-glow' : ''}`}
            style={{
              border: `2px solid ${CATEGORY_INFO[q.card.category].color}55`,
              boxShadow: showResult && selectedAnswer === q.quiz.correctIndex
                ? `0 0 20px ${CATEGORY_INFO[q.card.category].color}60`
                : `0 4px 12px rgba(0,0,0,0.4)`,
            }}
          >
            {q.card.imageUrl ? (
              <img src={q.card.imageUrl} alt={q.card.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl" style={{ background: `${CATEGORY_INFO[q.card.category].color}20` }}>
                {CATEGORY_INFO[q.card.category].emoji}
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5" style={{ background: 'rgba(0,0,0,0.7)' }}>
              <p className="text-[7px] text-amber-100 font-bold truncate text-center">{q.card.name}</p>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: RARITY_INFO[q.card.rarity].bgColor, color: RARITY_INFO[q.card.rarity].color }}>
                {q.card.rarity}
              </span>
              <span className="text-[9px] font-bold" style={{ color: CATEGORY_INFO[q.card.category].color }}>
                {CATEGORY_INFO[q.card.category].label}
              </span>
            </div>
            <p className="text-[10px] text-amber-200/40 truncate">{q.card.description}</p>
          </div>
        </div>

        {/* Question */}
        <div
          className="w-full max-w-sm rounded-xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: `1.5px solid ${genreInfo.color}30`,
          }}
        >
          <p className="text-amber-100 text-sm font-bold mb-4 leading-relaxed">{q.quiz.question}</p>

          <div className="space-y-2.5">
            {q.quiz.choices.map((choice, i) => {
              let btnBg = 'rgba(255,255,255,0.05)';
              let btnBorder = 'rgba(255,255,255,0.1)';
              let textColor = 'rgba(255,255,255,0.8)';

              if (showResult) {
                if (i === q.quiz.correctIndex) {
                  btnBg = 'rgba(34,197,94,0.25)';
                  btnBorder = 'rgba(34,197,94,0.6)';
                  textColor = '#22c55e';
                } else if (i === selectedAnswer && i !== q.quiz.correctIndex) {
                  btnBg = 'rgba(239,68,68,0.25)';
                  btnBorder = 'rgba(239,68,68,0.6)';
                  textColor = '#ef4444';
                }
              }

              return (
                <button
                  key={i}
                  onClick={() => handleAnswer(i)}
                  disabled={selectedAnswer !== null}
                  className="w-full text-left px-4 py-3 rounded-lg text-sm transition-all active:scale-[0.98]"
                  style={{ background: btnBg, border: `1.5px solid ${btnBorder}`, color: textColor }}
                >
                  <span className="text-amber-200/30 mr-2 font-bold">{['A', 'B', 'C', 'D'][i]}</span>
                  {choice}
                  {showResult && i === q.quiz.correctIndex && <span className="ml-2">✅</span>}
                  {showResult && i === selectedAnswer && i !== q.quiz.correctIndex && <span className="ml-2">❌</span>}
                </button>
              );
            })}
          </div>

          {/* Answer feedback */}
          {showResult && (
            <div className="mt-3 text-center">
              {selectedAnswer === q.quiz.correctIndex ? (
                <div>
                  <span className="text-sm font-bold text-green-400">🎉 正解！</span>
                  <span className="text-xs ml-2 font-bold" style={{ color: '#ffd700' }}>+{diffInfo.altPerCorrect + (consecutiveCorrect >= 2 ? 5 : 0)} ALT</span>
                </div>
              ) : (
                <span className="text-sm font-bold text-red-400">
                  {selectedAnswer === -1 ? '⏰ 時間切れ...' : '😢 不正解...'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Score summary during play */}
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
        .qp-card-glow { animation: qpCardGlow 1s ease-in-out infinite; }
        @keyframes qpCardGlow { 0%, 100% { box-shadow: 0 0 8px rgba(34,197,94,0.3); } 50% { box-shadow: 0 0 24px rgba(34,197,94,0.6), 0 0 48px rgba(34,197,94,0.3); } }
      `}</style>
    </div>
  );
}
