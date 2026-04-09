/*
 * HomePage: Dark UI × Neon color game center feel
 * Profile card, ALT balance, level progress, daily missions, quick access
 */
import { useUserStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';
import { Link } from 'wouter';
import { Coins, Zap, Flame, ChevronRight, Sparkles, Target, TrendingUp } from 'lucide-react';

const DAILY_MISSIONS = [
  { id: 1, name: 'ゲームを3回プレイ', reward: 30, progress: 1, total: 3, emoji: '🎮' },
  { id: 2, name: 'ランキングTOP10に入る', reward: 50, progress: 0, total: 1, emoji: '🏆' },
  { id: 3, name: 'ガチャを1回引く', reward: 20, progress: 0, total: 1, emoji: '🎰' },
];

const QUICK_ACCESS = [
  { label: '人気', emoji: '🔥', color: '#EF4444', path: '/games' },
  { label: '新着', emoji: '✨', color: '#8B5CF6', path: '/games' },
  { label: '挑戦中', emoji: '⚔️', color: '#F59E0B', path: '/games' },
];

export default function HomePage() {
  const user = useUserStore((s) => s.user);
  const levelInfo = calculateLevel(user.totalAlt);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile Card */}
      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-2xl shrink-0"
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            boxShadow: '0 0 16px rgba(79,70,229,0.3)',
          }}
        >
          🧑‍🎓
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: '#F8FAFC' }}>{user.nickname}</span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(79,70,229,0.2)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' }}
            >
              Lv.{levelInfo.level}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{levelInfo.title}</p>
          <div className="flex items-center gap-1 mt-1">
            <Flame className="w-3 h-3" style={{ color: '#EF4444' }} />
            <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
              {user.streakDays}日連続ログイン
            </span>
          </div>
        </div>
      </div>

      {/* ALT Balance + Level Progress */}
      <div
        className="rounded-xl p-4"
        style={{
          background: '#1E293B',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5" style={{ color: '#F59E0B' }} />
            <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>ALT残高</span>
          </div>
          <span className="text-2xl font-black tabular-nums" style={{ color: '#F59E0B' }}>
            {user.currentAlt.toLocaleString()}
          </span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
              Lv.{levelInfo.level} → Lv.{levelInfo.level + 1}
            </span>
            <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
              {Math.round(levelInfo.progress * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${levelInfo.progress * 100}%`,
                background: 'linear-gradient(90deg, #4F46E5, #10B981)',
                boxShadow: '0 0 8px rgba(79,70,229,0.4)',
              }}
            />
          </div>
          {levelInfo.nextLevelAlt && (
            <p className="text-[10px]" style={{ color: '#64748B' }}>
              あと {levelInfo.nextLevelAlt - user.totalAlt} ALT で次のレベル
            </p>
          )}
        </div>
      </div>

      {/* Daily Missions */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-4 h-4" style={{ color: '#4F46E5' }} />
          <h2 className="text-sm font-bold" style={{ color: '#F8FAFC' }}>今日のミッション</h2>
        </div>
        <div className="space-y-2">
          {DAILY_MISSIONS.map((m) => (
            <div
              key={m.id}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{
                background: '#1E293B',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <span className="text-xl">{m.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold" style={{ color: '#F8FAFC' }}>{m.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(m.progress / m.total) * 100}%`,
                        background: m.progress >= m.total ? '#10B981' : '#4F46E5',
                      }}
                    />
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: '#94A3B8' }}>
                    {m.progress}/{m.total}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <Coins className="w-3 h-3" style={{ color: '#F59E0B' }} />
                <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>+{m.reward}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Access */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4" style={{ color: '#F59E0B' }} />
          <h2 className="text-sm font-bold" style={{ color: '#F8FAFC' }}>クイックアクセス</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ACCESS.map((qa) => (
            <Link key={qa.label} href={qa.path}>
              <div
                className="rounded-xl p-3 flex flex-col items-center gap-1.5 transition-all active:scale-95"
                style={{
                  background: '#1E293B',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <span className="text-2xl">{qa.emoji}</span>
                <span className="text-xs font-semibold" style={{ color: '#F8FAFC' }}>{qa.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Feature Cards */}
      <div className="space-y-2">
        <Link href="/gacha">
          <div
            className="rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(139,92,246,0.1))',
              border: '1px solid rgba(79,70,229,0.2)',
            }}
          >
            <Sparkles className="w-6 h-6 shrink-0" style={{ color: '#A5B4FC' }} />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#F8FAFC' }}>ガチャを引こう！</p>
              <p className="text-[10px]" style={{ color: '#94A3B8' }}>レアカードをゲットしよう</p>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: '#64748B' }} />
          </div>
        </Link>

        <Link href="/ranking">
          <div
            className="rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(234,88,12,0.05))',
              border: '1px solid rgba(245,158,11,0.15)',
            }}
          >
            <TrendingUp className="w-6 h-6 shrink-0" style={{ color: '#F59E0B' }} />
            <div className="flex-1">
              <p className="text-sm font-bold" style={{ color: '#F8FAFC' }}>ランキング</p>
              <p className="text-[10px]" style={{ color: '#94A3B8' }}>今の順位をチェック</p>
            </div>
            <ChevronRight className="w-4 h-4" style={{ color: '#64748B' }} />
          </div>
        </Link>
      </div>
    </div>
  );
}
