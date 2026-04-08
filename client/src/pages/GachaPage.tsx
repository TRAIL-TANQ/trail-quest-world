/*
 * GachaPage: Normal/Premium gacha with card reveal animation
 * Treasure room background, ornate chest UI, card flip effect
 * Rich sparkle animations, glowing rarity borders
 */
import { useState } from 'react';
import { IMAGES, GACHA_COSTS, RARITY_LABELS, RARITY_COLORS, RARITY_STARS } from '@/lib/constants';
import { MOCK_CARDS } from '@/lib/mockData';
import { useUserStore } from '@/lib/stores';
import type { GachaCard } from '@/lib/types';
import { toast } from 'sonner';

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
  const pool = MOCK_CARDS.filter((c) => c.rarity <= rarity + 1 && c.rarity >= rarity);
  if (pool.length === 0) return MOCK_CARDS[Math.floor(Math.random() * MOCK_CARDS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

const categoryEmoji: Record<string, string> = {
  great_person: '👤',
  creature: '🐉',
  heritage: '🏛️',
  invention: '💡',
  trail: '🗺️',
};

export default function GachaPage() {
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);
  const [pulledCard, setPulledCard] = useState<GachaCard | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePull = (type: 'normal' | 'premium') => {
    const cost = type === 'normal' ? GACHA_COSTS.NORMAL : GACHA_COSTS.PREMIUM;
    if (user.currentAlt < cost) {
      toast.error('ALTが足りません');
      return;
    }
    updateAlt(-cost);
    setIsAnimating(true);
    setPulledCard(null);
    setTimeout(() => {
      const card = rollGacha(type === 'premium');
      setPulledCard(card);
      setIsAnimating(false);
    }, 2000);
  };

  return (
    <div className="relative min-h-full">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GACHA_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.5) 0%, rgba(11,17,40,0.92) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Title */}
        <div className="text-center mb-5">
          <div className="flex items-center justify-center gap-3 mb-1">
            <div className="h-px flex-1 max-w-[50px]" style={{ background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.5))' }} />
            <h1 className="text-xl font-bold" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.4)' }}>
              🎰 ガチャ
            </h1>
            <div className="h-px flex-1 max-w-[50px]" style={{ background: 'linear-gradient(90deg, rgba(168,85,247,0.5), transparent)' }} />
          </div>
          <p className="text-amber-200/40 text-[11px]">カードを集めてコレクションを完成させよう！</p>
        </div>

        {/* Card Display Area */}
        <div className="flex items-center justify-center mb-6" style={{ minHeight: '300px' }}>
          {isAnimating ? (
            <div className="relative">
              <div className="w-44 h-56 rounded-2xl flex items-center justify-center relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(255,215,0,0.1))',
                  border: '2px solid rgba(255,215,0,0.4)',
                  boxShadow: '0 0 40px rgba(255,215,0,0.3), 0 0 80px rgba(168,85,247,0.2)',
                  animation: 'pulse-glow 0.4s ease-in-out infinite',
                }}
              >
                <span className="text-7xl" style={{ animation: 'float 0.8s ease-in-out infinite' }}>🎁</span>
                {/* Sparkles */}
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="absolute w-1.5 h-1.5 rounded-full"
                    style={{
                      background: i % 2 === 0 ? '#ffd700' : '#a855f7',
                      top: `${10 + Math.random() * 80}%`,
                      left: `${10 + Math.random() * 80}%`,
                      animation: `sparkle ${0.4 + Math.random() * 0.6}s ease-in-out ${Math.random() * 0.5}s infinite`,
                      boxShadow: `0 0 6px ${i % 2 === 0 ? 'rgba(255,215,0,0.8)' : 'rgba(168,85,247,0.8)'}`,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : pulledCard ? (
            <div className="animate-bounce-in">
              {/* Gacha type label */}
              <div className="text-center mb-3">
                <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{
                    background: `${RARITY_COLORS[pulledCard.rarity]}22`,
                    color: RARITY_COLORS[pulledCard.rarity],
                    border: `1px solid ${RARITY_COLORS[pulledCard.rarity]}44`,
                  }}
                >
                  {RARITY_LABELS[pulledCard.rarity]}
                </span>
              </div>

              <div className="w-52 rounded-2xl overflow-hidden relative"
                style={{
                  border: `3px solid ${RARITY_COLORS[pulledCard.rarity]}`,
                  boxShadow: `0 0 25px ${RARITY_COLORS[pulledCard.rarity]}55, 0 0 50px ${RARITY_COLORS[pulledCard.rarity]}22, 0 8px 32px rgba(0,0,0,0.5)`,
                  background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
                }}
              >
                {/* Card image area */}
                <div className="h-48 flex items-center justify-center relative"
                  style={{ background: `radial-gradient(circle, ${RARITY_COLORS[pulledCard.rarity]}15, transparent)` }}
                >
                  <span className="text-8xl">{categoryEmoji[pulledCard.category] || '❓'}</span>
                  {/* Sparkles around card */}
                  {pulledCard.rarity >= 4 && [...Array(6)].map((_, i) => (
                    <div key={i} className="absolute w-1 h-1 rounded-full"
                      style={{
                        background: RARITY_COLORS[pulledCard.rarity],
                        top: `${20 + Math.random() * 60}%`,
                        left: `${10 + Math.random() * 80}%`,
                        animation: `sparkle ${1 + Math.random()}s ease-in-out ${Math.random()}s infinite`,
                        boxShadow: `0 0 4px ${RARITY_COLORS[pulledCard.rarity]}`,
                      }}
                    />
                  ))}
                </div>

                {/* Card info */}
                <div className="px-4 py-3 text-center"
                  style={{ borderTop: `1px solid ${RARITY_COLORS[pulledCard.rarity]}44` }}
                >
                  <div className="flex justify-center gap-0.5 mb-1.5">
                    {Array.from({ length: RARITY_STARS[pulledCard.rarity] }).map((_, i) => (
                      <span key={i} className="text-base" style={{ color: RARITY_COLORS[pulledCard.rarity] }}>★</span>
                    ))}
                  </div>
                  <h3 className="text-lg font-bold text-amber-100 mb-0.5">{pulledCard.name}</h3>
                  {pulledCard.era && <p className="text-[10px] text-amber-200/35 mb-1">{pulledCard.era}</p>}
                  <p className="text-[11px] text-amber-200/50 line-clamp-2">{pulledCard.description}</p>
                </div>
              </div>

              <button onClick={() => setPulledCard(null)} className="rpg-btn rpg-btn-gold w-full mt-4 py-3">
                OK
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-28 h-28 mx-auto mb-4 rounded-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(255,215,0,0.05))',
                  border: '2px solid rgba(255,215,0,0.2)',
                  boxShadow: '0 0 20px rgba(168,85,247,0.1)',
                }}
              >
                <span className="text-6xl">🎰</span>
              </div>
              <p className="text-amber-200/40 text-sm">ガチャを回してカードをゲット！</p>
            </div>
          )}
        </div>

        {/* Gacha Buttons */}
        {!pulledCard && !isAnimating && (
          <div className="space-y-3">
            {/* Normal Gacha */}
            <button
              onClick={() => handlePull('normal')}
              disabled={user.currentAlt < GACHA_COSTS.NORMAL}
              className="w-full rounded-xl p-4 transition-all active:scale-[0.98] disabled:opacity-35 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.03))',
                border: '2px solid rgba(59,130,246,0.3)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 0 20px rgba(59,130,246,0.05)',
              }}
            >
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: 'rgba(59,130,246,0.5)' }} />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: 'rgba(59,130,246,0.5)' }} />
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-bold text-blue-300">ノーマルガチャ ×1</p>
                  <p className="text-[10px] text-blue-200/40">★1〜★4 カード</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)' }}
                >
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128' }}
                  >A</div>
                  <span className="text-sm font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.NORMAL}</span>
                </div>
              </div>
            </button>

            {/* Premium Gacha */}
            <button
              onClick={() => handlePull('premium')}
              disabled={user.currentAlt < GACHA_COSTS.PREMIUM}
              className="w-full rounded-xl p-4 transition-all active:scale-[0.98] disabled:opacity-35 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.03))',
                border: '2px solid rgba(168,85,247,0.35)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.3), 0 0 25px rgba(168,85,247,0.08), inset 0 0 20px rgba(168,85,247,0.05)',
              }}
            >
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: 'rgba(168,85,247,0.5)' }} />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: 'rgba(168,85,247,0.5)' }} />
              <div className="flex items-center justify-between">
                <div className="text-left">
                  <p className="text-sm font-bold text-purple-300">プレミアムガチャ ×1</p>
                  <p className="text-[10px] text-purple-200/40">★3〜★6 確率UP！</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.25)' }}
                >
                  <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128' }}
                  >A</div>
                  <span className="text-sm font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.PREMIUM}</span>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Gacha rates info */}
        {!pulledCard && !isAnimating && (
          <div className="mt-4 rounded-xl p-3 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.9), rgba(14,20,45,0.9))',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
          >
            <p className="text-[10px] text-amber-200/35 mb-2 font-bold">📊 提供割合</p>
            <div className="grid grid-cols-3 gap-x-3 gap-y-1">
              {Object.entries(RARITY_LABELS).map(([r, label]) => (
                <div key={r} className="flex items-center gap-1">
                  <span className="text-[9px]" style={{ color: RARITY_COLORS[Number(r)] }}>★{r}</span>
                  <span className="text-[9px] text-amber-200/35">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
