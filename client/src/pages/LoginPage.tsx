/*
 * LoginPage: Launch screen with Guest play / PIN login choice
 * Dark navy + gold RPG theme. 4-digit PIN input with auto-advance.
 */
import { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { IMAGES } from '@/lib/constants';
import { createGuestAuth, saveAuth } from '@/lib/auth';
import { verifyPin, ensureChildStatus, registerChild } from '@/lib/pinService';
import { saveUserProfile } from '@/lib/userProfileService';

type Screen = 'choice' | 'pin' | 'register';

export default function LoginPage() {
  const [, navigate] = useLocation();
  const setUser = useUserStore((s) => s.setUser);
  const user = useUserStore((s) => s.user);

  const [screen, setScreen] = useState<Screen>('choice');
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Register form
  const [regName, setRegName] = useState('');
  const [regYear, setRegYear] = useState(2015);
  const [regMonth, setRegMonth] = useState(4);
  const [regDay, setRegDay] = useState(1);
  const [regPin, setRegPin] = useState('');
  const [regPinConfirm, setRegPinConfirm] = useState('');
  const [regSuccess, setRegSuccess] = useState<{ pin: string; name: string; childId: string } | null>(null);

  // Guest mode handler
  const handleGuest = useCallback(() => {
    const auth = createGuestAuth();
    setUser({ ...user, id: auth.childId, nickname: auth.childName });
    navigate('/');
  }, [user, setUser, navigate]);

  // PIN digit input handler
  const handleDigitChange = useCallback((index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    setError('');
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    // Auto-advance to next input
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  // Handle backspace to go to previous input
  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }, [digits]);

  // Submit PIN
  const handlePinSubmit = useCallback(async () => {
    const pin = digits.join('');
    if (pin.length !== 4) {
      setError('4桁のPINコードを入力してください');
      return;
    }
    setLoading(true);
    setError('');

    // Admin PIN check
    const adminPin = import.meta.env.VITE_ADMIN_PIN;
    if (adminPin && pin === adminPin) {
      saveAuth('admin', '管理者', true);
      setUser({ ...user, id: 'admin', nickname: '管理者' });
      navigate('/');
      setLoading(false);
      return;
    }

    try {
      const result = await verifyPin(pin);
      if (!result.success || !result.childId || !result.childName) {
        setError(result.error ?? 'PINコードが見つかりません');
        setLoading(false);
        return;
      }
      // Save auth
      saveAuth(result.childId, result.childName);
      // Ensure child_status row exists
      await ensureChildStatus(result.childId);
      // Save user profile (best effort)
      void saveUserProfile(result.childId, result.childName, user.avatarType);
      // Update store
      setUser({ ...user, id: result.childId, nickname: result.childName });
      navigate('/');
    } catch {
      setError('接続エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [digits, user, setUser, navigate]);

  // Auto-submit when all 4 digits are filled
  const allFilled = digits.every((d) => d !== '');

  // ===== Register handler =====
  const handleRegister = useCallback(async () => {
    setError('');
    if (regName.trim().length < 2 || regName.trim().length > 10) {
      setError('名前は2〜10文字で入力してね');
      return;
    }
    if (!/^\d{4}$/.test(regPin)) {
      setError('PINは4桁の数字にしてね');
      return;
    }
    if (regPin !== regPinConfirm) {
      setError('PINが一致しないよ。もう一度確認してね');
      return;
    }
    setLoading(true);
    try {
      const result = await registerChild({
        name: regName.trim(),
        pin: regPin,
        birthYear: regYear,
        birthMonth: regMonth,
        birthDay: regDay,
      });
      if (!result.success || !result.childId) {
        setError(result.error ?? '登録に失敗しました');
        setLoading(false);
        return;
      }
      // Show success screen briefly, then auto-login
      setRegSuccess({ pin: regPin, name: regName.trim(), childId: result.childId });
    } finally {
      setLoading(false);
    }
  }, [regName, regPin, regPinConfirm, regYear, regMonth, regDay]);

  const handleRegisterContinue = useCallback(() => {
    if (!regSuccess) return;
    saveAuth(regSuccess.childId, regSuccess.name);
    void saveUserProfile(regSuccess.childId, regSuccess.name, user.avatarType);
    setUser({ ...user, id: regSuccess.childId, nickname: regSuccess.name });
    navigate('/');
  }, [regSuccess, user, setUser, navigate]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0b1128 100%)' }}
    >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.HERO_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.15) saturate(0.5)' }} />
        <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(255,215,0,0.06), transparent 70%)' }} />
      </div>

      <div className="relative z-10 w-full max-w-[340px]">
        {/* Logo */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl font-bold mb-1"
            style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.3)', fontFamily: 'var(--font-cinzel), serif' }}
          >
            TRAIL QUEST
          </h1>
          <p className="text-sm tracking-[0.3em]" style={{ color: 'rgba(255,215,0,0.5)', fontFamily: 'var(--font-cinzel), serif' }}>
            WORLD
          </p>
          <p className="text-xs text-amber-200/30 mt-2">進むたびに強くなる 学びのゲームワールド</p>
        </div>

        {screen === 'choice' ? (
          /* ---------- Choice screen ---------- */
          <div
            className="rounded-2xl p-6 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '2px solid rgba(255,215,0,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,215,0,0.03)',
            }}
          >
            {/* Corner decorations */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />

            {/* Guest play button */}
            <button
              onClick={handleGuest}
              className="w-full py-4 rounded-xl text-base font-bold mb-4 transition-all duration-200 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                color: '#0b1128',
                boxShadow: '0 4px 16px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              <span className="mr-2">&#x1F3AE;</span>
              ゲストで遊ぶ
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.15)' }} />
              <span className="text-xs text-amber-200/30">または</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,215,0,0.15)' }} />
            </div>

            {/* PIN login button */}
            <button
              onClick={() => setScreen('pin')}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 mb-2"
              style={{
                background: 'rgba(255,215,0,0.08)',
                color: '#ffd700',
                border: '1.5px solid rgba(255,215,0,0.25)',
              }}
            >
              <span className="mr-2">&#x1F511;</span>
              PINでログイン
            </button>

            {/* Register button */}
            <button
              onClick={() => { setScreen('register'); setError(''); }}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95"
              style={{
                background: 'rgba(59,130,246,0.12)',
                color: '#60a5fa',
                border: '1.5px solid rgba(59,130,246,0.35)',
              }}
            >
              <span className="mr-2">&#x1F31F;</span>
              はじめてのひと（<ruby>新規登録<rt>しんきとうろく</rt></ruby>）
            </button>

            <p className="text-center text-[10px] text-amber-200/20 mt-4">
              ゲストモードではデータはこの端末にのみ保存されます
            </p>
          </div>
        ) : screen === 'register' ? (
          /* ---------- Register screen ---------- */
          <div
            className="rounded-2xl p-5 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '2px solid rgba(255,215,0,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}
          >
            {regSuccess ? (
              <div className="text-center">
                <div className="text-5xl mb-2">🎉</div>
                <h2 className="text-base font-bold mb-3" style={{ color: '#ffd700' }}>
                  <ruby>登録完了<rt>とうろくかんりょう</rt></ruby>！
                </h2>
                <p className="text-sm text-amber-100 mb-1"><strong>{regSuccess.name}</strong>さん</p>
                <p className="text-[13px] text-amber-200/80 mb-3">PINは</p>
                <p className="text-3xl font-black mb-3 tracking-[0.4em]" style={{ color: '#ffd700', textShadow: '0 0 14px rgba(255,215,0,0.5)' }}>
                  {regSuccess.pin}
                </p>
                <p className="text-xs text-amber-200/70 mb-5">
                  <ruby>忘<rt>わす</rt></ruby>れないでね！<br />
                  <ruby>次回<rt>じかい</rt></ruby>からはこのPINでログインするよ
                </p>
                <button
                  onClick={handleRegisterContinue}
                  className="w-full py-3 rounded-xl text-base font-bold active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                    color: '#0b1128',
                    boxShadow: '0 4px 16px rgba(255,215,0,0.4)',
                  }}>
                  <ruby>始<rt>はじ</rt></ruby>める
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-center text-base font-bold mb-4" style={{ color: '#ffd700' }}>
                  <ruby>新規登録<rt>しんきとうろく</rt></ruby>
                </h2>

                {/* 名前 */}
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">
                    <ruby>名前<rt>なまえ</rt></ruby>（ニックネーム）
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={regName}
                    onChange={(e) => { setRegName(e.target.value); setError(''); }}
                    placeholder="たろう"
                    className="w-full py-2.5 px-3 rounded-lg text-sm outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#ffd700',
                      border: '1.5px solid rgba(255,215,0,0.3)',
                    }}
                  />
                  <p className="text-[10px] text-amber-200/40 mt-0.5">2〜10<ruby>文字<rt>もじ</rt></ruby></p>
                </div>

                {/* 生年月日 */}
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">
                    <ruby>生年月日<rt>せいねんがっぴ</rt></ruby>
                  </label>
                  <div className="flex gap-2">
                    <select value={regYear} onChange={(e) => setRegYear(Number(e.target.value))}
                      className="flex-1 py-2 px-2 rounded-lg text-sm"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#ffd700', border: '1.5px solid rgba(255,215,0,0.3)' }}>
                      {Array.from({ length: 11 }, (_, i) => 2010 + i).map((y) => (
                        <option key={y} value={y} style={{ background: '#0b1128' }}>{y}年</option>
                      ))}
                    </select>
                    <select value={regMonth} onChange={(e) => setRegMonth(Number(e.target.value))}
                      className="py-2 px-2 rounded-lg text-sm"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#ffd700', border: '1.5px solid rgba(255,215,0,0.3)' }}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m} style={{ background: '#0b1128' }}>{m}月</option>
                      ))}
                    </select>
                    <select value={regDay} onChange={(e) => setRegDay(Number(e.target.value))}
                      className="py-2 px-2 rounded-lg text-sm"
                      style={{ background: 'rgba(255,255,255,0.06)', color: '#ffd700', border: '1.5px solid rgba(255,215,0,0.3)' }}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d} style={{ background: '#0b1128' }}>{d}日</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* PIN */}
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">
                    PIN（4<ruby>桁<rt>けた</rt></ruby>の<ruby>数字<rt>すうじ</rt></ruby>）
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={regPin}
                    onChange={(e) => { setRegPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                    placeholder="0000"
                    className="w-full py-2.5 px-3 rounded-lg text-lg tracking-[0.5em] text-center outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#ffd700',
                      border: '1.5px solid rgba(255,215,0,0.3)',
                    }}
                  />
                </div>

                {/* PIN confirm */}
                <div className="mb-3">
                  <label className="block text-[11px] font-bold text-amber-200/80 mb-1">
                    PIN（<ruby>確認<rt>かくにん</rt></ruby>のため、もう<ruby>一度<rt>いちど</rt></ruby>）
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={regPinConfirm}
                    onChange={(e) => { setRegPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4)); setError(''); }}
                    placeholder="0000"
                    className="w-full py-2.5 px-3 rounded-lg text-lg tracking-[0.5em] text-center outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      color: '#ffd700',
                      border: '1.5px solid rgba(255,215,0,0.3)',
                    }}
                  />
                </div>

                {error && (
                  <p className="text-center text-xs mb-3" style={{ color: '#ef4444' }}>⚠️ {error}</p>
                )}

                <button
                  onClick={handleRegister}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-base font-bold mb-2 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                    color: '#0b1128',
                    boxShadow: '0 4px 16px rgba(255,215,0,0.3)',
                  }}>
                  {loading ? '登録中...' : <><ruby>登録<rt>とうろく</rt></ruby>する</>}
                </button>
                <button
                  onClick={() => { setScreen('choice'); setError(''); }}
                  className="w-full text-center text-xs py-2"
                  style={{ color: 'rgba(255,215,0,0.4)' }}>
                  ← <ruby>戻<rt>もど</rt></ruby>る
                </button>
              </>
            )}
          </div>
        ) : (
          /* ---------- PIN input screen ---------- */
          <div
            className="rounded-2xl p-6 relative"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '2px solid rgba(255,215,0,0.2)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px rgba(255,215,0,0.03)',
            }}
          >
            {/* Corner decorations */}
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(255,215,0,0.3)' }} />

            <h2 className="text-center text-sm font-bold mb-5" style={{ color: '#ffd700' }}>
              PINコードを入力
            </h2>

            {/* 4-digit PIN boxes */}
            <div className="flex justify-center gap-3 mb-5">
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  autoFocus={i === 0}
                  className="w-14 h-16 text-center text-2xl font-bold rounded-xl outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    color: '#ffd700',
                    border: digit
                      ? '2px solid rgba(255,215,0,0.5)'
                      : '2px solid rgba(255,215,0,0.15)',
                    boxShadow: digit ? '0 0 12px rgba(255,215,0,0.15)' : 'none',
                    caretColor: '#ffd700',
                  }}
                />
              ))}
            </div>

            {/* Error message */}
            {error && (
              <p className="text-center text-xs mb-4" style={{ color: '#ef4444' }}>
                {error}
              </p>
            )}

            {/* Submit button */}
            <button
              onClick={handlePinSubmit}
              disabled={!allFilled || loading}
              className="w-full py-3 rounded-xl text-sm font-bold mb-4 transition-all duration-200 active:scale-95 disabled:opacity-40"
              style={{
                background: allFilled
                  ? 'linear-gradient(135deg, #ffd700, #d4a500)'
                  : 'rgba(255,215,0,0.15)',
                color: allFilled ? '#0b1128' : 'rgba(255,215,0,0.4)',
                boxShadow: allFilled ? '0 4px 16px rgba(255,215,0,0.3)' : 'none',
              }}
            >
              {loading ? 'ログイン中...' : 'ログイン'}
            </button>

            {/* Back to guest */}
            <button
              onClick={() => {
                setScreen('choice');
                setDigits(['', '', '', '']);
                setError('');
              }}
              className="w-full text-center text-xs py-2 transition-colors"
              style={{ color: 'rgba(255,215,0,0.4)' }}
            >
              &larr; ゲストで遊ぶ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
