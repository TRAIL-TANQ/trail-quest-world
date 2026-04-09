/*
 * MyPage: Dark UI × Neon - Profile, stats, level up test button
 */
import { useState } from 'react';
import { useUserStore, useAltStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';
import LevelUpModal from '@/components/effects/LevelUpModal';
import { Coins, Flame, Trophy, Gamepad2, BookOpen, Sparkles } from 'lucide-react';

const STATS = [
  { label: 'プレイ回数', value: '42', icon: Gamepad2, color: '#4F46E5' },
  { label: '正答率', value: '78%', icon: BookOpen, color: '#10B981' },
  { label: '最高順位', value: '3位', icon: Trophy, color: '#F59E0B' },
  { label: '所持カード', value: '8枚', icon: Sparkles, color: '#8B5CF6' },
];

export default function MyPage() {
  const user = useUserStore((s) => s.user);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);
  const levelInfo = calculateLevel(user.totalAlt);
  const [showLevelUp, setShowLevelUp] = useState(false);

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Profile Card */}
      <div
        className="rounded-xl p-5 text-center"
        style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center text-3xl mx-auto mb-3"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 0 24px rgba(79,70,229,0.3)' }}
        >
          🧑‍🎓
        </div>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#F8FAFC' }}>{user.nickname}</h2>
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-xs font-semibold px-3 py-0.5 rounded-full" style={{ background: 'rgba(79,70,229,0.2)', color: '#A5B4FC', border: '1px solid rgba(79,70,229,0.3)' }}>
            Lv.{levelInfo.level}
          </span>
          <span className="text-xs" style={{ color: '#94A3B8' }}>{levelInfo.title}</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <Flame className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>{user.streakDays}日連続ログイン</span>
        </div>
      </div>

      {/* ALT Balance */}
      <div
        className="rounded-xl p-4 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5" style={{ color: '#F59E0B' }} />
          <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>ALT残高</span>
        </div>
        <span className="text-2xl font-black tabular-nums" style={{ color: '#F59E0B' }}>{user.currentAlt.toLocaleString()}</span>
      </div>

      {/* Level Progress */}
      <div className="rounded-xl p-4" style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>レベル進捗</span>
          <span className="text-xs font-medium" style={{ color: '#94A3B8' }}>{Math.round(levelInfo.progress * 100)}%</span>
        </div>
        <div className="h-3 rounded-full overflow-hidden mb-1.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${levelInfo.progress * 100}%`, background: 'linear-gradient(90deg, #4F46E5, #10B981)', boxShadow: '0 0 8px rgba(79,70,229,0.4)' }} />
        </div>
        {levelInfo.nextLevelAlt && (
          <p className="text-[10px]" style={{ color: '#64748B' }}>Lv.{levelInfo.level + 1} まであと {levelInfo.nextLevelAlt - user.totalAlt} ALT</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2">
        {STATS.map((stat) => (
          <div key={stat.label} className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
              <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-lg font-black" style={{ color: '#F8FAFC' }}>{stat.value}</p>
              <p className="text-[10px]" style={{ color: '#94A3B8' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Test Buttons */}
      <div className="rounded-xl p-4 space-y-2" style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-bold mb-2" style={{ color: '#94A3B8' }}>テスト機能</p>
        <button
          onClick={() => setShowLevelUp(true)}
          className="w-full py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, #4F46E5, #6366F1)', color: '#F8FAFC', boxShadow: '0 0 12px rgba(79,70,229,0.3)' }}
        >
          レベルアップ演出テスト
        </button>
        <button
          onClick={() => { addTotalAlt(50); triggerEarnEffect(50); }}
          className="w-full py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          ALT獲得エフェクトテスト (+50 ALT)
        </button>
      </div>

      <LevelUpModal isOpen={showLevelUp} onClose={() => setShowLevelUp(false)} newLevel={levelInfo.level + 1} title="一人前の探究者" />
    </div>
  );
}
