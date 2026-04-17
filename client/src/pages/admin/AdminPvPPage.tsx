/**
 * AdminPvPPage — 対人戦績。
 * 部門タブ（小学生 / 中学生 / 全体）＋ マトリクス + 個人ランキング + ライバル関係。
 */
import { useEffect, useMemo, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import { fetchPvPAnalysis, type PvPAnalysis, type PvPScope, type PvPCell } from '@/lib/adminDashboardService';

const SCOPE_TABS: Array<{ id: PvPScope; label: string; emoji: string }> = [
  { id: 'elementary', label: '小学生の部', emoji: '🏫' },
  { id: 'middle',     label: '中学生の部', emoji: '🎓' },
  { id: 'all',        label: '全体',       emoji: '👥' },
];

export default function AdminPvPPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function cellColor(cell: PvPCell | undefined): { bg: string; color: string } {
  if (!cell || (cell.wins === 0 && cell.losses === 0)) {
    return { bg: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.25)' };
  }
  const diff = cell.wins - cell.losses;
  if (diff > 0) return { bg: 'rgba(34,197,94,0.18)', color: '#22c55e' };
  if (diff < 0) return { bg: 'rgba(239,68,68,0.18)', color: '#f87171' };
  return { bg: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' };
}

function Inner() {
  const [scope, setScope] = useState<PvPScope>('elementary');
  const [data, setData] = useState<PvPAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetchPvPAnalysis(scope).then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, [scope]);

  const totalBattles = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    Object.values(data.matrix).forEach((row) => Object.values(row).forEach((c) => { n += c.wins; }));
    return n;
  }, [data]);

  return (
    <AdminShell title="対人戦績" subtitle={`部門別の対戦結果と対戦マトリクス`} backHref="/admin">
      {/* Scope tabs */}
      <div className="flex gap-1 mb-3">
        {SCOPE_TABS.map((t) => {
          const active = scope === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setScope(t.id)}
              className="flex-1 rounded-lg py-2 text-[12px] font-black transition-all"
              style={{
                background: active ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                color: active ? '#ffd700' : 'rgba(255,215,0,0.55)',
                border: active ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,215,0,0.15)',
              }}
            >
              {t.emoji} {t.label}
            </button>
          );
        })}
      </div>

      {!data && <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>}
      {data && data.students.length === 0 && (
        <p className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>この部門に生徒がいません</p>
      )}

      {data && data.students.length > 0 && (
        <>
          {/* Summary */}
          <AdminCard className="p-3 mb-3">
            <div className="flex justify-between items-center text-[11px]">
              <span style={{ color: 'rgba(255,215,0,0.7)' }}>部門内総対戦数</span>
              <span className="text-lg font-black" style={{ color: '#ffd700' }}>{totalBattles}回</span>
            </div>
          </AdminCard>

          {/* Matrix */}
          <AdminCard className="p-2 mb-3">
            <p className="text-[11px] font-bold mb-2 px-1" style={{ color: 'rgba(255,215,0,0.7)' }}>
              🆚 対戦マトリクス（行の視点）
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px] border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                  <tr>
                    <th className="p-1"></th>
                    {data.students.map((s) => {
                      const cid = `${s.classAbbr}_${s.name}`;
                      return (
                        <th key={cid} className="p-1 text-center" style={{ color: 'rgba(255,215,0,0.65)', minWidth: 44 }}>
                          <div>{s.emoji}</div>
                          <div className="text-[9px] mt-0.5">{s.name.slice(0, 4)}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((row) => {
                    const rowId = `${row.classAbbr}_${row.name}`;
                    return (
                      <tr key={rowId}>
                        <td className="p-1 whitespace-nowrap text-right" style={{ color: 'rgba(255,215,0,0.7)' }}>
                          {row.emoji}<span className="ml-0.5">{row.name.slice(0, 4)}</span>
                        </td>
                        {data.students.map((col) => {
                          const colId = `${col.classAbbr}_${col.name}`;
                          if (rowId === colId) {
                            return <td key={colId} className="p-1 text-center" style={{ color: 'rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.3)' }}>—</td>;
                          }
                          const cell = data.matrix[rowId]?.[colId];
                          const { bg, color } = cellColor(cell);
                          const hasBattle = cell && (cell.wins > 0 || cell.losses > 0);
                          return (
                            <td key={colId} className="p-1 text-center font-bold rounded-sm"
                              style={{ background: bg, color, border: '1px solid rgba(255,215,0,0.12)' }}>
                              {hasBattle ? (
                                <span>{cell.wins}<span className="mx-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>-</span>{cell.losses}</span>
                              ) : (
                                <span style={{ opacity: 0.25 }}>-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[9px] mt-2 px-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
              緑=勝ち越し / 赤=負け越し / 灰=同数 / セルは「勝-負」（行の視点）
            </p>
          </AdminCard>

          {/* Rankings */}
          <AdminCard className="p-3 mb-3">
            <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🏅 個人対人成績</p>
            <table className="w-full text-[11px]">
              <thead>
                <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                  <th className="text-left">#</th>
                  <th className="text-left">名前</th>
                  <th className="text-right">勝</th>
                  <th className="text-right">敗</th>
                  <th className="text-right">勝率</th>
                  <th className="text-left">最多対戦</th>
                </tr>
              </thead>
              <tbody>
                {data.rankings.map((r, i) => (
                  <tr key={r.childId} style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <td style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)' }}>
                      {i + 1}
                    </td>
                    <td>{r.emoji} {r.name}</td>
                    <td className="text-right" style={{ color: '#22c55e' }}>{r.wins}</td>
                    <td className="text-right" style={{ color: '#f87171' }}>{r.losses}</td>
                    <td className="text-right">
                      {(r.wins + r.losses) > 0 ? `${Math.round(r.winRate * 100)}%` : '—'}
                    </td>
                    <td className="text-[10px]" style={{ color: 'rgba(255,215,0,0.6)' }}>
                      {r.topOpponentName ? `${r.topOpponentName}(${r.topOpponentBattles}戦)` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminCard>

          {/* Rivals */}
          <AdminCard tone="red" className="p-3">
            <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🔥 ライバル対決（3戦以上）</p>
            {data.rivals.length === 0 ? (
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだライバル関係は形成されていません</p>
            ) : (
              <ul className="flex flex-col gap-1 text-[11px]">
                {data.rivals.map((p) => (
                  <li key={`${p.a.childId}-${p.b.childId}`} className="flex items-center justify-between"
                    style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <span>{p.a.emoji} {p.a.name} vs {p.b.emoji} {p.b.name}</span>
                    <span className="font-bold tabular-nums">
                      {p.totalBattles}戦 <span style={{ color: 'rgba(255,255,255,0.5)' }}>({p.aWins}勝{p.bWins}敗)</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </>
      )}
    </AdminShell>
  );
}
