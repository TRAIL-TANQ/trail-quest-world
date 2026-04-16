/*
 * GachaPage: Fantasy RPG gacha with treasure chest image buttons
 * - 天井システム: ノーマル50回/プレミアム30回でSSR確定
 * - 10連機能: 10枚一括引き（SR以上1枚確定）
 * - ガチャ履歴: 過去100件の引き結果を表示
 * Gold ornate styling + full animation system
 */
import { useState, useMemo, useCallback, useEffect } from 'react';
import { GACHA_COSTS, RARITY_LABELS, RARITY_COLORS, RARITY_STARS, IMAGES, CARD_RARITY_IMAGES } from '@/lib/constants';
import { COLLECTION_CARDS, GACHA_RARITY_RATES } from '@/lib/cardData';
import { useUserStore, useGachaStore, useCollectionStore, useMissionStore } from '@/lib/stores';
import type { GachaHistoryEntry } from '@/lib/stores';
import type { CollectionCard, CollectionRarity } from '@/lib/types';
import { availableRarities, levelToGachaPhase } from '@/lib/knowledgeCards';
import { calculateLevel } from '@/lib/level';
import { fetchPity, savePity, spendAltForGacha, recordPulls } from '@/lib/gachaService';
import { fetchChildStatus } from '@/lib/quizService';
import { spendAlt } from '@/lib/altGuard';
import { computeOwnership } from '@/lib/myDecks';
import { getAuth } from '@/lib/auth';
import { toast } from 'sonner';

// --- Constants ---
const PITY_LIMIT_NORMAL = 50;   // ノーマル天井
const PITY_LIMIT_PREMIUM = 30;  // プレミアム天井

// コレクションカードをガチャ排出用にレア度別プールに分類
const CARD_POOLS: Record<CollectionRarity, CollectionCard[]> = {
  N: COLLECTION_CARDS.filter((c) => c.rarity === 'N'),
  R: COLLECTION_CARDS.filter((c) => c.rarity === 'R'),
  SR: COLLECTION_CARDS.filter((c) => c.rarity === 'SR'),
  SSR: COLLECTION_CARDS.filter((c) => c.rarity === 'SSR'),
};

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

function pickFromPool(rarity: CollectionRarity): CollectionCard {
  const pool = CARD_POOLS[rarity];
  if (pool.length === 0) return COLLECTION_CARDS[Math.floor(Math.random() * COLLECTION_CARDS.length)];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * 変更8: プレイヤーレベルに対応するガチャフェーズのレア度分布で抽選。
 * - フェーズは levelToGachaPhase(level) で決定（1..5）
 * - premium は通常より 1 フェーズ先のレア度分布を使う（ただし上限5にクランプ）
 * - 天井到達時は許容レア度の最高を強制返却
 * - 許容レア度外のレアがロールされたら、availableRarities 内に丸める（ノーマル側ガード）
 */
function rollRarity(premium: boolean, pityCount: number, playerLevel: number): CollectionRarity {
  const basePhase = levelToGachaPhase(playerLevel);
  const phase = premium ? Math.min(5, basePhase + 1) : basePhase;
  const weights = availableRarities(phase);
  const allowed = weights.map(([r]) => r as CollectionRarity);
  const highest: CollectionRarity =
    allowed.includes('SSR') ? 'SSR' :
    allowed.includes('SR')  ? 'SR'  :
    allowed.includes('R')   ? 'R'   : 'N';

  // 天井: 許容内の最高レアを返す
  if (premium && pityCount >= PITY_LIMIT_PREMIUM - 1) return highest;
  if (!premium && pityCount >= PITY_LIMIT_NORMAL - 1) return highest;

  // 重み抽選
  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of weights) {
    r -= w;
    if (r <= 0) return rarity as CollectionRarity;
  }
  return highest;
}

type GachaPhase = 'idle' | 'shake' | 'burst' | 'flip' | 'reveal' | 'multi_reveal';

export default function GachaPage() {
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);
  // 変更8: レベルベースのガチャフェーズ決定に使う
  const playerLevel = useMemo(() => calculateLevel(user.totalAlt).level, [user.totalAlt]);
  const pityCount = useGachaStore((s) => s.pityCount);
  const premiumPityCount = useGachaStore((s) => s.premiumPityCount);
  const incrementPity = useGachaStore((s) => s.incrementPity);
  const resetPity = useGachaStore((s) => s.resetPity);
  const addHistory = useGachaStore((s) => s.addHistory);
  const history = useGachaStore((s) => s.history);
  const addCards = useCollectionStore((s) => s.addCards);
  const addCard = useCollectionStore((s) => s.addCard);
  const ownedCardIds = useCollectionStore((s) => s.ownedCardIds);
  const collectionInitialized = useCollectionStore((s) => s.initialized);
  const initOwned = useCollectionStore((s) => s.initOwned);
  const updateMissionProgress = useMissionStore((s) => s.updateProgress);

  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [pulledCard, setPulledCard] = useState<CollectionCard | null>(null);
  const [pulledCards, setPulledCards] = useState<CollectionCard[]>([]);
  const [gachaType, setGachaType] = useState<'normal' | 'premium'>('normal');
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // ===== 変更7: Supabase 初期同期 =====
  // マウント時に gacha_pity と child_status.alt_points を読み込んで、
  // ローカルストアのpity と currentAlt を Supabase の真値に合わせる。
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pity, status] = await Promise.all([
        fetchPity(user.id),
        fetchChildStatus(user.id),
      ]);
      if (cancelled) return;
      // pity をローカルに反映
      const storeState = useGachaStore.getState();
      const normalDelta = pity.normal_pity - storeState.pityCount;
      const premiumDelta = pity.premium_pity - storeState.premiumPityCount;
      if (normalDelta !== 0) {
        if (normalDelta > 0) for (let i = 0; i < normalDelta; i++) storeState.incrementPity(false);
        else storeState.resetPity(false);
      }
      if (premiumDelta !== 0) {
        if (premiumDelta > 0) for (let i = 0; i < premiumDelta; i++) storeState.incrementPity(true);
        else storeState.resetPity(true);
      }
      // ALT balance をローカル user.currentAlt に合わせる
      if (status) {
        const diff = status.alt_points - user.currentAlt;
        if (diff !== 0) updateAlt(diff);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // コレクション初期化（まだ未初期化の場合）
  useEffect(() => {
    if (collectionInitialized) return;
    const auth = getAuth();
    const childId = auth?.childId ?? 'guest';
    computeOwnership(childId).then(({ ownedNames }) => {
      const ids = COLLECTION_CARDS
        .filter((c) => ownedNames.has(c.name))
        .map((c) => c.id);
      initOwned(ids);
    });
  }, [collectionInitialized, initOwned]);

  const burstParticles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * Math.PI * 2;
      const dist = 80 + Math.random() * 120;
      return { id: i, tx: Math.cos(angle) * dist, ty: Math.sin(angle) * dist, delay: Math.random() * 0.3, size: 3 + Math.random() * 5 };
    }), []);

  // 1回引き（変更7: Supabase に ALT 減算 / pity 更新 / pull 履歴を永続化）
  const handlePull = useCallback(async (type: 'normal' | 'premium') => {
    const cost = type === 'normal' ? GACHA_COSTS.NORMAL : GACHA_COSTS.PREMIUM;
    if (user.currentAlt < cost) { toast.error('ALTが足りません'); return; }
    if (phase !== 'idle' && phase !== 'reveal' && phase !== 'multi_reveal') return;

    // Supabase 側で ALT を減算。失敗したらアニメーションを開始しない。
    const spend = await spendAltForGacha(user.id, cost);
    if (!spend.ok) {
      toast.error(spend.reason === 'insufficient_alt' ? 'ALTが足りません' : '通信エラー');
      return;
    }
    // 変更18: altGuard 経由で消費理由を明示
    spendAlt(updateAlt, cost, type === 'premium' ? 'gacha_premium' : 'gacha_normal');

    setGachaType(type);
    setPulledCard(null);
    setPulledCards([]);
    setIsDuplicate(false);
    setPhase('shake');

    const currentPity = type === 'premium' ? premiumPityCount : pityCount;
    const rarity = rollRarity(type === 'premium', currentPity, playerLevel);
    const card = pickFromPool(rarity);

    // 新しい pity 値を計算（ローカル + Supabase 両方に反映）
    let newNormal = pityCount;
    let newPremium = premiumPityCount;
    if (rarity === 'SSR' || rarity === 'SR') {
      if (type === 'premium') newPremium = 0; else newNormal = 0;
      resetPity(type === 'premium');
    } else {
      if (type === 'premium') newPremium += 1; else newNormal += 1;
      incrementPity(type === 'premium');
    }
    void savePity(user.id, newNormal, newPremium);
    void recordPulls([{
      child_id: user.id,
      card_id: card.id,
      rarity,
      gacha_type: type,
      pity_count: type === 'premium' ? newPremium : newNormal,
    }]);

    const alreadyOwned = ownedCardIds.has(card.id);
    setIsDuplicate(alreadyOwned);
    addCard(card.id);

    updateMissionProgress(type === 'premium' ? 'mission-004' : 'mission-002', 1);
    if (rarity === 'SR' || rarity === 'SSR') updateMissionProgress('mission-005', 1);

    addHistory({
      id: `${Date.now()}-${Math.random()}`,
      card,
      gachaType: type,
      timestamp: Date.now(),
      isDuplicate: alreadyOwned,
    });

    const isSSR = rarity === 'SSR';
    const isSR = rarity === 'SR';
    const burstDuration = isSSR ? 2000 : isSR ? 1500 : 800;
    setTimeout(() => { setPulledCard(card); setPhase('burst'); }, 500);
    setTimeout(() => setPhase('flip'), 500 + burstDuration);
    setTimeout(() => setPhase('reveal'), 500 + burstDuration + 600);
  }, [user.currentAlt, user.id, phase, updateAlt, pityCount, premiumPityCount, incrementPity, resetPity, addCard, addHistory, ownedCardIds, playerLevel, updateMissionProgress]);

  // 10連引き（変更7: Supabase に ALT 減算 / pity 更新 / 10件バルク履歴保存）
  const handlePull10 = useCallback(async (type: 'normal' | 'premium') => {
    const cost = (type === 'normal' ? GACHA_COSTS.NORMAL : GACHA_COSTS.PREMIUM) * 10;
    if (user.currentAlt < cost) { toast.error('ALTが足りません'); return; }
    if (phase !== 'idle' && phase !== 'reveal' && phase !== 'multi_reveal') return;

    const spend = await spendAltForGacha(user.id, cost);
    if (!spend.ok) {
      toast.error(spend.reason === 'insufficient_alt' ? 'ALTが足りません' : '通信エラー');
      return;
    }
    // 変更18: altGuard 経由で消費理由を明示
    spendAlt(updateAlt, cost, type === 'premium' ? 'gacha_premium_10' : 'gacha_normal_10');

    setGachaType(type);
    setPulledCard(null);
    setPhase('shake');

    let currentPity = type === 'premium' ? premiumPityCount : pityCount;
    const cards: CollectionCard[] = [];
    const rarities: CollectionRarity[] = [];
    const pityAtEachPull: number[] = [];
    let hasSROrAbove = false;

    for (let i = 0; i < 10; i++) {
      let rarity: CollectionRarity;
      if (i === 9 && !hasSROrAbove) {
        rarity = type === 'premium'
          ? (Math.random() < 0.30 ? 'SSR' : 'SR')
          : (Math.random() < 0.10 ? 'SSR' : 'SR');
        resetPity(type === 'premium');
        currentPity = 0;
      } else {
        rarity = rollRarity(type === 'premium', currentPity, playerLevel);
        if (rarity === 'SSR' || rarity === 'SR') {
          hasSROrAbove = true;
          resetPity(type === 'premium');
          currentPity = 0;
        } else {
          currentPity++;
        }
      }
      rarities.push(rarity);
      pityAtEachPull.push(currentPity);
      cards.push(pickFromPool(rarity));
    }

    // ローカル store の pity を最終値に補正
    if (type === 'premium') {
      for (let i = 0; i < currentPity; i++) incrementPity(true);
    } else {
      for (let i = 0; i < currentPity; i++) incrementPity(false);
    }

    // Supabase: pity 保存 + 10件バルク履歴
    const finalNormal = type === 'premium' ? pityCount : currentPity;
    const finalPremium = type === 'premium' ? currentPity : premiumPityCount;
    void savePity(user.id, finalNormal, finalPremium);
    void recordPulls(cards.map((c, i) => ({
      child_id: user.id,
      card_id: c.id,
      rarity: rarities[i],
      gacha_type: type,
      pity_count: pityAtEachPull[i],
    })));

    const cardIds = cards.map((c) => c.id);
    addCards(cardIds);

    updateMissionProgress(type === 'premium' ? 'mission-004' : 'mission-002', 10);
    const srAboveCount = cards.filter((c) => c.rarity === 'SR' || c.rarity === 'SSR').length;
    if (srAboveCount > 0) updateMissionProgress('mission-005', 1);

    cards.forEach((card) => {
      addHistory({
        id: `${Date.now()}-${Math.random()}`,
        card,
        gachaType: type,
        timestamp: Date.now(),
        isDuplicate: ownedCardIds.has(card.id),
      });
    });

    setPulledCards(cards);
    setTimeout(() => setPhase('multi_reveal'), 1000);
  }, [user.currentAlt, user.id, phase, updateAlt, pityCount, premiumPityCount, incrementPity, resetPity, addCards, addHistory, ownedCardIds, playerLevel, updateMissionProgress]);

  const handleDismiss = () => { setPhase('idle'); setPulledCard(null); setPulledCards([]); };

  const rarityColor = pulledCard ? RARITY_COLOR_MAP[pulledCard.rarity] : '#ffd700';
  const isSSR = pulledCard?.rarity === 'SSR';
  const isHighRarity = pulledCard && (pulledCard.rarity === 'SR' || pulledCard.rarity === 'SSR');
  const pityRemaining = PITY_LIMIT_NORMAL - pityCount;
  const premiumPityRemaining = PITY_LIMIT_PREMIUM - premiumPityCount;

  return (
    <div className="relative min-h-full">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GACHA_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.6) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Title + ALT + History Button */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎰</span>
            <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>ガチャ</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
              <span className="text-xs font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>{user.currentAlt.toLocaleString()}</span>
            </div>
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
              style={showHistory
                ? { background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.4)' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span className="text-sm">📜</span>
            </button>
          </div>
        </div>

        {/* 履歴パネル */}
        {showHistory && (
          <div className="mb-4 rounded-xl overflow-hidden" style={{ background: 'rgba(11,17,40,0.95)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <div className="px-3 py-2 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,215,0,0.1)' }}>
              <p className="text-[11px] font-bold text-amber-200/70">ガチャ履歴（直近{Math.min(history.length, 20)}件）</p>
              <span className="text-[10px] text-amber-200/30">{history.length}件</span>
            </div>
            {history.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-[11px] text-amber-200/30">まだガチャを引いていません</p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {history.slice(0, 20).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="relative w-7 h-9 rounded overflow-hidden flex-shrink-0">
                      <img src={entry.card.imageUrl} alt={entry.card.name} className="w-full h-full object-cover" />
                      <img src={CARD_RARITY_IMAGES[entry.card.rarity] || CARD_RARITY_IMAGES['N']} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-amber-100 truncate">{entry.card.name}</p>
                      <p className="text-[9px] text-amber-200/30">{entry.gachaType === 'premium' ? 'プレミアム' : 'ノーマル'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${RARITY_COLOR_MAP[entry.card.rarity]}25`, color: RARITY_COLOR_MAP[entry.card.rarity] }}>
                        {entry.card.rarity}
                      </span>
                      {entry.isDuplicate && <span className="text-[8px] text-amber-200/25">重複</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Animation Area */}
        {(phase === 'shake' || phase === 'burst' || phase === 'flip' || phase === 'reveal') && (
          <div className="flex items-center justify-center" style={{ minHeight: '360px' }}>
            {/* SHAKE PHASE */}
            {phase === 'shake' && (
              <div className="text-center">
                <div className="w-44 h-44 mx-auto flex items-center justify-center" style={{ animation: 'shake 0.5s ease-in-out' }}>
                  <img src={gachaType === 'premium' ? IMAGES.GACHA_PREMIUM_BTN : IMAGES.GACHA_NORMAL_BTN} alt="宝箱"
                    className="w-40 h-40 object-contain" style={{ filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.4))' }} />
                </div>
              </div>
            )}

            {/* BURST PHASE */}
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
                <div className="w-48 h-64 rounded-2xl flex items-center justify-center overflow-hidden relative"
                  style={{
                    boxShadow: `0 0 24px ${rarityColor}44`,
                    animation: isSSR ? 'card-flip 0.6s ease-out, rainbow-border 2s linear infinite' : 'card-flip 0.6s ease-out',
                    backfaceVisibility: 'hidden',
                  }}>
                  <img src={pulledCard.imageUrl} alt={pulledCard.name} className="w-full h-full object-cover" />
                  <img src={CARD_RARITY_IMAGES[pulledCard.rarity] || CARD_RARITY_IMAGES['N']} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2 }} />
                </div>
              </div>
            )}

            {/* REVEAL PHASE (1枚) */}
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
                <div className="w-52 mx-auto rounded-xl overflow-hidden relative"
                  style={{
                    boxShadow: `0 0 32px ${rarityColor}33, 0 8px 24px rgba(0,0,0,0.5)`,
                    animation: isSSR ? 'rainbow-border 2s linear infinite' : `glow-pulse 2s ease-in-out infinite`,
                    '--glow-color': rarityColor,
                  } as React.CSSProperties}>
                  <div className="relative" style={{ aspectRatio: '3/4' }}>
                    <img src={pulledCard.imageUrl} alt={pulledCard.name} className="w-full h-full object-cover" />
                    {/* Frame overlay */}
                    <img src={CARD_RARITY_IMAGES[pulledCard.rarity] || CARD_RARITY_IMAGES['N']} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2 }} />
                    {isHighRarity && Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="absolute w-1 h-1 rounded-full" style={{
                        background: rarityColor,
                        top: `${15 + Math.random() * 70}%`, left: `${10 + Math.random() * 80}%`,
                        animation: `sparkle ${0.8 + Math.random() * 1.2}s ease-in-out ${Math.random() * 0.5}s infinite`,
                        boxShadow: `0 0 4px ${rarityColor}`,
                        zIndex: 3,
                      }} />
                    ))}
                    {/* Card name on frame */}
                    <span
                      className="absolute left-0 right-0 text-center font-bold text-white truncate px-3"
                      style={{
                        bottom: '30px',
                        fontSize: '16px',
                        textShadow: '0 2px 6px rgba(0,0,0,0.95), 0 0 3px rgba(0,0,0,0.8)',
                        zIndex: 3,
                      }}
                    >
                      {pulledCard.name}
                    </span>
                  </div>
                  <div className="px-3 py-2 text-center" style={{ background: `linear-gradient(to top, rgba(11,17,40,0.95), rgba(11,17,40,0.7))`, borderTop: `1px solid ${rarityColor}33` }}>
                    <div className="flex justify-center gap-0.5 mb-1">
                      {Array.from({ length: pulledCard.rarity === 'SSR' ? 4 : pulledCard.rarity === 'SR' ? 3 : pulledCard.rarity === 'R' ? 2 : 1 }).map((_, i) => (
                        <span key={i} className="text-sm" style={{ color: rarityColor }}>★</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-amber-200/50 mt-0.5">{categoryEmoji[pulledCard.category]} {pulledCard.description.slice(0, 30)}…</p>
                  </div>
                </div>
                {isDuplicate && <p className="text-xs text-amber-200/40 mt-2">すでに持っているカードです</p>}
                <button onClick={handleDismiss} className="rpg-btn rpg-btn-gold mt-4 px-8 py-2.5">OK</button>
              </div>
            )}
          </div>
        )}

        {/* 10連REVEAL PHASE */}
        {phase === 'multi_reveal' && pulledCards.length > 0 && (
          <div style={{ animation: 'scale-in 0.3s ease-out' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-amber-200/70">10連結果</p>
              <div className="flex gap-1">
                {(['SSR', 'SR', 'R', 'N'] as CollectionRarity[]).map((r) => {
                  const cnt = pulledCards.filter((c) => c.rarity === r).length;
                  if (cnt === 0) return null;
                  return (
                    <span key={r} className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ background: `${RARITY_COLOR_MAP[r]}20`, color: RARITY_COLOR_MAP[r], border: `1px solid ${RARITY_COLOR_MAP[r]}40` }}>
                      {r}×{cnt}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5 mb-4">
              {pulledCards.map((card, i) => {
                const rc = RARITY_COLOR_MAP[card.rarity];
                const isNew = !ownedCardIds.has(card.id);
                return (
                  <div key={i} className="relative rounded-lg overflow-hidden"
                    style={{
                      boxShadow: card.rarity === 'SSR' ? `0 0 10px ${rc}66` : card.rarity === 'SR' ? `0 0 6px ${rc}44` : 'none',
                      animation: `scale-in 0.3s ease-out ${i * 0.05}s both`,
                    }}>
                    <div className="relative" style={{ aspectRatio: '3/4' }}>
                      <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                      {/* Frame overlay */}
                      <img src={CARD_RARITY_IMAGES[card.rarity] || CARD_RARITY_IMAGES['N']} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2 }} />
                      {isNew && (
                        <div className="absolute top-0.5 right-0.5" style={{ zIndex: 3 }}>
                          <span className="text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.9)', color: '#fff' }}>NEW</span>
                        </div>
                      )}
                      {/* Card name on frame */}
                      <span
                        className="absolute left-0 right-0 text-center font-bold text-white truncate px-0.5"
                        style={{ bottom: '8px', fontSize: '7px', textShadow: '0 1px 3px rgba(0,0,0,0.95)', zIndex: 3 }}
                      >
                        {card.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <button onClick={handleDismiss} className="rpg-btn rpg-btn-gold w-full py-2.5">OK</button>
          </div>
        )}

        {/* IDLE STATE - Treasure Chest Buttons */}
        {phase === 'idle' && (
          <div className="space-y-4 mt-2">
            {/* 天井カウンター */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <p className="text-[9px] text-blue-300/50 mb-0.5">ノーマル天井まで</p>
                <p className="text-sm font-bold text-blue-300">あと{pityRemaining}回</p>
                <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(59,130,246,0.15)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(pityCount / PITY_LIMIT_NORMAL) * 100}%`, background: 'linear-gradient(90deg, #3b82f6, #60a5fa)' }} />
                </div>
              </div>
              <div className="rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.15)' }}>
                <p className="text-[9px] text-amber-200/50 mb-0.5">プレミアム天井まで</p>
                <p className="text-sm font-bold" style={{ color: '#ffd700' }}>あと{premiumPityRemaining}回</p>
                <div className="h-1 rounded-full mt-1 overflow-hidden" style={{ background: 'rgba(255,215,0,0.15)' }}>
                  <div className="h-full rounded-full" style={{ width: `${(premiumPityCount / PITY_LIMIT_PREMIUM) * 100}%`, background: 'linear-gradient(90deg, #f59e0b, #ffd700)' }} />
                </div>
              </div>
            </div>

            {/* Title area */}
            <div className="text-center">
              <p className="text-sm text-amber-200/60">宝箱をタップしてカードをゲット！</p>
            </div>

            {/* Two treasure chest buttons */}
            <div className="grid grid-cols-2 gap-4">
              {/* Normal Gacha */}
              <div className="flex flex-col gap-2">
                <button onClick={() => handlePull('normal')} disabled={user.currentAlt < GACHA_COSTS.NORMAL}
                  className="group relative flex flex-col items-center transition-all active:scale-95 disabled:opacity-30">
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2"
                    style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.08), rgba(59,130,246,0.02))', border: '2px solid rgba(59,130,246,0.3)', boxShadow: '0 0 20px rgba(59,130,246,0.1)' }}>
                    <img src={IMAGES.GACHA_NORMAL_BTN} alt="ノーマルガチャ" className="w-full h-full object-contain p-2 transition-transform group-hover:scale-105" style={{ filter: 'drop-shadow(0 4px 12px rgba(59,130,246,0.3))' }} />
                  </div>
                  <p className="text-xs font-bold text-blue-300 mb-1">ノーマル×1</p>
                  <div className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                    <div className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold" style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                    <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.NORMAL}</span>
                  </div>
                </button>
                <button onClick={() => handlePull10('normal')} disabled={user.currentAlt < GACHA_COSTS.NORMAL * 10}
                  className="group flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.05))', border: '1px solid rgba(59,130,246,0.3)' }}>
                  <span className="text-[10px] font-bold text-blue-300">10連</span>
                  <div className="flex items-center gap-0.5">
                    <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[5px] font-bold" style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                    <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.NORMAL * 10}</span>
                  </div>
                  <span className="text-[8px] text-blue-300/60 ml-0.5">SR確定</span>
                </button>
              </div>

              {/* Premium Gacha */}
              <div className="flex flex-col gap-2">
                <button onClick={() => handlePull('premium')} disabled={user.currentAlt < GACHA_COSTS.PREMIUM}
                  className="group relative flex flex-col items-center transition-all active:scale-95 disabled:opacity-30">
                  <div className="relative w-full aspect-square rounded-2xl overflow-hidden mb-2"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(168,85,247,0.05))', border: '2px solid rgba(255,215,0,0.4)', boxShadow: '0 0 24px rgba(255,215,0,0.15)', animation: 'glow-pulse 3s ease-in-out infinite', '--glow-color': '#ffd700' } as React.CSSProperties}>
                    <img src={IMAGES.GACHA_PREMIUM_BTN} alt="プレミアムガチャ" className="w-full h-full object-contain p-1 transition-transform group-hover:scale-105" style={{ filter: 'drop-shadow(0 4px 16px rgba(255,215,0,0.4))' }} />
                    <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[8px] font-bold" style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>PREMIUM</div>
                  </div>
                  <p className="text-xs font-bold mb-1" style={{ color: '#ffd700' }}>プレミアム×1</p>
                  <div className="flex items-center gap-1 px-3 py-1 rounded-lg" style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
                    <div className="w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-bold" style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                    <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.PREMIUM}</span>
                  </div>
                </button>
                <button onClick={() => handlePull10('premium')} disabled={user.currentAlt < GACHA_COSTS.PREMIUM * 10}
                  className="group flex items-center justify-center gap-1.5 py-2 rounded-xl transition-all active:scale-95 disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(168,85,247,0.08))', border: '1px solid rgba(255,215,0,0.35)' }}>
                  <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>10連</span>
                  <div className="flex items-center gap-0.5">
                    <div className="w-2.5 h-2.5 rounded-full flex items-center justify-center text-[5px] font-bold" style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                    <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>{GACHA_COSTS.PREMIUM * 10}</span>
                  </div>
                  <span className="text-[8px] text-amber-200/50 ml-0.5">SR確定</span>
                </button>
              </div>
            </div>

            {/* Rarity table */}
            <div className="rounded-xl p-3" style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.1)' }}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-blue-300/70 font-bold mb-1.5 text-center">ノーマル</p>
                  {(['SSR', 'SR', 'R', 'N'] as CollectionRarity[]).map((r) => (
                    <div key={r} className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold" style={{ color: RARITY_COLOR_MAP[r] }}>{r}</span>
                      <span className="text-[10px] text-amber-200/40">{r === 'SSR' ? '1%' : r === 'SR' ? '9%' : r === 'R' ? '30%' : '60%'}</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] font-bold mb-1.5 text-center" style={{ color: '#ffd700' }}>プレミアム</p>
                  {(['SSR', 'SR', 'R'] as CollectionRarity[]).map((r) => (
                    <div key={r} className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-bold" style={{ color: RARITY_COLOR_MAP[r] }}>{r}</span>
                      <span className="text-[10px] text-amber-200/40">{r === 'SSR' ? '15%' : r === 'SR' ? '35%' : '50%'}</span>
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
