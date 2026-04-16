/**
 * HikakuBattlePage — ⚡ 比較バトル
 *
 * 2つの計算式から大きい方をタップ。間違えたら即終了。30秒制限。
 * 難易度は正解数で自動上昇。答えが同じにならない＆差が大きすぎない問題を生成。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { playSuccess, playError, playDefeat, playBattleStart } from '@/lib/sfx';
import { finalizeAltGame, getGameDailyRemaining } from '@/lib/altGameService';

type Phase = 'start' | 'playing' | 'result';

type Side = 'A' | 'B';

interface Expr {
  text: string;
  value: number;
}

interface Pair {
  left: Expr;
  right: Expr;
  bigger: Side;
}

const GAME_SECONDS = 30;
const GAME_TYPE = 'hikaku_battle' as const;
const BEST_KEY = 'hikaku_best_';

// ===== 問題生成 =====

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type Kind = 'add1' | 'mul1' | 'mix' | 'mul2';

function kindFor(correct: number): Kind {
  if (correct < 5) return 'add1';
  if (correct < 10) return 'mul1';
  if (correct < 15) return 'mix';
  return 'mul2';
}

function buildExpr(kind: Kind): Expr {
  switch (kind) {
    case 'add1': {
      const a = rand(1, 9), b = rand(1, 9);
      return { text: `${a} + ${b}`, value: a + b };
    }
    case 'mul1': {
      const a = rand(2, 9), b = rand(2, 9);
      return { text: `${a} × ${b}`, value: a * b };
    }
    case 'mix': {
      if (Math.random() < 0.5) {
        const a = rand(10, 30), b = rand(2, 9);
        return { text: `${a} + ${b}`, value: a + b };
      }
      const a = rand(2, 9), b = rand(3, 9);
      return { text: `${a} × ${b}`, value: a * b };
    }
    case 'mul2': {
      const a = rand(11, 19), b = rand(2, 9);
      return { text: `${a} × ${b}`, value: a * b };
    }
  }
}

function buildPair(correct: number): Pair {
  const kind = kindFor(correct);
  // 答えの差が 1〜15 くらいになるまで引き直す（パッと見で分かりにくくする）
  // - 同値は必ずNG
  // - 差が大きすぎる場合もNG
  for (let i = 0; i < 40; i++) {
    const a = buildExpr(kind);
    const b = buildExpr(kind);
    if (a.value === b.value) continue;
    const diff = Math.abs(a.value - b.value);
    const max = Math.max(a.value, b.value);
    // 差が大きすぎない（元の値の 50% 以内、絶対値で 1〜max-1）
    if (diff > Math.max(2, Math.floor(max * 0.5))) continue;
    if (a.text === b.text) continue;
    return { left: a, right: b, bigger: a.value > b.value ? 'A' : 'B' };
  }
  // フォールバック：値が違えば採用
  for (let i = 0; i < 20; i++) {
    const a = buildExpr(kind);
    const b = buildExpr(kind);
    if (a.value !== b.value) return { left: a, right: b, bigger: a.value > b.value ? 'A' : 'B' };
  }
  const a = buildExpr(kind);
  return { left: a, right: { text: `${a.value + 1}`, value: a.value + 1 }, bigger: 'B' };
}

function getBestScore(childId: string): number {
  try {
    return parseInt(localStorage.getItem(BEST_KEY + childId) || '0', 10);
  } catch {
    return 0;
  }
}

function saveBestScore(childId: string, score: number): boolean {
  const prev = getBestScore(childId);
  if (score > prev) {
    try { localStorage.setItem(BEST_KEY + childId, String(score)); } catch { /* */ }
    return true;
  }
  return false;
}

function computeAlt(correct: number): number {
  if (correct <= 0) return 0;
  let alt = correct;
  if (correct >= 10) alt += 5;
  if (correct >= 20) alt += 10;
  return alt;
}

// ===== Component =====

export default function HikakuBattlePage() {
  const userId = useUserStore((s) => s.user.id);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);

  const [phase, setPhase] = useState<Phase>('start');
  const [pair, setPair] = useState<Pair | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [flash, setFlash] = useState<{ side: Side; ok: boolean } | null>(null);
  const [altEarned, setAltEarned] = useState(0);
  const [limited, setLimited] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);
  const [endReason, setEndReason] = useState<'time' | 'wrong' | null>(null);

  const bestScore = useMemo(() => getBestScore(userId), [userId, phase]);
  const remaining = useMemo(() => getGameDailyRemaining(userId, GAME_TYPE), [userId, phase]);

  const timerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const savedRef = useRef(false);

  const startGame = useCallback(() => {
    playBattleStart();
    savedRef.current = false;
    setScore(0);
    setTimeLeft(GAME_SECONDS);
    setFlash(null);
    setAltEarned(0);
    setLimited(false);
    setIsNewBest(false);
    setEndReason(null);
    setPair(buildPair(0));
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

    const newBest = saveBestScore(userId, score);
    setIsNewBest(newBest);

    const raw = computeAlt(score);
    void finalizeAltGame({
      childId: userId,
      gameType: GAME_TYPE,
      rawAltEarned: raw,
      score,
    }).then(({ altEarned: granted, limited: wasLimited }) => {
      if (granted > 0) addTotalAlt(granted);
      setAltEarned(granted);
      setLimited(wasLimited);
    });
  }, [phase, score, userId, addTotalAlt]);

  const handleTap = useCallback((side: Side) => {
    if (phase !== 'playing' || !pair || flash) return;
    const correct = side === pair.bigger;
    if (correct) {
      playSuccess();
      setFlash({ side, ok: true });
      const newScore = score + 1;
      setScore(newScore);
      flashTimerRef.current = window.setTimeout(() => {
        setFlash(null);
        setPair(buildPair(newScore));
      }, 180);
    } else {
      playError();
      setFlash({ side, ok: false });
      flashTimerRef.current = window.setTimeout(() => {
        setEndReason('wrong');
        setPhase('result');
      }, 450);
    }
  }, [phase, pair, flash, score]);

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
            大きい方をはやくタップ！<br />
            間違えたら即ゲームオーバー
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
            <li>左右の式を見くらべて、大きい方をタップ</li>
            <li>間違えると即ゲームオーバー</li>
            <li>10問でボーナス+5 ALT / 20問で+10 ALT</li>
          </ul>
        </div>
      </div>
    );
  }

  if (phase === 'playing' && pair) {
    const timePct = (timeLeft / GAME_SECONDS) * 100;
    const timeColor = timeLeft > 15 ? '#22c55e' : timeLeft > 5 ? '#eab308' : '#ef4444';
    const leftState = flash?.side === 'A' ? (flash.ok ? 'ok' : 'ng') : null;
    const rightState = flash?.side === 'B' ? (flash.ok ? 'ok' : 'ng') : null;

    return (
      <div className="px-3 pt-3 pb-3 min-h-[calc(100vh-140px)] flex flex-col">
        {/* HUD */}
        <div className="flex items-center justify-between mb-2 text-[12px]">
          <div className="tqw-hud-pill">
            <span className="hud-label">正解</span>
            <span className="hud-value">{score}</span>
          </div>
          <div className="tqw-hud-pill tqw-hud-pill--gold">
            <span className="hud-label">のこり</span>
            <span className="hud-value">{timeLeft}s</span>
          </div>
        </div>

        {/* Time bar */}
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

        {/* VS panels */}
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

          {/* VS overlay */}
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
        <div className="text-5xl mb-2">{endReason === 'wrong' ? '💥' : '🏁'}</div>
        <h1 className="text-xl font-black mb-4 tqw-title-game">
          {endReason === 'wrong' ? 'ゲームオーバー' : 'タイムアップ'}
        </h1>

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
