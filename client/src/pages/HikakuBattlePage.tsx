/**
 * HikakuBattlePage — ⚡ 比較バトル
 *
 * 2つの計算式から大きい方をタップ。5段階の難易度（★1〜★5）で
 * 制限時間・ミス許容回数・答えの差・出題範囲・ALT単価が変化する。
 *
 * ルール:
 *   - 2つの式の答えは一致しない（再抽選）
 *   - 答えの差は minDiff 以上、かつ極端な差は避ける（判断力勝負）
 *   - ★5 は厳密に差=1（接戦）。生成に失敗したら 1〜2 まで緩和
 *   - ミス許容を超えると即終了
 *   - ハイスコアは難易度別に localStorage に保存
 *   - 日次5回ALT制限はゲーム単位で共通（難易度をまたいで1つのクォータ）
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playDefeat, playBattleStart, playTap } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';
import { useGameTimer } from '@/hooks/useGameTimer';

type Phase = 'start' | 'playing' | 'result';
type Side = 'A' | 'B';
type DiffId = 1 | 2 | 3 | 4 | 5;

interface Expr {
  text: string;
  value: number;
}

interface Pair {
  left: Expr;
  right: Expr;
  bigger: Side;
}

interface DiffConfig {
  id: DiffId;
  label: string;
  icon: string;
  timeSeconds: number;
  missAllowed: number;
  minDiff: number;    // 答えの絶対差の下限
  strictDiff?: number; // 厳密にこの値（★5 のみ）
  altPerCorrect: number;
}

const GAME_TYPE = 'hikaku_battle' as const;
const BEST_KEY_PREFIX = 'hikaku_best_';

const DIFF_CONFIGS: Record<DiffId, DiffConfig> = {
  1: { id: 1, label: 'かんたん',   icon: '🟢', timeSeconds: 30, missAllowed: 3, minDiff: 3, altPerCorrect: 1 },
  2: { id: 2, label: 'ふつう',     icon: '🟡', timeSeconds: 30, missAllowed: 2, minDiff: 2, altPerCorrect: 1 },
  3: { id: 3, label: 'むずかしい', icon: '🟠', timeSeconds: 30, missAllowed: 1, minDiff: 1, altPerCorrect: 2 },
  4: { id: 4, label: 'ゲキむず',   icon: '🔴', timeSeconds: 25, missAllowed: 1, minDiff: 1, altPerCorrect: 3 },
  5: { id: 5, label: '鬼',         icon: '👹', timeSeconds: 20, missAllowed: 1, minDiff: 1, strictDiff: 1, altPerCorrect: 5 },
};

const DIFF_ORDER: DiffId[] = [1, 2, 3, 4, 5];

// ===== 問題生成 =====

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function exprAdd1(): Expr {
  const a = rand(1, 9), b = rand(1, 9);
  return { text: `${a} + ${b}`, value: a + b };
}
function exprMul1(): Expr {
  const a = rand(2, 9), b = rand(2, 9);
  return { text: `${a} × ${b}`, value: a * b };
}
function exprAdd2(): Expr {
  // 10〜30 + 1〜9 → 値は 11〜39（mul1 の 4〜81 と比較しやすいレンジ）
  const a = rand(10, 30), b = rand(2, 9);
  return { text: `${a} + ${b}`, value: a + b };
}
function exprMul2digit(): Expr {
  // 10〜19 × 2〜9 → 値は 20〜171
  const a = rand(10, 19), b = rand(2, 9);
  return { text: `${a} × ${b}`, value: a * b };
}
function exprCompound(): Expr {
  // 演算子優先順位あり: a + b × c または a × b + c（値は 10〜90 程度）
  if (Math.random() < 0.5) {
    const a = rand(1, 9), b = rand(2, 9), c = rand(2, 9);
    return { text: `${a} + ${b} × ${c}`, value: a + b * c };
  }
  const a = rand(2, 9), b = rand(2, 9), c = rand(1, 9);
  return { text: `${a} × ${b} + ${c}`, value: a * b + c };
}

function buildOneForDiff(diff: DiffId, correct: number): Expr {
  switch (diff) {
    case 1:
      return exprAdd1();
    case 2:
      if (correct < 6) return exprAdd1();
      return Math.random() < 0.5 ? exprAdd1() : exprMul1();
    case 3:
      return Math.random() < 0.5 ? exprAdd1() : exprMul1();
    case 4:
      return Math.random() < 0.5 ? exprAdd2() : exprMul1();
    case 5:
      return Math.random() < 0.5 ? exprMul2digit() : exprCompound();
  }
}

function buildPair(diff: DiffId, correct: number): Pair {
  const cfg = DIFF_CONFIGS[diff];

  // 通常の差条件（下限 minDiff、上限は元値の 50% 以内で判断力勝負）
  const tryMake = (maxDiffFactor: number): Pair | null => {
    for (let i = 0; i < 60; i++) {
      const a = buildOneForDiff(diff, correct);
      const b = buildOneForDiff(diff, correct);
      if (a.text === b.text) continue;
      if (a.value === b.value) continue;
      const d = Math.abs(a.value - b.value);
      if (cfg.strictDiff !== undefined) {
        if (d !== cfg.strictDiff) continue;
      } else {
        if (d < cfg.minDiff) continue;
      }
      const max = Math.max(a.value, b.value);
      if (d > Math.max(2, Math.floor(max * maxDiffFactor))) continue;
      return { left: a, right: b, bigger: a.value > b.value ? 'A' : 'B' };
    }
    return null;
  };

  // ★5: 差=1 を優先、失敗したら差<=2、それでも失敗したら差<=3 でフォールバック
  if (cfg.strictDiff !== undefined) {
    for (let i = 0; i < 80; i++) {
      const a = buildOneForDiff(diff, correct);
      const b = buildOneForDiff(diff, correct);
      if (a.text === b.text) continue;
      if (Math.abs(a.value - b.value) === cfg.strictDiff) {
        return { left: a, right: b, bigger: a.value > b.value ? 'A' : 'B' };
      }
    }
    // 緩和
    for (let i = 0; i < 40; i++) {
      const a = buildOneForDiff(diff, correct);
      const b = buildOneForDiff(diff, correct);
      const d = Math.abs(a.value - b.value);
      if (a.text !== b.text && d >= 1 && d <= 3) {
        return { left: a, right: b, bigger: a.value > b.value ? 'A' : 'B' };
      }
    }
  }

  const p = tryMake(0.5) ?? tryMake(0.9);
  if (p) return p;

  // フォールバック: 値が違えば採用
  for (let i = 0; i < 30; i++) {
    const a = buildOneForDiff(diff, correct);
    const b = buildOneForDiff(diff, correct);
    if (a.value !== b.value && a.text !== b.text) {
      return { left: a, right: b, bigger: a.value > b.value ? 'A' : 'B' };
    }
  }
  const a = buildOneForDiff(diff, correct);
  return { left: a, right: { text: `${a.value + 1}`, value: a.value + 1 }, bigger: 'B' };
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

export default function HikakuBattlePage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [selectedDiff, setSelectedDiff] = useState<DiffId>(1);
  const [activeDiff, setActiveDiff] = useState<DiffId>(1);
  const [pair, setPair] = useState<Pair | null>(null);
  const [score, setScore] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [flash, setFlash] = useState<{ side: Side; ok: boolean } | null>(null);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [endReason, setEndReason] = useState<'time' | 'miss' | null>(null);

  const activeCfg = DIFF_CONFIGS[activeDiff];
  const selectedCfg = DIFF_CONFIGS[selectedDiff];

  const bestScore = useMemo(() => getBestScore(userId, selectedDiff), [userId, selectedDiff, phase]);
  const remaining = useMemo(() => getGameDailyRemaining(userId, GAME_TYPE), [userId, phase]);

  const timerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);
  const gameTimer = useGameTimer();

  const startGame = useCallback(() => {
    playBattleStart();
    const cfg = DIFF_CONFIGS[selectedDiff];
    savedRef.current = false;
    gameTimer.start();
    setActiveDiff(selectedDiff);
    setScore(0);
    setMissCount(0);
    setTimeLeft(cfg.timeSeconds);
    setFlash(null);
    setAltEarned(0);
    setLimited(false);
    setIsNewBest(false);
    setEndReason(null);
    setPair(buildPair(selectedDiff, 0));
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
          setEndReason('time');
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

  // Save on result
  useEffect(() => {
    if (phase !== 'result' || savedRef.current) return;
    savedRef.current = true;

    const newBest = saveBestScore(userId, activeDiff, score);
    setIsNewBest(newBest);

    const raw = score * activeCfg.altPerCorrect;
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      difficulty: activeDiff,
      rawAltEarned: raw,
      score,
      durationSeconds: gameTimer.getElapsedSeconds(),
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, activeDiff, activeCfg.altPerCorrect, addTotalAlt]);

  const handleTap = useCallback((side: Side) => {
    if (phase !== 'playing' || !pair || flash) return;
    const cfg = activeCfg;
    const correct = side === pair.bigger;
    if (correct) {
      playSuccess();
      setFlash({ side, ok: true });
      const newScore = score + 1;
      setScore(newScore);
      flashTimerRef.current = window.setTimeout(() => {
        setFlash(null);
        setPair(buildPair(activeDiff, newScore));
      }, 180);
    } else {
      playError();
      setFlash({ side, ok: false });
      const newMiss = missCount + 1;
      setMissCount(newMiss);
      if (newMiss >= cfg.missAllowed) {
        flashTimerRef.current = window.setTimeout(() => {
          setEndReason('miss');
          setPhase('result');
        }, 450);
      } else {
        flashTimerRef.current = window.setTimeout(() => {
          setFlash(null);
          setPair(buildPair(activeDiff, score));
        }, 400);
      }
    }
  }, [phase, pair, flash, score, missCount, activeCfg, activeDiff]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    };
  }, []);

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
          <div className="text-6xl mb-3">⚡</div>
          <h1 className="text-2xl font-black mb-2 tqw-title-game">比較バトル</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--tqw-text-gray)' }}>
            大きい方をはやくタップ！<br />難易度を えらんでね
          </p>

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

          <div className="grid grid-cols-3 gap-1.5 mb-4 text-[10px]">
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>時間</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>{selectedCfg.timeSeconds}秒</div>
            </div>
            <div className="rounded-lg py-1.5" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div style={{ color: 'var(--tqw-text-gray)' }}>ミス許容</div>
              <div className="text-sm font-black" style={{ color: 'var(--tqw-gold)' }}>
                {selectedCfg.missAllowed === 1 ? '即死' : `${selectedCfg.missAllowed}回`}
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
            <li>左右の式を見くらべて、大きい方をタップ</li>
            <li>★1=差3以上/★2=差2以上/★3〜4=差1以上/★5=ほぼ同値の接戦</li>
            <li>ミス許容を超えると即終了</li>
            <li>1日5回までALT獲得（難易度共通）</li>
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && pair) {
    const timePct = (timeLeft / activeCfg.timeSeconds) * 100;
    const timeColor = timeLeft > activeCfg.timeSeconds * 0.5 ? '#22c55e' : timeLeft > activeCfg.timeSeconds * 0.2 ? '#eab308' : '#ef4444';
    const leftState = flash?.side === 'A' ? (flash.ok ? 'ok' : 'ng') : null;
    const rightState = flash?.side === 'B' ? (flash.ok ? 'ok' : 'ng') : null;
    const livesRemaining = activeCfg.missAllowed - missCount;

    return (
      <div className="px-3 pt-3 pb-3 min-h-[calc(100vh-140px)] flex flex-col">
        <div className="flex items-center justify-between mb-2 text-[12px]">
          <div className="tqw-hud-pill">
            <span className="hud-label">{'★'.repeat(activeDiff)}</span>
            <span className="hud-value">{score}</span>
          </div>
          <div className="tqw-hud-pill">
            <span className="hud-label">ライフ</span>
            <span className="hud-value" style={{ color: livesRemaining <= 1 ? '#ef4444' : 'var(--tqw-gold)' }}>
              {activeCfg.missAllowed === 1 ? '一撃' : `${'♥'.repeat(Math.max(0, livesRemaining))}${'·'.repeat(missCount)}`}
            </span>
          </div>
          <div className="tqw-hud-pill tqw-hud-pill--gold">
            <span className="hud-label">のこり</span>
            <span className="hud-value">{timeLeft}s</span>
          </div>
        </div>

        <div className="w-full h-2 rounded-full overflow-hidden mb-2"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          <div className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${timePct}%`,
              background: `linear-gradient(90deg, ${timeColor}, ${timeColor}cc)`,
              boxShadow: `0 0 6px ${timeColor}88`,
            }}
          />
        </div>

        <div className="flex-1 flex flex-col gap-2 relative" style={{ minHeight: 320 }}>
          <button
            onClick={() => handleTap('A')}
            className="flex-1 rounded-2xl text-4xl font-black transition-all active:scale-[0.98]"
            style={{
              background: leftState === 'ok' ? 'rgba(34,197,94,0.4)' :
                          leftState === 'ng' ? 'rgba(239,68,68,0.4)' :
                          'linear-gradient(135deg, rgba(40,60,120,0.5), rgba(20,30,70,0.7))',
              color: '#fff',
              border: leftState === 'ok' ? '3px solid #22c55e' :
                      leftState === 'ng' ? '3px solid #ef4444' :
                      '2px solid rgba(255,215,0,0.3)',
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
              boxShadow: leftState === 'ok' ? '0 0 24px rgba(34,197,94,0.7)' :
                         leftState === 'ng' ? '0 0 24px rgba(239,68,68,0.7)' :
                         '0 0 12px rgba(255,215,0,0.15)',
              minHeight: 140,
            }}
          >
            {pair.left.text}
          </button>

          <button
            onClick={() => handleTap('B')}
            className="flex-1 rounded-2xl text-4xl font-black transition-all active:scale-[0.98]"
            style={{
              background: rightState === 'ok' ? 'rgba(34,197,94,0.4)' :
                          rightState === 'ng' ? 'rgba(239,68,68,0.4)' :
                          'linear-gradient(135deg, rgba(120,40,60,0.5), rgba(70,20,30,0.7))',
              color: '#fff',
              border: rightState === 'ok' ? '3px solid #22c55e' :
                      rightState === 'ng' ? '3px solid #ef4444' :
                      '2px solid rgba(255,215,0,0.3)',
              textShadow: '0 2px 6px rgba(0,0,0,0.6)',
              boxShadow: rightState === 'ok' ? '0 0 24px rgba(34,197,94,0.7)' :
                         rightState === 'ng' ? '0 0 24px rgba(239,68,68,0.7)' :
                         '0 0 12px rgba(255,215,0,0.15)',
              minHeight: 140,
            }}
          >
            {pair.right.text}
          </button>

          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-2xl font-black px-3 py-1 rounded-full"
            style={{
              background: 'rgba(0,0,0,0.75)',
              color: 'var(--tqw-gold)',
              border: '2px solid var(--tqw-gold)',
              boxShadow: '0 0 16px rgba(255,215,0,0.5)',
            }}
          >
            VS
          </div>
        </div>
      </div>
    );
  }

  // Result
  return (
    <div className="px-4 pt-6 pb-6 tqw-animate-fadeIn">
      <div className="tqw-card-panel rounded-2xl p-6 text-center">
        <div className="text-5xl mb-2">{endReason === 'miss' ? '💥' : '🏁'}</div>
        <h1 className="text-xl font-black mb-1 tqw-title-game">
          {endReason === 'miss' ? 'ゲームオーバー' : 'タイムアップ'}
        </h1>
        <div className="text-[12px] mb-4" style={{ color: 'var(--tqw-gold)' }}>
          {'★'.repeat(activeDiff)} {activeCfg.label}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-[12px]">
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div style={{ color: 'var(--tqw-text-gray)' }}>正解</div>
            <div className="text-2xl font-black" style={{ color: 'var(--tqw-gold)' }}>{score}</div>
          </div>
          <div className="rounded-lg p-3" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
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
