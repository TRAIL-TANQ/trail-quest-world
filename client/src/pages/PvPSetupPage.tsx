/*
 * PvPSetupPage: 2人対戦セットアップ（ローカル同端末、画面共有）
 *
 * 画面反転・端末受け渡しはなし。2人とも同じ側から画面を見る前提。
 * フロー:
 *  1. P1 PIN入力 → デッキ選択
 *  2. P2 PIN入力 → デッキ選択（P1と異なるアカウントのみ）
 *  3. 「対戦開始！」→ /games/knowledge-challenger/pvp/battle へ
 *
 * 管理者PINの場合は全デッキ解放。
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { STARTER_DECKS } from '@/lib/stages';
import type { StarterDeck } from '@/lib/stages';
import { verifyPvPPin, loadQuestProgressFor, isStarterDeckUnlockedFor, getUnlockedSSRCardNamesFor } from '@/lib/pvpAuth';
import type { QuestProgressData } from '@/lib/questProgress';
import { savePvPSession, clearPvPSession } from '@/lib/pvpSession';
import type { PvPPlayer, PvPRoundCount } from '@/lib/pvpSession';

type Phase = 'p1-pin' | 'p1-deck' | 'p2-pin' | 'p2-deck' | 'ready';

interface PlayerDraft {
  childId: string;
  childName: string;
  isAdmin: boolean;
  progress: QuestProgressData;
  unlockedSSRCardNames: string[];
  deckId: string | null;
}

function PinInput({
  title,
  accentColor,
  onVerified,
}: {
  title: string;
  accentColor: string;
  onVerified: (p: { childId: string; childName: string; isAdmin: boolean }) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setError('');
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = useCallback(async () => {
    const pin = digits.join('');
    if (pin.length !== 4) {
      setError('4桁のPINコードを入力してください');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await verifyPvPPin(pin);
      if (!result.success || !result.childId || !result.childName) {
        setError(result.error ?? 'PINコードが見つかりません');
        setLoading(false);
        return;
      }
      onVerified({ childId: result.childId, childName: result.childName, isAdmin: !!result.isAdmin });
    } catch {
      setError('接続エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }, [digits, onVerified]);

  const allFilled = digits.every((d) => d !== '');

  return (
    <div
      className="rounded-2xl p-6 relative max-w-[340px] mx-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
        border: `2px solid ${accentColor}55`,
        boxShadow: `0 4px 20px rgba(0,0,0,0.4), inset 0 0 20px ${accentColor}08`,
      }}
    >
      <h2 className="text-center text-sm font-bold mb-5" style={{ color: accentColor }}>
        {title}
      </h2>
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
              color: accentColor,
              border: digit ? `2px solid ${accentColor}88` : `2px solid ${accentColor}33`,
              boxShadow: digit ? `0 0 12px ${accentColor}33` : 'none',
              caretColor: accentColor,
            }}
          />
        ))}
      </div>
      {error && <p className="text-center text-xs mb-4" style={{ color: '#ef4444' }}>{error}</p>}
      <button
        onClick={handleSubmit}
        disabled={!allFilled || loading}
        className="w-full py-3 rounded-xl text-sm font-bold transition-all duration-200 active:scale-95 disabled:opacity-40"
        style={{
          background: allFilled ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` : `${accentColor}22`,
          color: allFilled ? '#0b1128' : `${accentColor}77`,
        }}
      >
        {loading ? '確認中...' : 'ログイン'}
      </button>
    </div>
  );
}

function DeckPicker({
  title,
  accentColor,
  progress,
  isAdmin,
  onSelect,
}: {
  title: string;
  accentColor: string;
  progress: QuestProgressData;
  isAdmin: boolean;
  onSelect: (deck: StarterDeck) => void;
}) {
  const [selected, setSelected] = useState<StarterDeck | null>(null);

  return (
    <div className="max-w-md mx-auto">
      <h2 className="text-center text-base font-bold mb-4" style={{ color: accentColor }}>{title}</h2>
      <div className="space-y-2">
        {STARTER_DECKS.map((deck) => {
          const unlocked = isStarterDeckUnlockedFor(deck.id, progress, isAdmin);
          const isSelected = selected?.id === deck.id;
          return (
            <button
              key={deck.id}
              disabled={!unlocked}
              onClick={() => setSelected(deck)}
              className="w-full text-left p-3 rounded-xl transition-all active:scale-[0.99] disabled:cursor-not-allowed"
              style={{
                background: isSelected
                  ? `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`
                  : 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: isSelected ? `2px solid ${accentColor}aa` : '1.5px solid rgba(255,215,0,0.15)',
                opacity: unlocked ? 1 : 0.4,
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{deck.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-amber-100">{deck.name}</p>
                    {!unlocked && <span className="text-xs">🔒</span>}
                  </div>
                  <p className="text-[10px] text-amber-200/50 truncate">
                    {unlocked ? deck.description : 'デッキクエストでマスターをクリアして解放'}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => selected && onSelect(selected)}
        disabled={!selected}
        className="w-full mt-4 py-3.5 rounded-xl text-base font-bold transition-all active:scale-95 disabled:opacity-40"
        style={{
          background: selected ? `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` : `${accentColor}22`,
          color: selected ? '#0b1128' : `${accentColor}77`,
        }}
      >
        {selected ? `⚔️ ${selected.name} で出撃` : 'デッキを選択してください'}
      </button>
    </div>
  );
}

export default function PvPSetupPage() {
  const [, navigate] = useLocation();
  const [phase, setPhase] = useState<Phase>('p1-pin');
  const [p1, setP1] = useState<PlayerDraft | null>(null);
  const [p2, setP2] = useState<PlayerDraft | null>(null);
  const [roundCount, setRoundCount] = useState<PvPRoundCount>(5);

  useEffect(() => { clearPvPSession(); }, []);

  const handleP1Pin = useCallback(async (auth: { childId: string; childName: string; isAdmin: boolean }) => {
    const progress = await loadQuestProgressFor(auth.childId, auth.isAdmin);
    const unlockedSSRCardNames = getUnlockedSSRCardNamesFor(progress, auth.isAdmin);
    setP1({ ...auth, progress, unlockedSSRCardNames, deckId: null });
    setPhase('p1-deck');
  }, []);

  const handleP1Deck = useCallback((deck: StarterDeck) => {
    setP1((prev) => (prev ? { ...prev, deckId: deck.id } : prev));
    setPhase('p2-pin');
  }, []);

  const handleP2Pin = useCallback(async (auth: { childId: string; childName: string; isAdmin: boolean }) => {
    if (p1 && auth.childId === p1.childId && !auth.isAdmin) {
      toast.error('プレイヤー1と同じアカウントでは対戦できません');
      return;
    }
    const progress = await loadQuestProgressFor(auth.childId, auth.isAdmin);
    const unlockedSSRCardNames = getUnlockedSSRCardNamesFor(progress, auth.isAdmin);
    setP2({ ...auth, progress, unlockedSSRCardNames, deckId: null });
    setPhase('p2-deck');
  }, [p1]);

  const handleP2Deck = useCallback((deck: StarterDeck) => {
    setP2((prev) => (prev ? { ...prev, deckId: deck.id } : prev));
    setPhase('ready');
  }, []);

  const handleStart = useCallback(() => {
    if (!p1?.deckId || !p2?.deckId) return;
    const toPlayer = (d: PlayerDraft): PvPPlayer => ({
      childId: d.childId,
      childName: d.childName,
      isAdmin: d.isAdmin,
      starterDeckId: d.deckId!,
      unlockedSSRCardNames: d.unlockedSSRCardNames,
    });
    savePvPSession({ player1: toPlayer(p1), player2: toPlayer(p2), startedAt: Date.now(), roundCount });
    navigate('/games/knowledge-challenger/pvp/battle');
  }, [p1, p2, navigate, roundCount]);

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0b1128 100%)' }}
    >
      <div className="max-w-md mx-auto mb-6 text-center">
        <h1 className="text-xl font-bold" style={{ color: '#ffd700', fontFamily: 'var(--font-cinzel), serif' }}>
          🤝 2人対戦セットアップ
        </h1>
        <p className="text-[11px] text-amber-200/50 mt-1">1台の画面を2人で見ながら対戦</p>
      </div>

      {/* Progress breadcrumb */}
      <div className="max-w-md mx-auto mb-6 flex items-center justify-center gap-2 text-[10px]">
        {[
          { key: 'p1', label: 'P1', done: !!p1?.deckId, active: phase === 'p1-pin' || phase === 'p1-deck', color: '#ef4444' },
          { key: 'p2', label: 'P2', done: !!p2?.deckId, active: phase === 'p2-pin' || phase === 'p2-deck', color: '#3b82f6' },
          { key: 'go', label: '⚔️', done: false, active: phase === 'ready', color: '#22c55e' },
        ].map((s) => (
          <div
            key={s.key}
            className="px-2 py-1 rounded-md font-bold"
            style={{
              background: s.active ? `${s.color}33` : s.done ? `${s.color}22` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${s.active || s.done ? `${s.color}66` : 'rgba(255,255,255,0.08)'}`,
              color: s.active || s.done ? s.color : 'rgba(255,255,255,0.3)',
            }}
          >{s.label}</div>
        ))}
      </div>

      {phase === 'p1-pin' && (
        <PinInput title="プレイヤー1 PINコード" accentColor="#ef4444" onVerified={handleP1Pin} />
      )}

      {phase === 'p1-deck' && p1 && (
        <DeckPicker
          title={`🔴 ${p1.childName} のデッキ選択`}
          accentColor="#ef4444"
          progress={p1.progress}
          isAdmin={p1.isAdmin}
          onSelect={handleP1Deck}
        />
      )}

      {phase === 'p2-pin' && (
        <PinInput title="プレイヤー2 PINコード" accentColor="#3b82f6" onVerified={handleP2Pin} />
      )}

      {phase === 'p2-deck' && p2 && (
        <DeckPicker
          title={`🔵 ${p2.childName} のデッキ選択`}
          accentColor="#3b82f6"
          progress={p2.progress}
          isAdmin={p2.isAdmin}
          onSelect={handleP2Deck}
        />
      )}

      {phase === 'ready' && p1 && p2 && (
        <div className="max-w-md mx-auto text-center">
          <div className="flex items-stretch gap-3 mb-6">
            <div className="flex-1 rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.03))',
                border: '2px solid rgba(239,68,68,0.5)',
              }}>
              <p className="text-[10px] text-red-300/70 mb-1">🔴 プレイヤー1</p>
              <p className="text-sm font-bold text-amber-100 mb-1">{p1.childName}</p>
              <p className="text-[10px] text-amber-200/60">{STARTER_DECKS.find((d) => d.id === p1.deckId)?.icon} {STARTER_DECKS.find((d) => d.id === p1.deckId)?.name}</p>
            </div>
            <div className="flex items-center text-amber-200/60 font-bold">VS</div>
            <div className="flex-1 rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.03))',
                border: '2px solid rgba(59,130,246,0.5)',
              }}>
              <p className="text-[10px] text-blue-300/70 mb-1">🔵 プレイヤー2</p>
              <p className="text-sm font-bold text-amber-100 mb-1">{p2.childName}</p>
              <p className="text-[10px] text-amber-200/60">{STARTER_DECKS.find((d) => d.id === p2.deckId)?.icon} {STARTER_DECKS.find((d) => d.id === p2.deckId)?.name}</p>
            </div>
          </div>

          {/* Round count selector */}
          <div className="mb-6 rounded-xl p-3"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
              border: '1.5px solid rgba(255,215,0,0.25)',
            }}>
            <p className="text-[11px] text-amber-200/70 mb-2 font-bold">🏆 試合形式</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { count: 3 as PvPRoundCount, label: '3回戦', icon: '⚡', sub: 'スピード' },
                { count: 5 as PvPRoundCount, label: '5回戦', icon: '🔥', sub: '標準' },
                { count: 7 as PvPRoundCount, label: '7回戦', icon: '👑', sub: 'フルマッチ' },
              ]).map((opt) => {
                const selected = roundCount === opt.count;
                return (
                  <button
                    key={opt.count}
                    onClick={() => setRoundCount(opt.count)}
                    className="rounded-lg py-2 transition-all active:scale-95"
                    style={{
                      background: selected
                        ? 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,215,0,0.08))'
                        : 'rgba(255,255,255,0.04)',
                      border: selected ? '2px solid rgba(255,215,0,0.7)' : '1.5px solid rgba(255,215,0,0.15)',
                      color: selected ? '#ffd700' : 'rgba(255,215,0,0.5)',
                    }}
                  >
                    <div className="text-lg leading-none">{opt.icon}</div>
                    <div className="text-xs font-bold mt-1">{opt.label}</div>
                    <div className="text-[9px] opacity-70">{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-4 rounded-xl text-lg font-bold transition-all active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              color: '#0b1128',
              boxShadow: '0 4px 16px rgba(34,197,94,0.4)',
            }}
          >
            ⚔️ 対戦開始！
          </button>
        </div>
      )}

      <div className="max-w-md mx-auto mt-8 text-center">
        <button
          onClick={() => navigate('/')}
          className="text-xs py-2 px-4"
          style={{ color: 'rgba(255,215,0,0.4)' }}
        >
          ← ホームに戻る
        </button>
      </div>
    </div>
  );
}
