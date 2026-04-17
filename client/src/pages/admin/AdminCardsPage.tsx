/**
 * AdminCardsPage — カード分析（フィニッシャーランキング）。
 * レアリティ別フィルターで「N なのに強いカード」を発見しやすくする。
 */
import { useEffect, useMemo, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import { fetchCardAnalysis, type CardAnalysisRow } from '@/lib/adminDashboardService';
import { COLLECTION_CARDS } from '@/lib/cardData';
import type { CardRarity } from '@/lib/knowledgeCards';

type RarityFilter = 'all' | 'N' | 'R' | 'SR' | 'SSR';
const RARITY_TABS: Array<{ id: RarityFilter; label: string; color: string }> = [
  { id: 'all', label: '全て',  color: 'rgba(255,215,0,0.8)' },
  { id: 'N',   label: 'N',     color: '#9ca3af' },
  { id: 'R',   label: 'R',     color: '#3b82f6' },
  { id: 'SR',  label: 'SR',    color: '#a855f7' },
  { id: 'SSR', label: 'SSR',   color: '#ffd700' },
];

interface EnrichedRow extends CardAnalysisRow {
  rarity: CardRarity | 'N';
}

function rarityOf(name: string): CardRarity {
  const c = COLLECTION_CARDS.find((cc) => cc.name === name);
  return (c?.rarity as CardRarity) ?? 'N';
}

export default function AdminCardsPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [rows, setRows] = useState<CardAnalysisRow[] | null>(null);
  const [filter, setFilter] = useState<RarityFilter>('all');

  useEffect(() => {
    let cancelled = false;
    fetchCardAnalysis().then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, []);

  const enriched: EnrichedRow[] = useMemo(() => {
    return (rows ?? []).map((r) => ({ ...r, rarity: rarityOf(r.name) }));
  }, [rows]);

  const filtered = useMemo(() => {
    if (filter === 'all') return enriched;
    return enriched.filter((r) => r.rarity === filter);
  }, [enriched, filter]);

  if (!rows) {
    return (
      <AdminShell title="カード分析" backHref="/admin">
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="カード分析" subtitle="フィニッシャー発生回数ランキング" backHref="/admin">
      <div className="flex gap-1 mb-3">
        {RARITY_TABS.map((t) => {
          const active = filter === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className="flex-1 rounded-md py-1.5 text-[11px] font-black transition-all"
              style={{
                background: active ? `${t.color}22` : 'rgba(255,255,255,0.04)',
                color: active ? t.color : 'rgba(255,255,255,0.5)',
                border: active ? `1.5px solid ${t.color}` : '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <AdminCard className="p-3">
        {filtered.length === 0 ? (
          <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>データがありません</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                <th className="text-left">#</th>
                <th className="text-left">カード</th>
                <th className="text-center">レア</th>
                <th className="text-right">フィニッシュ</th>
                <th className="text-right">率</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const rc = r.rarity === 'SSR' ? '#ffd700' : r.rarity === 'SR' ? '#a855f7' : r.rarity === 'R' ? '#3b82f6' : '#9ca3af';
                return (
                  <tr key={r.name} style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <td style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)' }}>
                      {i + 1}
                    </td>
                    <td>{r.name}</td>
                    <td className="text-center">
                      <span className="px-1.5 py-0.5 rounded font-black text-[10px]"
                        style={{ background: `${rc}22`, color: rc, border: `1px solid ${rc}66` }}>
                        {r.rarity}
                      </span>
                    </td>
                    <td className="text-right">{r.count}回</td>
                    <td className="text-right">{Math.round(r.share * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminCard>
    </AdminShell>
  );
}
