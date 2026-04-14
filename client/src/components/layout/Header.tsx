/*
 * Header: RPG-style top bar with character avatar, level, XP bar, ALT balance
 * Gold frame on dark navy, ornate styling with decorative elements
 * Shows equipped shop avatar icon if one is equipped, otherwise default boy/girl
 */
import { useLocation } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';
import { IMAGES, AVATAR_ITEMS } from '@/lib/constants';
import { isGuest, isAdmin, clearAuth } from '@/lib/auth';

export default function Header() {
  const [, navigate] = useLocation();
  const user = useUserStore((s) => s.user);
  const levelInfo = calculateLevel(user.totalAlt);
  const guestMode = isGuest();
  const adminMode = isAdmin();

  // Determine which avatar icon to show
  const getAvatarIcon = () => {
    if (user.equippedAvatarId && AVATAR_ITEMS[user.equippedAvatarId]) {
      return AVATAR_ITEMS[user.equippedAvatarId].icon;
    }
    return user.avatarType === 'girl' ? IMAGES.CHARACTER_GIRL : IMAGES.CHARACTER_BOY;
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="px-3 py-2 flex items-center gap-2.5 relative"
        style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.98) 0%, rgba(16,22,48,0.97) 100%)',
          borderBottom: '2px solid rgba(255,215,0,0.25)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(255,215,0,0.08)',
        }}
      >
        {/* Decorative gold line at top */}
        <div className="absolute top-0 left-0 right-0 h-px" style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.3), transparent)',
        }} />

        {/* Avatar with ornate border */}
        <div className="relative w-11 h-11 rounded-full overflow-hidden flex-shrink-0"
          style={{
            border: '2px solid #ffd700',
            boxShadow: '0 0 10px rgba(255,215,0,0.35), inset 0 0 4px rgba(255,215,0,0.1)',
          }}
        >
          <img
            src={getAvatarIcon()}
            alt="avatar"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 rounded-t-sm"
            style={{
              background: 'linear-gradient(180deg, #ffd700, #d4a500)',
              color: '#0b1128',
              lineHeight: '14px',
            }}
          >
            {levelInfo.level}
          </div>
        </div>

        {/* Level & XP */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded"
              style={{
                background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                color: '#0b1128',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            >
              Lv.{levelInfo.level}
            </span>
            <span className="text-[11px] text-amber-200/70 truncate font-medium">
              {levelInfo.title}
            </span>
            {adminMode && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(255,215,0,0.2)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.4)' }}>
                👑 ADMIN
              </span>
            )}
          </div>
          <div className="w-full h-2.5 rounded-full overflow-hidden relative"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,215,0,0.15)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
            }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 relative"
              style={{
                width: `${levelInfo.progress * 100}%`,
                background: 'linear-gradient(90deg, #16a34a, #22c55e, #4ade80)',
                boxShadow: '0 0 8px rgba(34,197,94,0.5)',
              }}
            >
              <div className="absolute inset-0 animate-shimmer rounded-full" />
            </div>
          </div>
        </div>

        {/* ALT Balance with coin icon */}
        <div className="flex items-center gap-1.5 flex-shrink-0 px-2.5 py-1.5 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(255,215,0,0.04))',
            border: '1.5px solid rgba(255,215,0,0.25)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 0 8px rgba(255,215,0,0.03)',
          }}
        >
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #d4a500)',
              color: '#0b1128',
              boxShadow: '0 0 8px rgba(255,215,0,0.4), 0 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            A
          </div>
          <span className="text-sm font-bold font-[var(--font-orbitron)]"
            style={{ color: '#ffd700', textShadow: '0 0 6px rgba(255,215,0,0.2)' }}
          >
            {user.currentAlt.toLocaleString()}
          </span>
        </div>

        {/* Guest login button / Logout button */}
        {guestMode ? (
          <button
            onClick={() => navigate('/login')}
            className="flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95"
            style={{
              background: 'rgba(255,215,0,0.1)',
              color: '#ffd700',
              border: '1px solid rgba(255,215,0,0.25)',
            }}
          >
            &#x1F511;ログイン
          </button>
        ) : (
          <button
            onClick={() => {
              clearAuth();
              window.location.href = '/login';
            }}
            className="flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium transition-all active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(255,215,0,0.4)',
              border: '1px solid rgba(255,215,0,0.1)',
            }}
          >
            ログアウト
          </button>
        )}
      </div>
    </header>
  );
}
