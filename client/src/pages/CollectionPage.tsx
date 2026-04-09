/*
 * CollectionPage: Dark UI × Neon - Card collection grid with category tabs
 */
import { useState } from 'react';
import { MOCK_CARDS } from '@/lib/mockData';
import { RARITY_COLORS } from '@/lib/constants';
import { Star, Lock } from 'lucide-react';

const CARD_TABS = [
  { id: 'all', label: 'すべて' },
  { id: 'great_person', label: '偉人' },
  { id: 'creature', label: '生き物' },
  { id: 'heritage', label: '世界遺産' },
  { id: 'invention', label: '発明' },
];

const categoryEmoji: Record<string, string> = {
  great_person: '🧑‍🔬',
  creature: '🦁',
  heritage: '🏛️',
  invention: '💡',
  trail: '🗺️',
};

export default function CollectionPage() {
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCard, setSelectedCard] = useState<typeof MOCK_CARDS[0] | null>(null);

  const ownedCardIds = new Set(MOCK_CARDS.slice(0, 8).map((c) => c.id));

  const filteredCards = activeTab === 'all'
    ? MOCK_CARDS
    : MOCK_CARDS.filter((c) => c.category === activeTab);

  const ownedCount = MOCK_CARDS.filter((c) => ownedCardIds.has(c.id)).length;

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold" style={{ color: '#F8FAFC' }}>カードコレクション</h1>
        <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: 'rgba(79,70,229,0.15)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' }}>
          {ownedCount}/{MOCK_CARDS.length}
        </span>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
        {CARD_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95"
              style={{
                background: isActive ? '#4F46E5' : 'rgba(255,255,255,0.05)',
                color: isActive ? '#F8FAFC' : '#94A3B8',
                border: isActive ? '1px solid rgba(79,70,229,0.5)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Card Grid */}
      <div className="grid grid-cols-3 gap-2">
        {filteredCards.map((card, i) => {
          const owned = ownedCardIds.has(card.id);
          const rarityColor = RARITY_COLORS[card.rarity] || '#94A3B8';

          return (
            <button
              key={card.id}
              onClick={() => owned && setSelectedCard(card)}
              className="rounded-xl overflow-hidden transition-all active:scale-95 text-left"
              style={{
                background: '#1E293B',
                border: owned ? `1px solid ${rarityColor}40` : '1px solid rgba(255,255,255,0.04)',
                opacity: owned ? 1 : 0.4,
                animation: `slide-up 0.3s ${i * 30}ms ease-out both`,
              }}
            >
              <div
                className="aspect-[3/4] flex items-center justify-center relative"
                style={{
                  background: owned ? `linear-gradient(135deg, ${rarityColor}15, ${rarityColor}05)` : 'rgba(255,255,255,0.02)',
                }}
              >
                {owned ? (
                  <span className="text-3xl">{categoryEmoji[card.category] || '❓'}</span>
                ) : (
                  <Lock className="w-6 h-6" style={{ color: '#475569' }} />
                )}
                {owned && (
                  <div className="absolute bottom-1 left-0 right-0 flex justify-center gap-0.5">
                    {Array.from({ length: Math.min(card.rarity, 5) }).map((_, j) => (
                      <Star key={j} className="w-2.5 h-2.5 fill-current" style={{ color: rarityColor }} />
                    ))}
                  </div>
                )}
              </div>
              <div className="px-2 py-1.5">
                <p className="text-[10px] font-semibold truncate" style={{ color: owned ? '#F8FAFC' : '#475569' }}>
                  {owned ? card.name : '???'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70" onClick={() => setSelectedCard(null)}>
          <div
            className="rounded-2xl p-5 w-[280px] text-center"
            style={{
              background: '#1E293B',
              border: `1px solid ${RARITY_COLORS[selectedCard.rarity]}40`,
              boxShadow: `0 0 32px ${RARITY_COLORS[selectedCard.rarity]}20`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="w-24 h-32 mx-auto rounded-xl flex items-center justify-center mb-3"
              style={{
                background: `linear-gradient(135deg, ${RARITY_COLORS[selectedCard.rarity]}20, ${RARITY_COLORS[selectedCard.rarity]}08)`,
                border: `1px solid ${RARITY_COLORS[selectedCard.rarity]}40`,
              }}
            >
              <span className="text-4xl">{categoryEmoji[selectedCard.category] || '❓'}</span>
            </div>
            <div className="flex justify-center gap-0.5 mb-2">
              {Array.from({ length: Math.min(selectedCard.rarity, 5) }).map((_, j) => (
                <Star key={j} className="w-4 h-4 fill-current" style={{ color: RARITY_COLORS[selectedCard.rarity] }} />
              ))}
            </div>
            <h3 className="text-base font-bold mb-1" style={{ color: '#F8FAFC' }}>{selectedCard.name}</h3>
            {selectedCard.era && <p className="text-[10px] mb-2" style={{ color: '#94A3B8' }}>{selectedCard.era}</p>}
            <p className="text-xs mb-4" style={{ color: '#94A3B8' }}>{selectedCard.description}</p>
            <button
              onClick={() => setSelectedCard(null)}
              className="px-6 py-2 rounded-lg text-sm font-bold transition-all active:scale-95"
              style={{ background: '#4F46E5', color: '#F8FAFC' }}
            >
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
