/*
 * LoginPage: Fantasy RPG adventurer registration
 * Gold ornate styling with character art
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { IMAGES } from '@/lib/constants';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const setNickname = useUserStore((s) => s.setNickname);
  const [name, setName] = useState('');

  const handleStart = () => {
    if (name.trim()) setNickname(name.trim());
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

      <div className="relative z-10 w-full max-w-[320px]">
        {/* Logo area */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 mx-auto mb-3 rounded-full overflow-hidden"
            style={{ border: '3px solid rgba(255,215,0,0.4)', boxShadow: '0 0 20px rgba(255,215,0,0.2)' }}>
            <img src={IMAGES.CHARACTER} alt="" className="w-full h-full object-cover object-top" />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.3)', fontFamily: 'var(--font-cinzel), serif' }}>
            TRAIL QUEST
          </h1>
          <p className="text-sm tracking-[0.3em]" style={{ color: 'rgba(255,215,0,0.5)', fontFamily: 'var(--font-cinzel), serif' }}>WORLD</p>
          <p className="text-xs text-amber-200/30 mt-2">進むたびに強くなる 学びのゲームワールド</p>
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
            ニックネームは後から変更できます
          </p>
        </div>
      </div>
    </div>
  );
}
