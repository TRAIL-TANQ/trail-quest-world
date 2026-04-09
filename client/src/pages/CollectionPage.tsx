/*
 * CollectionPage: 50枚カードコレクション画面
 * カテゴリタブ + レア度フィルタ付き
 * レア度別カード枠: N=グレー, R=青, SR=金, SSR=虹/紫（CSS実装）
 * ファンタジーRPG風ダークブルー＋ゴールドアクセント
 */
import { useState, useMemo } from 'react';
import { COLLECTION_CARDS } from '@/lib/cardData';
import { CARD_RARITY_COLORS, CARD_CATEGORY_INFO } from '@/lib/constants';
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

// レア度別のカード枠CSSクラス名を取得
function getCardFrameClass(rarity: CollectionRarity, owned: boolean): string {
  if (!owned) return 'card-frame-locked';
  return `card-frame-${rarity.toLowerCase()}`;
}

// レア度バッジの背景
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

export default function CollectionPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeRarity, setActiveRarity] = useState('all');
  const [selectedCard, setSelectedCard] = useState<CollectionCard | null>(null);

  // デモ用: 最初の20枚を所持済みとする
  const ownedCardIds = useMemo(() => new Set(COLLECTION_CARDS.slice(0, 20).map((c) => c.id)), []);

  const filteredCards = useMemo(() => {
    return COLLECTION_CARDS.filter((c) => {
      if (activeCategory !== 'all' && c.category !== activeCategory) return false;
      if (activeRarity !== 'all' && c.rarity !== activeRarity) return false;
      return true;
    });
  }, [activeCategory, activeRarity]);

  const ownedCount = COLLECTION_CARDS.filter((c) => ownedCardIds.has(c.id)).length;

  return (
    <div className="px-4 pt-4 pb-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #a855f7, #7c3aed)', boxShadow: '0 0 10px rgba(168,85,247,0.3)' }}>
            <span className="text-lg">🃏</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>カードコレクション</h1>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
          style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
          <span className="text-[10px] text-amber-200/40">所持</span>
          <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{ownedCount}</span>
          <span className="text-[10px] text-amber-200/30">/{COLLECTION_CARDS.length}</span>
        </div>
      </div>

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
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
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

      {/* カードグリッド */}
      <div className="grid grid-cols-3 gap-2.5">
        {filteredCards.map((card, i) => {
          const owned = ownedCardIds.has(card.id);
          const frameClass = getCardFrameClass(card.rarity, owned);
          return (
            <button key={card.id} onClick={() => owned ? setSelectedCard(card) : null}
              className={`rounded-xl overflow-hidden transition-all duration-200 animate-slide-up relative ${frameClass}`}
              style={{
                animationDelay: `${i * 30}ms`,
                opacity: owned ? 1 : 0.35,
                filter: owned ? 'none' : 'grayscale(1)',
              }}>
              {/* カード画像 */}
              <div className="aspect-[3/4] relative overflow-hidden">
                {owned ? (
                  <img
                    src={card.imageUrl}
                    alt={card.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"
                    style={{ background: 'rgba(10,15,35,0.8)' }}>
                    <span className="text-3xl opacity-30">❓</span>
                  </div>
                )}
                {/* レア度バッジ */}
                {owned && (
                  <div className="absolute top-1 right-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                      style={getRarityBadgeStyle(card.rarity)}>
                      {card.rarity}
                    </span>
                  </div>
                )}
                {/* SSRの虹エフェクト */}
                {owned && card.rarity === 'SSR' && (
                  <div className="absolute inset-0 pointer-events-none"
                    style={{
                      background: 'linear-gradient(135deg, rgba(168,85,247,0.1), rgba(236,72,153,0.05), rgba(139,92,246,0.1))',
                      animation: 'shimmer 3s ease-in-out infinite',
                    }} />
                )}
              </div>
              {/* カード名 */}
              <div className="px-1.5 py-1.5 text-center"
                style={{ borderTop: `1px solid ${owned ? CARD_RARITY_COLORS[card.rarity] + '25' : 'rgba(255,255,255,0.04)'}` }}>
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
      {selectedCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedCard(null)}>
          <div className={`w-full max-w-[280px] rounded-2xl overflow-hidden animate-bounce-in relative card-frame-modal-${selectedCard.rarity.toLowerCase()}`}
            onClick={(e) => e.stopPropagation()}>
            {/* 角の装飾 */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: `${CARD_RARITY_COLORS[selectedCard.rarity]}88` }} />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: `${CARD_RARITY_COLORS[selectedCard.rarity]}88` }} />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: `${CARD_RARITY_COLORS[selectedCard.rarity]}88` }} />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: `${CARD_RARITY_COLORS[selectedCard.rarity]}88` }} />

            {/* レア度ヘッダー */}
            <div className="px-4 py-2 flex items-center justify-between"
              style={{ background: `linear-gradient(135deg, ${CARD_RARITY_COLORS[selectedCard.rarity]}25, transparent)`, borderBottom: `1px solid ${CARD_RARITY_COLORS[selectedCard.rarity]}33` }}>
              <span className="text-[10px] text-amber-200/50">
                {CARD_CATEGORY_INFO[selectedCard.category]?.emoji} {CARD_CATEGORY_INFO[selectedCard.category]?.label}
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded"
                style={getRarityBadgeStyle(selectedCard.rarity)}>
                {selectedCard.rarity}
              </span>
            </div>

            {/* カード画像 */}
            <div className="relative">
              <img
                src={selectedCard.imageUrl}
                alt={selectedCard.name}
                className="w-full aspect-[3/4] object-cover"
              />
              {selectedCard.rarity === 'SSR' && (
                <div className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.08), rgba(139,92,246,0.15))',
                    animation: 'shimmer 3s ease-in-out infinite',
                  }} />
              )}
            </div>

            {/* カード情報 */}
            <div className="px-4 pb-4 pt-3 text-center">
              <h3 className="text-lg font-bold text-amber-100 mb-2">{selectedCard.name}</h3>
              <p className="text-xs text-amber-200/55 mb-4 leading-relaxed">{selectedCard.description}</p>
              <button onClick={() => setSelectedCard(null)} className="rpg-btn rpg-btn-gold w-full">閉じる</button>
            </div>
          </div>
        </div>
      )}

      {/* カード枠スタイル定義 */}
      <style>{`
        /* 共通カード枠スタイル */
        .card-frame-n,
        .card-frame-r,
        .card-frame-sr,
        .card-frame-ssr {
          border: 3px solid;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          background: linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95));
          position: relative;
        }

        /* N（ノーマル）: グレー枠 */
        .card-frame-n {
          border-color: #9ca3af;
        }

        /* R（レア）: 薄いゴールド枠 */
        .card-frame-r {
          border-color: #d4a574;
        }

        /* SR（スーパーレア）: 濃いゴールド枠 */
        .card-frame-sr {
          border-color: #f59e0b;
        }

        /* SSR（スーパースーパーレア）: 虹色グラデーション枠 */
        .card-frame-ssr {
          border: 3px solid;
          border-image: linear-gradient(135deg, #a855f7, #ec4899, #8b5cf6, #f59e0b) 1;
          box-shadow: 0 0 12px rgba(168,85,247,0.4), 0 0 24px rgba(168,85,247,0.15), 0 2px 8px rgba(0,0,0,0.3);
        }

        /* SSR内側装飾線 */
        .card-frame-ssr::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid rgba(168,85,247,0.5);
          border-radius: 0.75rem;
          pointer-events: none;
          margin: 3px;
        }

        /* 未所持カード */
        .card-frame-locked {
          border: 3px solid rgba(255,255,255,0.06);
          box-shadow: none;
          background: rgba(255,255,255,0.02);
        }

        /* モーダル用カード枠 */
        .card-frame-modal-n,
        .card-frame-modal-r,
        .card-frame-modal-sr,
        .card-frame-modal-ssr {
          border: 3px solid;
          box-shadow: 0 0 30px rgba(0,0,0,0.5), 0 8px 32px rgba(0,0,0,0.7);
          background: linear-gradient(135deg, rgba(21,29,59,0.98), rgba(11,17,40,0.98));
          position: relative;
        }

        .card-frame-modal-n {
          border-color: #9ca3af;
        }

        .card-frame-modal-r {
          border-color: #d4a574;
        }

        .card-frame-modal-sr {
          border-color: #f59e0b;
        }

        .card-frame-modal-ssr {
          border: 3px solid;
          border-image: linear-gradient(135deg, #a855f7, #ec4899, #8b5cf6, #f59e0b) 1;
          box-shadow: 0 0 30px rgba(168,85,247,0.4), 0 0 60px rgba(168,85,247,0.2), 0 8px 32px rgba(0,0,0,0.7);
        }

        /* モーダルSSR内側装飾線 */
        .card-frame-modal-ssr::before {
          content: '';
          position: absolute;
          inset: 0;
          border: 1px solid rgba(168,85,247,0.5);
          border-radius: 1rem;
          pointer-events: none;
          margin: 3px;
        }

        @keyframes shimmer {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}
