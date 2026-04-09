import { useUserStore } from '@/lib/stores';
import { Coins } from 'lucide-react';

export default function Header() {
  const user = useUserStore((s) => s.user);

  return (
    <header className="sticky top-0 z-50 w-full" style={{ background: '#0F172A' }}>
      <div className="px-4 h-12 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <h1 className="text-sm font-extrabold tracking-wider"
          style={{
            color: '#F8FAFC',
            textShadow: '0 0 12px rgba(79,70,229,0.5), 0 0 24px rgba(79,70,229,0.2)',
          }}
        >
          TRAIL QUEST WORLD
        </h1>

        {/* ALT Balance */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.25)',
          }}
        >
          <Coins className="w-4 h-4" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-bold tabular-nums" style={{ color: '#F59E0B' }}>
            {user.currentAlt.toLocaleString()}
          </span>
        </div>
      </div>
    </header>
  );
}
