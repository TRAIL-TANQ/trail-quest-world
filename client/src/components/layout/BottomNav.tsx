/*
 * BottomNav: 5-tab navigation bar
 * Gold active state, dark navy background, RPG guild style
 */
import { useLocation, Link } from 'wouter';

const tabs = [
  { path: '/', label: 'ホーム', icon: '🏠' },
  { path: '/alt-games', label: 'ALTゲーム', icon: '🌟' },
  { path: '/gacha', label: 'ガチャ', icon: '🎰' },
  { path: '/shop', label: 'ショップ', icon: '🛒' },
  { path: '/ranking', label: 'ランキング', icon: '🏆' },
  { path: '/mypage', label: 'マイページ', icon: '👤' },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{
        background: 'linear-gradient(180deg, rgba(14,20,48,0.98) 0%, rgba(8,12,30,1) 100%)',
        borderTop: '2px solid rgba(255,215,0,0.2)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,215,0,0.08)',
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,215,0,0.15) 30%, rgba(255,215,0,0.25) 50%, rgba(255,215,0,0.15) 70%, transparent 95%)',
      }} />

      <div className="flex items-center justify-around py-1.5 px-2">
        {tabs.map((tab) => {
          const isActive = tab.path === '/'
            ? location === '/'
            : location.startsWith(tab.path);

          return (
            <Link key={tab.path} href={tab.path}>
              <button
                className="flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all duration-200 relative"
                style={isActive ? {
                  background: 'linear-gradient(180deg, rgba(255,215,0,0.12), rgba(255,215,0,0.03))',
                } : {}}
              >
                {isActive && (
                  <>
                    <div
                      className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, transparent, #ffd700, transparent)',
                        boxShadow: '0 0 10px rgba(255,215,0,0.5)',
                      }}
                    />
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full blur-md"
                      style={{ background: 'rgba(255,215,0,0.1)' }}
                    />
                  </>
                )}
                <span className="text-xl leading-none relative z-10" style={{
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(255,215,0,0.5))' : 'grayscale(0.3) opacity(0.6)',
                  transform: isActive ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.2s ease',
                }}>
                  {tab.icon}
                </span>
                <span
                  className="text-[10px] font-bold relative z-10"
                  style={{
                    color: isActive ? '#ffd700' : 'rgba(255,255,255,0.35)',
                    textShadow: isActive ? '0 0 8px rgba(255,215,0,0.3)' : 'none',
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
