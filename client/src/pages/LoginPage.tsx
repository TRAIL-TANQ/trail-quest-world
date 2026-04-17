/*
 * LoginPage — 名前ログイン
 *
 * 生徒 20名の名簿に対して、ひらがな名前で自己申告ログインする。
 * 児童向けUXのため PIN なし、ただし管理者/モニターだけは PIN 入力画面を残す。
 *
 * childId: 'スターター_はるか' のようにクラス略称+名前で組み立てる
 * （Supabase child_status は text 型なので INSERT で受け付けられる前提）
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useUserStore, useCollectionStore } from '@/lib/stores';
import { IMAGES } from '@/lib/constants';
import { saveAuth, getAuth } from '@/lib/auth';
import { ensureChildStatus } from '@/lib/pinService';
import { saveUserProfile } from '@/lib/userProfileService';
import { COLLECTION_CARDS } from '@/lib/cardData';
import {
  STUDENTS,
  findStudentByName,
  kanaToHira,
  buildStudentChildId,
  type StudentRecord,
} from '@/data/students';

type Screen = 'name' | 'confirm' | 'admin';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const setUser = useUserStore((s) => s.setUser);
  const user = useUserStore((s) => s.user);

  const [screen, setScreen] = useState<Screen>('name');
  const [nameInput, setNameInput] = useState('');
  const [matched, setMatched] = useState<StudentRecord | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin PIN
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 既ログインなら自動で/へ戻す（auth.ts の isGuest 判定に準拠）
  useEffect(() => {
    const a = getAuth();
    if (!a.isGuest) {
      navigate('/');
    }
  }, [navigate]);

  // ===== Name login =====
  const handleNameChange = (v: string) => {
    setError('');
    // カタカナ→ひらがなに自動変換して格納
    setNameInput(kanaToHira(v));
  };

  const handleNameSubmit = useCallback(() => {
    const s = findStudentByName(nameInput);
    if (!s) {
      setError('みつからないよ。もういちどいれてね');
      return;
    }
    setMatched(s);
    setScreen('confirm');
  }, [nameInput]);

  const finalizeStudentLogin = useCallback(async () => {
    if (!matched) return;
    setLoading(true);
    const childId = buildStudentChildId(matched);
    const displayName = matched.name;
    try {
      saveAuth(childId, displayName);
      // Supabase: child_status を ensure（失敗しても catch 内でスルー）
      await ensureChildStatus(childId);
      void saveUserProfile(childId, displayName, user.avatarType);
      setUser({ ...user, id: childId, nickname: displayName });
      navigate('/');
    } catch {
      // 予期せぬ例外時もログインは継続（localStorage にauth済み）
      setUser({ ...user, id: childId, nickname: displayName });
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [matched, user, setUser, navigate]);

  // ===== Admin PIN =====
  const handleDigitChange = useCallback((index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setError('');
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  const handlePinSubmit = useCallback(() => {
    const pin = digits.join('');
    if (pin.length !== 4) { setError('4桁のPINを入力してね'); return; }
    setError('');
    const monitorPin = import.meta.env.VITE_MONITOR_PIN || '0000';
    const adminPin = import.meta.env.VITE_ADMIN_PIN || '9999';

    if (pin === monitorPin) {
      saveAuth('monitor', 'モニター', false, true);
      const allIds = COLLECTION_CARDS.map((c) => c.id);
      useCollectionStore.getState().initOwned(allIds);
      setUser({ ...user, id: 'monitor', nickname: 'モニター' });
      navigate('/');
      return;
    }
    if (pin === adminPin) {
      saveAuth('admin', '管理者', true);
      setUser({ ...user, id: 'admin', nickname: '管理者' });
      navigate('/');
      return;
    }
    setError('PINが違うよ');
  }, [digits, user, setUser, navigate]);

  const goToAdmin = () => {
    setScreen('admin');
    setDigits(['', '', '', '']);
    setError('');
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0b1128 100%)' }}
    >
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.HERO_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.15) saturate(0.5)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.06), transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[340px]">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1"
            style={{ color: '#ffd700', fontFamily: 'var(--font-cinzel), serif', letterSpacing: '0.08em', textShadow: '0 0 15px rgba(255,215,0,0.3)' }}
          >
            🎮 TRAIL QUEST WORLD
          </h1>
          <p className="text-sm tracking-[0.3em]" style={{ color: 'rgba(255,215,0,0.5)', fontFamily: 'var(--font-cinzel), serif' }}>
            トレイル クエスト ワールド
          </p>
          <p className="text-xs text-amber-200/30 mt-2">学びのゲームワールド</p>
        </div>

        {/* ===== Name screen ===== */}
        {screen === 'name' && (
          <div
            className="rounded-2xl p-6 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '2px solid rgba(255,215,0,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,215,0,0.03)',
            }}
          >
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />

            <p className="text-center text-base font-bold mb-4" style={{ color: '#ffd700' }}>
              なまえをいれてね
            </p>

            <input
              type="text"
              autoFocus
              inputMode="text"
              value={nameInput}
              onChange={(e) => handleNameChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameSubmit(); }}
              placeholder="ひらがなでにゅうりょく"
              maxLength={12}
              className="w-full px-4 py-3 rounded-xl text-center text-lg font-bold mb-3"
              style={{
                background: 'rgba(0,0,0,0.4)',
                border: '2px solid rgba(255,215,0,0.3)',
                color: '#fff',
                outline: 'none',
                letterSpacing: '0.15em',
                caretColor: '#ffd700',
              }}
            />

            {error && (
              <p className="text-center text-[12px] mb-3" style={{ color: '#f87171' }}>{error}</p>
            )}

            <button
              onClick={handleNameSubmit}
              disabled={!nameInput.trim() || loading}
              className="w-full py-3 rounded-xl text-base font-bold transition-all active:scale-95 disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                color: '#0b1128',
                boxShadow: '0 4px 16px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
                minHeight: 48,
              }}
            >
              ログイン
            </button>

            <p className="text-[10px] text-center mt-3" style={{ color: 'rgba(255,215,0,0.5)' }}>
              （カタカナ入力も自動でひらがなに変わるよ）
            </p>

            {/* Admin link */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,215,0,0.1)' }}>
              <button
                onClick={goToAdmin}
                className="w-full text-[11px] transition-all active:scale-95"
                style={{ color: 'rgba(255,215,0,0.4)' }}
              >
                🔧 管理者
              </button>
            </div>
          </div>
        )}

        {/* ===== Confirm screen ===== */}
        {screen === 'confirm' && matched && (
          <div
            className="rounded-2xl p-6 text-center relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '2px solid rgba(255,215,0,0.35)',
              boxShadow: '0 4px 24px rgba(255,215,0,0.12)',
            }}
          >
            <div className="text-5xl mb-2">{matched.emoji}</div>
            <p className="text-[12px] mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>{matched.className}</p>
            <p className="text-xl font-black mb-4" style={{ color: '#ffd700' }}>
              {matched.name}さん
            </p>
            <p className="text-sm mb-5 text-amber-100">でいい？</p>

            <div className="flex gap-2">
              <button
                onClick={() => { setScreen('name'); setMatched(null); }}
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,215,0,0.65)',
                  border: '1.5px solid rgba(255,215,0,0.2)',
                  minHeight: 48,
                }}
              >
                ちがう
              </button>
              <button
                onClick={finalizeStudentLogin}
                disabled={loading}
                className="flex-1 py-3 rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-40"
                style={{
                  background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                  color: '#0b1128',
                  boxShadow: '0 4px 16px rgba(255,215,0,0.3)',
                  minHeight: 48,
                }}
              >
                はい！
              </button>
            </div>
          </div>
        )}

        {/* ===== Admin PIN screen ===== */}
        {screen === 'admin' && (
          <div
            className="rounded-2xl p-6 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '2px solid rgba(255,215,0,0.2)',
            }}
          >
            <button
              onClick={() => { setScreen('name'); setError(''); }}
              className="text-[12px] mb-3"
              style={{ color: 'rgba(255,215,0,0.5)' }}
            >
              ← もどる
            </button>
            <p className="text-center text-sm font-bold mb-4" style={{ color: '#ffd700' }}>
              管理者PIN (4桁)
            </p>
            <div className="flex justify-center gap-2 mb-3">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="password"
                  inputMode="numeric"
                  pattern="\d*"
                  maxLength={1}
                  value={digits[i]}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-12 h-14 text-center text-2xl font-bold rounded-lg"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '2px solid rgba(255,215,0,0.3)',
                    color: '#fff',
                    outline: 'none',
                  }}
                />
              ))}
            </div>
            {error && (
              <p className="text-center text-[12px] mb-3" style={{ color: '#f87171' }}>{error}</p>
            )}
            <button
              onClick={handlePinSubmit}
              className="w-full py-3 rounded-xl text-base font-bold active:scale-95"
              style={{
                background: 'rgba(255,215,0,0.12)',
                color: '#ffd700',
                border: '1.5px solid rgba(255,215,0,0.3)',
                minHeight: 48,
              }}
            >
              ログイン
            </button>
            <p className="text-[10px] text-center mt-3" style={{ color: 'rgba(255,215,0,0.4)' }}>
              管理者(9999) / モニター(0000)
            </p>
          </div>
        )}

        {/* Student roster hint (small, just to confirm who is registered) */}
        {screen === 'name' && (
          <p className="text-[9px] text-center mt-4" style={{ color: 'rgba(255,215,0,0.25)' }}>
            登録ずみ {STUDENTS.length}めい
          </p>
        )}
      </div>
    </div>
  );
}
