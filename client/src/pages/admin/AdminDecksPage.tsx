/**
 * AdminDecksPage — デッキ分析。
 * 人気ランキング / 勝率比較 / デッキ別フィニッシャーTOP3。
 */
import { useEffect, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import { fetchDeckAnalysis, type DeckAnalysisRow } from '@/lib/adminDashboardService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

export default function AdminDecksPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [rows, setRows] = useState<DeckAnalysisRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDeckAnalysis().then((r) => { if (!cancelled) setRows(r); });
    return () => { cancelled = true; };
  }, []);

  if (!rows) {
    return (
      <AdminShell title="デッキ分析" backHref="/admin">
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      </AdminShell>
    );
  }

  const totalUses = rows.reduce((a, r) => a + r.uses, 0);
  const usesChart = rows.filter((r) => r.deckKey !== 'custom').map((r) => ({ name: r.deckName, uses: r.uses }));
  const winRateChart = rows.filter((r) => r.uses > 0 && r.deckKey !== 'custom').map((r) => ({
    name: r.deckName, winRate: Math.round(r.winRate * 100),
  }));

  return (
    <AdminShell title="デッキ分析" subtitle={`全${totalUses}バトル`} backHref="/admin">
      {/* 人気ランキング棒グラフ */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>📊 使用回数</p>
        <div style={{ width: '100%', height: Math.max(140, usesChart.length * 28) }}>
          <ResponsiveContainer>
            <BarChart data={usesChart} layout="vertical" margin={{ left: 70, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid stroke="rgba(255,215,0,0.08)" strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: 'rgba(255,215,0,0.55)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
              <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,215,0,0.75)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
              <Tooltip contentStyle={{ background: '#0f1428', border: '1px solid #ffd700', fontSize: 11 }} />
              <Bar dataKey="uses" fill="#ffd700" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>

      {/* ランキングテーブル */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🏅 人気ランキング</p>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
              <th className="text-left">#</th>
              <th className="text-left">デッキ</th>
              <th className="text-right">使用</th>
              <th className="text-right">使用率</th>
              <th className="text-right">勝率</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.deckKey} style={{ color: 'rgba(255,255,255,0.85)' }}>
                <td style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)' }}>
                  {i + 1}
                </td>
                <td>{r.icon} {r.deckName}</td>
                <td className="text-right">{r.uses}</td>
                <td className="text-right">{Math.round(r.share * 100)}%</td>
                <td className="text-right" style={{ color: r.uses > 0 ? (r.winRate >= 0.5 ? '#22c55e' : '#ef4444') : 'rgba(255,255,255,0.3)' }}>
                  {r.uses > 0 ? `${Math.round(r.winRate * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>

      {/* 勝率比較 */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>📈 デッキ別勝率</p>
        <div style={{ width: '100%', height: Math.max(140, winRateChart.length * 28) }}>
          <ResponsiveContainer>
            <BarChart data={winRateChart} layout="vertical" margin={{ left: 70, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid stroke="rgba(255,215,0,0.08)" strokeDasharray="3 3" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: 'rgba(255,215,0,0.55)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
              <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,215,0,0.75)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
              <Tooltip contentStyle={{ background: '#0f1428', border: '1px solid #ffd700', fontSize: 11 }} />
              <Bar dataKey="winRate">
                {winRateChart.map((r, i) => (
                  <Cell key={i} fill={r.winRate >= 50 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>

      {/* フィニッシャー率 */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🏆 デッキ別フィニッシャーTOP3</p>
        <div className="flex flex-col gap-2">
          {rows.filter((r) => r.uses > 0 && r.topFinishers.length > 0).map((r) => (
            <div key={r.deckKey} className="rounded-lg p-2"
              style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
              <p className="text-[11px] font-bold mb-1" style={{ color: '#ffd700' }}>{r.icon} {r.deckName}</p>
              <ul className="pl-2 text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {r.topFinishers.map((f, i) => (
                  <li key={f.name} className="flex justify-between">
                    <span>{i + 1}. {f.name}</span>
                    <span className="tabular-nums" style={{ color: 'rgba(255,215,0,0.7)' }}>
                      {f.count}回（{Math.round(f.share * 100)}%）
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </AdminCard>
    </AdminShell>
  );
}
