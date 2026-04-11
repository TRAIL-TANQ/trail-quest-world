/*
 * LoginPage: Fantasy RPG adventurer registration with avatar selection
 * Gold ornate styling with character art + boy/girl toggle
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { IMAGES } from '@/lib/constants';
import { saveUserProfile } from '@/lib/userProfileService';
import type { AvatarType } from '@/lib/types';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const userId = useUserStore((s) => s.user.id);
  const setNickname = useUserStore((s) => s.setNickname);
  const setAvatarType = useUserStore((s) => s.setAvatarType);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarType>('boy');

  const handleStart = () => {
    const finalName = name.trim() || 'ぼうけんしゃ';
    setNickname(finalName);
    setAvatarType(selectedAvatar);
    // 変更17: Supabase user_profile に永続化（失敗してもログインは続行）
    void saveUserProfile(userId, finalName, selectedAvatar);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0b1128 100%)' }}>
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.HERO_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.15) saturate(0.5)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.06), transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[340px]">
        {/* Logo area */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.3)', fontFamily: 'var(--font-cinzel), serif' }}>
            TRAIL QUEST
          </h1>
          <p className="text-sm tracking-[0.3em]" style={{ color: 'rgba(255,215,0,0.5)', fontFamily: 'var(--font-cinzel), serif' }}>WORLD</p>
          <p className="text-xs text-amber-200/30 mt-2">進むたびに強くなる 学びのゲームワールド</p>
        </div>

        {/* Avatar Selection */}
        <div className="mb-4">
          <label className="text-xs font-bold block mb-3 text-amber-200/50 text-center">キャラクターを選ぼう</label>
          <div className="flex justify-center gap-5">
            {/* Boy */}
            <button
              onClick={() => setSelectedAvatar('boy')}
              className="relative flex flex-col items-center transition-all duration-300"
              style={{ transform: selectedAvatar === 'boy' ? 'scale(1.05)' : 'scale(0.95)', opacity: selectedAvatar === 'boy' ? 1 : 0.5 }}
            >
              <div className="w-24 h-24 rounded-full overflow-hidden relative"
                style={{
                  border: selectedAvatar === 'boy' ? '3px solid #ffd700' : '3px solid rgba(255,215,0,0.15)',
                  boxShadow: selectedAvatar === 'boy' ? '0 0 20px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.1)' : 'none',
                  transition: 'all 0.3s ease',
                }}>
                <img src={IMAGES.CHARACTER_BOY} alt="男の子" className="w-full h-full object-cover object-top" />
              </div>
              {selectedAvatar === 'boy' && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128', boxShadow: '0 2px 8px rgba(255,215,0,0.4)' }}>
                  ✓
                </div>
              )}
              <span className="text-xs mt-2 font-medium" style={{ color: selectedAvatar === 'boy' ? '#ffd700' : 'rgba(255,215,0,0.35)' }}>
                男の子
              </span>
            </button>

            {/* Girl */}
            <button
              onClick={() => setSelectedAvatar('girl')}
              className="relative flex flex-col items-center transition-all duration-300"
              style={{ transform: selectedAvatar === 'girl' ? 'scale(1.05)' : 'scale(0.95)', opacity: selectedAvatar === 'girl' ? 1 : 0.5 }}
            >
              <div className="w-24 h-24 rounded-full overflow-hidden relative"
                style={{
                  border: selectedAvatar === 'girl' ? '3px solid #ffd700' : '3px solid rgba(255,215,0,0.15)',
                  boxShadow: selectedAvatar === 'girl' ? '0 0 20px rgba(255,215,0,0.4), 0 0 40px rgba(255,215,0,0.1)' : 'none',
                  transition: 'all 0.3s ease',
                }}>
                <img src={IMAGES.CHARACTER_GIRL} alt="女の子" className="w-full h-full object-cover object-top" />
              </div>
              {selectedAvatar === 'girl' && (
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128', boxShadow: '0 2px 8px rgba(255,215,0,0.4)' }}>
                  ✓
                </div>
              )}
              <span className="text-xs mt-2 font-medium" style={{ color: selectedAvatar === 'girl' ? '#ffd700' : 'rgba(255,215,0,0.35)' }}>
                女の子
              </span>
            </button>
          </div>
        </div>

        {/* Input card */}
        <div className="rounded-2xl p-5 relative"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '2px solid rgba(255,215,0,0.2)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,215,0,0.03)',
          }}>
          <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
          <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
          <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
          <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />

          <label className="text-xs font-bold block mb-2 text-amber-200/50">冒険者の名前</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ニックネームを入力..."
            maxLength={12}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all mb-4"
            style={{
              background: 'rgba(255,255,255,0.04)',
              color: '#fde68a',
              border: '1px solid rgba(255,215,0,0.15)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.4)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(255,215,0,0.1)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,215,0,0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
          />

          <button onClick={handleStart}
            className="rpg-btn rpg-btn-gold w-full py-3 flex items-center justify-center gap-2">
            <span>⚔️</span> 冒険をはじめる
          </button>

          <p className="text-center text-[10px] text-amber-200/20 mt-3">
            ニックネームとキャラクターは後から変更できます
          </p>
        </div>
      </div>
    </div>
  );
}
