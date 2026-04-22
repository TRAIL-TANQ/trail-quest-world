/*
 * BottomNav: 6-tab navigation bar
 * Gold active state, v12 frosted-glass background, RPG guild style
 */
import { useLocation, Link } from 'wouter';

const tabs = [
  { path: '/', label: 'ホーム', icon: '🏠' },
  { path: '/alt-games', label: 'ALTゲーム', icon: '🌟' },
  { path: '/gacha', label: 'ガチャ', icon: '🎰' },
  { path: '/market', label: 'マーケット', icon: '📈' },
  { path: '/ranking', label: 'ランキング', icon: '🏆' },
  { path: '/mypage', label: 'マイページ', icon: '👤' },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{
        // v12: .tqw-card-panel と同系のすりガラス風。装飾ラインを削除しシンプルに。
        background: 'linear-gradient(135deg, rgba(26, 31, 58, 0.82), rgba(15, 20, 40, 0.88))',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '1px solid rgba(197, 160, 63, 0.2)',
        boxShadow: '0 -6px 20px rgba(0,0,0,0.35)',
      }}
    >
      <div className="flex items-center justify-around py-1.5 px-2">
        {tabs.map((tab) => {
          const isActive = tab.path === '/'
            ? location === '/'
            : location.startsWith(tab.path);

          return (
            <Link key={tab.path} href={tab.path}>
              <button
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 relative"
              >
                {isActive && (
                  <div
                    className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                    style={{ background: 'var(--tqw-gold, #ffd700)' }}
                  />
                )}
                <span className="text-xl leading-none" style={{
                  filter: isActive ? 'none' : 'grayscale(0.75) opacity(0.55)',
                  transform: isActive ? 'scale(1.06)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                }}>
                  {tab.icon}
                </span>
                <span
                  className="text-[10px] font-bold"
                  style={{
                    color: isActive ? 'var(--tqw-gold, #ffd700)' : 'rgba(255,255,255,0.4)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {tab.label}
                </span>
              </button>
            </Link>
          );
        })}
      </div>

      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
