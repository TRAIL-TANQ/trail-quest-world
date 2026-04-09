/*
 * RankingPage: Dark UI × Neon - Daily/Weekly/Monthly tabs + ranking list
 */
import { useState } from 'react';
import { MOCK_RANKINGS } from '@/lib/mockData';
import { Trophy, Coins } from 'lucide-react';

const TABS = [
  { id: 'daily', label: 'デイリー' },
  { id: 'weekly', label: 'ウィークリー' },
  { id: 'monthly', label: 'マンスリー' },
];

const RANK_COLORS: Record<number, string> = {
  1: '#F59E0B',
  2: '#94A3B8',
  3: '#CD7F32',
};

export default function RankingPage() {
  const [activeTab, setActiveTab] = useState('daily');

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-bold mb-3" style={{ color: '#F8FAFC' }}>ランキング</h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: isActive ? '#4F46E5' : 'transparent',
                color: isActive ? '#F8FAFC' : '#94A3B8',
                boxShadow: isActive ? '0 0 12px rgba(79,70,229,0.3)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* My Rank Banner */}
      <div
        className="rounded-xl p-3 mb-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(79,70,229,0.05))',
          border: '1px solid rgba(79,70,229,0.2)',
        }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}>
          🧑‍🎓
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold" style={{ color: '#F8FAFC' }}>あなたの順位</p>
          <p className="text-[10px]" style={{ color: '#94A3B8' }}>もっとプレイして上を目指そう！</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black" style={{ color: '#A5B4FC' }}>4位</p>
          <div className="flex items-center gap-0.5">
            <Coins className="w-3 h-3" style={{ color: '#F59E0B' }} />
            <span className="text-[10px] font-bold" style={{ color: '#F59E0B' }}>170 ALT</span>
          </div>
        </div>
      </div>

      {/* Ranking List */}
      <div className="space-y-2">
        {MOCK_RANKINGS.map((entry, i) => {
          const rank = i + 1;
          const isTop3 = rank <= 3;
          const rankColor = RANK_COLORS[rank] || '#94A3B8';

          return (
            <div
              key={entry.userId}
              className="rounded-xl p-3 flex items-center gap-3"
              style={{
                background: isTop3 ? `linear-gradient(135deg, ${rankColor}10, ${rankColor}05)` : '#1E293B',
                border: isTop3 ? `1px solid ${rankColor}30` : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="w-8 text-center shrink-0">
                {isTop3 ? (
                  <Trophy className="w-5 h-5 mx-auto" style={{ color: rankColor }} />
                ) : (
                  <span className="text-sm font-bold" style={{ color: '#94A3B8' }}>{rank}</span>
                )}
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0"
                style={{
                  background: isTop3 ? `${rankColor}20` : 'rgba(255,255,255,0.05)',
                  border: isTop3 ? `1px solid ${rankColor}40` : '1px solid rgba(255,255,255,0.06)',
                }}
              >
                👤
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: '#F8FAFC' }}>{entry.nickname}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Coins className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                <span className="text-sm font-bold tabular-nums" style={{ color: '#F59E0B' }}>{entry.score}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
