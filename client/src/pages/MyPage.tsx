/*
 * MyPage: Profile, statistics, settings
 * Fantasy adventurer's guild card style, ornate profile frame
 */
import { useUserStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';
import { IMAGES, CLASS_LIST } from '@/lib/constants';
import { Link } from 'wouter';

export default function MyPage() {
  const user = useUserStore((s) => s.user);
  const levelInfo = calculateLevel(user.totalAlt);
  const classLabel = CLASS_LIST.find((c) => c.id === user.classId)?.label || user.classId;

  const stats = [
    { label: 'プレイ回数', value: '42', icon: '🎮' },
    { label: '総獲得ALT', value: user.totalAlt.toLocaleString(), icon: '💰' },
    { label: '連続ログイン', value: `${user.streakDays}日`, icon: '🔥' },
    { label: 'カード所持', value: '8/16', icon: '🃏' },
    { label: 'ベストスコア', value: '520', icon: '🏆' },
    { label: 'クリア率', value: '85%', icon: '✅' },
  ];

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            boxShadow: '0 0 10px rgba(59,130,246,0.3)',
          }}
        >
          <span className="text-lg">👤</span>
        </div>
        <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>
          マイページ
        </h1>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl overflow-hidden mb-4 relative"
        style={{
          border: '2px solid rgba(255,215,0,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,215,0,0.05)',
          background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
        }}
      >
        {/* Corner decorations */}
        <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm z-10" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm z-10" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />

        {/* Banner */}
        <div className="h-20 relative">
          <img src={IMAGES.HERO_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3) saturate(0.5)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(14,20,45,0.9))' }} />
        </div>

        {/* Avatar & Info */}
        <div className="px-4 pb-4 -mt-8 relative">
          <div className="flex items-end gap-3 mb-3">
            <div className="w-16 h-16 rounded-full overflow-hidden flex-shrink-0 relative"
              style={{
                border: '3px solid #ffd700',
                boxShadow: '0 0 12px rgba(255,215,0,0.4), 0 0 24px rgba(255,215,0,0.15)',
              }}
            >
              <img src={IMAGES.CHARACTER} alt="avatar" className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-lg font-bold text-amber-100">{user.nickname}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    background: 'rgba(59,130,246,0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59,130,246,0.25)',
                  }}
                >{classLabel}</span>
                <span className="text-[10px] text-amber-200/30">ID: {user.id}</span>
              </div>
            </div>
          </div>

          {/* Level & XP */}
          <div className="rounded-xl p-3 mb-0"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                    color: '#0b1128',
                    boxShadow: '0 0 6px rgba(255,215,0,0.2)',
                  }}
                >
                  Lv.{levelInfo.level}
                </span>
                <span className="text-xs text-amber-200/50">{levelInfo.title}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}
                >A</div>
                <span className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>
                  {user.currentAlt.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}
            >
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${levelInfo.progress * 100}%`,
                  background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                  boxShadow: '0 0 6px rgba(34,197,94,0.5)',
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-amber-200/25">
                {user.totalAlt} ALT
              </span>
              <span className="text-[9px] text-amber-200/25">
                {levelInfo.nextLevelAlt ? `次のレベル: ${levelInfo.nextLevelAlt} ALT` : 'MAX'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-amber-200/60 mb-3 flex items-center gap-1.5">
          <span>📊</span> 統計情報
          <div className="flex-1 h-px ml-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.15), transparent)' }} />
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((stat, i) => (
            <div key={stat.label}
              className="rounded-xl p-2.5 text-center animate-slide-up relative"
              style={{
                animationDelay: `${i * 50}ms`,
                background: 'linear-gradient(135deg, rgba(21,29,59,0.9), rgba(14,20,45,0.9))',
                border: '1px solid rgba(255,215,0,0.1)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}
            >
              <span className="text-lg block mb-1">{stat.icon}</span>
              <p className="text-sm font-bold text-amber-100 font-[var(--font-orbitron)]">{stat.value}</p>
              <p className="text-[9px] text-amber-200/35 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="space-y-2">
        <Link href="/collection">
          <div className="rounded-xl p-3 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.03))',
              border: '1px solid rgba(168,85,247,0.2)',
            }}
          >
            <div className="flex items-center gap-2">
              <span>🃏</span>
              <span className="text-sm text-amber-100">カードコレクション</span>
            </div>
            <span className="text-amber-200/25 text-sm">→</span>
          </div>
        </Link>
        <Link href="/shop">
          <div className="rounded-xl p-3 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{
              background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
          >
            <div className="flex items-center gap-2">
              <span>🛒</span>
              <span className="text-sm text-amber-100">ショップ</span>
            </div>
            <span className="text-amber-200/25 text-sm">→</span>
          </div>
        </Link>
        <div className="rounded-xl p-3 flex items-center justify-between opacity-40"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <span>⚙️</span>
            <span className="text-sm text-amber-100">設定</span>
          </div>
          <span className="text-[10px] text-amber-200/25">Coming Soon</span>
        </div>
        <div className="rounded-xl p-3 flex items-center justify-between opacity-40"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <span>❓</span>
            <span className="text-sm text-amber-100">ヘルプ</span>
          </div>
          <span className="text-[10px] text-amber-200/25">Coming Soon</span>
        </div>
      </div>
    </div>
  );
}
