/*
 * CollectionPage: Card collection grid with category tabs
 * Fantasy card album style, ornate card frames, rarity glow effects
 */
import { useState } from 'react';
import { MOCK_CARDS } from '@/lib/mockData';
import { RARITY_COLORS, RARITY_LABELS, RARITY_STARS } from '@/lib/constants';

const categoryTabs = [
  { id: 'all', label: 'すべて' },
  { id: 'great_person', label: '偉人' },
  { id: 'creature', label: '生き物' },
  { id: 'heritage', label: '世界遺産' },
  { id: 'invention', label: '発明' },
  { id: 'trail', label: '探究' },
];

const categoryEmoji: Record<string, string> = {
  great_person: '👤',
  creature: '🐉',
  heritage: '🏛️',
  invention: '💡',
  trail: '🗺️',
};

export default function CollectionPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedCard, setSelectedCard] = useState<typeof MOCK_CARDS[0] | null>(null);

  // Simulate owned cards (first 8 are owned)
  const ownedCardIds = new Set(MOCK_CARDS.slice(0, 8).map((c) => c.id));

  const filteredCards = activeCategory === 'all'
    ? MOCK_CARDS
    : MOCK_CARDS.filter((c) => c.category === activeCategory);

  const ownedCount = MOCK_CARDS.filter((c) => ownedCardIds.has(c.id)).length;

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              boxShadow: '0 0 10px rgba(168,85,247,0.3)',
            }}
          >
            <span className="text-lg">🃏</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>
            カードコレクション
          </h1>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
          style={{
            background: 'rgba(255,215,0,0.08)',
            border: '1px solid rgba(255,215,0,0.2)',
          }}
        >
          <span className="text-[10px] text-amber-200/40">所持</span>
          <span className="text-xs font-bold" style={{ color: '#ffd700' }}>{ownedCount}</span>
          <span className="text-[10px] text-amber-200/30">/{MOCK_CARDS.length}</span>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveCategory(tab.id)}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
            style={activeCategory === tab.id ? {
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))',
              color: '#ffd700',
              border: '1px solid rgba(255,215,0,0.35)',
              boxShadow: '0 0 8px rgba(255,215,0,0.1)',
            } : {
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,255,255,0.4)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-3 gap-2.5">
        {filteredCards.map((card, i) => {
          const owned = ownedCardIds.has(card.id);
          const rarityColor = RARITY_COLORS[card.rarity];
          return (
            <button
              key={card.id}
              onClick={() => owned ? setSelectedCard(card) : null}
              className="rounded-xl overflow-hidden transition-all duration-200 animate-slide-up card-shine relative"
              style={{
                animationDelay: `${i * 40}ms`,
                border: owned
                  ? `2px solid ${rarityColor}66`
                  : '2px solid rgba(255,255,255,0.06)',
                background: owned
                  ? 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))'
                  : 'rgba(255,255,255,0.02)',
                opacity: owned ? 1 : 0.35,
                filter: owned ? 'none' : 'grayscale(1)',
                boxShadow: owned ? `0 2px 8px rgba(0,0,0,0.3), inset 0 0 12px ${rarityColor}08` : 'none',
              }}
            >
              {/* Rarity glow for high-rarity cards */}
              {owned && card.rarity >= 4 && (
                <div className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{ boxShadow: `inset 0 0 15px ${rarityColor}15` }}
                />
              )}

              {/* Card image */}
              <div className="aspect-square flex items-center justify-center relative"
                style={{
                  background: owned
                    ? `radial-gradient(circle, ${rarityColor}12, transparent)`
                    : 'transparent',
                }}
              >
                {owned ? (
                  <span className="text-3xl">{categoryEmoji[card.category] || '❓'}</span>
                ) : (
                  <span className="text-2xl opacity-30">❓</span>
                )}
                {/* Rarity badge */}
                {owned && (
                  <div className="absolute top-1 right-1">
                    <span className="text-[8px] px-1 py-0.5 rounded font-bold"
                      style={{
                        background: `${rarityColor}25`,
                        color: rarityColor,
                        border: `1px solid ${rarityColor}40`,
                      }}
                    >
                      ★{card.rarity}
                    </span>
                  </div>
                )}
              </div>
              {/* Card name */}
              <div className="px-1.5 py-1.5 text-center"
                style={{ borderTop: `1px solid ${owned ? rarityColor + '25' : 'rgba(255,255,255,0.04)'}` }}
              >
                <p className="text-[10px] font-bold text-amber-100 truncate">
                  {owned ? card.name : '???'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="w-full max-w-[280px] rounded-2xl overflow-hidden animate-bounce-in relative"
            style={{
              border: `3px solid ${RARITY_COLORS[selectedCard.rarity]}`,
              boxShadow: `0 0 30px ${RARITY_COLORS[selectedCard.rarity]}44, 0 0 60px ${RARITY_COLORS[selectedCard.rarity]}22, 0 8px 32px rgba(0,0,0,0.5)`,
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(11,17,40,0.98))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Corner decorations */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: `${RARITY_COLORS[selectedCard.rarity]}88` }} />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: `${RARITY_COLORS[selectedCard.rarity]}88` }} />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: `${RARITY_COLORS[selectedCard.rarity]}88` }} />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: `${RARITY_COLORS[selectedCard.rarity]}88` }} />

            {/* Rarity header */}
            <div className="px-4 py-2 text-center"
              style={{
                background: `linear-gradient(135deg, ${RARITY_COLORS[selectedCard.rarity]}25, transparent)`,
                borderBottom: `1px solid ${RARITY_COLORS[selectedCard.rarity]}33`,
              }}
            >
              <span className="text-xs font-bold"
                style={{ color: RARITY_COLORS[selectedCard.rarity] }}
              >
                {RARITY_LABELS[selectedCard.rarity]}
              </span>
            </div>

            {/* Card image */}
            <div className="h-44 flex items-center justify-center relative"
              style={{ background: `radial-gradient(circle, ${RARITY_COLORS[selectedCard.rarity]}12, transparent)` }}
            >
              <span className="text-8xl">{categoryEmoji[selectedCard.category] || '❓'}</span>
              {/* Sparkles for high rarity */}
              {selectedCard.rarity >= 4 && [...Array(6)].map((_, i) => (
                <div key={i} className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: RARITY_COLORS[selectedCard.rarity],
                    top: `${20 + Math.random() * 60}%`,
                    left: `${10 + Math.random() * 80}%`,
                    animation: `sparkle ${1 + Math.random()}s ease-in-out ${Math.random()}s infinite`,
                    boxShadow: `0 0 4px ${RARITY_COLORS[selectedCard.rarity]}`,
                  }}
                />
              ))}
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-0.5 py-2">
              {Array.from({ length: RARITY_STARS[selectedCard.rarity] }).map((_, i) => (
                <span key={i} className="text-lg" style={{ color: RARITY_COLORS[selectedCard.rarity] }}>★</span>
              ))}
            </div>

            {/* Info */}
            <div className="px-4 pb-4 text-center">
              <h3 className="text-lg font-bold text-amber-100 mb-1">{selectedCard.name}</h3>
              {selectedCard.era && (
                <p className="text-xs text-amber-200/35 mb-2">{selectedCard.era}</p>
              )}
              <p className="text-xs text-amber-200/55 mb-4">{selectedCard.description}</p>
              <button
                onClick={() => setSelectedCard(null)}
                className="rpg-btn rpg-btn-gold w-full"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
