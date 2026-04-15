/*
 * RankingPage: 6カテゴリのランキング表示。
 * タブで切替、上位3名に金銀銅メダル、自分の順位を下部に固定表示。
 */
import { useEffect, useMemo, useState } from 'react';
import { IMAGES } from '@/lib/constants';
import { useUserStore } from '@/lib/stores';
import { fetchRatingStatus } from '@/lib/ratingService';
import {
  RANKING_CATEGORIES,
  getTitle,
  type RankingCategory,
  type RankingEntry,
} from '@/lib/rankingService';

const medalEmoji = ['🥇', '🥈', '🥉'];
const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];

export default function RankingPage() {
  const user = useUserStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<RankingCategory>('overall');
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const activeCategory = useMemo(
    () => RANKING_CATEGORIES.find((c) => c.id === activeTab)!,
    [activeTab]
  );

  // Personal rating for title header
  const [myRating, setMyRating] = useState<number>(1000);
  useEffect(() => {
    let cancelled = false;
    fetchRatingStatus(user.id).then((r) => {
      if (cancelled || !r) return;
      setMyRating(r.rating);
    });
    return () => { cancelled = true; };
  }, [user.id]);

  // Fetch ranking when tab changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    activeCategory.fetch().then((rows) => {
      if (cancelled) return;
      setEntries(rows);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setEntries([]);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeCategory]);

  const myEntry = entries.find((e) => e.childId === user.id);
  const myTitle = getTitle(myRating);

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.RANKING_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.6) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏆</span>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>ランキング</h1>
        </div>

        {/* Personal title card */}
        <div className="mb-4 rounded-xl p-3 flex items-center gap-3"
          style={{
            background: `linear-gradient(135deg, ${myTitle.color}22, ${myTitle.color}08)`,
            border: `1.5px solid ${myTitle.color}66`,
          }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
            style={{
              background: `linear-gradient(135deg, ${myTitle.color}33, ${myTitle.color}11)`,
              border: `2px solid ${myTitle.color}88`,
            }}>{myTitle.emoji}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-amber-200/50">あなたの称号</p>
            <p className="text-base font-black truncate" style={{ color: myTitle.color, textShadow: `0 0 8px ${myTitle.color}44` }}>
              {myTitle.label}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-amber-200/40">Elo</p>
            <p className="text-lg font-black" style={{ color: '#ffd700' }}>{myRating}</p>
          </div>
        </div>

        {/* Category tabs (horizontal scroll) */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <style>{`.rank-tabs::-webkit-scrollbar{display:none;}`}</style>
          {RANKING_CATEGORIES.map((cat) => {
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95"
                style={isActive ? {
                  background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                  color: '#0b1128',
                  boxShadow: '0 2px 8px rgba(255,215,0,0.3)',
                } : {
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,215,0,0.15)',
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                <span className="mr-1">{cat.emoji}</span>{cat.label}
              </button>
            );
          })}
        </div>

        {/* Ranking list */}
        <div className="gold-frame rounded-xl overflow-hidden">
          {loading ? (
            <div className="text-center text-amber-200/50 text-xs py-8">読み込み中…</div>
          ) : entries.length === 0 ? (
            <div className="text-center text-amber-200/50 text-xs py-8">
              まだランキングデータがありません
            </div>
          ) : (
            entries.map((entry, i) => {
              const isMe = entry.childId === user.id;
              return (
                <div key={entry.childId}
                  className="flex items-center gap-3 px-3 py-2.5"
                  style={{
                    borderBottom: i < entries.length - 1 ? '1px solid rgba(255,215,0,0.08)' : 'none',
                    background: entry.rank <= 3
                      ? `linear-gradient(90deg, ${medalColors[entry.rank - 1]}11, transparent)`
                      : isMe ? 'rgba(255,215,0,0.1)' : 'transparent',
                  }}>
                  <div className="w-8 text-center shrink-0">
                    {entry.rank <= 3
                      ? <span className="text-xl">{medalEmoji[entry.rank - 1]}</span>
                      : <span className="text-sm font-bold text-amber-200/40">{entry.rank}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-100 truncate">
                      {entry.nickname}{isMe && <span className="text-[10px] text-amber-200/50 ml-1">(あなた)</span>}
                    </p>
                    {entry.secondary && (
                      <p className="text-[10px] text-amber-200/40">{entry.secondary}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm font-bold" style={{ color: '#ffd700' }}>
                      {activeCategory.formatPrimary(entry.primary)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* My rank fixed display if not in top list */}
        {!loading && myEntry === undefined && entries.length > 0 && (
          <div className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-3"
            style={{
              background: 'rgba(255,215,0,0.12)',
              border: '1.5px solid rgba(255,215,0,0.35)',
            }}>
            <div className="w-8 text-center shrink-0">
              <span className="text-xs font-bold text-amber-200/60">—</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-amber-100">
                あなた <span className="text-[10px] text-amber-200/50 ml-1">圏外</span>
              </p>
              <p className="text-[10px] text-amber-200/50">トップ50に入るまで頑張ろう！</p>
            </div>
          </div>
        )}

        {/* Title bands legend */}
        <div className="mt-4 gold-frame-thin rounded-xl p-3">
          <p className="text-[10px] text-amber-200/40 mb-2 font-bold">🏅 称号（Eloレート帯）</p>
          <div className="space-y-1">
            {[
              { emoji: '🟤', label: 'ビギナー',       range: '0-999',      color: '#a16207' },
              { emoji: '⚪', label: 'チャレンジャー', range: '1000-1199', color: '#e5e7eb' },
              { emoji: '🟡', label: 'ファイター',     range: '1200-1399', color: '#ffd700' },
              { emoji: '🔵', label: 'エキスパート',   range: '1400-1599', color: '#3b82f6' },
              { emoji: '🟣', label: 'マスター',       range: '1600-1799', color: '#a855f7' },
              { emoji: '🔴', label: 'レジェンド',     range: '1800+',     color: '#ef4444' },
            ].map((r) => (
              <div key={r.label} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span>{r.emoji}</span>
                  <span style={{ color: r.color }}>{r.label}</span>
                </div>
                <span className="text-amber-200/40">{r.range}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
