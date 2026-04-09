/*
 * GameListPage: Category-based game list
 * Guild quest board style with ornate game cards, rich gold frames
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { GAME_CATEGORIES, IMAGES } from '@/lib/constants';
import { MOCK_GAMES } from '@/lib/mockData';

export default function GameListPage() {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredGames = activeCategory === 'all'
    ? MOCK_GAMES
    : MOCK_GAMES.filter((g) => g.category === activeCategory);

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GAME_CARDS_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.7) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            <span className="text-lg">🎮</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>ゲーム一覧</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-3 mb-4" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setActiveCategory('all')}
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={activeCategory === 'all' ? {
              background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))',
              color: '#ffd700', border: '1px solid rgba(255,215,0,0.35)', boxShadow: '0 0 10px rgba(255,215,0,0.1)',
            } : {
              background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)',
            }}>すべて</button>
          {GAME_CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
              style={activeCategory === cat.id ? {
                background: `linear-gradient(135deg, ${cat.color}33, ${cat.color}15)`,
                color: cat.color, border: `1px solid ${cat.color}55`, boxShadow: `0 0 8px ${cat.color}22`,
              } : {
                background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)',
              }}>
              <span>{cat.emoji}</span>{cat.label}
            </button>
          ))}
        </div>

        <div className="space-y-2.5">
          {filteredGames.map((game, i) => {
            const cat = GAME_CATEGORIES.find((c) => c.id === game.category);
            const catColor = cat?.color || '#666';
            return (
              <Link key={game.id} href={`/games/${game.id}`}>
                <div className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] card-shine animate-slide-up relative"
                  style={{
                    animationDelay: `${i * 60}ms`,
                    background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                    border: `1.5px solid ${catColor}33`,
                    boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px ${catColor}05`,
                  }}>
                  <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: `${catColor}55` }} />
                  <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: `${catColor}55` }} />
                  <div className="flex items-center p-3 gap-3">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${catColor}25, ${catColor}0a)`,
                        border: `1.5px solid ${catColor}40`, boxShadow: `0 0 10px ${catColor}15`,
                      }}>{game.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-amber-100 truncate mb-0.5">{game.title}</h3>
                      <p className="text-[11px] text-amber-200/45 mb-1.5 line-clamp-1">{game.description}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, si) => (
                            <span key={si} className="text-[8px]" style={{ color: si < game.difficulty ? '#ffd700' : 'rgba(255,255,255,0.12)' }}>★</span>
                          ))}
                        </div>
                        <span className="text-[10px] text-amber-200/20">|</span>
                        <span className="text-[10px] text-amber-200/40">約{game.estimatedMinutes}分</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center mb-0.5"
                        style={{
                          background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                          boxShadow: '0 0 10px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
                        }}>
                        <span className="text-[11px] font-bold" style={{ color: '#0b1128' }}>A</span>
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>+{game.altReward}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
