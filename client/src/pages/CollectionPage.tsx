/*
 * CollectionPage: 50枚カードコレクション画面
 * - CollectionStore連携: ガチャで引いたカードが自動反映
 * - NEWバッジ: 初取得カードに表示
 * - ソート機能: レア度順・取得順・名前順
 * - カード詳細モーダル: フリップアニメーション＋レア度別エフェクト
 * - コンプリート率: カテゴリ別進捗バー表示
 * ファンタジーRPG風ダークブルー＋ゴールドアクセント
 */
import { useState, useMemo, useEffect } from 'react';
import { COLLECTION_CARDS } from '@/lib/cardData';
import { CARD_RARITY_COLORS, CARD_CATEGORY_INFO } from '@/lib/constants';
import { useCollectionStore } from '@/lib/stores';
import type { CollectionCard, CollectionRarity } from '@/lib/types';

const categoryTabs = [
  { id: 'all', label: 'すべて' },
  { id: 'great_people', label: '偉人' },
  { id: 'creatures', label: '生き物' },
  { id: 'world_heritage', label: '世界遺産' },
  { id: 'inventions', label: '発明' },
  { id: 'discovery', label: '探究' },
];

const rarityTabs: { id: string; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'N', label: 'N' },
  { id: 'R', label: 'R' },
  { id: 'SR', label: 'SR' },
  { id: 'SSR', label: 'SSR' },
];

const sortTabs = [
  { id: 'default', label: 'デフォルト' },
  { id: 'rarity', label: 'レア度順' },
  { id: 'acquired', label: '取得順' },
  { id: 'name', label: '名前順' },
];

const CATEGORY_CARDS: Record<string, CollectionCard[]> = {
  great_people: COLLECTION_CARDS.filter((c) => c.category === 'great_people'),
  creatures: COLLECTION_CARDS.filter((c) => c.category === 'creatures'),
  world_heritage: COLLECTION_CARDS.filter((c) => c.category === 'world_heritage'),
  inventions: COLLECTION_CARDS.filter((c) => c.category === 'inventions'),
  discovery: COLLECTION_CARDS.filter((c) => c.category === 'discovery'),
};

function getRarityBadgeStyle(rarity: CollectionRarity) {
  const color = CARD_RARITY_COLORS[rarity];
  if (rarity === 'SSR') {
    return {
      background: 'linear-gradient(135deg, #a855f7, #ec4899, #8b5cf6)',
      color: '#fff',
      textShadow: '0 0 4px rgba(168,85,247,0.5)',
    };
  }
  if (rarity === 'SR') {
    return {
      background: 'linear-gradient(135deg, #f59e0b, #d97706)',
      color: '#fff',
      textShadow: '0 0 4px rgba(245,158,11,0.5)',
    };
  }
  return {
    background: `${color}30`,
    color: color,
  };
}

function getRarityBorderStyle(rarity: CollectionRarity) {
  const c = CARD_RARITY_COLORS[rarity];
  if (rarity === 'SSR') return { border: '2px solid transparent', backgroundImage: 'linear-gradient(rgba(11,17,40,1), rgba(11,17,40,1)), linear-gradient(135deg, #a855f7, #ec4899, #3b82f6, #22c55e, #a855f7)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box', boxShadow: `0 0 16px rgba(168,85,247,0.5)` };
  if (rarity === 'SR') return { border: `2px solid ${c}`, boxShadow: `0 0 12px ${c}55` };
  if (rarity === 'R') return { border: `2px solid ${c}`, boxShadow: `0 0 8px ${c}33` };
  return { border: `2px solid ${c}55`, boxShadow: 'none' };
}

// カード詳細モーダル
function CardModal({ card, onClose }: { card: CollectionCard; onClose: () => void }) {
  const [flipped, setFlipped] = useState(false);
  const clearNew = useCollectionStore((s) => s.clearNew);
  const rarityColor = CARD_RARITY_COLORS[card.rarity];
  const isSSR = card.rarity === 'SSR';
  const stars = card.rarity === 'SSR' ? 4 : card.rarity === 'SR' ? 3 : card.rarity === 'R' ? 2 : 1;

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleClose = () => {
    clearNew(card.id);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className="relative"
        style={{ perspective: '1000px', width: '260px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* フリップコンテナ */}
        <div
          style={{
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: flipped ? 'rotateY(0deg)' : 'rotateY(-90deg)',
          }}
        >
          <div
            className="rounded-2xl overflow-hidden relative"
            style={{ ...getRarityBorderStyle(card.rarity) }}
          >
            {/* 角の装飾 */}
            <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 z-10" style={{ borderColor: `${rarityColor}88` }} />
            <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 z-10" style={{ borderColor: `${rarityColor}88` }} />
            <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 z-10" style={{ borderColor: `${rarityColor}88` }} />
            <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 z-10" style={{ borderColor: `${rarityColor}88` }} />

            {/* カテゴリ＋レア度ヘッダー */}
            <div className="px-4 py-2 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${rarityColor}20, transparent)`, borderBottom: `1px solid ${rarityColor}33` }}>
              <span className="text-[10px] text-amber-200/50">
                {CARD_CATEGORY_INFO[card.category]?.emoji} {CARD_CATEGORY_INFO[card.category]?.label}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={getRarityBadgeStyle(card.rarity)}>
                {card.rarity}
              </span>
            </div>

            {/* カード画像 */}
            <div className="relative">
              <img src={card.imageUrl} alt={card.name} className="w-full aspect-[3/4] object-cover" />
              {/* SSRシマーエフェクト */}
              {isSSR && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.08), rgba(139,92,246,0.15))', animation: 'shimmer 3s ease-in-out infinite' }} />
              )}
              {/* SRスパークル */}
              {(card.rarity === 'SR' || isSSR) && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="absolute w-1 h-1 rounded-full pointer-events-none" style={{
                  background: rarityColor,
                  top: `${10 + (i * 15)}%`, left: `${5 + (i * 16)}%`,
                  animation: `sparkle ${1 + i * 0.3}s ease-in-out ${i * 0.2}s infinite`,
                  boxShadow: `0 0 4px ${rarityColor}`,
                }} />
              ))}
            </div>

            {/* カード情報フッター */}
            <div className="px-4 pb-4 pt-3 text-center"
              style={{ background: 'linear-gradient(to top, rgba(11,17,40,0.98), rgba(21,29,59,0.95))', borderTop: `1px solid ${rarityColor}33` }}>
              <div className="flex justify-center gap-0.5 mb-1.5">
                {Array.from({ length: stars }).map((_, i) => (
                  <span key={i} className="text-sm" style={{ color: rarityColor }}>★</span>
                ))}
              </div>
              <h3 className="text-base font-bold text-amber-100 mb-2">{card.name}</h3>
              <p className="text-[11px] text-amber-200/55 mb-4 leading-relaxed">{card.description}</p>
              <button onClick={handleClose} className="rpg-btn rpg-btn-gold w-full">閉じる</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeRarity, setActiveRarity] = useState('all');
  const [activeSort, setActiveSort] = useState('default');
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);
  const [showProgress, setShowProgress] = useState(false);

  // CollectionStoreから所持カード・NEW状態を取得
  const ownedCardIds = useCollectionStore((s) => s.ownedCardIds);
  const newCardIds = useCollectionStore((s) => s.newCardIds);
  const acquiredOrder = useCollectionStore((s) => s.acquiredOrder);
  const ownedCount = ownedCardIds.size;

  const filteredCards = useMemo(() => {
    let cards = COLLECTION_CARDS.filter((c) => {
      if (activeCategory !== 'all' && c.category !== activeCategory) return false;
      if (activeRarity !== 'all' && c.rarity !== activeRarity) return false;
      return true;
    });

    // ソート処理
    if (activeSort === 'rarity') {
      const rarityOrder: Record<CollectionRarity, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
      cards.sort((a, b) => rarityOrder[a.rarity] - rarityOrder[b.rarity]);
    } else if (activeSort === 'acquired') {
      cards.sort((a, b) => {
        const aIdx = acquiredOrder.indexOf(a.id);
        const bIdx = acquiredOrder.indexOf(b.id);
        return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
      });
    } else if (activeSort === 'name') {
      cards.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    }

    return cards;
  }, [activeCategory, activeRarity, activeSort, acquiredOrder]);

  // カテゴリ別コンプリート率
  const categoryProgress = useMemo(() => {
    return Object.entries(CATEGORY_CARDS).map(([catId, cards]) => {
      const owned = cards.filter((c) => ownedCardIds.has(c.id)).length;
      const total = cards.length;
      const pct = Math.round((owned / total) * 100);
      const info = CARD_CATEGORY_INFO[catId];
      return { catId, label: info?.label ?? catId, emoji: info?.emoji ?? '📦', owned, total, pct };
    });
  }, [ownedCardIds]);

  return (
    <div className="px-4 pt-4 pb-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 10px rgba(168,85,247,0.3)' }}>
            <span className="text-lg">🃏</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>カードコレクション</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
            style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
            <span className="text-[10px] text-amber-200/40">所持</span>
            <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{ownedCount}</span>
            <span className="text-[10px] text-amber-200/30">/{COLLECTION_CARDS.length}</span>
          </div>
          <button
            onClick={() => setShowProgress(!showProgress)}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all"
            style={showProgress
              ? { background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.4)' }
              : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className="text-sm">📊</span>
          </button>
        </div>
      </div>

      {/* コンプリート率パネル */}
      {showProgress && (
        <div className="mb-4 rounded-xl p-3 space-y-2.5"
          style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.12)' }}>
          <p className="text-[10px] text-amber-200/50 font-bold mb-2">カテゴリ別コンプリート率</p>
          {categoryProgress.map(({ catId, label, emoji, owned, total, pct }) => (
            <div key={catId}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-amber-200/70">{emoji} {label}</span>
                <span className="text-[10px] font-bold" style={{ color: pct === 100 ? '#22c55e' : '#ffd700' }}>
                  {owned}/{total} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100
                      ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                      : 'linear-gradient(90deg, #f59e0b, #ffd700)',
                  }}
                />
              </div>
            </div>
          ))}
          {/* 全体コンプリート率 */}
          <div className="pt-2 border-t border-amber-200/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-amber-200/80">🏆 全体</span>
              <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>
                {ownedCount}/{COLLECTION_CARDS.length} ({Math.round((ownedCount / COLLECTION_CARDS.length) * 100)}%)
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.round((ownedCount / COLLECTION_CARDS.length) * 100)}%`,
                  background: 'linear-gradient(90deg, #a855f7, #ffd700)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* カテゴリタブ */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
        {categoryTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveCategory(tab.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={activeCategory === tab.id ? {
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))',
              color: '#ffd700', border: '1px solid rgba(255,215,0,0.35)', boxShadow: '0 0 8px rgba(255,215,0,0.1)',
            } : {
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)',
            }}>
            {tab.id !== 'all' && CARD_CATEGORY_INFO[tab.id] ? `${CARD_CATEGORY_INFO[tab.id].emoji} ` : ''}{tab.label}
          </button>
        ))}
      </div>

      {/* レア度フィルタ */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
        {rarityTabs.map((tab) => {
          const color = tab.id !== 'all' ? CARD_RARITY_COLORS[tab.id as CollectionRarity] : '#ffd700';
          return (
            <button key={tab.id} onClick={() => setActiveRarity(tab.id)}
              className="flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
              style={activeRarity === tab.id ? {
                background: `${color}25`,
                color: color, border: `1px solid ${color}55`,
              } : {
                background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)',
              }}>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ソートタブ */}
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
        {sortTabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveSort(tab.id)}
            className="flex-shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all"
            style={activeSort === tab.id ? {
              background: 'rgba(168,85,247,0.2)',
              color: '#d8b4fe', border: '1px solid rgba(168,85,247,0.5)',
            } : {
              background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* カードグリッド */}
      <div className="grid grid-cols-3 gap-2.5">
        {filteredCards.map((card, i) => {
          const owned = ownedCardIds.has(card.id);
          const isNew = newCardIds.has(card.id);
          const rarityColor = CARD_RARITY_COLORS[card.rarity];
          return (
            <button
              key={card.id}
              onClick={() => owned ? setSelectedCard(card) : undefined}
              className="rounded-xl overflow-hidden transition-all duration-200 relative"
              style={{
                animationDelay: `${i * 30}ms`,
                opacity: owned ? 1 : 0.35,
                filter: owned ? 'none' : 'grayscale(1)',
                ...(owned ? getRarityBorderStyle(card.rarity) : { border: '2px solid rgba(255,255,255,0.06)' }),
              }}
            >
              {/* カード画像 */}
              <div className="aspect-[3/4] relative overflow-hidden">
                {owned ? (
                  <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: 'rgba(10,15,35,0.8)' }}>
                    <span className="text-3xl opacity-30">❓</span>
                  </div>
                )}
                {/* レア度バッジ */}
                {owned && (
                  <div className="absolute top-1 right-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={getRarityBadgeStyle(card.rarity)}>
                      {card.rarity}
                    </span>
                  </div>
                )}
                {/* NEWバッジ */}
                {owned && isNew && (
                  <div className="absolute top-1 left-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: '#fff',
                        textShadow: '0 0 4px rgba(239,68,68,0.5)',
                        animation: 'pulse 2s ease-in-out infinite',
                      }}>
                      NEW
                    </span>
                  </div>
                )}
                {/* SSRシマーエフェクト */}
                {owned && card.rarity === 'SSR' && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.05), rgba(139,92,246,0.1))', animation: 'shimmer 3s ease-in-out infinite' }} />
                )}
              </div>
              {/* カード名 */}
              <div className="px-1.5 py-1.5 text-center"
                style={{ borderTop: `1px solid ${owned ? rarityColor + '25' : 'rgba(255,255,255,0.04)'}`, background: 'rgba(11,17,40,0.7)' }}>
                <p className="text-[10px] font-bold text-amber-100 truncate">{owned ? card.name : '???'}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* フィルタ結果が0件の場合 */}
      {filteredCards.length === 0 && (
        <div className="text-center py-12">
          <span className="text-4xl mb-3 block">🔍</span>
          <p className="text-sm text-amber-200/40">該当するカードがありません</p>
        </div>
      )}

      {/* カード詳細モーダル */}
      {selectedCard && <CardModal card={selectedCard} onClose={() => setSelectedCard(null)} />}

      <style>{`
        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
        @keyframes sparkle {
          0%, 100% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
