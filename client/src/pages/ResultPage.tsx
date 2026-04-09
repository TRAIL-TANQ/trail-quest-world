/*
 * ResultPage: Dark UI × Neon - Score display, new record, ALT earned
 */
import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useGameStore, useUserStore, useAltStore } from '@/lib/stores';
import { Coins, RotateCcw, Home } from 'lucide-react';

export default function ResultPage() {
  const [, navigate] = useLocation();
  const lastResult = useGameStore((s) => s.lastResult);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);
  const [displayScore, setDisplayScore] = useState(0);
  const [showNewRecord, setShowNewRecord] = useState(false);

  const score = lastResult?.score ?? 185;
  const isBest = lastResult?.isBestScore ?? true;
  const altReward = 15;

  useEffect(() => {
    const duration = 1200;
    const start = Date.now();
    const animate = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);

    const t1 = setTimeout(() => { addTotalAlt(altReward); triggerEarnEffect(altReward); }, 1500);
    const t2 = setTimeout(() => { if (isBest) setShowNewRecord(true); }, 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0F172A' }}>
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
        <span className="text-lg font-bold" style={{ color: '#F59E0B' }}>+{altReward} ALT</span>
      </div>

      <div className="flex gap-3 w-full max-w-[280px]">
        <button onClick={() => navigate('/games')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95" style={{ background: '#1E293B', color: '#F8FAFC', border: '1px solid rgba(255,255,255,0.08)' }}>
          <RotateCcw className="w-4 h-4" /> もう一度
        </button>
        <button onClick={() => navigate('/')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all active:scale-95" style={{ background: '#4F46E5', color: '#F8FAFC', boxShadow: '0 0 12px rgba(79,70,229,0.3)' }}>
          <Home className="w-4 h-4" /> ホーム
        </button>
      </div>
    </div>
  );
}
