import { useLocation, Link } from 'wouter';
import { Home, Gamepad2, Ticket, Trophy, User } from 'lucide-react';

const tabs = [
  { path: '/', label: 'ホーム', Icon: Home },
  { path: '/games', label: 'ゲーム', Icon: Gamepad2 },
  { path: '/gacha', label: 'ガチャ', Icon: Ticket },
  { path: '/ranking', label: 'ランキング', Icon: Trophy },
  { path: '/mypage', label: 'マイページ', Icon: User },
];

export default function BottomNav() {
  const [location] = useLocation();

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-50"
      style={{
        background: '#0F172A',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="flex items-center justify-around py-1 px-1">
        {tabs.map((tab) => {
          const isActive = tab.path === '/'
            ? location === '/'
            : location.startsWith(tab.path);

          return (
            <Link key={tab.path} href={tab.path}>
              <button
                className="flex flex-col items-center gap-0.5 py-2 px-3 rounded-lg transition-all duration-150 relative active:scale-95"
              >
                <tab.Icon
                  className="w-5 h-5 transition-colors"
                  style={{ color: isActive ? '#4F46E5' : '#64748B' }}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span
                  className="text-[10px] font-semibold transition-colors"
                  style={{ color: isActive ? '#4F46E5' : '#64748B' }}
                >
                  {tab.label}
                </span>
                {/* Active indicator bar */}
                {isActive && (
                  <div
                    className="absolute -bottom-1 w-5 h-0.5 rounded-full"
                    style={{
                      background: '#4F46E5',
                      boxShadow: '0 0 8px rgba(79,70,229,0.6)',
                    }}
                  />
                )}
              </button>
            </Link>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
