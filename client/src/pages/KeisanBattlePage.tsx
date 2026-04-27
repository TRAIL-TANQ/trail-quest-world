/**
 * KeisanBattlePage — 🔢 計算バトル
 *
 * 30秒（ゲキむず★4のみ45秒）制限で計算問題を連続で解くスコアアタック。
 * 5段階の難易度（★1〜★5）により、制限時間・開始Lv・最大Lv・ALT単価・
 * コンボ倍率が変化する。
 *
 * 共通ルール:
 *   - 答えは常に正の整数（割り算は割り切れるもの、引き算は 0 以上）
 *   - 同じ問題が連続しないようシャッフル
 *   - 2問連続不正解でレベルダウン（下限は難易度の startLv）
 *   - テンキーUI（スマホのソフトキーボードは使わない）
 *
 * 制限：
 *   - 日次5回までALT獲得（難易度をまたいでゲーム単位で共通）
 *   - ハイスコアは難易度別に localStorage に保存
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playTap, playDefeat, playBattleStart } from '@/lib/sfx';
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
  icon: string;
  timeSeconds: number;
  startLv: number;
  maxLv: number;
  altPerCorrect: number;
  comboTiers: ComboTier[]; // 昇順。最後にマッチした段が適用倍率
}

const GAME_TYPE = 'keisan_battle' as const;
const BEST_KEY_PREFIX = 'keisan_best_';

const DIFF_CONFIGS: Record<DiffId, DiffConfig> = {
  1: { id: 1, label: 'かんたん',   icon: '🟢', timeSeconds: 30, startLv: 1, maxLv: 1, altPerCorrect: 1, comboTiers: [] },
  2: { id: 2, label: 'ふつう',     icon: '🟡', timeSeconds: 30, startLv: 1, maxLv: 2, altPerCorrect: 1, comboTiers: [
    { threshold: 5,  multiplier: 2, label: '🔥 コンボ ×2' },
  ] },
  3: { id: 3, label: 'むずかしい', icon: '🟠', timeSeconds: 30, startLv: 2, maxLv: 3, altPerCorrect: 2, comboTiers: [
    { threshold: 5,  multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ] },
  4: { id: 4, label: 'ゲキむず',   icon: '🔴', timeSeconds: 45, startLv: 3, maxLv: 4, altPerCorrect: 3, comboTiers: [
    { threshold: 5,  multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
  ] },
  5: { id: 5, label: '鬼',         icon: '👹', timeSeconds: 30, startLv: 4, maxLv: 5, altPerCorrect: 5, comboTiers: [
    { threshold: 5,  multiplier: 2, label: '🔥 コンボ ×2' },
    { threshold: 10, multiplier: 3, label: '⚡ スーパーコンボ ×3' },
    { threshold: 15, multiplier: 5, label: '✨ 伝説コンボ ×5' },
  ] },
};

const DIFF_ORDER: DiffId[] = [1, 2, 3, 4, 5];

// ===== 問題生成 =====

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateProblem(level: number): Problem {
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

function levelFor(totalCorrect: number, cfg: DiffConfig): number {
  const offset = Math.floor(totalCorrect / 5);
  return Math.min(cfg.maxLv, cfg.startLv + offset);
}

function comboMult(combo: number, tiers: ComboTier[]): number {
  let mult = 1;
  for (const t of tiers) {
    if (combo >= t.threshold) mult = t.multiplier;
  }
  return mult;
}

function tierFor(combo: number, tiers: ComboTier[]): ComboTier | null {
  // ちょうどその値に到達したときの演出用（降順で最初にマッチする段）
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (combo === tiers[i].threshold) return tiers[i];
  }
  return null;
}

function bestKey(childId: string, diff: DiffId): string {
  return `${BEST_KEY_PREFIX}${childId}_d${diff}`;
}

function getBestScore(childId: string, diff: DiffId): number {
  try {
    return parseInt(localStorage.getItem(bestKey(childId, diff)) || '0', 10);
  } catch {
    return 0;
  }
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

export default function KeisanBattlePage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [selectedDiff, setSelectedDiff] = useState<DiffId>(1);
  const [activeDiff, setActiveDiff] = useState<DiffId>(1); // 実プレイ中の難易度
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
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setWrongStreak(0);
    setCurrentLevel(cfg.startLv);
    setMaxLevel(cfg.startLv);
    setAltEarned(0);
    setLimited(false);
    setTimeLeft(cfg.timeSeconds);
    setFeedback(null);
    setShowAnswer(null);
    setComboFlash(null);
    setIsNewBest(false);
    setInput('');
    setProblem(generateUnique(cfg.startLv, null));
    setPhase('playing');
  }, [selectedDiff]);

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

  // Save result
  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;
    const finalScore = score;
    const newBest = saveBestScore(userId, activeDiff, finalScore);
    setIsNewBest(newBest);

    const rawAlt = altAccumRef.current;
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      difficulty: activeDiff,
      rawAltEarned: rawAlt,
      score: finalScore,
      maxLevel,
      maxCombo,
      durationSeconds: gameTimer.getElapsedSeconds(),
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, activeDiff, maxLevel, maxCombo, addTotalAlt]);

  // Phase MG-1: 自動進行 (β方式) — 入力欄が正解と一致した瞬間に呼ばれる success 経路。
  // 不正解判定は行わない (失敗体験を作らない設計、kk 教育方針)。
  const triggerCorrect = useCallback(() => {
    if (phase !== 'playing' || !problem || feedback) return;
    const cfg = activeCfg;
    playSuccess();
    setFeedback('correct');
    const newCombo = combo + 1;
    const mult = comboMult(newCombo, cfg.comboTiers);
    const earned = cfg.altPerCorrect * mult;
    altAccumRef.current += earned;
    setCombo(newCombo);
    setMaxCombo((m) => Math.max(m, newCombo));
    setWrongStreak(0);
    const newScore = score + 1;
    setScore(newScore);
    const nextLv = levelFor(newScore, cfg);
    if (nextLv !== currentLevel) {
      setCurrentLevel(nextLv);
      setMaxLevel((m) => Math.max(m, nextLv));
    }
    const tier = tierFor(newCombo, cfg.comboTiers);
    if (tier) setComboFlash(tier.label);

    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      setShowAnswer(null);
      setComboFlash(null);
      setInput('');
      setProblem((prev) => generateUnique(nextLv, prev));
    }, 250);
  }, [phase, problem, feedback, combo, score, currentLevel, activeCfg]);

  // Phase MG-1: 「分からない」ボタン。コンボリセットだけして次の問題へ。
  // ALT/スコア/バツ/減点/レベルダウンなど、ペナルティは一切無し。
  const handleGiveUp = useCallback(() => {
    if (phase !== 'playing' || !problem || feedback) return;
    playTap();
    setCombo(0);
    setInput('');
    setShowAnswer(null);
    setProblem((prev) => generateUnique(currentLevel, prev));
  }, [phase, problem, feedback, currentLevel]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // Phase MG-1: 入力した瞬間に正解判定 (β方式: 「決定」ボタン撤廃)。
  // 桁数が正解と同じになったらそれ以上の入力は受け付けない。
  // 不一致の入力は何も起こさず保持 (子供は「←」で消して打ち直す)。
  const appendDigit = (d: string) => {
    if (phase !== 'playing' || !problem || feedback) return;
    const expected = String(problem.answer);
    if (input.length >= expected.length) return; // 桁数オーバーは無視
    playTap();
    const newInput = input + d;
    setInput(newInput);
    if (newInput === expected) {
      triggerCorrect();
    }
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
            コンボでALT倍率UP！<br />難易度を えらんでね
          </p>

          {/* Difficulty selector */}
          <div className="grid grid-cols-5 gap-1 mb-4">
            {DIFF_ORDER.map((d) => {
              const cfg = DIFF_CONFIGS[d];
              const selected = d === selectedDiff;
              return (
                <button
                  key={d}
                  onClick={() => { playTap(); setSelectedDiff(d); }}
                  className={`rounded-xl py-2 px-1 transition-all active:scale-95 ${selected ? 'tqw-btn-gold' : ''}`}
                  style={selected ? { minHeight: 56 } : {
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

          {/* Selected difficulty meta */}
          <div className="grid grid-cols-3 gap-1.5 mb-4 text-[10px]">
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>時間</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.timeSeconds}秒</div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>Lv範囲</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>
                {selectedCfg.startLv === selectedCfg.maxLv ? `Lv${selectedCfg.startLv}` : `${selectedCfg.startLv}→${selectedCfg.maxLv}`}
              </div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>1問</div>
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
            <li>5問正解ごとにレベルアップ（難易度の最大Lvまで）</li>
            <li>2問連続不正解でレベルダウン</li>
            {selectedCfg.comboTiers.length > 0 ? (
              <li>
                コンボでALT倍率UP：
                {selectedCfg.comboTiers.map((t) => `${t.threshold}で×${t.multiplier}`).join(' / ')}
              </li>
            ) : (
              <li>★1はコンボ倍率なし（ゆっくり挑戦）</li>
            )}
            <li>1日5回までALT獲得（難易度共通）</li>
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'playing') {
    const timePct = (timeLeft / activeCfg.timeSeconds) * 100;
    const timeColor = timeLeft > activeCfg.timeSeconds * 0.5 ? '#22c55e' : timeLeft > activeCfg.timeSeconds * 0.2 ? '#eab308' : '#ef4444';
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
        <div className="flex items-center justify-between mb-3 text-[12px]">
          <div className="tqw-hud-pill">
            <span className="hud-label">{'★'.repeat(activeDiff)}</span>
            <span className="hud-value">Lv{currentLevel}</span>
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
          {/* Phase MG-1: 「決定」撤廃 → 「分からない」(コンボリセットのみ、減点なし) */}
          <button
            onClick={handleGiveUp}
            disabled={!!feedback}
            className="py-4 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-40"
            style={{
              background: 'rgba(100,116,139,0.35)',
              color: '#cbd5e1',
              border: '1.5px solid rgba(148,163,184,0.5)',
              minHeight: 56,
            }}
          >
            分からない
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
            ✨ {'★'.repeat(activeDiff)} のハイスコア更新！
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
