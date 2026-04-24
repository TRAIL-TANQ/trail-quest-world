/**
 * LeaderSelectPage — 🎴 カードバトル v2 リーダー選択
 *
 * v2.0-launch: 10 リーダーを 2 列グリッドで表示、タップで /battle/play?leaderId=xxx 遷移。
 * プリセットデッキはリーダーに 1:1 紐付いているので、選択 = そのリーダーのデッキで開始。
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { fetchLeaders, fetchPresetDecks, type PresetDeck } from '@/lib/battleService';
import type { BattleLeaderRow } from '@/lib/battle/battleTypes';

const COLOR_LABEL: Record<string, { emoji: string; label: string }> = {
  red: { emoji: '🔴', label: '赤' },
  blue: { emoji: '🔵', label: '青' },
  green: { emoji: '🟢', label: '緑' },
  yellow: { emoji: '🟡', label: '黄' },
  purple: { emoji: '🟣', label: '紫' },
  black: { emoji: '⚫', label: '黒' },
  colorless: { emoji: '⚪', label: '無' },
};

export default function LeaderSelectPage() {
  const [, navigate] = useLocation();
  const [leaders, setLeaders] = useState<BattleLeaderRow[]>([]);
  const [decks, setDecks] = useState<PresetDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ls, ds] = await Promise.all([fetchLeaders(), fetchPresetDecks()]);
        if (cancelled) return;
        setLeaders(ls);
        setDecks(ds);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // leaderId から そのリーダーの preset deck を引く lookup
  const deckByLeader = useMemo(() => {
    const m = new Map<string, PresetDeck>();
    for (const d of decks) {
      if (!m.has(d.deck.leader_id)) m.set(d.deck.leader_id, d);
    }
    return m;
  }, [decks]);

  function handleSelect(leaderId: string) {
    const deck = deckByLeader.get(leaderId);
    if (!deck) {
      alert('このリーダーのデッキがまだ用意されていません');
      return;
    }
    navigate(`/battle/play?leaderId=${encodeURIComponent(leaderId)}&deckId=${deck.deck.id}`);
  }

  return (
    <div className="relative min-h-full">
      <div className="relative z-10 px-4 pt-4 pb-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #f0a500)',
              boxShadow: '0 0 10px rgba(255,215,0,0.3)',
            }}
          >
            <span className="text-lg">🎴</span>
          </div>
          <h1
            className="text-lg font-bold"
            style={{
              color: 'var(--tqw-gold)',
              textShadow: '0 0 10px rgba(255,215,0,0.2)',
            }}
          >
            リーダーをえらぼう
          </h1>
          <div
            className="flex-1 h-px"
            style={{
              background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)',
            }}
          />
          <Link href="/alt-games">
            <button className="text-xs text-white/60 hover:text-white px-2 py-1">
              ← もどる
            </button>
          </Link>
        </div>

        {loading && (
          <div className="text-center text-white/60 py-10">よみこみ中…</div>
        )}

        {error && (
          <div className="text-center text-red-400 py-10">
            リーダーを読み込めませんでした: {error}
          </div>
        )}

        {!loading && !error && leaders.length === 0 && (
          <div className="text-center text-white/60 py-10">
            リーダーが登録されていません
          </div>
        )}

        {!loading && !error && leaders.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {leaders.map((l) => {
              const color = COLOR_LABEL[l.color] ?? { emoji: '⚪', label: l.color };
              const hasDeck = deckByLeader.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => handleSelect(l.id)}
                  disabled={!hasDeck}
                  className="group relative rounded-xl overflow-hidden border border-white/10 bg-black/40 hover:border-yellow-400/60 hover:bg-black/60 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    aspectRatio: '3 / 4',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Image area */}
                  <div className="w-full h-[75%] bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center overflow-hidden">
                    {l.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.image_url}
                        alt={l.name}
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <span className="text-4xl">🎴</span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2 text-left">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-sm">{color.emoji}</span>
                      <span
                        className="text-sm font-bold truncate"
                        style={{ color: 'var(--tqw-gold)' }}
                      >
                        {l.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-white/70">
                      <span>ライフ{l.life}</span>
                      <span>⚔{l.attack_power}</span>
                      <span>🛡{l.defense_power}</span>
                    </div>
                  </div>
                  {!hasDeck && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-white/80">
                      デッキ準備中
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
