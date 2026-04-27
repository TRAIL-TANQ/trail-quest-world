/**
 * ShousuuBattlePage — 🟢 小数バトル
 *
 * 小数の計算問題を連続で解くスコアアタック。5段階の難易度。
 *
 * 回答ルール:
 *   - 入力は小数点キー「.」付きテンキー
 *   - 「3」と「3.0」はどちらも正解扱い（整数/小数どちらでもOK）
 *   - 比較は誤差 0.005 以内で一致とみなす
 *
 * 問題生成:
 *   - 内部的には int スケーリング（×100）で計算し浮動小数誤差を避ける
 *   - 割り算は常に割り切れる問題
 *   - 答えは小数第2位まで、引き算結果は 0 以上
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playTap, playDefeat, playBattleStart } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';
import { useGameTimer } from '@/hooks/useGameTimer';

type Phase = 'start' | 'playing' | 'result';
type DiffId = 1 | 2 | 3 | 4 | 5;

interface Problem {
  text: string;
  answer: number;
}

interface ComboTier {
  threshold: number;
  multiplier: number;
  label: string;
}

interface DiffConfig {
  id: DiffId;
  label: string;
  timeSeconds: number;
  altPerCorrect: number;
  comboTiers: ComboTier[];
}

const GAME_TYPE = 'shousuu_battle' as const;
const BEST_KEY_PREFIX = 'shousuu_best_';
const TOLERANCE = 0.005; // 誤差許容

const DIFF_CONFIGS: Record<DiffId, DiffConfig> = {
  1: { id: 1, label: 'かんたん',   timeSeconds: 30, altPerCorrect: 1, comboTiers: [] },
  2: { id: 2, label: 'ふつう',     timeSeconds: 30, altPerCorrect: 1, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
  ] },
  3: { id: 3, label: 'むずかしい', timeSeconds: 30, altPerCorrect: 2, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ] },
  4: { id: 4, label: 'ゲキむず',   timeSeconds: 45, altPerCorrect: 3, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ] },
  5: { id: 5, label: '鬼',         timeSeconds: 30, altPerCorrect: 5, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
    { threshold: 15, multiplier: 5, label: '✨ 伝説コンボ ×5' },
  ] },
};

const DIFF_ORDER: DiffId[] = [1, 2, 3, 4, 5];

// ===== Helpers =====

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDec(x: number): string {
  // 浮動誤差除去のため 4桁で丸めてから文字列化
  const y = Math.round(x * 10000) / 10000;
  const s = y.toString();
  return s;
}

// 表示用: 指定桁数の小数にする（例: 0.3 + 0.5 の表示を "0.3" に揃えるとき）
function formatDecFixed(x: number, digits: number): string {
  const y = Math.round(x * Math.pow(10, digits)) / Math.pow(10, digits);
  return y.toFixed(digits).replace(/\.?0+$/, '') || '0';
}

// ===== Problem generation =====

function genLv1(): Problem {
  // 小数第1位の足し引き、繰り上がり/繰り下がりなし
  if (Math.random() < 0.5) {
    // a + b where a+b < 1.0 (to keep it simple) OR stays within same integer part
    const a10 = rand(1, 8);
    const b10 = rand(1, 9 - a10);
    if (b10 <= 0) return { text: '0.3 + 0.5', answer: 0.8 };
    return { text: `${formatDecFixed(a10 / 10, 1)} + ${formatDecFixed(b10 / 10, 1)}`, answer: (a10 + b10) / 10 };
  }
  // a - b >= 0
  const a10 = rand(2, 19);
  const b10 = rand(1, a10);
  // prefer no-borrow: keep same integer part
  return { text: `${formatDecFixed(a10 / 10, 1)} - ${formatDecFixed(b10 / 10, 1)}`, answer: (a10 - b10) / 10 };
}

function genLv2(): Problem {
  // 小数第1位、繰り上がり/繰り下がりを含む
  if (Math.random() < 0.5) {
    const a10 = rand(3, 35);
    const b10 = rand(3, 35);
    return { text: `${formatDecFixed(a10 / 10, 1)} + ${formatDecFixed(b10 / 10, 1)}`, answer: (a10 + b10) / 10 };
  }
  const a10 = rand(10, 50);
  const b10 = rand(1, a10 - 1);
  return { text: `${formatDecFixed(a10 / 10, 1)} - ${formatDecFixed(b10 / 10, 1)}`, answer: (a10 - b10) / 10 };
}

function genLv3(): Problem {
  // 小数第2位まで / 小数×整数
  const r = Math.random();
  if (r < 0.5) {
    // 2桁小数の+/-
    const a100 = rand(25, 300);
    const b100 = rand(25, 300);
    if (Math.random() < 0.5) {
      return { text: `${formatDec(a100 / 100)} + ${formatDec(b100 / 100)}`, answer: (a100 + b100) / 100 };
    }
    if (a100 <= b100) return genLv3();
    return { text: `${formatDec(a100 / 100)} - ${formatDec(b100 / 100)}`, answer: (a100 - b100) / 100 };
  }
  // 小数 × 整数（答えは小数1〜2桁）
  const a10 = rand(2, 30);
  const b = rand(2, 9);
  return { text: `${formatDec(a10 / 10)} × ${b}`, answer: (a10 * b) / 10 };
}

function genLv4(): Problem {
  // 小数×小数 or 小数÷整数
  if (Math.random() < 0.5) {
    // 小数1桁 × 小数1桁 → 小数2桁
    const a10 = rand(1, 9);
    const b10 = rand(1, 9);
    return { text: `${formatDec(a10 / 10)} × ${formatDec(b10 / 10)}`, answer: (a10 * b10) / 100 };
  }
  // 小数 ÷ 整数（割り切れるもの）
  const b = rand(2, 9);
  const quot10 = rand(1, 12); // 答え = quot/10 （0.1〜1.2）
  const a10 = quot10 * b;
  if (a10 > 99) return genLv4();
  return { text: `${formatDec(a10 / 10)} ÷ ${b}`, answer: quot10 / 10 };
}

function genLv5(): Problem {
  // 小数÷小数 or 四則混合
  if (Math.random() < 0.5) {
    // 小数 ÷ 小数（割り切れる、答えは整数や簡単な小数）
    // 構築: quot と b10（除数）を先に決め、a10 = quot * b10
    const b10 = rand(2, 9); // 除数の小数部のみ（0.2〜0.9）
    const quot = rand(2, 10); // 答え（整数）
    const a10 = quot * b10;
    if (a10 > 99) return genLv5();
    return { text: `${formatDec(a10 / 10)} ÷ ${formatDec(b10 / 10)}`, answer: quot };
  }
  // a × b + c （全て小数1桁）
  for (let i = 0; i < 20; i++) {
    const a10 = rand(2, 15);
    const b10 = rand(2, 15);
    const c10 = rand(1, 20);
    const prod100 = a10 * b10;    // (a/10)*(b/10) = prod/100
    const sum100 = prod100 + c10 * 10; // prod/100 + c/10 = (prod + c*10)/100
    // 答えを小数2桁以内に
    if (sum100 % 1 !== 0) continue;
    if (sum100 > 999) continue;
    return { text: `${formatDec(a10 / 10)} × ${formatDec(b10 / 10)} + ${formatDec(c10 / 10)}`, answer: sum100 / 100 };
  }
  return { text: `0.5 × 1.2 + 0.3`, answer: 0.9 };
}

function generate(diff: DiffId): Problem {
  switch (diff) {
    case 1: return genLv1();
    case 2: return genLv2();
    case 3: return genLv3();
    case 4: return genLv4();
    case 5: return genLv5();
  }
}

function generateUnique(diff: DiffId, prev: Problem | null): Problem {
  for (let i = 0; i < 10; i++) {
    const p = generate(diff);
    if (!prev || p.text !== prev.text) return p;
  }
  return generate(diff);
}

// ===== combo / best =====

function comboMult(combo: number, tiers: ComboTier[]): number {
  let mult = 1;
  for (const t of tiers) if (combo >= t.threshold) mult = t.multiplier;
  return mult;
}
function tierFor(combo: number, tiers: ComboTier[]): ComboTier | null {
  for (let i = tiers.length - 1; i >= 0; i--) if (combo === tiers[i].threshold) return tiers[i];
  return null;
}

function bestKey(childId: string, diff: DiffId): string {
  return `${BEST_KEY_PREFIX}${childId}_d${diff}`;
}
function getBestScore(childId: string, diff: DiffId): number {
  try { return parseInt(localStorage.getItem(bestKey(childId, diff)) || '0', 10); } catch { return 0; }
}
function saveBestScore(childId: string, diff: DiffId, score: number): boolean {
  const prev = getBestScore(childId, diff);
  if (score > prev) {
    try { localStorage.setItem(bestKey(childId, diff), String(score)); } catch { /* */ }
    return true;
  }
  return false;
}

// ===== Component =====

export default function ShousuuBattlePage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [selectedDiff, setSelectedDiff] = useState<DiffId>(1);
  const [activeDiff, setActiveDiff] = useState<DiffId>(1);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [showAnswer, setShowAnswer] = useState<number | null>(null);
  const [comboFlash, setComboFlash] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const activeCfg = DIFF_CONFIGS[activeDiff];
  const selectedCfg = DIFF_CONFIGS[selectedDiff];

  const bestScore = useMemo(() => getBestScore(userId, selectedDiff), [userId, selectedDiff, phase]);
  const remaining = useMemo(() => getGameDailyRemaining(userId, GAME_TYPE), [userId, phase]);

  const altAccumRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const gameTimer = useGameTimer();

  const startGame = useCallback(() => {
    playBattleStart();
    const cfg = DIFF_CONFIGS[selectedDiff];
    altAccumRef.current = 0;
    savedRef.current = false;
    gameTimer.start();
    setActiveDiff(selectedDiff);
    setScore(0); setCombo(0); setMaxCombo(0);
    setAltEarned(0); setLimited(false);
    setTimeLeft(cfg.timeSeconds);
    setFeedback(null); setShowAnswer(null); setComboFlash(null);
    setIsNewBest(false);
    setInput('');
    setProblem(generateUnique(selectedDiff, null));
    setPhase('playing');
  }, [selectedDiff]);

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
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;
    const newBest = saveBestScore(userId, activeDiff, score);
    setIsNewBest(newBest);
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      difficulty: activeDiff,
      rawAltEarned: altAccumRef.current,
      score,
      maxCombo,
      durationSeconds: gameTimer.getElapsedSeconds(),
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, activeDiff, maxCombo, addTotalAlt]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const submit = useCallback(() => {
    if (phase !== 'playing' || !problem || feedback) return;
    const parsed = parseFloat(input);
    if (!Number.isFinite(parsed)) return;
    const cfg = activeCfg;
    const ok = Math.abs(parsed - problem.answer) < TOLERANCE;
    if (ok) {
      playSuccess();
      setFeedback('correct');
      const newCombo = combo + 1;
      const mult = comboMult(newCombo, cfg.comboTiers);
      altAccumRef.current += cfg.altPerCorrect * mult;
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setScore((s) => s + 1);
      const tier = tierFor(newCombo, cfg.comboTiers);
      if (tier) setComboFlash(tier.label);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null); setShowAnswer(null); setComboFlash(null);
        setInput('');
        setProblem((prev) => generateUnique(activeDiff, prev));
      }, 250);
    } else {
      playError();
      setFeedback('wrong');
      setShowAnswer(problem.answer);
      setCombo(0);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null); setShowAnswer(null);
        setInput('');
        setProblem((prev) => generateUnique(activeDiff, prev));
      }, 700);
    }
  }, [phase, problem, feedback, input, combo, activeCfg, activeDiff]);

  const appendDigit = (d: string) => {
    if (feedback) return;
    playTap();
    setInput((s) => {
      if (s.length >= 7) return s;
      return s + d;
    });
  };

  const appendDot = () => {
    if (feedback) return;
    playTap();
    setInput((s) => {
      if (s.includes('.')) return s;
      if (s === '') return '0.';
      if (s.length >= 6) return s;
      return s + '.';
    });
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
          <div className="text-6xl mb-3">🟢</div>
          <h1 className="text-2xl font-black mb-2 tqw-title-game">小数バトル</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--tqw-text-gray)' }}>
            小数の計算を正確に！<br />難易度を えらんでね
          </p>

          <div className="grid grid-cols-5 gap-1 mb-4">
            {DIFF_ORDER.map((d) => {
              const cfg = DIFF_CONFIGS[d];
              const sel = d === selectedDiff;
              return (
                <button
                  key={d}
                  onClick={() => { playTap(); setSelectedDiff(d); }}
                  className={`rounded-xl py-2 px-1 transition-all active:scale-95 ${sel ? 'tqw-btn-gold' : ''}`}
                  style={sel ? { minHeight: 56 } : {
                    minHeight: 56,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,215,0,0.15)',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  <div className="text-[11px] font-black leading-none mb-0.5">{'★'.repeat(d)}</div>
                  <div className="text-[9px] font-bold leading-tight">{cfg.label}</div>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mb-4 text-[10px]">
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>時間</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.timeSeconds}秒</div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>1問ALT</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>+{selectedCfg.altPerCorrect}</div>
            </div>
          </div>

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
            <li>「.」キーで小数点を入力</li>
            <li>整数の答えは「3」でも「3.0」でもOK</li>
            <li>答えは小数第2位まで</li>
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && problem) {
    const timePct = (timeLeft / activeCfg.timeSeconds) * 100;
    const timeColor = timeLeft > activeCfg.timeSeconds * 0.5 ? '#22c55e' : timeLeft > activeCfg.timeSeconds * 0.2 ? '#eab308' : '#ef4444';

    return (
      <div className="px-4 pt-4 pb-4 min-h-[calc(100vh-140px)] relative"
        style={{
          background: feedback === 'wrong'
            ? 'radial-gradient(ellipse at center, rgba(239,68,68,0.15), transparent 70%)'
            : combo >= 15
            ? 'radial-gradient(ellipse at center, rgba(255,215,0,0.18), transparent 70%)'
            : undefined,
          transition: 'background 0.2s',
        }}
      >
        <div className="flex items-center justify-between mb-3 text-[12px]">
          <div className="tqw-hud-pill">
            <span className="hud-label">{'★'.repeat(activeDiff)}</span>
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

        <div className="w-full h-3 rounded-full overflow-hidden mb-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${timePct}%`, background: `linear-gradient(90deg, ${timeColor}, ${timeColor}cc)`, boxShadow: `0 0 8px ${timeColor}88` }}
          />
        </div>
        <div className="text-center text-[11px] mb-3" style={{ color: 'var(--tqw-text-gray)' }}>のこり {timeLeft} 秒</div>

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

        <div className="tqw-card-panel rounded-2xl p-6 mb-4 text-center"
          style={{
            border: feedback === 'correct' ? '2px solid #22c55e' :
                    feedback === 'wrong' ? '2px solid #ef4444' :
                    '1px solid rgba(197,160,63,0.3)',
          }}
        >
          <div className="text-4xl font-black mb-3" style={{ color: 'var(--tqw-gold)', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            {problem.text} = ?
          </div>
          <div className="h-14 rounded-xl flex items-center justify-center text-3xl font-black"
            style={{
              background: 'rgba(0,0,0,0.5)',
              border: '2px solid rgba(255,215,0,0.3)',
              color: feedback === 'correct' ? '#22c55e' : feedback === 'wrong' ? '#ef4444' : '#fff',
              minHeight: 56,
            }}
          >
            {showAnswer !== null ? formatDec(showAnswer) : (input || '　')}
          </div>
          {showAnswer !== null && (
            <div className="text-[10px] mt-1" style={{ color: '#ef4444' }}>せいかいは {formatDec(showAnswer)}</div>
          )}
        </div>

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
            onClick={appendDot}
            className="py-4 rounded-xl text-2xl font-black active:scale-95 transition-all"
            style={{
              background: 'rgba(96,165,250,0.2)',
              color: '#60a5fa',
              border: '1.5px solid rgba(96,165,250,0.4)',
              minHeight: 56,
            }}
          >
            .
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
        </div>
        <button
          onClick={submit}
          disabled={!input || !!feedback}
          className="w-full mt-2 py-3 rounded-xl text-lg font-black active:scale-95 transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(180deg, var(--tqw-gold-light) 0%, var(--tqw-gold) 50%, var(--tqw-gold-dark) 100%)',
            color: '#1a1000',
            border: '2px solid var(--tqw-gold)',
            minHeight: 48,
          }}
        >
          決定
        </button>
      </div>
    );
  }

  // Result
  return (
    <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
      <div className="tqw-card-panel rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">🏁</div>
        <h1 className="text-xl font-black mb-1 tqw-title-game">リザルト</h1>
        <div className="text-[12px] mb-4" style={{ color: 'var(--tqw-gold)' }}>
          {'★'.repeat(activeDiff)} {activeCfg.label}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-[12px]">
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>正解</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{score}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>最大コンボ</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{maxCombo}</div>
          </div>
          <div className="rounded-lg p-3 col-span-2" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>獲得ALT</div>
            <div className="text-2xl font-black" style={{ color: altEarned > 0 ? 'var(--tqw-gold)' : '#888' }}>+{altEarned}</div>
          </div>
        </div>

        {isNewBest && (
          <div className="text-sm font-black mb-3" style={{ color: '#ffe066', textShadow: '0 0 8px rgba(255,215,0,0.5)' }}>
            ✨ {'★'.repeat(activeDiff)} のハイスコア更新！
          </div>
        )}
        {limited && (
          <div className="text-[11px] mb-3 rounded-lg p-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
            今日のALT獲得上限に達しているよ（練習プレイ）
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={startGame} className="tqw-btn-battle flex-1 py-3 rounded-xl text-base font-black" style={{ minHeight: 48 }}>
            もう一回
          </button>
          <Link href="/alt-games" className="flex-1">
            <button className="tqw-btn-quest w-full py-3 rounded-xl text-base font-black" style={{ minHeight: 48 }}>
              もどる
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
