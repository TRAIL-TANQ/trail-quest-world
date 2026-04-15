/*
 * GameListPage: Knowledge Challenger entry point
 * Single game entry - Knowledge Challenger card battle
 * Guild quest board style with ornate game card
 */
import { Link } from 'wouter';
import { IMAGES } from '@/lib/constants';

export default function GameListPage() {
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

        <div className="space-y-2.5">
          {/* Knowledge Challenger - Main Game (ソロモード) */}
          <Link href="/games/stages">
            <div className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] card-shine animate-slide-up relative"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: '1.5px solid rgba(255,215,0,0.35)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,215,0,0.05)',
              }}>
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: 'rgba(255,215,0,0.55)' }} />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: 'rgba(255,215,0,0.55)' }} />
              <div className="flex items-center p-3 gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.05))',
                    border: '1.5px solid rgba(255,215,0,0.4)',
                    boxShadow: '0 0 10px rgba(255,215,0,0.15)',
                  }}>⚔️</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-amber-100 truncate mb-0.5">ナレッジ・チャレンジャー</h3>
                  <p className="text-[11px] text-amber-200/45 mb-1.5 line-clamp-2">ソロモード 全10ステージ・レアカード報酬あり</p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, si) => (
                        <span key={si} className="text-[8px]" style={{ color: si < 2 ? '#ffd700' : 'rgba(255,255,255,0.12)' }}>★</span>
                      ))}
                    </div>
                    <span className="text-[10px] text-amber-200/20">|</span>
                    <span className="text-[10px] text-amber-200/40">約5分</span>
                    <span className="text-[10px] text-amber-200/20">|</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(255,215,0,0.15)', color: '#ffd700' }}>NEW</span>
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
                  <span className="text-[10px] font-bold" style={{ color: '#ffd700' }}>+30</span>
                </div>
              </div>
            </div>
          </Link>

          {/* Quest Board - Quiz Practice */}
          <Link href="/games/quest-board">
            <div className="rounded-xl overflow-hidden transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] card-shine animate-slide-up relative"
              style={{
                background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: '1.5px solid rgba(59,130,246,0.35)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(59,130,246,0.05)',
                animationDelay: '0.1s',
              }}>
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: 'rgba(59,130,246,0.55)' }} />
              <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: 'rgba(59,130,246,0.55)' }} />
              <div className="flex items-center p-3 gap-3">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(59,130,246,0.05))',
                    border: '1.5px solid rgba(59,130,246,0.4)',
                    boxShadow: '0 0 10px rgba(59,130,246,0.15)',
                  }}>📚</div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-amber-100 truncate mb-0.5">デッキクエスト</h3>
                  <p className="text-[11px] text-amber-200/45 mb-1.5 line-clamp-2">デッキを解放してバトルに挑もう</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-200/40">👑偉人</span>
                    <span className="text-[10px] text-amber-200/40">🐟生き物</span>
                    <span className="text-[10px] text-amber-200/40">🏛️遺産</span>
                    <span className="text-[10px] text-amber-200/40">🔬発明</span>
                  </div>
                </div>
                <div className="flex flex-col items-center flex-shrink-0">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center mb-0.5"
                    style={{
                      background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                      boxShadow: '0 0 10px rgba(59,130,246,0.3), 0 2px 4px rgba(0,0,0,0.3)',
                    }}>
                    <span className="text-[11px] font-bold" style={{ color: '#fff' }}>Q</span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: '#3b82f6' }}>+ALT</span>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
