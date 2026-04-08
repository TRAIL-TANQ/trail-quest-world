/*
 * ResultPage: Game result with best score celebration, ALT earned, level up
 * Victory fanfare style with gold sparkle effects, ornate frames
 */
import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useGameStore, useUserStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';

export default function ResultPage() {
  const [, navigate] = useLocation();
  const lastResult = useGameStore((s) => s.lastResult);
  const user = useUserStore((s) => s.user);
  const levelInfo = calculateLevel(user.totalAlt);
  const [showScore, setShowScore] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);

  // Stable sparkle positions
  const sparkles = useMemo(() =>
    Array.from({ length: 25 }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 2}s`,
      duration: `${1 + Math.random() * 2}s`,
      size: Math.random() > 0.7 ? 2 : 1,
    })), []);

  useEffect(() => {
    if (!lastResult) {
      navigate('/');
      return;
    }
    const targetScore = lastResult.score;
    const duration = 1500;
    const startTime = Date.now();

    const t1 = setTimeout(() => setShowScore(true), 300);
    const t2 = setTimeout(() => setShowDetails(true), 1800);
    const t3 = setTimeout(() => setShowLevelUp(true), 2500);

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime - 300;
      if (elapsed < 0) return;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.floor(targetScore * eased));
      if (progress >= 1) clearInterval(interval);
    }, 16);

    return () => {
      clearInterval(interval);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [lastResult, navigate]);

  if (!lastResult) return null;

  const altEarned = 10;
  const bonusAlt = lastResult.isBestScore ? 5 : 0;
  const totalAltEarned = altEarned + bonusAlt;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0b1128 100%)' }}
    >
      {/* Background sparkles */}
      {sparkles.map((s) => (
        <div key={s.id} className="absolute rounded-full"
          style={{
            width: s.size,
            height: s.size,
            background: '#ffd700',
            top: s.top,
            left: s.left,
            animation: `sparkle ${s.duration} ease-in-out ${s.delay} infinite`,
            boxShadow: '0 0 4px rgba(255,215,0,0.6)',
          }}
        />
      ))}

      {/* Radial glow behind score */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(255,215,0,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10">
        {/* Result Banner */}
        <div className="text-center mb-6">
          <div className="inline-block mb-4 px-6 py-2 rounded-xl relative"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,215,0,0.05))',
              border: '2px solid rgba(255,215,0,0.35)',
              boxShadow: '0 0 15px rgba(255,215,0,0.1)',
            }}
          >
            {/* Corner decorations */}
            <div className="absolute -top-0.5 -left-0.5 w-2 h-2 border-t-2 border-l-2" style={{ borderColor: '#ffd700' }} />
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 border-t-2 border-r-2" style={{ borderColor: '#ffd700' }} />
            <div className="absolute -bottom-0.5 -left-0.5 w-2 h-2 border-b-2 border-l-2" style={{ borderColor: '#ffd700' }} />
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 border-b-2 border-r-2" style={{ borderColor: '#ffd700' }} />
            <span className="text-sm font-bold" style={{ color: '#ffd700' }}>🎉 リザルト</span>
          </div>

          {/* Best Score Badge */}
          {lastResult.isBestScore && showScore && (
            <div className="animate-bounce-in mb-3">
              <span className="text-xl font-bold"
                style={{
                  color: '#ffd700',
                  textShadow: '0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,215,0,0.3)',
                }}
              >
                ベストスコア更新！
              </span>
            </div>
          )}

          {/* Score Display */}
          {showScore && (
            <div className="animate-bounce-in">
              <p className="text-7xl font-bold font-[var(--font-orbitron)]"
                style={{
                  color: '#ffd700',
                  textShadow: '0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(255,215,0,0.2), 0 4px 8px rgba(0,0,0,0.5)',
                }}
              >
                {displayScore}
              </p>
              <p className="text-sm text-amber-200/40 mt-1 font-[var(--font-orbitron)]">PT</p>
            </div>
          )}
        </div>

        {/* Details */}
        {showDetails && (
          <div className="rounded-2xl p-4 mb-4 animate-slide-up relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '2px solid rgba(255,215,0,0.25)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,215,0,0.03)',
            }}
          >
            {/* Score breakdown */}
            <div className="space-y-2.5 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-200/50">スコア</span>
                <span className="text-amber-100 font-bold">+{altEarned}</span>
              </div>
              {lastResult.isBestScore && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-200/50">🏆 ベスト更新ボーナス！</span>
                  <span className="font-bold" style={{ color: '#ffd700' }}>+{bonusAlt}</span>
                </div>
              )}
              {lastResult.accuracy !== undefined && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-amber-200/50">正答率</span>
                  <span className="text-amber-100">{Math.round(lastResult.accuracy * 100)}%</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-200/50">クリアタイム</span>
                <span className="text-amber-100">{lastResult.timeSeconds}秒</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px mb-4" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.2), transparent)' }} />

            {/* ALT Earned */}
            <div className="rounded-xl p-3 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.03))',
                border: '1px solid rgba(255,215,0,0.2)',
              }}
            >
              <div className="flex items-center justify-center gap-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                    color: '#0b1128',
                    boxShadow: '0 0 8px rgba(255,215,0,0.3)',
                  }}
                >A</div>
                <span className="text-2xl font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>
                  +{totalAltEarned}
                </span>
                <span className="text-sm" style={{ color: '#ffd700' }}>ALT</span>
              </div>
            </div>
          </div>
        )}

        {/* Level Up Section */}
        {showLevelUp && (
          <div className="rounded-2xl p-4 mb-4 animate-bounce-in relative"
            style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(21,29,59,0.95))',
              border: '2px solid rgba(34,197,94,0.3)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 0 15px rgba(34,197,94,0.05)',
            }}
          >
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                    color: '#0b1128',
                    boxShadow: '0 0 6px rgba(255,215,0,0.2)',
                  }}
                >
                  Lv.{levelInfo.level}
                </span>
                <span className="text-xs text-amber-200/50">{levelInfo.title}</span>
              </div>
              {/* XP Bar */}
              <div className="w-full h-2.5 rounded-full overflow-hidden mb-1"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
              >
                <div className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${levelInfo.progress * 100}%`,
                    background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                    boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                  }}
                />
              </div>
              <p className="text-[9px] text-amber-200/25">
                {levelInfo.nextLevelAlt ? `次のレベルまで ${levelInfo.nextLevelAlt - user.totalAlt} ALT` : 'MAX LEVEL'}
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {showDetails && (
          <div className="flex gap-3 animate-slide-up" style={{ animationDelay: '200ms' }}>
            <button
              onClick={() => navigate('/')}
              className="rpg-btn rpg-btn-blue flex-1 py-3"
            >
              ホームに戻る
            </button>
            <button
              onClick={() => navigate('/games')}
              className="rpg-btn rpg-btn-gold flex-1 py-3"
            >
              もう一度プレイ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
