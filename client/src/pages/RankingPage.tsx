/*
 * RankingPage: Daily/Weekly/Monthly ranking tabs
 * Colosseum background, gold trophy styling, ornate ranking list
 */
import { useState } from 'react';
import { IMAGES } from '@/lib/constants';
import { MOCK_RANKINGS } from '@/lib/mockData';
import { useUserStore } from '@/lib/stores';

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

  return (
    <div className="relative min-h-full">
      {/* Background */}
      <div className="absolute inset-0 z-0">
        <img src={IMAGES.RANKING_BG} alt="" className="w-full h-full object-cover" style={{ filter: 'brightness(0.25) saturate(0.7)' }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(11,17,40,0.6) 0%, rgba(11,17,40,0.95) 100%)' }} />
      </div>

      <div className="relative z-10 px-4 pt-4 pb-4">
        {/* Title */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏆</span>
          <h1 className="text-lg font-bold" style={{ color: '#ffd700', textShadow: '0 0 10px rgba(255,215,0,0.3)' }}>
            ランキング
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,215,0,0.15)' }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
              style={activeTab === tab.id ? {
                background: 'linear-gradient(135deg, #ffd700, #f0a500)',
                color: '#0b1128',
                boxShadow: '0 2px 8px rgba(255,215,0,0.3)',
              } : {
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Period info */}
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-[10px] text-amber-200/40">
            {activeTab === 'daily' ? '残り 06:00 JST' : activeTab === 'weekly' ? '残り 3日' : '残り 22日'}
          </span>
          <span className="text-[10px] text-amber-200/40">
            参加者 {MOCK_RANKINGS.length * 12}人
          </span>
        </div>

        {/* Ranking List */}
        <div className="gold-frame rounded-xl overflow-hidden">
          {MOCK_RANKINGS.map((entry, i) => (
            <div
              key={entry.userId}
              className="flex items-center gap-3 px-3 py-2.5 transition-all animate-slide-up"
              style={{
                animationDelay: `${i * 50}ms`,
                borderBottom: i < MOCK_RANKINGS.length - 1 ? '1px solid rgba(255,215,0,0.08)' : 'none',
                background: entry.rank <= 3
                  ? `linear-gradient(90deg, ${medalColors[entry.rank - 1]}11, transparent)`
                  : 'transparent',
              }}
            >
              {/* Rank */}
              <div className="w-8 text-center flex-shrink-0">
                {entry.rank <= 3 ? (
                  <span className="text-xl">{medalEmoji[entry.rank - 1]}</span>
                ) : (
                  <span className="text-sm font-bold text-amber-200/40">{entry.rank}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                  border: entry.rank <= 3
                    ? `2px solid ${medalColors[entry.rank - 1]}`
                    : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                👤
              </div>

              {/* Name & Level */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-100 truncate">{entry.nickname}</p>
                <p className="text-[10px] text-amber-200/40">Lv.{entry.level}</p>
              </div>

              {/* Score */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>
                  {entry.score}
                </span>
                <span className="text-[10px]" style={{ color: '#ffd700' }}>ALT</span>
              </div>
            </div>
          ))}
        </div>

        {/* My Ranking */}
        <div className="mt-3 gold-frame rounded-xl p-3">
          <div className="flex items-center gap-3">
            <div className="w-8 text-center">
              <span className="text-sm font-bold text-amber-200/40">12</span>
            </div>
            <div className="w-9 h-9 rounded-full flex-shrink-0 overflow-hidden"
              style={{ border: '2px solid #ffd700', boxShadow: '0 0 8px rgba(255,215,0,0.3)' }}
            >
              <img src={IMAGES.CHARACTER} alt="" className="w-full h-full object-cover object-top" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-100">{user.nickname} <span className="text-[10px] text-amber-300">（あなた）</span></p>
              <p className="text-[10px] text-amber-200/40">Lv.{user.level}</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold font-[var(--font-orbitron)]" style={{ color: '#ffd700' }}>
                {user.currentAlt}
              </span>
              <span className="text-[10px]" style={{ color: '#ffd700' }}>ALT</span>
            </div>
          </div>
        </div>

        {/* Reward info */}
        <div className="mt-3 gold-frame-thin rounded-xl p-3">
          <p className="text-[10px] text-amber-200/40 mb-2 font-bold">🎁 ランキング報酬</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-200/60">🥇 1位</span>
              <span style={{ color: '#ffd700' }}>300 ALT</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-200/60">🥈 2位</span>
              <span style={{ color: '#ffd700' }}>200 ALT</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-200/60">🥉 3位</span>
              <span style={{ color: '#ffd700' }}>100 ALT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
