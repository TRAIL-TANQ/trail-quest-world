/*
 * HallOfFamePage (変更11): 5-0 パーフェクトクリアで保存されたデッキ一覧。
 *
 * 殿堂入り条件: ソロモードまたはフリープレイで 5 ラウンド全勝。
 * Supabase hall_of_fame テーブルから新しい順に取得して表示。
 */
import { useEffect, useState } from 'react';
import { useUserStore } from '@/lib/stores';
import { fetchHallOfFame, type HallOfFameEntry } from '@/lib/hallOfFameService';
import { getStage } from '@/lib/stages';
import { IMAGES, CARD_RARITY_IMAGES } from '@/lib/constants';
import type { BattleCard } from '@/lib/knowledgeCards';

const rarityColor: Record<string, string> = {
  N:   '#9ca3af',
  R:   '#3b82f6',
  SR:  '#f59e0b',
  SSR: '#a855f7',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  const hh = d.getHours().toString().padStart(2, '0');
  const mi = d.getMinutes().toString().padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}

export default function HallOfFamePage() {
  const user = useUserStore((s) => s.user);
  const [entries, setEntries] = useState<HallOfFameEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await fetchHallOfFame(user.id, 50);
      if (cancelled) return;
      setEntries(list);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.GAME_CARDS_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.2) saturate(0.6)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.7) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            <span className="text-lg">🏆</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>殿堂入りデッキ</h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          <span className="text-[11px] text-amber-200/50">{entries.length} 件</span>
        </div>

        <div className="mb-4 rounded-xl p-3 flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))', border: '1px solid rgba(255,215,0,0.2)' }}>
          <span className="text-base">💫</span>
          <span className="text-[11px] text-amber-200/70">5 ラウンド全勝 (5-0) でこの殿堂に刻まれる</span>
        </div>

        {loading ? (
          <div className="text-center text-amber-200/50 text-xs py-12">読み込み中…</div>
        ) : entries.length === 0 ? (
          <div className="rounded-xl p-6 text-center"
            style={{ background: 'rgba(21,29,59,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-3xl block mb-2">🌟</span>
            <p className="text-[11px] text-amber-200/50">
              まだ殿堂入りデッキはありません。
              <br />ソロモードで 5 ラウンド全勝を目指そう！
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry) => {
              const stage = entry.stage_id !== null ? getStage(entry.stage_id) : null;
              const isOpen = expandedId === entry.id;
              return (
                <div key={entry.id} className="rounded-xl overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                    border: '1.5px solid rgba(255,215,0,0.25)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 0 16px rgba(255,215,0,0.04)',
                  }}>
                  <button onClick={() => setExpandedId(isOpen ? null : entry.id)}
                    className="w-full p-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.25), rgba(255,215,0,0.08))',
                        border: '1.5px solid rgba(255,215,0,0.4)',
                      }}>🏆</div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-bold text-amber-100 truncate">
                        {stage ? stage.name : 'フリープレイ'}
                      </p>
                      <p className="text-[10px] text-amber-200/40">{formatDate(entry.cleared_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[9px] text-amber-200/50">ファン総数</p>
                      <p className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>
                        {entry.total_fans}
                      </p>
                    </div>
                    <span className="text-amber-200/40 text-xs ml-1">{isOpen ? '▼' : '▶'}</span>
                  </button>

                  {/* Deck expansion */}
                  {isOpen && (
                    <div className="px-3 pb-3 pt-1 border-t" style={{ borderColor: 'rgba(255,215,0,0.1)' }}>
                      <p className="text-[10px] text-amber-200/50 mb-2">📜 使用デッキ ({entry.deck_data.length}枚)</p>
                      <div className="grid grid-cols-5 gap-1.5">
                        {entry.deck_data.map((card: BattleCard, i: number) => {
                          const rc = rarityColor[card.rarity] || '#9ca3af';
                          return (
                            <div key={i} className="relative rounded-md overflow-hidden"
                              style={{
                                aspectRatio: '3/4',
                              }}>
                              {card.imageUrl ? (
                                <img src={card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-amber-200/40"
                                  style={{ background: 'rgba(0,0,0,0.4)' }}>?</div>
                              )}
                              {/* Frame overlay */}
                              <img src={CARD_RARITY_IMAGES[card.rarity] || CARD_RARITY_IMAGES['N']} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ zIndex: 2 }} />
                              <span
                                className="absolute left-0 right-0 text-center font-bold text-white truncate px-0.5"
                                style={{ bottom: '6px', fontSize: '6px', textShadow: '0 1px 2px rgba(0,0,0,0.95)', zIndex: 3 }}
                              >
                                {card.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
