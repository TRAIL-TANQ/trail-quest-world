/*
 * LoginPage: Dark UI × Neon - Simple login screen
 */
import { useState } from 'react';
import { useLocation } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const setNickname = useUserStore((s) => s.setNickname);
  const [name, setName] = useState('');

  const handleStart = () => {
    if (name.trim()) {
      setNickname(name.trim());
    }
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: '#0F172A' }}>
      {/* Logo area */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🗺️</div>
        <h1 className="text-2xl font-black mb-1" style={{ color: '#F8FAFC' }}>
          TRAIL QUEST
        </h1>
        <p className="text-sm" style={{ color: '#4F46E5' }}>WORLD</p>
      </div>

      {/* Input area */}
      <div className="w-full max-w-[280px] space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: '#94A3B8' }}>ニックネーム</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="冒険者の名前を入力..."
            maxLength={12}
            className="w-full px-4 py-3 rounded-xl text-sm font-medium outline-none transition-all"
            style={{
              background: '#1E293B',
              color: '#F8FAFC',
              border: '1px solid rgba(79,70,229,0.3)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(79,70,229,0.6)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(79,70,229,0.2)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(79,70,229,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        <button
          onClick={handleStart}
          className="w-full py-3 rounded-xl text-sm font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #6366F1)',
            color: '#F8FAFC',
            boxShadow: '0 0 16px rgba(79,70,229,0.3)',
          }}
        >
          <Sparkles className="w-4 h-4" /> 冒険をはじめる
        </button>

        <p className="text-center text-[10px]" style={{ color: '#64748B' }}>
          ニックネームは後から変更できます
        </p>
      </div>
    </div>
  );
}
