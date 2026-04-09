/*
 * GachaPage: Dark UI × Neon - Full gacha animation with rarity-based effects
 * Phase 1: Shake/spin (0.5s)
 * Phase 2: Rarity reveal with color burst (1-2s depending on rarity)
 * Phase 3: Card flip reveal (0.5s)
 */
import { useState, useMemo, useCallback } from 'react';
import { GACHA_COSTS, RARITY_LABELS, RARITY_COLORS } from '@/lib/constants';
import { MOCK_CARDS } from '@/lib/mockData';
import { useUserStore, useGachaStore } from '@/lib/stores';
import type { GachaCard, CardRarity } from '@/lib/types';
import { toast } from 'sonner';
import { Coins, Star } from 'lucide-react';

function rollGacha(premium: boolean): GachaCard {
  const rand = Math.random();
  let rarity: number;
  if (premium) {
    if (rand < 0.02) rarity = 6;
    else if (rand < 0.10) rarity = 5;
    else if (rand < 0.30) rarity = 4;
    else rarity = 3;
  } else {
    if (rand < 0.01) rarity = 6;
    else if (rand < 0.05) rarity = 5;
    else if (rand < 0.15) rarity = 4;
    else if (rand < 0.30) rarity = 3;
    else if (rand < 0.55) rarity = 2;
    else rarity = 1;
  }
  const pool = MOCK_CARDS.filter((c) => c.rarity === rarity);
  if (pool.length === 0) return MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

const categoryEmoji: Record<string, string> = {
  great_person: '🧑‍🔬', creature: '🦁', heritage: '🏛️', invention: '💡', trail: '🗺️',
};

type GachaPhase = 'idle' | 'shake' | 'burst' | 'flip' | 'reveal';

export default function GachaPage() {
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);
  const pityCount = useGachaStore((s) => s.pityCount);
  const incrementPity = useGachaStore((s) => s.incrementPity);
  const resetPity = useGachaStore((s) => s.resetPity);

  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [pulledCard, setPulledCard] = useState<GachaCard | null>(null);
  const [gachaType, setGachaType] = useState<'normal' | 'premium'>('normal');

  // Stable burst particles
  const burstParticles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      return {
        id: i,
        tx: Math.cos(angle) * dist,
        ty: Math.sin(angle) * dist,
        delay: Math.random() * 0.3,
        size: 3 + Math.random() * 5,
      };
    }), []);

  const handlePull = useCallback((type: 'normal' | 'premium') => {
    const cost = type === 'normal' ? GACHA_COSTS.NORMAL : GACHA_COSTS.PREMIUM;
    if (user.currentAlt < cost) { toast.error('ALTが足りません'); return; }
    if (phase !== 'idle' && phase !== 'reveal') return;

    updateAlt(-cost);
    setGachaType(type);
    setPulledCard(null);
    setPhase('shake');

    const card = rollGacha(type === 'premium');
    const rarity = card.rarity as CardRarity;

    // Track pity
    if (rarity >= 5) { resetPity(); } else { incrementPity(); }

    // Phase timing based on rarity
    const burstDuration = rarity >= 6 ? 2000 : rarity >= 4 ? 1500 : 800;

    setTimeout(() => {
      setPulledCard(card);
      setPhase('burst');
    }, 500);

    setTimeout(() => setPhase('flip'), 500 + burstDuration);
    setTimeout(() => setPhase('reveal'), 500 + burstDuration + 600);
  }, [user.currentAlt, phase, updateAlt, incrementPity, resetPity]);

  const handleDismiss = () => {
    setPhase('idle');
    setPulledCard(null);
  };

  const rarityColor = pulledCard ? RARITY_COLORS[pulledCard.rarity] || '#94A3B8' : '#4F46E5';
  const isLegend = pulledCard?.rarity === 6;
  const isHighRarity = pulledCard && pulledCard.rarity >= 4;
  const pityRemaining = 50 - pityCount;

  return (
    <div className="px-4 py-4 relative">
      {/* Title + ALT */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold" style={{ color: '#F8FAFC' }}>ガチャ</h1>
        <div className="flex items-center gap-1 px-3 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <Coins className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{user.currentAlt.toLocaleString()}</span>
        </div>
      </div>

      {/* Gacha Machine Area */}
      <div className="flex items-center justify-center" style={{ minHeight: '320px' }}>
        {/* IDLE STATE */}
        {phase === 'idle' && !pulledCard && (
          <div className="text-center">
            <div
              className="w-32 h-32 mx-auto mb-4 rounded-full flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(79,70,229,0.05))',
                border: '2px solid rgba(79,70,229,0.3)',
                boxShadow: '0 0 24px rgba(79,70,229,0.15)',
              }}
            >
              <span className="text-6xl" style={{ animation: 'float 3s ease-in-out infinite' }}>🎰</span>
            </div>
            <p className="text-sm mb-1" style={{ color: '#94A3B8' }}>ガチャを回してカードをゲット！</p>
            <p className="text-[10px]" style={{ color: '#64748B' }}>あと{pityRemaining}回で★5確定</p>
          </div>
        )}

        {/* SHAKE PHASE */}
        {phase === 'shake' && (
          <div className="text-center">
            <div
              className="w-32 h-32 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(79,70,229,0.1))',
                border: '2px solid rgba(79,70,229,0.5)',
                boxShadow: '0 0 32px rgba(79,70,229,0.3)',
                animation: 'shake 0.5s ease-in-out',
              }}
            >
              <span className="text-6xl">🎰</span>
            </div>
          </div>
        )}

        {/* BURST PHASE - Rarity reveal */}
        {phase === 'burst' && pulledCard && (
          <div className="relative flex items-center justify-center" style={{ width: '280px', height: '280px' }}>
            {/* Background flash for legend */}
            {isLegend && (
              <div className="fixed inset-0 z-[90] pointer-events-none" style={{ animation: 'flash 0.6s ease-out', background: 'white' }} />
            )}

            {/* Radial burst */}
            <div
              className="absolute rounded-full"
              style={{
                width: '60px', height: '60px',
                background: isLegend
                  ? 'radial-gradient(circle, rgba(239,68,68,0.6), rgba(245,158,11,0.4), rgba(16,185,129,0.3), rgba(79,70,229,0.2))'
                  : `radial-gradient(circle, ${rarityColor}88, ${rarityColor}22, transparent)`,
                animation: 'radial-burst 1.5s ease-out forwards',
              }}
            />

            {/* Particles */}
            {burstParticles.map((p) => (
              <div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size, height: p.size,
                  background: isLegend
                    ? ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'][p.id % 5]
                    : rarityColor,
                  left: '50%', top: '50%',
                  marginLeft: -p.size / 2, marginTop: -p.size / 2,
                  '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                  animation: `coin-burst 1s ease-out ${p.delay}s forwards`,
                  boxShadow: `0 0 6px ${isLegend ? ['#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'][p.id % 5] : rarityColor}`,
                } as React.CSSProperties}
              />
            ))}

            {/* Center glow */}
            <div
              className="absolute rounded-full"
              style={{
                width: '80px', height: '80px',
                background: `radial-gradient(circle, ${rarityColor}44, transparent)`,
                animation: 'pulse-glow 0.4s ease-in-out infinite',
              }}
            />

            {/* Rarity label */}
            <div className="absolute text-center" style={{ animation: 'bounce-in 0.5s ease-out' }}>
              <span className="text-lg font-black" style={{ color: rarityColor, textShadow: `0 0 20px ${rarityColor}` }}>
                {RARITY_LABELS[pulledCard.rarity]}
              </span>
            </div>
          </div>
        )}

        {/* FLIP PHASE - Card flipping */}
        {phase === 'flip' && pulledCard && (
          <div className="relative" style={{ perspective: '600px' }}>
            <div
              className="w-48 h-64 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${rarityColor}20, #1E293B)`,
                border: isLegend ? '3px solid transparent' : `3px solid ${rarityColor}`,
                boxShadow: `0 0 24px ${rarityColor}44`,
                animation: isLegend ? 'card-flip 0.6s ease-out, rainbow-border 2s linear infinite' : 'card-flip 0.6s ease-out',
                backfaceVisibility: 'hidden',
              }}
            >
              <span className="text-6xl">{categoryEmoji[pulledCard.category] || '❓'}</span>
            </div>
          </div>
        )}

        {/* REVEAL PHASE - Full card display */}
        {phase === 'reveal' && pulledCard && (
          <div className="text-center" style={{ animation: 'scale-in 0.3s ease-out' }}>
            {/* Rarity badge */}
            <div className="mb-3">
              <span className="text-xs font-bold px-3 py-1 rounded-full" style={{
                background: `${rarityColor}20`, color: rarityColor, border: `1px solid ${rarityColor}40`,
              }}>
                {RARITY_LABELS[pulledCard.rarity]}
              </span>
            </div>

            {/* Card */}
            <div
              className="w-52 mx-auto rounded-2xl overflow-hidden relative"
              style={{
                background: '#1E293B',
                border: isLegend ? '3px solid transparent' : `3px solid ${rarityColor}`,
                boxShadow: `0 0 32px ${rarityColor}33`,
                animation: isLegend ? 'rainbow-border 2s linear infinite' : `glow-pulse 2s ease-in-out infinite`,
                '--glow-color': rarityColor,
              } as React.CSSProperties}
            >
              <div className="h-44 flex items-center justify-center relative" style={{ background: `radial-gradient(circle, ${rarityColor}12, transparent)` }}>
                <span className="text-7xl">{categoryEmoji[pulledCard.category] || '❓'}</span>
                {/* Sparkles for high rarity */}
                {isHighRarity && Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="absolute w-1 h-1 rounded-full" style={{
                    background: rarityColor,
                    top: `${15 + Math.random() * 70}%`, left: `${10 + Math.random() * 80}%`,
                    animation: `sparkle ${0.8 + Math.random() * 1.2}s ease-in-out ${Math.random() * 0.5}s infinite`,
                    boxShadow: `0 0 4px ${rarityColor}`,
                  }} />
                ))}
              </div>
              <div className="px-4 py-3 text-center" style={{ borderTop: `1px solid ${rarityColor}33` }}>
                <div className="flex justify-center gap-0.5 mb-1.5">
                  {Array.from({ length: Math.min(pulledCard.rarity, 6) }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" style={{ color: rarityColor }} />
                  ))}
                </div>
                <h3 className="text-base font-bold mb-0.5" style={{ color: '#F8FAFC' }}>{pulledCard.name}</h3>
                {pulledCard.era && <p className="text-[10px] mb-1" style={{ color: '#94A3B8' }}>{pulledCard.era}</p>}
                <p className="text-[10px] line-clamp-2" style={{ color: '#94A3B8' }}>{pulledCard.description}</p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="mt-4 px-8 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
              style={{ background: '#4F46E5', color: '#F8FAFC', boxShadow: '0 0 12px rgba(79,70,229,0.3)' }}
            >
              OK
            </button>
          </div>
        )}
      </div>

      {/* Gacha Buttons */}
      {(phase === 'idle' || phase === 'reveal') && !pulledCard && (
        <div className="space-y-3 mt-4">
          {/* Normal */}
          <button
            onClick={() => handlePull('normal')}
            disabled={user.currentAlt < GACHA_COSTS.NORMAL}
            className="w-full rounded-xl p-4 transition-all active:scale-[0.98] disabled:opacity-30"
            style={{
              background: '#1E293B',
              border: '1px solid rgba(79,70,229,0.3)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: '#A5B4FC' }}>ノーマルガチャ ×1</p>
                <p className="text-[10px]" style={{ color: '#64748B' }}>★1〜★4 カード</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <Coins className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{GACHA_COSTS.NORMAL}</span>
              </div>
            </div>
          </button>

          {/* Premium */}
          <button
            onClick={() => handlePull('premium')}
            disabled={user.currentAlt < GACHA_COSTS.PREMIUM}
            className="w-full rounded-xl p-4 transition-all active:scale-[0.98] disabled:opacity-30"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))',
              border: '1px solid rgba(245,158,11,0.3)',
              boxShadow: '0 0 16px rgba(245,158,11,0.05)',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-sm font-bold" style={{ color: '#F59E0B' }}>プレミアムガチャ ×1</p>
                <p className="text-[10px]" style={{ color: '#64748B' }}>★3〜★6 確率UP！</p>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Coins className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                <span className="text-sm font-bold" style={{ color: '#F59E0B' }}>{GACHA_COSTS.PREMIUM}</span>
              </div>
            </div>
          </button>

          {/* Pity counter */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>天井カウント</span>
              <span className="text-[10px]" style={{ color: '#64748B' }}>{pityCount}/50</span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${(pityCount / 50) * 100}%`, background: 'linear-gradient(90deg, #4F46E5, #F59E0B)' }} />
            </div>
            <p className="text-[9px] mt-1" style={{ color: '#64748B' }}>あと{pityRemaining}回で★5確定</p>
          </div>

          {/* Rates */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold mb-2" style={{ color: '#94A3B8' }}>提供割合</p>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
              {Object.entries(RARITY_LABELS).map(([r, label]) => (
                <div key={r} className="flex items-center gap-1">
                  <span className="text-[9px]" style={{ color: RARITY_COLORS[Number(r)] }}>★{r}</span>
                  <span className="text-[9px]" style={{ color: '#64748B' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overlay during animation */}
      {(phase === 'shake' || phase === 'burst') && (
        <div className="fixed inset-0 z-[80] pointer-events-none" style={{ background: 'rgba(0,0,0,0.6)', transition: 'opacity 0.3s' }} />
      )}
    </div>
  );
}
