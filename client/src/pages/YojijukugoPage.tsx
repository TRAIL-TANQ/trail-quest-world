/**
 * YojijukugoPage — 🎌 四字熟語クイズ
 *
 * 四字熟語の □ に入る漢字を4択で答える。正解後に意味を短く表示。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playTap, playDefeat, playBattleStart } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';
import { useGameTimer } from '@/hooks/useGameTimer';
import { getYojijukugoByDifficulty, type YojijukugoQuestion } from '@/data/yojijukugoData';

type Phase = 'start' | 'playing' | 'result';
type DiffId = 1 | 2 | 3 | 4 | 5;

interface ComboTier { threshold: number; multiplier: number; label: string; }
interface DiffConfig {
  id: DiffId;
  label: string;
  timeSeconds: number;
  altPerCorrect: number;
  comboTiers: ComboTier[];
}

const GAME_TYPE = 'yojijukugo' as const;
const BEST_KEY_PREFIX = 'yojijukugo_best_';

const DIFF_CONFIGS: Record<DiffId, DiffConfig> = {
  1: { id: 1, label: 'かんたん',   timeSeconds: 60, altPerCorrect: 1, comboTiers: [] },
  2: { id: 2, label: 'ふつう',     timeSeconds: 60, altPerCorrect: 1, comboTiers: [
    { threshold: 5, multiplier: 2, label: '🔥 コンボ ×2' },
  ] },
  3: { id: 3, label: 'むずかしい', timeSeconds: 60, altPerCorrect: 2, comboTiers: [
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

interface Problem {
  q: YojijukugoQuestion;
  choices: string[];
  correctIndex: number;
}

function shuffle<T>(a: T[]): T[] {
  const o = a.slice();
  for (let i = o.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [o[i], o[j]] = [o[j], o[i]];
  }
  return o;
}

function makeProblem(q: YojijukugoQuestion): Problem {
  const choices = shuffle([q.answer, ...q.distractors]);
  return { q, choices, correctIndex: choices.indexOf(q.answer) };
}

function pickNext(pool: YojijukugoQuestion[], prev: YojijukugoQuestion | null): Problem {
  if (pool.length === 0) {
    return makeProblem({ full: '一石二鳥', display: '一□二鳥', answer: '石', distractors: ['木', '山', '水'], meaning: '—', difficulty: 1 });
  }
  let q = pool[Math.floor(Math.random() * pool.length)];
  if (prev && pool.length > 1) {
    for (let i = 0; i < 10 && q.full === prev.full; i++) {
      q = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return makeProblem(q);
}

function comboMult(combo: number, tiers: ComboTier[]): number {
  let m = 1;
  for (const t of tiers) if (combo >= t.threshold) m = t.multiplier;
  return m;
}
function tierFor(combo: number, tiers: ComboTier[]): ComboTier | null {
  for (let i = tiers.length - 1; i >= 0; i--) if (combo === tiers[i].threshold) return tiers[i];
  return null;
}

function bestKey(childId: string, diff: DiffId): string {
  return `${BEST_KEY_PREFIX}${childId}_d${diff}`;
}
function getBest(childId: string, diff: DiffId): number {
  try { return parseInt(localStorage.getItem(bestKey(childId, diff)) || '0', 10); } catch { return 0; }
}
function saveBest(childId: string, diff: DiffId, score: number): boolean {
  const prev = getBest(childId, diff);
  if (score > prev) { try { localStorage.setItem(bestKey(childId, diff), String(score)); } catch { /* */ } return true; }
  return false;
}

export default function YojijukugoPage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [selectedDiff, setSelectedDiff] = useState<DiffId>(1);
  const [activeDiff, setActiveDiff] = useState<DiffId>(1);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [comboFlash, setComboFlash] = useState<string | null>(null);
  const [showMeaning, setShowMeaning] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  const activeCfg = DIFF_CONFIGS[activeDiff];
  const selectedCfg = DIFF_CONFIGS[selectedDiff];
  const pool = useMemo(() => getYojijukugoByDifficulty(activeDiff), [activeDiff]);

  const bestScore = useMemo(() => getBest(userId, selectedDiff), [userId, selectedDiff, phase]);
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
    setFeedback(null); setPicked(null); setComboFlash(null); setShowMeaning(null);
    setIsNewBest(false);
    const nextPool = getYojijukugoByDifficulty(selectedDiff);
    setProblem(pickNext(nextPool, null));
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
    const newBest = saveBest(userId, activeDiff, score);
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

  const handleChoice = useCallback((idx: number) => {
    if (phase !== 'playing' || !problem || feedback) return;
    const cfg = activeCfg;
    const correct = idx === problem.correctIndex;
    setPicked(idx);
    if (correct) {
      playSuccess();
      setFeedback('correct');
      setShowMeaning(problem.q.meaning);
      const newCombo = combo + 1;
      const mult = comboMult(newCombo, cfg.comboTiers);
      altAccumRef.current += cfg.altPerCorrect * mult;
      setCombo(newCombo);
      setMaxCombo((m) => Math.max(m, newCombo));
      setScore((s) => s + 1);
      const tier = tierFor(newCombo, cfg.comboTiers);
      if (tier) setComboFlash(tier.label);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null); setPicked(null); setComboFlash(null); setShowMeaning(null);
        setProblem((prev) => pickNext(pool, prev?.q ?? null));
      }, 1000);
    } else {
      playError();
      setFeedback('wrong');
      setShowMeaning(problem.q.meaning);
      setCombo(0);
      feedbackTimerRef.current = window.setTimeout(() => {
        setFeedback(null); setPicked(null); setShowMeaning(null);
        setProblem((prev) => pickNext(pool, prev?.q ?? null));
      }, 1200);
    }
  }, [phase, problem, feedback, combo, activeCfg, pool]);

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
          <div className="text-6xl mb-3">🎌</div>
          <h1 className="text-2xl font-black mb-2 tqw-title-game">四字熟語クイズ</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--tqw-text-gray)' }}>
            □ に入る漢字を4つから選ぼう！<br />難易度を えらんでね
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
                    minHeight: 56, background: 'rgba(255,255,255,0.04)',
                    border: '1.5px solid rgba(255,215,0,0.15)', color: 'rgba(255,255,255,0.45)',
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
      </div>
    );
  }

  if (phase === 'playing' && problem) {
    const timePct = (timeLeft / activeCfg.timeSeconds) * 100;
    const timeColor = timeLeft > activeCfg.timeSeconds * 0.5 ? '#22c55e' : timeLeft > activeCfg.timeSeconds * 0.2 ? '#eab308' : '#ef4444';
    return (
      <div className="px-4 pt-4 pb-4 min-h-[calc(100vh-140px)]"
        style={{
          background: feedback === 'wrong'
            ? 'radial-gradient(ellipse at center, rgba(239,68,68,0.15), transparent 70%)'
            : combo >= 15 ? 'radial-gradient(ellipse at center, rgba(255,215,0,0.18), transparent 70%)' : undefined,
          transition: 'background 0.2s',
        }}
      >
        <div className="flex items-center justify-between mb-3 text-[12px]">
          <div className="tqw-hud-pill"><span className="hud-label">{'★'.repeat(activeDiff)}</span></div>
          <div className="tqw-hud-pill"><span className="hud-label">正解</span><span className="hud-value">{score}</span></div>
          <div className="tqw-hud-pill tqw-hud-pill--gold"><span className="hud-label">コンボ</span><span className="hud-value">{combo}</span></div>
        </div>

        <div className="w-full h-3 rounded-full overflow-hidden mb-3"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="h-full rounded-full transition-all duration-300"
            style={{ width: `${timePct}%`, background: `linear-gradient(90deg, ${timeColor}, ${timeColor}cc)`, boxShadow: `0 0 8px ${timeColor}88` }}
          />
        </div>
        <div className="text-center text-[11px] mb-4" style={{ color: 'var(--tqw-text-gray)' }}>のこり {timeLeft} 秒</div>

        {comboFlash && (
          <div className="fixed left-1/2 -translate-x-1/2 top-1/3 z-40 pointer-events-none animate-pulse">
            <div className="text-3xl font-black px-5 py-3 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,100,0,0.25))',
                color: 'var(--tqw-gold)', border: '2px solid rgba(255,215,0,0.5)',
                boxShadow: '0 0 30px rgba(255,215,0,0.6)', textShadow: '0 0 10px rgba(255,215,0,0.8)',
              }}
            >{comboFlash}</div>
          </div>
        )}

        <div className="tqw-card-panel rounded-2xl p-6 mb-3 text-center"
          style={{
            border: feedback === 'correct' ? '2px solid #22c55e' :
                    feedback === 'wrong' ? '2px solid #ef4444' :
                    '1px solid rgba(197,160,63,0.3)',
          }}
        >
          <div className="font-black mb-2" style={{
            fontSize: 48,
            color: 'var(--tqw-gold)',
            textShadow: '0 0 20px rgba(255,215,0,0.4)',
            letterSpacing: '0.1em',
          }}>
            {feedback === 'correct'
              ? problem.q.full
              : feedback === 'wrong'
                ? problem.q.full.split('').map((ch, i) => problem.q.display[i] === '□' ? `「${ch}」` : ch).join('')
                : problem.q.display}
          </div>
          {showMeaning && (
            <div className="text-[12px] mt-2" style={{
              color: feedback === 'correct' ? '#a7f3d0' : '#fca5a5',
              padding: '6px 10px',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.3)',
            }}>
              意味: {showMeaning}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {problem.choices.map((c, i) => {
            const isPicked = picked === i;
            const isCorrect = feedback && i === problem.correctIndex;
            const isWrongPicked = feedback === 'wrong' && isPicked;
            return (
              <button
                key={i}
                onClick={() => handleChoice(i)}
                disabled={!!feedback}
                className="rounded-xl py-5 px-3 text-3xl font-black transition-all active:scale-95"
                style={{
                  background: isCorrect ? 'rgba(34,197,94,0.3)'
                    : isWrongPicked ? 'rgba(239,68,68,0.3)'
                    : 'linear-gradient(180deg, rgba(30,40,70,0.9), rgba(15,20,40,0.95))',
                  color: 'var(--tqw-gold)',
                  border: isCorrect ? '2px solid #22c55e'
                    : isWrongPicked ? '2px solid #ef4444'
                    : '1.5px solid rgba(255,215,0,0.25)',
                  boxShadow: isCorrect ? '0 0 16px rgba(34,197,94,0.5)'
                    : isWrongPicked ? '0 0 16px rgba(239,68,68,0.5)'
                    : 'none',
                  minHeight: 64,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
