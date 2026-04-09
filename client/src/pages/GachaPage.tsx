/*
 * GachaPage: Fantasy RPG gacha with treasure chest image buttons
 * Gold ornate styling + full animation system (shake → burst → flip → reveal)
 * CollectionStore連携: 引いたカードをコレクションに自動反映
 */
import { useState, useMemo, useCallback } from 'react';
import { GACHA_COSTS, RARITY_LABELS, RARITY_COLORS, RARITY_STARS, IMAGES } from '@/lib/constants';
import { COLLECTION_CARDS, GACHA_RARITY_RATES } from '@/lib/cardData';
import { useUserStore, useGachaStore, useCollectionStore } from '@/lib/stores';
import type { CollectionCard, CollectionRarity } from '@/lib/types';
import { toast } from 'sonner';

// コレクションカードをガチャ排出用にレア度別プールに分類
const CARD_POOLS: Record<CollectionRarity, CollectionCard[]> = {
  N: COLLECTION_CARDS.filter((c) => c.rarity === 'N'),
  R: COLLECTION_CARDS.filter((c) => c.rarity === 'R'),
  SR: COLLECTION_CARDS.filter((c) => c.rarity === 'SR'),
  SSR: COLLECTION_CARDS.filter((c) => c.rarity === 'SSR'),
};

function rollCollectionCard(premium: boolean): CollectionCard {
  const rand = Math.random();
  let rarity: CollectionRarity;
  if (premium) {
    // プレミアム: SSR 15%, SR 35%, R 50% (N排出なし)
    if (rand < 0.15) rarity = 'SSR';
    else if (rand < 0.50) rarity = 'SR';
    else rarity = 'R';
  } else {
    // ノーマル: SSR 1%, SR 9%, R 30%, N 60%
    if (rand < GACHA_RARITY_RATES.SSR) rarity = 'SSR';
    else if (rand < GACHA_RARITY_RATES.SSR + GACHA_RARITY_RATES.SR) rarity = 'SR';
    else if (rand < GACHA_RARITY_RATES.SSR + GACHA_RARITY_RATES.SR + GACHA_RARITY_RATES.R) rarity = 'R';
    else rarity = 'N';
  }
  const pool = CARD_POOLS[rarity];
  if (pool.length === 0) return COLLECTION_CARDS[Math.floor(Math.random() * COLLECTION_CARDS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

const RARITY_COLOR_MAP: Record<CollectionRarity, string> = {
  N: '#9ca3af',
  R: '#3b82f6',
  SR: '#f59e0b',
  SSR: '#a855f7',
};

const categoryEmoji: Record<string, string> = {
  great_people: '👤',
  creatures: '🦖',
  world_heritage: '🏛️',
  inventions: '💡',
  discovery: '🔭',
};

type GachaPhase = 'idle' | 'shake' | 'burst' | 'flip' | 'reveal';

export default function GachaPage() {
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);
  const pityCount = useGachaStore((s) => s.pityCount);
  const incrementPity = useGachaStore((s) => s.incrementPity);
  const resetPity = useGachaStore((s) => s.resetPity);
  const addCard = useCollectionStore((s) => s.addCard);
  const ownedCardIds = useCollectionStore((s) => s.ownedCardIds);

  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [pulledCard, setPulledCard] = useState<CollectionCard | null>(null);
  const [gachaType, setGachaType] = useState<'normal' | 'premium'>('normal');
  const [isDuplicate, setIsDuplicate] = useState(false);

  const burstParticles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      return { id: i, tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: Math.random() * 0.3, size: 3 + Math.random() * 5 };
    }), []);

  const handlePull = useCallback((type: 'normal' | 'premium') => {
    const cost = type === 'normal' ? GACHA_COSTS.NORMAL : GACHA_COSTS.PREMIUM;
    if (user.currentAlt < cost) { toast.error('ALTが足りません'); return; }
    if (phase !== 'idle' && phase !== 'reveal') return;

    updateAlt(-cost);
    setGachaType(type);
    setPulledCard(null);
    setIsDuplicate(false);
    setPhase('shake');

    const card = rollCollectionCard(type === 'premium');
    const isSSR = card.rarity === 'SSR';
    const isSR = card.rarity === 'SR';

    if (isSSR || isSR) { resetPity(); } else { incrementPity(); }

    // コレクションに追加（重複チェック）
    const alreadyOwned = ownedCardIds.has(card.id);
    setIsDuplicate(alreadyOwned);
    addCard(card.id);

    const burstDuration = isSSR ? 2000 : isSR ? 1500 : 800;
    setTimeout(() => { setPulledCard(card); setPhase('burst'); }, 500);
    setTimeout(() => setPhase('flip'), 500 + burstDuration);
    setTimeout(() => setPhase('reveal'), 500 + burstDuration + 600);
  }, [user.currentAlt, phase, updateAlt, incrementPity, resetPity, addCard, ownedCardIds]);

  const handleDismiss = () => { setPhase('idle'); setPulledCard(null); };

  const rarityColor = pulledCard ? RARITY_COLOR_MAP[pulledCard.rarity] : '#ffd700';
  const isSSR = pulledCard?.rarity === 'SSR';
  const isHighRarity = pulledCard && (pulledCard.rarity === 'SR' || pulledCard.rarity === 'SSR');
  const pityRemaining = 50 - pityCount;

  return (
    <div className="relative min-h-full">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GACHA_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.6) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Title + ALT */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎰</span>
            <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>ガチャ</h1>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
              style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
            <span className="text-xs font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>{user.currentAlt.toLocaleString()}</span>
          </div>
        </div>

        {/* Animation Area (shake / burst / flip / reveal) */}
        {(phase === 'shake' || phase === 'burst' || phase === 'flip' || phase === 'reveal') && (
          <div className="flex items-center justify-center" style={{ minHeight: '360px' }}>
            {/* SHAKE PHASE */}
            {phase === 'shake' && (
              <div className="text-center">
                <div className="w-44 h-44 mx-auto flex items-center justify-center"
                  style={{ animation: 'shake 0.5s ease-in-out' }}>
                  <img
                    src={gachaType === 'premium' ? IMAGES.GACHA_PREMIUM_BTN : IMAGES.GACHA_NORMAL_BTN}
                    alt="宝箱"
                    className="w-40 h-40 object-contain"
                    style={{ filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.4))' }}
                  />
                </div>
              </div>
            )}

            {/* BURST PHASE - Rarity reveal */}
            {phase === 'burst' && pulledCard && (
              <div className="relative flex items-center justify-center" style={{ width: '280px', height: '280px' }}>
                {isSSR && (
                  <div className="fixed inset-0 z-[90] pointer-events-none" style={{ animation: 'flash 0.6s ease-out', background: 'white' }} />
                )}
                <div className="absolute rounded-full"
                  style={{
                    width: '60px', height: '60px',
                    background: isSSR
                      ? 'radial-gradient(circle, rgba(255,215,0,0.6), rgba(168,85,247,0.4), rgba(59,130,246,0.3), transparent)'
                      : `radial-gradient(circle, ${rarityColor}88, ${rarityColor}22, transparent)`,
                    animation: 'radial-burst 1.5s ease-out forwards',
                  }} />
                {burstParticles.map((p) => (
                  <div key={p.id} className="absolute rounded-full"
                    style={{
                      width: p.size, height: p.size,
                      background: isSSR ? ['#ffd700', '#a855f7', '#3b82f6', '#22c55e', '#ef4444'][p.id % 5] : rarityColor,
                      left: '50%', top: '50%', marginLeft: -p.size / 2, marginTop: -p.size / 2,
                      '--tx': `${p.tx}px`, '--ty': `${p.ty}px`,
                      animation: `coin-burst 1s ease-out ${p.delay}s forwards`,
                      boxShadow: `0 0 6px ${isSSR ? ['#ffd700', '#a855f7', '#3b82f6', '#22c55e', '#ef4444'][p.id % 5] : rarityColor}`,
                    } as React.CSSProperties} />
                ))}
                <div className="absolute rounded-full"
                  style={{ width: '80px', height: '80px', background: `radial-gradient(circle, ${rarityColor}44, transparent)`, animation: 'pulse-glow 0.4s ease-in-out infinite' }} />
                <div className="absolute text-center" style={{ animation: 'bounce-in 0.5s ease-out' }}>
                  <span className="text-lg font-black" style={{ color: rarityColor, textShadow: `0 0 20px ${rarityColor}` }}>
                    {pulledCard.rarity}
                  </span>
                </div>
              </div>
            )}

            {/* FLIP PHASE */}
            {phase === 'flip' && pulledCard && (
              <div className="relative" style={{ perspective: '600px' }}>
                <div className="w-48 h-64 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{
                    border: isSSR ? '2px solid transparent' : `2px solid ${rarityColor}`,
                    boxShadow: `0 0 24px ${rarityColor}44`,
                    animation: isSSR ? 'card-flip 0.6s ease-out, rainbow-border 2s linear infinite' : 'card-flip 0.6s ease-out',
                    backfaceVisibility: 'hidden',
                  }}>
                  <img src={pulledCard.imageUrl} alt={pulledCard.name} className="w-full h-full object-cover" />
                </div>
              </div>
            )}

            {/* REVEAL PHASE */}
            {phase === 'reveal' && pulledCard && (
              <div className="text-center" style={{ animation: 'scale-in 0.3s ease-out' }}>
                <div className="mb-3 flex items-center justify-center gap-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={{ background: `${rarityColor}20`, color: rarityColor, border: `1px solid ${rarityColor}40` }}>
                    {pulledCard.rarity}
                  </span>
                  {isDuplicate && (
                    <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(156,163,175,0.2)', color: '#9ca3af', border: '1px solid rgba(156,163,175,0.3)' }}>
                      重複
                    </span>
                  )}
                </div>
                {/* カード画像（枠付き） */}
                <div className="w-52 mx-auto rounded-xl overflow-hidden relative"
                  style={{
                    border: isSSR ? '2px solid transparent' : `2px solid ${rarityColor}`,
                    boxShadow: `0 0 32px ${rarityColor}33, 0 8px 24px rgba(0,0,0,0.5)`,
                    animation: isSSR ? 'rainbow-border 2s linear infinite' : `glow-pulse 2s ease-in-out infinite`,
                    '--glow-color': rarityColor,
                  } as React.CSSProperties}>
                  {/* 角の装飾 */}
                  <div className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 rounded-tl-sm z-10" style={{ borderColor: `${rarityColor}88` }} />
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 rounded-tr-sm z-10" style={{ borderColor: `${rarityColor}88` }} />
                  <div className="absolute bottom-1 left-1 w-2.5 h-2.5 border-b-2 border-l-2 rounded-bl-sm z-10" style={{ borderColor: `${rarityColor}88` }} />
                  <div className="absolute bottom-1 right-1 w-2.5 h-2.5 border-b-2 border-r-2 rounded-br-sm z-10" style={{ borderColor: `${rarityColor}88` }} />

                  {/* カード画像 */}
                  <div className="relative" style={{ aspectRatio: '3/4' }}>
                    <img src={pulledCard.imageUrl} alt={pulledCard.name} className="w-full h-full object-cover" />
                    {/* スパークルエフェクト（高レア度のみ） */}
                    {isHighRarity && Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="absolute w-1 h-1 rounded-full" style={{
                        background: rarityColor,
                        top: `${15 + Math.random() * 70}%`, left: `${10 + Math.random() * 80}%`,
                        animation: `sparkle ${0.8 + Math.random() * 1.2}s ease-in-out ${Math.random() * 0.5}s infinite`,
                        boxShadow: `0 0 4px ${rarityColor}`,
                      }} />
                    ))}
                  </div>

                  {/* カード名 */}
                  <div className="px-3 py-2 text-center" style={{ background: `linear-gradient(to top, rgba(11,17,40,0.95), rgba(11,17,40,0.7))`, borderTop: `1px solid ${rarityColor}33` }}>
                    <div className="flex justify-center gap-0.5 mb-1">
                      {Array.from({ length: pulledCard.rarity === 'SSR' ? 4 : pulledCard.rarity === 'SR' ? 3 : pulledCard.rarity === 'R' ? 2 : 1 }).map((_, i) => (
                        <span key={i} className="text-sm" style={{ color: rarityColor }}>★</span>
                      ))}
                    </div>
                    <h3 className="text-sm font-bold text-amber-100">{pulledCard.name}</h3>
                    <p className="text-[10px] text-amber-200/50 mt-0.5">{categoryEmoji[pulledCard.category]} {pulledCard.description.slice(0, 30)}…</p>
                  </div>
                </div>

                {isDuplicate && (
                  <p className="text-xs text-amber-200/40 mt-2">すでに持っているカードです</p>
                )}

                <button onClick={handleDismiss} className="rpg-btn rpg-btn-gold mt-4 px-8 py-2.5">OK</button>
              </div>
            )}
          </div>
        )}

        {/* IDLE STATE - Treasure Chest Buttons */}
        {(phase === 'idle') && !pulledCard && (
          <div className="space-y-5 mt-2">
            {/* Title area */}
            <div className="text-center mb-2">
              <p className="text-sm text-amber-200/60">宝箱をタップしてカードをゲット！</p>
              <p className="text-[10px] text-amber-200/30 mt-1">あと{pityRemaining}回で★3確定</p>
            </div>

            {/* Two treasure chest buttons side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Normal Gacha */}
              <button
                onClick={() => handlePull('normal')}
                disabled={user.currentAlt < GACHA_COSTS.NORMAL}
                className="group relative flex flex-col items-center transition-all active:scale-95 disabled:opacity-30"
              >
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))',
                    border: '2px solid rgba(59,130,246,0.3)',
                    boxShadow: '0 0 20px rgba(59,130,246,0.1), inset 0 0 20px rgba(59,130,246,0.05)',
                  }}>
                  <img
                    src={IMAGES.GACHA_NORMAL_BTN}
                    alt="ノーマルガチャ"
                    className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105 group-active:scale-95"
                    style={{ filter: 'drop-shadow(0 4px 12px rgba(59,130,246,0.3))' }}
                  />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.08) 50%, transparent 70%)' }} />
                </div>
                <p className="text-xs font-bold text-blue-300 mb-1">ノーマルガチャ</p>
                <p className="text-[10px] text-amber-200/30 mb-1.5">N〜SR カード</p>
                <div className="flex items-center gap-1 px-3 py-1 rounded-lg"
                  style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <div className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                  <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.NORMAL}</span>
                </div>
              </button>

              {/* Premium Gacha */}
              <button
                onClick={() => handlePull('premium')}
                disabled={user.currentAlt < GACHA_COSTS.PREMIUM}
                className="group relative flex flex-col items-center transition-all active:scale-95 disabled:opacity-30"
              >
                <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(168,85,247,0.05))',
                    border: '2px solid rgba(255,215,0,0.4)',
                    boxShadow: '0 0 24px rgba(255,215,0,0.15), 0 0 48px rgba(168,85,247,0.08), inset 0 0 20px rgba(255,215,0,0.05)',
                    animation: 'glow-pulse 3s ease-in-out infinite',
                    '--glow-color': '#ffd700',
                  } as React.CSSProperties}>
                  <img
                    src={IMAGES.GACHA_PREMIUM_BTN}
                    alt="プレミアムガチャ"
                    className="w-full h-full object-contain p-1 transition-transform group-hover:scale-105 group-active:scale-95"
                    style={{ filter: 'drop-shadow(0 4px 16px rgba(255,215,0,0.4))' }}
                  />
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)' }} />
                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>
                    PREMIUM
                  </div>
                </div>
                <p className="text-xs font-bold" style={{ color: '#ffd700' }}>プレミアムガチャ</p>
                <p className="text-[10px] text-amber-200/30 mb-1.5">SR・SSR 確率UP！</p>
                <div className="flex items-center gap-1 px-3 py-1 rounded-lg"
                  style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <div className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                  <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.PREMIUM}</span>
                </div>
              </button>
            </div>

            {/* Rarity table */}
            <div className="rounded-xl p-3 mt-2" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
              <div className="grid grid-cols-2 gap-3">
                {/* ノーマル排出率 */}
                <div>
                  <p className="text-[10px] text-blue-300/70 font-bold mb-1.5 text-center">ノーマル</p>
                  {(['SSR', 'SR', 'R', 'N'] as CollectionRarity[]).map((r) => (
                    <div key={r} className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold" style={{ color: RARITY_COLOR_MAP[r] }}>{r}</span>
                      <span className="text-[10px] text-amber-200/40">
                        {r === 'SSR' ? '1%' : r === 'SR' ? '9%' : r === 'R' ? '30%' : '60%'}
                      </span>
                    </div>
                  ))}
                </div>
                {/* プレミアム排出率 */}
                <div>
                  <p className="text-[10px] font-bold mb-1.5 text-center" style={{ color: '#ffd700' }}>プレミアム</p>
                  {(['SSR', 'SR', 'R'] as CollectionRarity[]).map((r) => (
                    <div key={r} className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold" style={{ color: RARITY_COLOR_MAP[r] }}>{r}</span>
                      <span className="text-[10px] text-amber-200/40">
                        {r === 'SSR' ? '15%' : r === 'SR' ? '35%' : '50%'}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold" style={{ color: RARITY_COLOR_MAP['N'] }}>N</span>
                    <span className="text-[10px]" style={{ color: '#22c55e' }}>なし</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
