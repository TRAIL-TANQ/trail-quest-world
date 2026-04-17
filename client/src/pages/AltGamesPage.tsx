/**
 * AltGamesPage — 🌟 ALTゲームのトップ
 *
 * 3タブ構成（算数 / 国語 / 地理）。各タブに4枠のカードグリッド。
 * - 第1弾（このセッション）: 算数タブの「計算バトル」「比較バトル」をアクティブ化
 * - その他 10 枠は「もうすこしまってね！」モーダル表示
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';

type TabId = 'math' | 'kokugo' | 'chiri';

interface AltGameCard {
  id: string;
  name: string;
  icon: string;
  altRange: string;
  description: string;
  href: string | null;
}

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'math',   label: '算数', icon: '🔢' },
  { id: 'kokugo', label: '国語', icon: '📝' },
  { id: 'chiri',  label: '地理', icon: '🌍' },
];

const GAMES: Record<TabId, AltGameCard[]> = {
  math: [
    { id: 'keisan-battle',   name: '計算バトル',   icon: '🔢', altRange: '+1〜30 ALT', description: '制限時間で連続正解！',         href: '/alt-games/keisan-battle' },
    { id: 'hikaku-battle',   name: '比較バトル',   icon: '⚡', altRange: '+1〜15 ALT', description: '大きい方をはやくタップ',       href: '/alt-games/hikaku-battle' },
    { id: 'bunsu-battle',    name: '分数バトル',   icon: '🔵', altRange: '+1〜25 ALT', description: '分数の足し引き掛け割り',       href: '/alt-games/bunsu-battle' },
    { id: 'shousuu-battle',  name: '小数バトル',   icon: '🟢', altRange: '+1〜25 ALT', description: '小数の計算をすばやく',         href: '/alt-games/shousuu-battle' },
  ],
  kokugo: [
    { id: 'kanji-flash',    name: '漢字フラッシュ',   icon: '📝', altRange: '+1〜25 ALT', description: '漢字の読みを4択',       href: '/alt-games/kanji-flash' },
    { id: 'yojijukugo',     name: '四字熟語クイズ',   icon: '🎌', altRange: '+1〜25 ALT', description: '□に入る漢字を4択',       href: '/alt-games/yojijukugo' },
    { id: 'kotowaza',       name: 'ことわざパズル',   icon: '🔀', altRange: '—',          description: '準備中',                  href: null },
    { id: 'bunsho-narabe',  name: '文章並べ替え',     icon: '📖', altRange: '—',          description: '準備中',                  href: null },
  ],
  chiri: [
    { id: 'todofuken',      name: '都道府県タッチ',   icon: '🗾', altRange: '+1〜75 ALT', description: '地図でタップ！',          href: '/alt-games/todofuken' },
    { id: 'kencho',         name: '県庁所在地クイズ', icon: '🏙️', altRange: '+1〜25 ALT', description: '県庁所在地を4択',          href: '/alt-games/kenchou' },
    { id: 'kokki',          name: '国旗フラッシュ',   icon: '🌍', altRange: '—',          description: '準備中',                  href: null },
    { id: 'nihonichi',      name: '日本一クイズ',     icon: '🏔️', altRange: '—',          description: '準備中',                  href: null },
  ],
};

export default function AltGamesPage() {
  const user = useUserStore((s) => s.user);
  const [tab, setTab] = useState<TabId>('math');
  const [comingSoon, setComingSoon] = useState(false);

  const cards = GAMES[tab];

  return (
    <div className="relative min-h-full">
      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', boxShadow: '0 0 10px rgba(255,215,0,0.3)' }}
          >
            <span className="text-lg">🌟</span>
          </div>
          <h1 className="text-lg font-bold" style={{ color: 'var(--tqw-gold)', textShadow: '0 0 10px rgba(255,215,0,0.2)' }}>
            ALTゲーム
          </h1>
          <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.3), transparent)' }} />
          <div className="flex items-center gap-1">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
              style={{ background: 'linear-gradient(135deg, #ffd700, #f0a500)', color: '#0b1128' }}
            >
              A
            </div>
            <span className="text-sm font-bold" style={{ color: 'var(--tqw-gold)' }}>
              {user.totalAlt.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex items-stretch gap-1 mb-4 rounded-xl p-1"
          style={{
            background: 'rgba(11,17,40,0.6)',
            border: '1px solid rgba(255,215,0,0.15)',
          }}
        >
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 rounded-lg text-[13px] font-bold transition-all relative"
                style={{
                  background: active
                    ? 'linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.06))'
                    : 'transparent',
                  color: active ? 'var(--tqw-gold)' : 'rgba(255,255,255,0.45)',
                  textShadow: active ? '0 0 6px rgba(255,215,0,0.4)' : 'none',
                }}
              >
                <span className="mr-1">{t.icon}</span>
                {t.label}
                {active && (
                  <span
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, transparent, var(--tqw-gold), transparent)',
                      boxShadow: '0 0 6px rgba(255,215,0,0.5)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-2 gap-2.5 tqw-animate-fadeIn" key={tab}>
          {cards.map((g) => {
            const available = g.href !== null;
            const cardInner = (
              <div
                className="tqw-card-panel rounded-xl p-3 relative overflow-hidden transition-all active:scale-[0.97] h-full flex flex-col"
                style={{
                  opacity: available ? 1 : 0.6,
                  cursor: 'pointer',
                  borderColor: available ? 'rgba(255,215,0,0.3)' : 'rgba(120,120,140,0.15)',
                  minHeight: 150,
                }}
                onClick={!available ? () => setComingSoon(true) : undefined}
              >
                <div className="text-3xl mb-2">{g.icon}</div>
                <h3 className="text-[13px] font-bold text-amber-100 mb-0.5 leading-tight">{g.name}</h3>
                <p className="text-[10px] text-amber-200/50 mb-2 line-clamp-2 flex-1">{g.description}</p>
                {available ? (
                  <>
                    <div className="flex items-center gap-1 mb-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold"
                        style={{ background: 'rgba(255,215,0,0.4)', color: '#fff' }}
                      >
                        A
                      </div>
                      <span className="text-[10px] font-bold" style={{ color: 'var(--tqw-gold)' }}>
                        {g.altRange}
                      </span>
                    </div>
                    <div
                      className="tqw-btn-quest rounded-lg text-center py-1.5 text-[11px] font-black"
                    >
                      挑戦する
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1 mb-2">
                      <span className="text-base">🔨</span>
                      <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        準備中
                      </span>
                    </div>
                    <div
                      className="rounded-lg text-center py-1.5 text-[10px] font-bold"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        color: 'rgba(255,215,0,0.5)',
                        border: '1px solid rgba(255,215,0,0.15)',
                      }}
                    >
                      もうすこしまってね！
                    </div>
                  </>
                )}
              </div>
            );

            if (available && g.href) {
              return (
                <Link key={g.id} href={g.href}>
                  {cardInner}
                </Link>
              );
            }
            return <div key={g.id}>{cardInner}</div>;
          })}
        </div>
      </div>

      {/* Coming-soon modal */}
      {comingSoon && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setComingSoon(false)}
        >
          <div
            className="tqw-card-panel rounded-2xl p-8 text-center w-full max-w-xs"
            style={{
              background: 'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '2px solid rgba(255,215,0,0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-5xl block mb-3">🔨</span>
            <h2 className="text-lg font-black mb-2" style={{ color: 'var(--tqw-gold)' }}>
              もうすこしまってね！
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--tqw-gold)', opacity: 0.75 }}>
              このゲームは次のアップデートで登場するよ
            </p>
            <button
              onClick={() => setComingSoon(false)}
              className="w-full py-3 rounded-xl font-bold text-base"
              style={{
                background: 'rgba(255,215,0,0.15)',
                border: '1.5px solid rgba(255,215,0,0.4)',
                color: 'var(--tqw-gold)',
                minHeight: 48,
              }}
            >
              とじる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
