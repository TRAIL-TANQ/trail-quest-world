/*
 * GamePlayPage: Dark UI × Neon - Game start screen + number tap game + result
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { MOCK_GAMES } from '@/lib/mockData';
import { useUserStore, useAltStore } from '@/lib/stores';
import { Star, ArrowLeft, Coins, Play, RotateCcw, Home } from 'lucide-react';

type Phase = 'start' | 'playing' | 'result';

export default function GamePlayPage() {
  const params = useParams<{ gameId: string }>();
  const [, navigate] = useLocation();
  const game = MOCK_GAMES.find((g) => g.id === params.gameId);
  const [phase, setPhase] = useState<Phase>('start');

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
        <div className="text-center">
          <p className="text-lg font-bold mb-4" style={{ color: '#F8FAFC' }}>ゲームが見つかりません</p>
          <button onClick={() => navigate('/games')} className="px-6 py-2 rounded-lg text-sm font-bold" style={{ background: '#4F46E5', color: '#F8FAFC' }}>戻る</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#0F172A' }}>
      {phase === 'start' && <GameStartScreen game={game} onStart={() => setPhase('playing')} onBack={() => navigate('/games')} />}
      {phase === 'playing' && <NumberTapGame game={game} onComplete={() => setPhase('result')} onExit={() => navigate('/games')} />}
      {phase === 'result' && <GameResultScreen game={game} onRetry={() => setPhase('start')} onHome={() => navigate('/')} />}
    </div>
  );
}

/* ===== Game Start Screen ===== */
function GameStartScreen({ game, onStart, onBack }: { game: typeof MOCK_GAMES[0]; onStart: () => void; onBack: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative">
      <button onClick={onBack} className="absolute top-4 left-4 flex items-center gap-1 text-sm active:scale-95" style={{ color: '#94A3B8' }}>
        <ArrowLeft className="w-4 h-4" /> 戻る
      </button>
      <span className="text-6xl mb-4">{game.emoji}</span>
      <h1 className="text-2xl font-black mb-2" style={{ color: '#F8FAFC' }}>{game.title}</h1>
      <p className="text-sm text-center mb-6" style={{ color: '#94A3B8' }}>{game.description}</p>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-xs mr-1" style={{ color: '#94A3B8' }}>難易度</span>
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className="w-4 h-4" style={{ color: i < game.difficulty ? '#F59E0B' : 'rgba(255,255,255,0.1)' }} fill={i < game.difficulty ? '#F59E0B' : 'none'} />
        ))}
      </div>
      <div className="flex items-center gap-1.5 mb-8 px-4 py-2 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <Coins className="w-4 h-4" style={{ color: '#F59E0B' }} />
        <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>クリアで +{game.altReward} ALT</span>
      </div>
      <button
        onClick={onStart}
        className="flex items-center gap-2 px-10 py-4 rounded-lg text-lg font-black transition-all active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
          color: '#F8FAFC',
          boxShadow: '0 0 24px rgba(79,70,229,0.4), 0 4px 12px rgba(0,0,0,0.3)',
          animation: 'pulse-glow 2s ease-in-out infinite',
        }}
      >
        <Play className="w-5 h-5 fill-current" /> スタート！
      </button>
    </div>
  );
}

/* ===== Number Tap Game ===== */
function NumberTapGame({ game, onComplete, onExit }: { game: typeof MOCK_GAMES[0]; onComplete: () => void; onExit: () => void }) {
  const gridSize = 16;
  const [numbers, setNumbers] = useState<number[]>([]);
  const [nextNumber, setNextNumber] = useState(1);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [combo, setCombo] = useState(0);
  const [wrongTap, setWrongTap] = useState<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const shuffled: number[] = [];
    for (let i = 1; i <= gridSize; i++) shuffled.push(i);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setNumbers(shuffled);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
      return;
    }
    const timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  const handleTap = useCallback((num: number) => {
    if (num === nextNumber) {
      setScore((s) => s + 10 + combo * 2);
      setCombo((c) => c + 1);
      setNextNumber((n) => n + 1);
      setWrongTap(null);
      if (nextNumber >= gridSize && !completedRef.current) {
        completedRef.current = true;
        onComplete();
      }
    } else {
      setCombo(0);
      setWrongTap(num);
      setTimeout(() => setWrongTap(null), 300);
    }
  }, [nextNumber, combo, onComplete]);

  return (
    <div className="min-h-screen flex flex-col px-4 pt-4 pb-6">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onExit} className="p-2 rounded-lg active:scale-90" style={{ color: '#94A3B8' }}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-lg text-xs font-bold" style={{ background: 'rgba(79,70,229,0.15)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' }}>
            スコア: {score.toString().padStart(5, '0')}
          </div>
          {combo > 1 && (
            <div className="px-2 py-1 rounded-lg text-xs font-bold animate-bounce-in" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              x{combo}
            </div>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>残り時間</span>
          <span className="text-sm font-bold tabular-nums" style={{ color: timeLeft <= 5 ? '#EF4444' : '#F8FAFC' }}>{timeLeft}秒</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${(timeLeft / 30) * 100}%`,
              background: timeLeft <= 5 ? '#EF4444' : timeLeft <= 10 ? '#F59E0B' : '#4F46E5',
            }}
          />
        </div>
      </div>

      {/* Next number indicator */}
      <div className="text-center mb-3">
        <span className="text-xs" style={{ color: '#94A3B8' }}>次の数字: </span>
        <span className="text-xl font-black" style={{ color: '#4F46E5', textShadow: '0 0 12px rgba(79,70,229,0.4)' }}>{nextNumber}</span>
      </div>

      {/* Number Grid */}
      <div className="flex-1 flex items-center justify-center">
        <div className="grid grid-cols-4 gap-2 w-full max-w-[320px]">
          {numbers.map((num) => {
            const isCleared = num < nextNumber;
            const isWrong = wrongTap === num;
            return (
              <button
                key={num}
                onClick={() => !isCleared && handleTap(num)}
                disabled={isCleared}
                className="aspect-square rounded-xl text-xl font-black transition-all active:scale-90"
                style={{
                  background: isCleared ? 'rgba(255,255,255,0.03)' : isWrong ? 'rgba(239,68,68,0.2)' : '#1E293B',
                  border: isCleared ? '1px solid rgba(255,255,255,0.03)' : isWrong ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  color: isCleared ? 'rgba(255,255,255,0.1)' : '#F8FAFC',
                  boxShadow: isWrong ? '0 0 12px rgba(239,68,68,0.3)' : 'none',
                  animation: isWrong ? 'shake 0.3s ease-in-out' : undefined,
                }}
              >
                {isCleared ? '✓' : num}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===== Game Result Screen ===== */
function GameResultScreen({ game, onRetry, onHome }: { game: typeof MOCK_GAMES[0]; onRetry: () => void; onHome: () => void }) {
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);
  const [displayScore, setDisplayScore] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);
  const finalScore = 185;

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(finalScore * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    const t1 = setTimeout(() => {
      addTotalAlt(game.altReward);
      triggerEarnEffect(game.altReward);
    }, 1500);
    const t2 = setTimeout(() => setShowNewRecord(true), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="text-3xl font-black mb-2" style={{ color: '#10B981', textShadow: '0 0 20px rgba(16,185,129,0.4)', animation: 'bounce-in 0.5s ease-out' }}>
        クリア！
      </div>
      <div className="text-6xl font-black tabular-nums mb-1" style={{ color: '#F8FAFC' }}>
        {displayScore.toString().padStart(3, '0')}
      </div>
      <p className="text-sm mb-4" style={{ color: '#94A3B8' }}>PT</p>

      {showNewRecord && (
        <div className="px-4 py-1.5 rounded-full text-sm font-black mb-6" style={{
          background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))',
          border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B',
          boxShadow: '0 0 16px rgba(245,158,11,0.3)', animation: 'bounce-in 0.5s ease-out',
        }}>
          NEW RECORD!
        </div>
      )}

      <div className="flex items-center gap-2 mb-8 px-4 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <Coins className="w-5 h-5" style={{ color: '#F59E0B' }} />
        <span className="text-lg font-bold" style={{ color: '#F59E0B' }}>+{game.altReward} ALT</span>
      </div>

      <div className="flex gap-3 w-full max-w-[280px]">
        <button onClick={onRetry} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95" style={{ background: '#1E293B', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RotateCcw className="w-4 h-4" /> もう一度
        </button>
        <button onClick={onHome} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95" style={{ background: '#4F46E5', color: '#F8FAFC', boxShadow: '0 0 12px rgba(79,70,229,0.3)' }}>
          <Home className="w-4 h-4" /> ホーム
        </button>
      </div>
    </div>
  );
}
