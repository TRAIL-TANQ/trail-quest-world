/*
 * GameListPage: Dark UI × Neon - Category tabs + 2-column game card grid
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { MOCK_GAMES } from '@/lib/mockData';
import { CATEGORY_TABS } from '@/lib/constants';
import { Coins, Star } from 'lucide-react';

export default function GameListPage() {
  const [activeTab, setActiveTab] = useState('all');

  const filteredGames = activeTab === 'all'
    ? MOCK_GAMES
    : MOCK_GAMES.filter((g) => g.category === activeTab);

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-bold mb-3" style={{ color: '#F8FAFC' }}>ゲーム一覧</h1>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
        {CATEGORY_TABS.map((tab) => {
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
                boxShadow: isActive ? '0 0 12px rgba(79,70,229,0.3)' : 'none',
              }}
            >
              {tab.emoji} {tab.label}
            </button>
          );
        })}
      </div>

      {/* Game Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {filteredGames.map((game, i) => (
          <Link key={game.id} href={`/games/${game.id}`}>
            <div
              className="rounded-xl overflow-hidden transition-all active:scale-95"
              style={{
                background: '#1E293B',
                border: '1px solid rgba(255,255,255,0.06)',
                animation: `slide-up 0.3s ${i * 50}ms ease-out both`,
              }}
            >
              <div
                className="h-24 flex items-center justify-center relative"
                style={{
                  background: `linear-gradient(135deg, ${getCategoryColor(game.category)}15, ${getCategoryColor(game.category)}08)`,
                }}
              >
                <span className="text-4xl">{game.emoji}</span>
                <div className="absolute top-2 right-2 flex items-center gap-0.5">
                  {Array.from({ length: game.difficulty }).map((_, j) => (
                    <Star key={j} className="w-2.5 h-2.5 fill-current" style={{ color: '#F59E0B' }} />
                  ))}
                </div>
              </div>
              <div className="p-3">
                <p className="text-xs font-bold mb-1 truncate" style={{ color: '#F8FAFC' }}>{game.title}</p>
                <div className="flex items-center gap-1">
                  <Coins className="w-3 h-3" style={{ color: '#F59E0B' }} />
                  <span className="text-[10px] font-bold" style={{ color: '#F59E0B' }}>+{game.altReward} ALT</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function getCategoryColor(category: string): string {
  const map: Record<string, string> = {
    math: '#F59E0B', inquiry: '#8B5CF6', puzzle: '#10B981',
    japanese: '#EC4899', social: '#EF4444', science: '#06B6D4',
  };
  return map[category] || '#4F46E5';
}
