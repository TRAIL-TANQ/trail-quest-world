/*
 * HomePage: World Map style layout - Royal Adventurer's Guild Aesthetic
 * Fantasy landscape background with game category quest markers
 * Character display, daily login streak, featured quests
 * Shows equipped shop avatar full-body image if one is equipped
 */
import { Link } from 'wouter';
import { IMAGES, GAME_CATEGORIES, AVATAR_ITEMS } from '@/lib/constants';
import { useUserStore } from '@/lib/stores';
import { calculateLevel } from '@/lib/level';

const categoryIcons: Record<string, string> = {
  math: '🔢', inquiry: '💡', puzzle: '🧩', japanese: '📝', social: '🏯', science: '🔬',
};
const categoryBgColors: Record<string, [string, string]> = {
  math: ['#f59e0b', '#d97706'], inquiry: ['#8b5cf6', '#7c3aed'],
  puzzle: ['#22c55e', '#16a34a'], japanese: ['#ec4899', '#db2777'],
  social: ['#ef4444', '#dc2626'], science: ['#06b6d4', '#0891b2'],
};

export default function HomePage() {
  const user = useUserStore((s) => s.user);
  const levelInfo = calculateLevel(user.totalAlt);

  // Determine which full-body avatar to show
  const getFullBodyAvatar = () => {
    if (user.equippedAvatarId && AVATAR_ITEMS[user.equippedAvatarId]) {
      return AVATAR_ITEMS[user.equippedAvatarId].full;
    }
    return user.avatarType === 'girl' ? IMAGES.CHARACTER_GIRL : IMAGES.CHARACTER_BOY;
  };

  return (
    <div className="relative min-h-full">
      {/* World Map Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.HERO_BG} alt="world map" className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.35) saturate(0.8)' }} />
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(180deg, rgba(11,17,40,0.5) 0%, rgba(11,17,40,0.75) 30%, rgba(11,17,40,0.92) 100%)',
        }} />
        <div className="absolute top-0 left-0 right-0 h-32" style={{
          background: 'radial-gradient(ellipse at top, rgba(255,215,0,0.06) 0%, transparent 70%)',
        }} />
      </div>

      {/* Content */}
      <div className="relative z-10 px-4 pt-3 pb-4">
        {/* Hero Section with Character */}
        <div className="relative mb-5">
          <div className="text-center mb-3 relative">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="h-px flex-1 max-w-[40px]" style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5))',
              }} />
              <h1 className="text-xl font-bold font-[var(--font-cinzel)] tracking-[0.15em]"
                style={{ color: '#ffd700', textShadow: '0 0 20px rgba(255,215,0,0.4), 0 2px 4px rgba(0,0,0,0.8)' }}>
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
            <div className="w-28 h-36 flex-shrink-0 animate-float relative">
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

        {/* Daily Mission Banner */}
        <div className="mb-5 rounded-xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.03))',
            border: '1.5px solid rgba(34,197,94,0.25)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px rgba(34,197,94,0.03)',
          }}>
          <div className="px-3 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                style={{
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.2), rgba(34,197,94,0.1))',
                  border: '1px solid rgba(34,197,94,0.3)',
                }}>
                <span className="text-lg">📋</span>
              </div>
              <div>
                <p className="text-emerald-300 text-xs font-bold">デイリーミッション</p>
                <p className="text-emerald-200/50 text-[10px]">ゲームを3回クリアしよう</p>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)' }}>
              <span className="text-xs font-bold" style={{ color: '#ffd700' }}>+15</span>
              <span className="text-[9px]" style={{ color: '#ffd700' }}>ALT</span>
            </div>
          </div>
          <div className="px-3 pb-2.5">
            <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{
                width: '33%', background: 'linear-gradient(90deg, #22c55e, #4ade80)',
                boxShadow: '0 0 8px rgba(34,197,94,0.5)',
              }} />
            </div>
            <p className="text-emerald-200/40 text-[9px] mt-1 text-right">1/3 完了</p>
          </div>
        </div>

        {/* Quest Board - Game Categories */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                boxShadow: '0 0 10px rgba(255,215,0,0.3), 0 2px 4px rgba(0,0,0,0.3)',
              }}>
              <span className="text-sm">⚔️</span>
            </div>
            <h2 className="text-base font-bold" style={{ color: '#ffd700', textShadow: '0 0 8px rgba(255,215,0,0.2)' }}>クエストボード</h2>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {GAME_CATEGORIES.map((cat, i) => {
              const [c1] = categoryBgColors[cat.id] || ['#666', '#555'];
              return (
                <Link key={cat.id} href="/games">
                  <div
                    className="rounded-xl p-3 transition-all duration-200 hover:scale-[1.02] active:scale-[0.97] card-shine relative overflow-hidden animate-slide-up"
                    style={{
                      animationDelay: `${i * 70}ms`,
                      background: 'linear-gradient(135deg, rgba(21,29,59,0.92), rgba(14,20,45,0.95))',
                      border: `1.5px solid ${c1}44`,
                      boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 0 20px ${c1}08`,
                    }}>
                    <div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-20"
                      style={{ background: c1, transform: 'translate(30%, -30%)' }} />
                    <div className="flex items-center gap-2.5 mb-2 relative">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          background: `linear-gradient(135deg, ${c1}33, ${c1}22)`,
                          border: `1px solid ${c1}55`, boxShadow: `0 0 8px ${c1}22`,
                        }}>
                        <span className="text-xl">{categoryIcons[cat.id] || cat.emoji}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] font-bold text-amber-100">{cat.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between relative">
                      <span className="text-[10px] text-amber-200/40">タップして挑戦</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold"
                        style={{ background: `${c1}22`, color: c1, border: `1px solid ${c1}33` }}>
                        +10 ALT
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 mb-5">
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
    </div>
  );
}
