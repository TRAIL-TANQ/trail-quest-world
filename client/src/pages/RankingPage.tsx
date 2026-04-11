/*
 * RankingPage (変更10): Elo-based ranking with personal rating / rank / winrate.
 * モック履歴は残しつつ、ページ上部に自分の rating / rank / wins / losses / winrate を表示。
 */
import { useEffect, useState } from 'react';
import { IMAGES } from '@/lib/constants';
import { MOCK_RANKINGS } from '@/lib/mockData';
import { useUserStore } from '@/lib/stores';
import { fetchRatingStatus, getRank, RANK_TABLE } from '@/lib/ratingService';

const tabs = [
  { id: 'daily', label: 'デイリー' },
  { id: 'weekly', label: 'ウィークリー' },
  { id: 'monthly', label: 'マンスリー' },
];

const medalColors = ['#ffd700', '#c0c0c0', '#cd7f32'];
const medalEmoji = ['🥇', '🥈', '🥉'];

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState('daily');
  const user = useUserStore((s) => s.user);

  // 変更10: 自分の rating / wins / losses を Supabase から読み込む
  const [rating, setRating] = useState<number>(1000);
  const [wins, setWins] = useState<number>(0);
  const [losses, setLosses] = useState<number>(0);
  const [loadingRank, setLoadingRank] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchRatingStatus(user.id);
      if (cancelled || !r) { setLoadingRank(false); return; }
      setRating(r.rating);
      setWins(r.wins);
      setLosses(r.losses);
      setLoadingRank(false);
    })();
    return () => { cancelled = true; };
  }, [user.id]);

  const rank = getRank(rating);
  const totalGames = wins + losses;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // 次のランク帯までの進捗
  const nextRank = RANK_TABLE.find((r) => r.minRating > rating);
  const rankProgress = nextRank
    ? ((rating - rank.minRating) / (nextRank.minRating - rank.minRating)) * 100
    : 100;

  return (
    <div className="relative min-h-full">
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.RANKING_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.6) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏆</span>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>ランキング</h1>
        </div>

        {/* 変更10: 自分のレート・ランク・勝率 */}
        <div className="mb-4 rounded-xl p-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${rank.color}22, ${rank.color}08)`,
            border: `1.5px solid ${rank.color}66`,
            boxShadow: `0 0 20px ${rank.color}22`,
          }}>
          {loadingRank ? (
            <div className="text-center text-amber-200/50 text-xs py-2">読み込み中…</div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0"
                  style={{
                    background: `linear-gradient(135deg, ${rank.color}33, ${rank.color}11)`,
                    border: `2px solid ${rank.color}88`,
                    boxShadow: `0 0 12px ${rank.color}44`,
                  }}>{rank.emoji}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-amber-200/50">現在のランク</p>
                  <p className="text-lg font-black" style={{ color: rank.color, textShadow: `0 0 8px ${rank.color}66` }}>
                    {rank.label}
                  </p>
                  <p className="text-[10px] text-amber-200/40">Elo {rating}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-amber-200/50">勝率</p>
                  <p className="text-2xl font-black font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>{winRate}%</p>
                  <p className="text-[9px] text-amber-200/40">{wins}勝 {losses}敗</p>
                </div>
              </div>

              {/* 次ランクまでの進捗バー */}
              {nextRank && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-amber-200/40">次: {nextRank.emoji} {nextRank.label}</span>
                    <span className="text-[9px] text-amber-200/40">{rating} / {nextRank.minRating}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, rankProgress))}%`,
                        background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})`,
                        boxShadow: `0 0 6px ${rank.color}88`,
                      }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-1 mb-4 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={activeTab === tab.id ? {
                background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                color: '#0b1128', boxShadow: '0 2px 8px rgba(255,215,0,0.3)',
              } : { color: 'rgba(255,255,255,0.4)' }}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] text-amber-200/40">
            {activeTab === 'daily' ? '残り 06:00 JST' : activeTab === 'weekly' ? '残り 3日' : '残り 22日'}
          </span>
          <span className="text-[10px] text-amber-200/40">参加者 {MOCK_RANKINGS.length * 12}人</span>
        </div>

        <div className="gold-frame rounded-xl overflow-hidden">
          {MOCK_RANKINGS.map((entry, i) => (
            <div key={entry.rank} className="flex items-center gap-3 px-3 py-2.5 transition-all animate-slide-up"
              style={{
                animationDelay: `${i * 50}ms`,
                borderBottom: i < MOCK_RANKINGS.length - 1 ? '1px solid rgba(255,215,0,0.08)' : 'none',
                background: entry.rank <= 3 ? `linear-gradient(90deg, ${medalColors[entry.rank - 1]}11, transparent)` : 'transparent',
              }}>
              <div className="w-8 text-center flex-shrink-0">
                {entry.rank <= 3 ? <span className="text-xl">{medalEmoji[entry.rank - 1]}</span>
                  : <span className="text-sm font-bold text-amber-200/40">{entry.rank}</span>}
              </div>
              <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                  border: entry.rank <= 3 ? `2px solid ${medalColors[entry.rank - 1]}` : '1px solid rgba(255,255,255,0.1)',
                }}>👤</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-100 truncate">{entry.nickname}</p>
                <p className="text-[10px] text-amber-200/40">Lv.{entry.level}</p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>{entry.score}</span>
                <span className="text-[10px]" style={{ color: '#ffd700' }}>ALT</span>
              </div>
            </div>
          ))}
        </div>

        {/* ランク帯一覧 */}
        <div className="mt-4 gold-frame-thin rounded-xl p-3">
          <p className="text-[10px] text-amber-200/40 mb-2 font-bold">🏅 ランク帯</p>
          <div className="space-y-1">
            {RANK_TABLE.map((r) => (
              <div key={r.tier} className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span>{r.emoji}</span>
                  <span style={{ color: r.color }}>{r.label}</span>
                </div>
                <span className="text-amber-200/40">
                  {r.minRating}{r.maxRating !== null ? ` - ${r.maxRating}` : '+'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
