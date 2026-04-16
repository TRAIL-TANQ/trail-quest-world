/*
 * GameListPage → ALTゲーム
 * Mini-game hub for earning ALT points.
 * 5 game slots: Time Attack (active), Card Quiz (active), 3 coming soon.
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';

interface MiniGame {
  id: string;
  name: string;
  icon: string;
  altRange: string;
  description: string;
  href: string | null; // null = 準備中
  color: string;
}

const MINI_GAMES: MiniGame[] = [
  {
    id: 'time-attack',
    name: 'タイムアタック',
    icon: '⏱️',
    altRange: '+5〜20 ALT',
    description: '制限時間内にクイズに答えまくれ！',
    href: '/games/time-attack',
    color: '#ef4444',
  },
  {
    id: 'card-quiz',
    name: 'カードクイズ',
    icon: '🃏',
    altRange: '+5〜25 ALT',
    description: 'デッキのカードについてクイズに挑戦',
    href: '/games/knowledge-challenger?screen=deck_select',
    color: '#3b82f6',
  },
  {
    id: 'flash-card',
    name: 'フラッシュカード',
    icon: '⚡',
    altRange: '+3〜10 ALT',
    description: 'カードの知識を素早く暗記！',
    href: null,
    color: '#8b5cf6',
  },
  {
    id: 'memory-game',
    name: '神経衰弱',
    icon: '🧠',
    altRange: '+5〜15 ALT',
    description: 'カードのペアを見つけよう',
    href: null,
    color: '#f59e0b',
  },
  {
    id: 'sort-puzzle',
    name: '並べ替えパズル',
    icon: '🧩',
    altRange: '+3〜10 ALT',
    description: '歴史イベントを正しい順番に並べよう',
    href: null,
    color: '#22c55e',
  },
];

export default function GameListPage() {
  const user = useUserStore((s) => s.user);
  const levelInfo = calculateLevel(user.totalAlt);
  const [comingSoon, setComingSoon] = useState(false);

  return (
    <div className="relative min-h-full">
      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            <span className="text-lg">🌟</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>ALTゲーム</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          <div className="flex items-center gap-1">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
            <span className="text-sm font-bold" style={{ color: '#ffd700' }}>{user.totalAlt.toLocaleString()}</span>
          </div>
        </div>

        {/* Mini-game grid */}
        <div className="grid grid-cols-2 gap-2.5">
          {MINI_GAMES.map((game) => {
            const available = game.href !== null;
            const content = (
              <div
                key={game.id}
                className="rounded-xl p-3 relative overflow-hidden transition-all active:scale-[0.97]"
                onClick={!available ? () => setComingSoon(true) : undefined}
                style={{
                  background: available
                    ? `linear-gradient(135deg, ${game.color}15, ${game.color}05)`
                    : 'rgba(11,17,40,0.6)',
                  border: available
                    ? `1.5px solid ${game.color}50`
                    : '1.5px solid rgba(120,120,140,0.15)',
                  opacity: available ? 1 : 0.55,
                  cursor: 'pointer',
                }}
              >
                <div className="text-3xl mb-2">{game.icon}</div>
                <h3 className="text-[13px] font-bold text-amber-100 mb-0.5">{game.name}</h3>
                <p className="text-[10px] text-amber-200/50 mb-2 line-clamp-2">{game.description}</p>
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                    style={{ background: available ? `${game.color}40` : 'rgba(255,255,255,0.1)', color: available ? '#fff' : 'rgba(255,255,255,0.3)' }}>A</div>
                  <span className="text-[10px] font-bold" style={{ color: available ? game.color : 'rgba(255,255,255,0.3)' }}>{game.altRange}</span>
                </div>
                {!available && (
                  <div className="absolute top-2 right-2 text-base">🔒</div>
                )}
              </div>
            );

            if (available && game.href) {
              return <Link key={game.id} href={game.href}>{content}</Link>;
            }
            return <div key={game.id}>{content}</div>;
          })}
        </div>
      </div>

      {/* Coming soon modal */}
      {comingSoon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setComingSoon(false)}
        >
          <div
            className="tqw-card-panel rounded-2xl p-8 text-center w-full max-w-xs"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '2px solid rgba(255,215,0,0.2)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-5xl block mb-3">🔨</span>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--tqw-gold, #ffd700)' }}>
              ただいま準備中です
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--tqw-gold, #ffd700)', opacity: 0.75 }}>
              もうすこしまってね！
            </p>
            <button
              onClick={() => setComingSoon(false)}
              className="w-full py-3 rounded-xl font-bold text-base"
              style={{
                background: 'rgba(255,215,0,0.15)',
                border: '1.5px solid rgba(255,215,0,0.4)',
                color: 'var(--tqw-gold, #ffd700)',
                minHeight: '48px',
              }}
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
