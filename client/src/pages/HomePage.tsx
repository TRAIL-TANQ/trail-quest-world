/*
 * HomePage: World Map style layout - Royal Adventurer's Guild Aesthetic
 * Fantasy landscape background with game category quest markers
 * Character display, daily login streak, featured quests
 * Shows equipped shop avatar full-body image if one is equipped
 * ミッション: 複数ミッション表示・進捗バー・報酬受け取りボタン
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { IMAGES, AVATAR_ITEMS } from '@/lib/constants';
import { useUserStore, useMissionStore, useAltStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';
import { fetchOverallRanking, type RankingEntry } from '@/lib/rankingService';

const categoryEmoji: Record<string, string> = {
  game: '⚔️', gacha: '🎰', collection: '🃏',
};

// ミッション達成エフェクト
function MissionCompleteEffect({ mission, onDone }: { mission: { title: string; reward: number }; onDone: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="text-center px-8 py-6 rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
          border: '2px solid rgba(255,215,0,0.5)',
          boxShadow: '0 0 40px rgba(255,215,0,0.3)',
          animation: 'missionComplete 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div className="text-4xl mb-2" style={{ animation: 'spin 0.6s ease-out' }}>🏆</div>
        <p className="text-amber-200/70 text-xs mb-1">ミッション達成！</p>
        <p className="text-amber-100 font-bold text-base mb-3">{mission.title}</p>
        <div className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl"
          style={{ background: 'rgba(255,215,0,0.15)', border: '1px solid rgba(255,215,0,0.3)' }}>
          <span className="text-xl font-bold" style={{ color: '#ffd700' }}>+{mission.reward}</span>
          <span className="text-sm font-bold" style={{ color: '#ffd700' }}>ALT</span>
        </div>
      </div>
      <style>{`
        @keyframes missionComplete {
          0% { opacity: 0; transform: scale(0.6); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

export default function HomePage() {
  const user = useUserStore((s) => s.user);
  const addTotalAlt = useUserStore((s) => s.addTotalAlt);
  const levelInfo = calculateLevel(user.totalAlt);
  const missions = useMissionStore((s) => s.missions);
  const claimReward = useMissionStore((s) => s.claimReward);
  const triggerEarnEffect = useAltStore((s) => s.triggerEarnEffect);

  const [showMissions, setShowMissions] = useState(true);
  const [completedEffect, setCompletedEffect] = useState<{ title: string; reward: number } | null>(null);

  // ランキングプレビュー（総合トップ3 + 自分の順位）
  const [rankingPreview, setRankingPreview] = useState<RankingEntry[]>([]);
  const [rankingLoading, setRankingLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetchOverallRanking().then((rows) => {
      if (cancelled) return;
      setRankingPreview(rows);
      setRankingLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setRankingLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  // ミッション報酬受け取り
  const handleClaim = (missionId: string) => {
    const reward = claimReward(missionId);
    if (reward > 0) {
      addTotalAlt(reward);
      triggerEarnEffect(reward);
      const mission = missions.find((m) => m.id === missionId);
      if (mission) {
        setCompletedEffect({ title: mission.title, reward });
        setTimeout(() => setCompletedEffect(null), 2000);
      }
    }
  };

  // ミッション統計
  const completedCount = missions.filter((m) => m.completed).length;
  const claimedCount = missions.filter((m) => m.claimed).length;
  const totalReward = missions.reduce((acc, m) => acc + (m.claimed ? m.reward : 0), 0);

  // Determine which full-body avatar to show
  const getFullBodyAvatar = () => {
    if (user.equippedAvatarId && AVATAR_ITEMS[user.equippedAvatarId]) {
      return AVATAR_ITEMS[user.equippedAvatarId].full;
    }
    return user.avatarType === 'girl' ? IMAGES.CHARACTER_GIRL : IMAGES.CHARACTER_BOY;
  };

  return (
    <div className="relative min-h-full" style={{ background: '#0a0e1a' }}>
      {/* World Map Background + Manus home mock overlay */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.HERO_BG} alt="world map" className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.3) saturate(0.8)' }} />
        <img src="/images/ui/bg-home.png" alt="" aria-hidden
          className="absolute inset-0 w-full h-full object-cover"
          style={{ opacity: 0.45, mixBlendMode: 'screen' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(10,14,26,0.45) 0%, rgba(10,14,26,0.7) 30%, rgba(10,14,26,0.92) 100%)',
        }} />
        <div className="absolute top-0 left-0 right-0 h-32" style={{
          background: 'radial-gradient(ellipse at top, rgba(255,215,0,0.06) 0%, transparent 70%)',
        }} />
      </div>

      {/* ミッション達成エフェクト */}
      {completedEffect && (
        <MissionCompleteEffect mission={completedEffect} onDone={() => setCompletedEffect(null)} />
      )}

      {/* Content */}
      <div className="relative z-10 px-4 pt-3 pb-4">
        {/* Hero Section with Character */}
        <div className="relative mb-5">
          <div className="text-center mb-3 relative">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="h-px flex-1 max-w-[40px]" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5))',
              }} />
              <h1 className="tqw-title-game text-xl font-[var(--font-cinzel)] tracking-[0.15em]">
                TRAIL QUEST WORLD
              </h1>
              <div className="h-px flex-1 max-w-[40px]" style={{
                background: 'linear-gradient(90deg, rgba(255,215,0,0.5), transparent)',
              }} />
            </div>
            <p className="text-amber-200/60 text-[11px] tracking-wider">遊ぶたびに強くなる 学びのゲームワールド</p>
          </div>

          {/* Character + Welcome Card */}
          <div className="flex items-end gap-3">
            <div className="w-36 h-44 flex-shrink-0 animate-float relative">
              <img src={getFullBodyAvatar()} alt="character"
                className="w-full h-full object-contain drop-shadow-[0_4px_16px_rgba(255,215,0,0.3)]" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full blur-md"
                style={{ background: 'rgba(255,215,0,0.15)' }} />
            </div>
            <div className="flex-1 mb-3">
              <div className="rounded-xl p-3 relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                  border: '2px solid rgba(255,215,0,0.35)',
                  boxShadow: 'inset 0 0 20px rgba(255,215,0,0.05), 0 4px 16px rgba(0,0,0,0.4)',
                }}>
                <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 rounded-tl-sm" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
                <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 rounded-tr-sm" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
                <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 rounded-bl-sm" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 rounded-br-sm" style={{ borderColor: 'rgba(255,215,0,0.6)' }} />

                <p className="text-amber-100 text-sm font-bold mb-1">おかえり、{user.nickname}！</p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-amber-200/50 text-xs">連続ログイン</span>
                  <span className="text-amber-300 font-bold text-sm">{user.streakDays}日目</span>
                  <span className="text-lg">🔥</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,215,0,0.08))',
                      border: '1px solid rgba(255,215,0,0.35)', color: '#ffd700',
                    }}>
                    Lv.{levelInfo.level}
                  </span>
                  <span className="text-[10px] text-amber-200/50">{levelInfo.title}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Daily Missions Panel */}
        <div className="mb-6 rounded-xl overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))',
            border: '1.5px solid rgba(34,197,94,0.25)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
          }}>
          {/* ヘッダー */}
          <button
            className="w-full px-3 py-2.5 flex items-center justify-between"
            onClick={() => setShowMissions(!showMissions)}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))', border: '1px solid rgba(34,197,94,0.3)' }}>
                <span className="text-base">📋</span>
              </div>
              <div className="text-left">
                <p className="text-emerald-300 text-xs font-bold">デイリーミッション</p>
                <p className="text-emerald-200/50 text-[10px]">
                  {claimedCount}/{missions.length} 受取済 ·
                  <span style={{ color: '#ffd700' }}> +{totalReward} ALT 獲得</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {completedCount > claimedCount && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                  style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', animation: 'pulse 2s ease-in-out infinite' }}>
                  受取可能
                </span>
              )}
              <span className="text-amber-200/40 text-xs">{showMissions ? '▲' : '▼'}</span>
            </div>
          </button>

          {/* ミッションリスト */}
          {showMissions && (
            <div className="px-3 pb-3 space-y-2.5">
              {missions.map((mission) => {
                const pct = Math.round((mission.progress / mission.target) * 100);
                const canClaim = mission.completed && !mission.claimed;
                return (
                  <div key={mission.id}
                    className="rounded-xl p-2.5 relative overflow-hidden"
                    style={{
                      background: mission.claimed
                        ? 'rgba(34,197,94,0.06)'
                        : mission.completed
                          ? 'rgba(255,215,0,0.06)'
                          : 'rgba(255,255,255,0.03)',
                      border: mission.claimed
                        ? '1px solid rgba(34,197,94,0.2)'
                        : mission.completed
                          ? '1px solid rgba(255,215,0,0.3)'
                          : '1px solid rgba(255,255,255,0.07)',
                    }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{categoryEmoji[mission.category] || '📌'}</span>
                        <p className={`text-xs font-bold ${mission.claimed ? 'text-emerald-300/60 line-through' : 'text-amber-100'}`}>
                          {mission.title}
                        </p>
                      </div>
                      {canClaim ? (
                        <button
                          onClick={() => handleClaim(mission.id)}
                          className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-lg font-bold transition-all hover:scale-105 active:scale-95"
                          style={{
                            background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                            color: '#1a1a00',
                            boxShadow: '0 0 10px rgba(255,215,0,0.4)',
                            animation: 'pulse 2s ease-in-out infinite',
                          }}>
                          +{mission.reward} ALT 受取
                        </button>
                      ) : mission.claimed ? (
                        <span className="text-[10px] text-emerald-400/60 flex-shrink-0">✓ 受取済</span>
                      ) : (
                        <span className="text-[10px] font-bold flex-shrink-0" style={{ color: '#ffd700' }}>
                          +{mission.reward} ALT
                        </span>
                      )}
                    </div>
                    {/* 進捗バー */}
                    {!mission.claimed && (
                      <>
                        <div className="w-full h-1.5 rounded-full mb-1" style={{ background: 'rgba(255,255,255,0.08)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${pct}%`,
                              background: mission.completed
                                ? 'linear-gradient(90deg, #ffd700, #f0a500)'
                                : 'linear-gradient(90deg, #22c55e, #4ade80)',
                              boxShadow: mission.completed ? '0 0 6px rgba(255,215,0,0.5)' : '0 0 6px rgba(34,197,94,0.4)',
                            }} />
                        </div>
                        <p className="text-[9px] text-amber-200/40 text-right">
                          {mission.progress}/{mission.target} 完了
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* メインエントリ: バトル / デッキクエスト / 2人対戦 */}
        <div className="mb-6 flex flex-col" style={{ gap: 20 }}>
          <Link href="/games/knowledge-challenger?screen=deck_select">
            <div
              className="tappable relative overflow-hidden cursor-pointer"
              style={{
                borderRadius: 16,
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #8b1a1a 0%, #c0392b 50%, #e74c3c 100%)',
                border: '2px solid #c5a03f',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5), inset 0 0 28px rgba(255,215,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1.5px solid rgba(255,215,0,0.5)',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                }}>
                <img src="/images/ui/icon-sword.png" alt="" className="w-10 h-10 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="absolute text-3xl" style={{ zIndex: 0, opacity: 0.4 }}>⚔️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>バトル</p>
                <p className="text-[11px] text-amber-100/85" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>デッキを選んで戦おう</p>
              </div>
              <span className="text-amber-100 text-xl">›</span>
            </div>
          </Link>

          <Link href="/games/knowledge-challenger?screen=deck_select">
            <div
              className="tappable relative overflow-hidden cursor-pointer"
              style={{
                borderRadius: 16,
                padding: '16px 18px',
                background: 'linear-gradient(135deg, #1a3a5c 0%, #2980b9 50%, #3498db 100%)',
                border: '2px solid #c5a03f',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5), inset 0 0 28px rgba(255,215,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 relative overflow-hidden"
                style={{
                  background: 'rgba(0,0,0,0.35)',
                  border: '1.5px solid rgba(255,215,0,0.5)',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                }}>
                <img src="/images/ui/icon-book.png" alt="" className="w-10 h-10 object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="absolute text-3xl" style={{ zIndex: 0, opacity: 0.4 }}>📖</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-black text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>デッキクエスト</p>
                <p className="text-[11px] text-amber-100/85" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>学んでデッキを手に入れよう</p>
              </div>
              <span className="text-amber-100 text-xl">›</span>
            </div>
          </Link>

          <Link href="/games/knowledge-challenger/pvp">
            <div
              className="rounded-xl p-4 flex items-center gap-3 transition-all active:scale-[0.98] cursor-pointer relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(239,68,68,0.18), rgba(59,130,246,0.18))',
                border: '1.5px solid rgba(255,215,0,0.35)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,215,0,0.04)',
              }}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #3b82f6)',
                  boxShadow: '0 0 12px rgba(255,215,0,0.25)',
                }}>
                <span className="text-2xl">⚔️</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-100">2人対戦</p>
                <p className="text-[10px] text-amber-200/60">友達と対戦しよう</p>
              </div>
              <span className="text-amber-200/50 text-lg">›</span>
            </div>
          </Link>
        </div>

        {/* Ranking Preview (Top 3 + self) */}
        <div className="mb-6 rounded-xl p-3"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.92), rgba(14,20,45,0.95))',
            border: '1.5px solid rgba(255,215,0,0.25)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(255,215,0,0.04)',
          }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">🏆</span>
            <h3 className="text-sm font-bold text-amber-100">ランキング</h3>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.2), transparent)' }} />
          </div>
          {rankingLoading ? (
            <p className="text-[11px] text-amber-200/40 text-center py-2">読み込み中…</p>
          ) : rankingPreview.length === 0 ? (
            <p className="text-[11px] text-amber-200/40 text-center py-2">まだデータがありません</p>
          ) : (
            <div className="space-y-1.5 mb-2">
              {rankingPreview.slice(0, 3).map((e, i) => {
                const rankClass = ['tqw-rank-1', 'tqw-rank-2', 'tqw-rank-3'][i];
                const tier = i === 0 ? 'Master' : i === 1 ? 'Master' : 'Diamond';
                const isMe = e.childId === user.id;
                return (
                  <div key={e.childId}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.05)',
                    }}>
                    <span className={`${rankClass} font-black text-base w-5 text-center`}>{i + 1}</span>
                    <span className="flex-1 text-amber-100 truncate font-bold text-[11px]">
                      {e.nickname}{isMe && <span className="text-amber-200/50 ml-1">(あなた)</span>}
                    </span>
                    <span className="font-bold text-[11px]" style={{ color: '#ffd700' }}>{e.primary}</span>
                    <span className="tqw-rank-badge text-[9px] px-1.5 py-0.5">{tier}</span>
                  </div>
                );
              })}
              {(() => {
                const myRank = rankingPreview.find((e) => e.childId === user.id)?.rank;
                if (!myRank || myRank <= 3) return null;
                const myEntry = rankingPreview.find((e) => e.childId === user.id)!;
                return (
                  <div className="flex items-center gap-2 text-[11px] pt-1 mt-1"
                    style={{ borderTop: '1px dashed rgba(255,215,0,0.2)' }}>
                    <span className="w-5 text-center text-amber-200/60 font-bold">{myRank}</span>
                    <span className="flex-1 text-amber-100 truncate font-bold">
                      あなた <span className="text-amber-200/50 ml-1">{myEntry.nickname}</span>
                    </span>
                    <span className="font-bold" style={{ color: '#ffd700' }}>{myEntry.primary}</span>
                  </div>
                );
              })()}
            </div>
          )}
          <Link href="/ranking">
            <a
              className="block rounded-md py-1.5 text-center text-[11px] font-bold transition-all active:scale-[0.98]"
              style={{
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)',
                color: '#ffd700',
                textDecoration: 'none',
              }}>
              📊 もっと見る →
            </a>
          </Link>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { href: '/ranking', icon: '🏆', label: 'ランキング', color: '#ffd700' },
            { href: '/collection', icon: '🃏', label: 'コレクション', color: '#a855f7' },
            { href: '/shop', icon: '🛒', label: 'ショップ', color: '#22c55e' },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="rounded-xl p-3 text-center transition-all hover:scale-[1.03] active:scale-[0.97] relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(21,29,59,0.9), rgba(14,20,45,0.9))',
                  border: `1.5px solid ${item.color}33`,
                  boxShadow: `0 2px 8px rgba(0,0,0,0.3), inset 0 0 15px ${item.color}05`,
                }}>
                <span className="text-2xl block mb-1.5">{item.icon}</span>
                <span className="text-[11px] text-amber-200/60 font-bold">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>

        {/* News */}
        <div className="rounded-xl p-3 relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
            border: '1.5px solid rgba(255,215,0,0.2)',
            boxShadow: 'inset 0 0 20px rgba(255,215,0,0.03), 0 2px 12px rgba(0,0,0,0.3)',
          }}>
          <div className="absolute top-0 left-0 w-2.5 h-2.5 border-t-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
          <div className="absolute top-0 right-0 w-2.5 h-2.5 border-t-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
          <div className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b-2 border-l-2" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b-2 border-r-2" style={{ borderColor: 'rgba(255,215,0,0.4)' }} />

          <div className="flex items-center gap-2 mb-2.5">
            <span className="text-sm">📢</span>
            <h3 className="text-sm font-bold text-amber-200">お知らせ</h3>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.2), transparent)' }} />
          </div>
          <div className="space-y-2">
            {[
              { date: '04/09', text: '新ゲーム「探究クエスト」が追加されました！', isNew: true },
              { date: '04/07', text: '期間限定ガチャ開催中！レジェンドカード確率UP', isNew: true },
              { date: '04/01', text: '春のALTキャンペーン実施中', isNew: false },
            ].map((news, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-amber-400/50 flex-shrink-0 text-[11px]">{news.date}</span>
                {news.isNew && (
                  <span className="text-[8px] px-1 py-0.5 rounded font-bold flex-shrink-0"
                    style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    NEW
                  </span>
                )}
                <span className="text-amber-100/70">{news.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
