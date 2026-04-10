/*
 * MyPage: Profile, statistics, settings
 * Fantasy adventurer's guild card style, ornate profile frame
 * Includes avatar change, Level Up & ALT effect test buttons
 * Shows equipped shop avatar if one is equipped
 */
import { useState } from 'react';
import { useUserStore, useAltStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';
import { IMAGES, CLASS_LIST, AVATAR_ITEMS } from '@/lib/constants';
import { Link } from 'wouter';
import LevelUpModal from '@/components/effects/LevelUpModal';
import type { AvatarType } from '@/lib/types';

export default function MyPage() {
  const user = useUserStore((s) => s.user);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const setAvatarType = useUserStore((s) => s.setAvatarType);
  const equipAvatar = useUserStore((s) => s.equipAvatar);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);
  const levelInfo = calculateLevel(user.totalAlt);
  const classLabel = CLASS_LIST.find((c) => c.id === user.classId)?.label || user.classId;
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Get current avatar image (equipped shop avatar or default)
  const getAvatarIcon = () => {
    if (user.equippedAvatarId && AVATAR_ITEMS[user.equippedAvatarId]) {
      return AVATAR_ITEMS[user.equippedAvatarId].icon;
    }
    return user.avatarType === 'girl' ? IMAGES.CHARACTER_GIRL : IMAGES.CHARACTER_BOY;
  };

  const stats = [
    { label: 'プレイ回数', value: '42', icon: '🎮' },
    { label: '総獲得ALT', value: user.totalAlt.toLocaleString(), icon: '💰' },
    { label: '連続ログイン', value: `${user.streakDays}日`, icon: '🔥' },
    { label: 'カード所持', value: '8/16', icon: '🃏' },
    { label: 'ベストスコア', value: '520', icon: '🏆' },
    { label: 'クリア率', value: '85%', icon: '✅' },
  ];

  const handleAvatarSelect = (type: AvatarType) => {
    setAvatarType(type);
    equipAvatar(null); // Reset equipped shop avatar when selecting default
    setShowAvatarPicker(false);
  };

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Title */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 0 10px rgba(59,130,246,0.3)' }}>
          <span className="text-lg">👤</span>
        </div>
        <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>マイページ</h1>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
      </div>

      {/* Profile Card */}
      <div className="rounded-2xl overflow-hidden mb-4 relative"
        style={{
          border: '2px solid rgba(255,215,0,0.3)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,215,0,0.05)',
          background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
        }}>
        <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm z-10" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
        <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm z-10" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />

        <div className="h-20 relative">
          <img src={IMAGES.HERO_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.3) saturate(0.5)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(14,20,45,0.9))' }} />
        </div>

        <div className="px-4 pb-4 -mt-8 relative">
          <div className="flex items-end gap-3 mb-3">
            {/* Avatar with change button */}
            <button onClick={() => setShowAvatarPicker(true)} className="relative group flex-shrink-0">
              <div className="w-16 h-16 rounded-full overflow-hidden relative"
                style={{ border: '3px solid #ffd700', boxShadow: '0 0 12px rgba(255,215,0,0.4), 0 0 24px rgba(255,215,0,0.15)' }}>
                <img src={getAvatarIcon()} alt="avatar" className="w-full h-full object-cover object-top" />
              </div>
              <div className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.5)' }}>
                <span className="text-xs text-white font-bold">変更</span>
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[8px]"
                style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128', border: '2px solid #0b1128' }}>
                ✏️
              </div>
            </button>
            <div className="flex-1 min-w-0 pb-1">
              <h2 className="text-lg font-bold text-amber-100">{user.nickname}</h2>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>{classLabel}</span>
                <span className="text-[10px] text-amber-200/30">ID: {user.id}</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,215,0,0.15)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2 py-0.5 rounded"
                  style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128', boxShadow: '0 0 6px rgba(255,215,0,0.2)' }}>
                  Lv.{levelInfo.level}
                </span>
                <span className="text-xs text-amber-200/50">{levelInfo.title}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                  style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}>A</div>
                <span className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>{user.currentAlt.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full h-2.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${levelInfo.progress * 100}%`, background: 'linear-gradient(90deg, #22c55e, #4ade80)', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-amber-200/25">{user.totalAlt} ALT</span>
              <span className="text-[9px] text-amber-200/25">{levelInfo.nextLevelAlt ? `次のレベル: ${levelInfo.nextLevelAlt} ALT` : 'MAX'}</span>
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
            <div key={stat.label} className="rounded-xl p-2.5 text-center animate-slide-up relative"
              style={{
                animationDelay: `${i * 50}ms`,
                background: 'linear-gradient(135deg, rgba(21,29,59,0.9), rgba(14,20,45,0.9))',
                border: '1px solid rgba(255,215,0,0.1)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              }}>
              <span className="text-lg block mb-1">{stat.icon}</span>
              <p className="text-sm font-bold text-amber-100 font-[var(--font-orbitron)]">{stat.value}</p>
              <p className="text-[9px] text-amber-200/35 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="space-y-2 mb-4">
        <Link href="/collection">
          <div className="rounded-xl p-3 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg, rgba(168,85,247,0.08), rgba(168,85,247,0.03))', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div className="flex items-center gap-2"><span>🃏</span><span className="text-sm text-amber-100">カードコレクション</span></div>
            <span className="text-amber-200/25 text-sm">→</span>
          </div>
        </Link>
        <Link href="/shop">
          <div className="rounded-xl p-3 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))', border: '1px solid rgba(255,215,0,0.15)' }}>
            <div className="flex items-center gap-2"><span>🛒</span><span className="text-sm text-amber-100">ショップ</span></div>
            <span className="text-amber-200/25 text-sm">→</span>
          </div>
        </Link>
        <Link href="/admin">
          <div className="rounded-xl p-3 flex items-center justify-between transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex items-center gap-2"><span>⚙️</span><span className="text-sm text-amber-100">管理者ダッシュボード</span></div>
            <span className="text-amber-200/25 text-sm">→</span>
          </div>
        </Link>
        <div className="rounded-xl p-3 flex items-center justify-between opacity-40"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2"><span>🔧</span><span className="text-sm text-amber-100">設定</span></div>
          <span className="text-[10px] text-amber-200/25">Coming Soon</span>
        </div>
      </div>

      {/* Test Buttons */}
      <div className="rounded-xl p-3 space-y-2"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,85,247,0.15)' }}>
        <p className="text-[10px] text-amber-200/30 font-bold mb-1">演出テスト</p>
        <button onClick={() => setShowLevelUp(true)}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(168,85,247,0.05))',
            border: '1px solid rgba(168,85,247,0.3)', color: '#a855f7', boxShadow: '0 0 12px rgba(168,85,247,0.1)',
          }}>
          ✨ レベルアップ演出テスト
        </button>
        <button onClick={() => { addTotalAlt(50); triggerEarnEffect(50); }}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,215,0,0.03))',
            border: '1px solid rgba(255,215,0,0.2)', color: '#ffd700',
          }}>
          💰 ALT獲得エフェクトテスト (+50 ALT)
        </button>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center px-6"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setShowAvatarPicker(false)}>
          <div className="w-full max-w-[320px] rounded-2xl p-5 relative"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '2px solid rgba(255,215,0,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,0,0.05)',
              animation: 'scale-in 0.3s ease-out',
            }}>
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />

            <h3 className="text-center text-sm font-bold mb-4" style={{ color: '#ffd700' }}>キャラクターを変更</h3>

            <div className="flex justify-center gap-6">
              {/* Boy */}
              <button onClick={() => handleAvatarSelect('boy')} className="flex flex-col items-center gap-2 transition-all duration-300"
                style={{ transform: user.avatarType === 'boy' && !user.equippedAvatarId ? 'scale(1.05)' : 'scale(0.95)', opacity: user.avatarType === 'boy' && !user.equippedAvatarId ? 1 : 0.5 }}>
                <div className="w-20 h-20 rounded-full overflow-hidden relative"
                  style={{
                    border: user.avatarType === 'boy' && !user.equippedAvatarId ? '3px solid #ffd700' : '3px solid rgba(255,215,0,0.15)',
                    boxShadow: user.avatarType === 'boy' && !user.equippedAvatarId ? '0 0 16px rgba(255,215,0,0.4)' : 'none',
                    transition: 'all 0.3s ease',
                  }}>
                  <img src={IMAGES.CHARACTER_BOY} alt="男の子" className="w-full h-full object-cover object-top" />
                </div>
                {user.avatarType === 'boy' && !user.equippedAvatarId && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128' }}>✓</div>
                )}
                <span className="text-xs font-medium" style={{ color: user.avatarType === 'boy' && !user.equippedAvatarId ? '#ffd700' : 'rgba(255,215,0,0.35)' }}>男の子</span>
              </button>

              {/* Girl */}
              <button onClick={() => handleAvatarSelect('girl')} className="flex flex-col items-center gap-2 transition-all duration-300"
                style={{ transform: user.avatarType === 'girl' && !user.equippedAvatarId ? 'scale(1.05)' : 'scale(0.95)', opacity: user.avatarType === 'girl' && !user.equippedAvatarId ? 1 : 0.5 }}>
                <div className="w-20 h-20 rounded-full overflow-hidden relative"
                  style={{
                    border: user.avatarType === 'girl' && !user.equippedAvatarId ? '3px solid #ffd700' : '3px solid rgba(255,215,0,0.15)',
                    boxShadow: user.avatarType === 'girl' && !user.equippedAvatarId ? '0 0 16px rgba(255,215,0,0.4)' : 'none',
                    transition: 'all 0.3s ease',
                  }}>
                  <img src={IMAGES.CHARACTER_GIRL} alt="女の子" className="w-full h-full object-cover object-top" />
                </div>
                {user.avatarType === 'girl' && !user.equippedAvatarId && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
                    style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128' }}>✓</div>
                )}
                <span className="text-xs font-medium" style={{ color: user.avatarType === 'girl' && !user.equippedAvatarId ? '#ffd700' : 'rgba(255,215,0,0.35)' }}>女の子</span>
              </button>
            </div>

            <button onClick={() => setShowAvatarPicker(false)}
              className="rpg-btn rpg-btn-gold w-full mt-5 py-2.5">
              閉じる
            </button>
          </div>
        </div>
      )}

      <LevelUpModal isOpen={showLevelUp} onClose={() => setShowLevelUp(false)} newLevel={levelInfo.level + 1} title="一人前の探究者" />
    </div>
  );
}
