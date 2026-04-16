/**
 * KeisanBattlePage — 🔢 計算バトル
 *
 * 60秒制限で計算問題を連続で解くスコアアタック。
 * 正解数に応じてレベルが上がり問題が難化。5/10/15コンボでALT倍率UP。
 *
 * ルール:
 *   - 答えは常に正の整数（割り算は割り切れるもの、引き算は0以上）
 *   - 同じ問題が連続しないようシャッフル
 *   - 2問連続不正解でレベルダウン（Lv1 未満にはならない）
 *   - テンキーUI（スマホのソフトキーボードは使わない）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playTap, playDefeat, playBattleStart } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';

type Phase = 'start' | 'playing' | 'result';

interface Problem {
  text: string;
  answer: number;
}

const GAME_SECONDS = 60;
const GAME_TYPE = 'keisan_battle' as const;
const BEST_KEY_PREFIX = 'keisan_best_';

// ===== 問題生成 =====

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(level: number): Problem {
  // Lv1: 1桁+1桁の足し引き / Lv2: 2桁+1桁 or 1桁×1桁 /
  // Lv3: 2桁+2桁 or 2桁×1桁 / Lv4: 2桁×2桁 or 3桁÷1桁 /
  // Lv5: 3桁×2桁 or 複合演算
  switch (level) {
    case 1: {
      if (Math.random() < 0.5) {
        const a = rand(1, 9), b = rand(1, 9);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      const a = rand(2, 9), b = rand(1, a);
      return { text: `${a} - ${b}`, answer: a - b };
    }
    case 2: {
      const r = Math.random();
      if (r < 0.4) {
        const a = rand(10, 99), b = rand(1, 9);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      if (r < 0.7) {
        const a = rand(10, 99), b = rand(1, 9);
        if (a - b < 0) return { text: `${b} + ${a}`, answer: a + b };
        return { text: `${a} - ${b}`, answer: a - b };
      }
      const a = rand(2, 9), b = rand(2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case 3: {
      const r = Math.random();
      if (r < 0.4) {
        const a = rand(10, 99), b = rand(10, 99);
        return { text: `${a} + ${b}`, answer: a + b };
      }
      if (r < 0.7) {
        const a = rand(30, 99), b = rand(10, a);
        return { text: `${a} - ${b}`, answer: a - b };
      }
      const a = rand(11, 40), b = rand(2, 9);
      return { text: `${a} × ${b}`, answer: a * b };
    }
    case 4: {
      if (Math.random() < 0.5) {
        const a = rand(11, 40), b = rand(11, 30);
        return { text: `${a} × ${b}`, answer: a * b };
      }
      const b = rand(2, 9);
      const quot = rand(20, 120);
      const a = quot * b;
      return { text: `${a} ÷ ${b}`, answer: quot };
    }
    case 5:
    default: {
      if (Math.random() < 0.5) {
        const a = rand(100, 500), b = rand(11, 30);
        return { text: `${a} × ${b}`, answer: a * b };
      }
      // 複合: A×B+C
      const a = rand(10, 40), b = rand(2, 9), c = rand(1, 99);
      return { text: `${a} × ${b} + ${c}`, answer: a * b + c };
    }
  }
}

function generateUnique(level: number, prev: Problem | null): Problem {
  for (let i = 0; i < 10; i++) {
    const p = generateProblem(level);
    if (!prev || p.text !== prev.text) return p;
  }
  return generateProblem(level);
}

function levelFor(totalCorrect: number): number {
  if (totalCorrect >= 15) return 5;
  if (totalCorrect >= 10) return 4;
  if (totalCorrect >= 6) return 3;
  if (totalCorrect >= 3) return 2;
  return 1;
}

function comboMultiplier(combo: number): number {
  if (combo >= 15) return 5;
  if (combo >= 10) return 3;
  if (combo >= 5) return 2;
  return 1;
}

function getBestScore(childId: string): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY_PREFIX + childId) || '0', 10);
  } catch {
    return 0;
  }
}

function saveBestScore(childId: string, score: number): boolean {
  const prev = getBestScore(childId);
  if (score > prev) {
    try { localStorage.setItem(BEST_KEY_PREFIX + childId, String(score)); } catch { /* */ }
    return true;
  }
  return false;
}

// ===== Component =====

export default function KeisanBattlePage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [problem, setProblem] = useState<Problem | null>(null);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [wrongStreak, setWrongStreak] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(1);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showAnswer, setShowAnswer] = useState<number | null>(null);
  const [comboFlash, setComboFlash] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const bestScore = useMemo(() => getBestScore(userId), [userId, phase]);
  const remaining = useMemo(() => getGameDailyRemaining(userId, GAME_TYPE), [userId, phase]);

  // Running totals we accrue during play. Store on ref to avoid stale closures.
  const altAccumRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);

  const startGame = useCallback(() => {
    playBattleStart();
    altAccumRef.current = 0;
    savedRef.current = false;
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setWrongStreak(0);
    setCurrentLevel(1);
    setMaxLevel(1);
    setAltEarned(0);
    setLimited(false);
    setTimeLeft(GAME_SECONDS);
    setFeedback(null);
    setShowAnswer(null);
    setComboFlash(null);
    setIsNewBest(false);
    setInput('');
    setProblem(generateUnique(1, null));
    setPhase('playing');
  }, []);

  // Timer
  useEffect(() => {
    if (phase !== 'playing') return;
    timerRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          playDefeat();
          setPhase('result');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [phase]);

  // Persist & save result when entering 'result'
  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;
    const finalScore = score;
    const newBest = saveBestScore(userId, finalScore);
    setIsNewBest(newBest);

    const rawAlt = altAccumRef.current;
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      rawAltEarned: rawAlt,
      score: finalScore,
      maxLevel,
      maxCombo,
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, maxLevel, maxCombo, addTotalAlt]);

  const submitAnswer = useCallback(() => {
    if (phase !== 'playing' || !problem || feedback) return;
    const parsed = parseInt(input, 10);
    if (!Number.isFinite(parsed)) return;

    const isCorrect = parsed === problem.answer;
    if (isCorrect) {
      playSuccess();
      setFeedback('correct');
      const newCombo = combo + 1;
      const mult = comboMultiplier(newCombo);
      const earned = 1 * mult;
      altAccumRef.current += earned;
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setWrongStreak(0);
      const newScore = score + 1;
      setScore(newScore);
      const nextLv = levelFor(newScore);
      if (nextLv !== currentLevel) {
        setCurrentLevel(nextLv);
        setMaxLevel((m) => Math.max(m, nextLv));
      }
      if (newCombo === 5) setComboFlash('🔥 コンボ! ×2');
      else if (newCombo === 10) setComboFlash('⚡ スーパーコンボ! ×3');
      else if (newCombo === 15) setComboFlash('✨ 伝説コンボ! ×5');

      // Move on quickly for correct answers.
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setShowAnswer(null);
        setComboFlash(null);
        setInput('');
        setProblem((prev) => generateUnique(nextLv, prev));
      }, 250);
    } else {
      playError();
      setFeedback('wrong');
      setShowAnswer(problem.answer);
      const newWrong = wrongStreak + 1;
      setWrongStreak(newWrong);
      setCombo(0);
      if (newWrong >= 2) {
        setCurrentLevel((lv) => Math.max(1, lv - 1));
        setWrongStreak(0);
      }
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null);
        setShowAnswer(null);
        setInput('');
        setProblem((prev) => generateUnique(currentLevel, prev));
      }, 700);
    }
  }, [phase, problem, feedback, input, combo, score, currentLevel, wrongStreak]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const appendDigit = (d: string) => {
    if (feedback) return;
    playTap();
    setInput((s) => (s.length >= 6 ? s : s + d));
  };
  const backspace = () => {
    if (feedback) return;
    playTap();
    setInput((s) => s.slice(0, -1));
  };

  // ===== Render =====

  if (phase === 'start') {
    return (
      <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
        <div className="flex items-center gap-2 mb-4">
          <Link href="/alt-games">
            <button className="text-[12px] px-2 py-1 rounded"
              style={{ background: 'rgba(255,215,0,0.1)', color: 'var(--tqw-gold)', border: '1px solid rgba(255,215,0,0.25)' }}>
              ← もどる
            </button>
          </Link>
        </div>
        <div className="tqw-card-panel rounded-2xl p-6 text-center">
          <div className="text-6xl mb-3">🔢</div>
          <h1 className="text-2xl font-black mb-2 tqw-title-game">計算バトル</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--tqw-text-gray)' }}>
            60秒で何問解ける？<br />
            コンボでALT倍率UP！
          </p>
          <div className="grid grid-cols-2 gap-2 mb-5 text-[12px]">
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>ハイスコア</div>
              <div className="text-lg font-black" style={{ color: 'var(--tqw-gold)' }}>{bestScore} 問</div>
            </div>
            <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>今日の残り</div>
              <div className="text-lg font-black" style={{ color: remaining > 0 ? 'var(--tqw-gold)' : '#ef4444' }}>
                {remaining}/5 回
              </div>
            </div>
          </div>
          {remaining === 0 && (
            <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              今日のALT獲得は終了。練習プレイは可能！
            </div>
          )}
          <button
            onClick={startGame}
            className="tqw-btn-battle w-full py-4 rounded-xl text-lg font-black"
            style={{ minHeight: 56 }}
          >
            スタート！
          </button>
        </div>
        <div className="tqw-card-panel rounded-xl p-4 mt-4 text-[11px]" style={{ color: 'var(--tqw-text-gray)' }}>
          <div className="font-bold mb-1" style={{ color: 'var(--tqw-gold)' }}>ルール</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>正解するとレベルアップ（問題が難しく）</li>
            <li>2問連続不正解でレベルダウン</li>
            <li>5コンボで🔥×2、10コンボで⚡×3、15コンボで✨×5</li>
            <li>1日5回までALT獲得</li>
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'playing') {
    const timePct = (timeLeft / GAME_SECONDS) * 100;
    const timeColor = timeLeft > 30 ? '#22c55e' : timeLeft > 10 ? '#eab308' : '#ef4444';
    return (
      <div
        className="px-4 pt-4 pb-4 min-h-[calc(100vh-140px)] relative"
        style={{
          background: feedback === 'wrong'
            ? 'radial-gradient(ellipse at center, rgba(239,68,68,0.15), transparent 70%)'
            : combo >= 15
            ? 'radial-gradient(ellipse at center, rgba(255,215,0,0.18), transparent 70%)'
            : undefined,
          transition: 'background 0.2s',
        }}
      >
        {/* HUD */}
        <div className="flex items-center justify-between mb-3 text-[12px]">
          <div className="tqw-hud-pill">
            <span className="hud-label">Lv</span>
            <span className="hud-value">{currentLevel}</span>
          </div>
          <div className="tqw-hud-pill">
            <span className="hud-label">正解</span>
            <span className="hud-value">{score}</span>
          </div>
          <div className="tqw-hud-pill tqw-hud-pill--gold">
            <span className="hud-label">コンボ</span>
            <span className="hud-value">{combo}</span>
          </div>
        </div>

        {/* Time bar */}
        <div className="w-full h-3 rounded-full overflow-hidden mb-4"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${timePct}%`,
              background: `linear-gradient(90deg, ${timeColor}, ${timeColor}cc)`,
              boxShadow: `0 0 8px ${timeColor}88`,
            }}
          />
        </div>
        <div className="text-center text-[11px] mb-3" style={{ color: 'var(--tqw-text-gray)' }}>
          のこり {timeLeft} 秒
        </div>

        {/* Combo flash */}
        {comboFlash && (
          <div className="fixed left-1/2 -translate-x-1/2 top-1/3 z-40 pointer-events-none animate-pulse">
            <div className="text-3xl font-black px-5 py-3 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,100,0,0.25))',
                color: 'var(--tqw-gold)',
                border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 0 30px rgba(255,215,0,0.6)',
                textShadow: '0 0 10px rgba(255,215,0,0.8)',
              }}
            >
              {comboFlash}
            </div>
          </div>
        )}

        {/* Problem */}
        <div className="tqw-card-panel rounded-2xl p-6 mb-4 text-center"
          style={{
            border: feedback === 'correct' ? '2px solid #22c55e' :
                    feedback === 'wrong' ? '2px solid #ef4444' :
                    '1px solid rgba(197,160,63,0.3)',
            transition: 'border-color 0.2s',
          }}
        >
          <div className="text-4xl font-black mb-3" style={{ color: 'var(--tqw-gold)', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            {problem?.text} = ?
          </div>
          <div className="h-14 rounded-xl flex items-center justify-center text-3xl font-black"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,215,0,0.3)',
              color: feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#ef4444' : '#fff',
              minHeight: 56,
            }}
          >
            {showAnswer !== null ? showAnswer : (input || '　')}
          </div>
          {showAnswer !== null && (
            <div className="text-[10px] mt-1" style={{ color: '#ef4444' }}>せいかいは {showAnswer}</div>
          )}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2">
          {['1','2','3','4','5','6','7','8','9'].map((d) => (
            <button
              key={d}
              onClick={() => appendDigit(d)}
              className="py-4 rounded-xl text-2xl font-black active:scale-95 transition-all"
              style={{
                background: 'linear-gradient(180deg, rgba(30,40,70,0.9), rgba(15,20,40,0.95))',
                color: '#fff',
                border: '1.5px solid rgba(255,215,0,0.25)',
                minHeight: 56,
              }}
            >
              {d}
            </button>
          ))}
          <button
            onClick={backspace}
            className="py-4 rounded-xl text-lg font-black active:scale-95 transition-all"
            style={{
              background: 'rgba(239,68,68,0.15)',
              color: '#f87171',
              border: '1.5px solid rgba(239,68,68,0.4)',
              minHeight: 56,
            }}
          >
            ←
          </button>
          <button
            onClick={() => appendDigit('0')}
            className="py-4 rounded-xl text-2xl font-black active:scale-95 transition-all"
            style={{
              background: 'linear-gradient(180deg, rgba(30,40,70,0.9), rgba(15,20,40,0.95))',
              color: '#fff',
              border: '1.5px solid rgba(255,215,0,0.25)',
              minHeight: 56,
            }}
          >
            0
          </button>
          <button
            onClick={submitAnswer}
            disabled={!input || !!feedback}
            className="py-4 rounded-xl text-lg font-black active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: 'linear-gradient(180deg, var(--tqw-gold-light) 0%, var(--tqw-gold) 50%, var(--tqw-gold-dark) 100%)',
              color: '#1a1000',
              border: '2px solid var(--tqw-gold)',
              minHeight: 56,
            }}
          >
            決定
          </button>
        </div>
      </div>
    );
  }

  // Result
  return (
    <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
      <div className="tqw-card-panel rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">🏁</div>
        <h1 className="text-xl font-black mb-4 tqw-title-game">リザルト</h1>

        <div className="grid grid-cols-2 gap-2 mb-4 text-[12px]">
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>正解</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{score}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>最大Lv</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{maxLevel}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>最大コンボ</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{maxCombo}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>獲得ALT</div>
            <div className="text-2xl font-black" style={{ color: altEarned > 0 ? 'var(--tqw-gold)' : '#888' }}>
              +{altEarned}
            </div>
          </div>
        </div>

        {isNewBest && (
          <div className="text-sm font-black mb-3" style={{ color: '#ffe066', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
            ✨ ハイスコア更新！
          </div>
        )}
        {limited && (
          <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            今日のALT獲得上限に達しているよ（練習プレイ）
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={startGame}
            className="tqw-btn-battle flex-1 py-3 rounded-xl text-base font-black"
            style={{ minHeight: 48 }}
          >
            もう一回
          </button>
          <Link href="/alt-games" className="flex-1">
            <button
              className="tqw-btn-quest w-full py-3 rounded-xl text-base font-black"
              style={{ minHeight: 48 }}
            >
              もどる
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
