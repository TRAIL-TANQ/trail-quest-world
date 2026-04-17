/**
 * AdminAltGamesPage — ALTゲーム分析。
 * ゲーム別プレイ回数 / 難易度別分布 / 生徒別ランキング。
 */
import { useEffect, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard, KpiTile } from '@/components/admin/AdminShell';
import {
  fetchAltGameAnalysis,
  gameLabel,
  type AltGameAnalysis,
  GAME_TYPE_SUBJECT,
} from '@/lib/adminDashboardService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

export default function AdminAltGamesPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [data, setData] = useState<AltGameAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAltGameAnalysis().then((d) => { if (!cancelled) setData(d); });
    return () => { cancelled = true; };
  }, []);

  if (!data) {
    return (
      <AdminShell title="ALTゲーム分析" backHref="/admin">
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      </AdminShell>
    );
  }

  // 難易度別分布データ: ゲームを行、★1-★5を積み上げ
  const difficultyChart = data.byGame.map((g) => ({
    name: gameLabel(g.gameType).replace(/^[^ ]+ /, ''),
    '★1': g.difficultyCounts[1] ?? 0,
    '★2': g.difficultyCounts[2] ?? 0,
    '★3': g.difficultyCounts[3] ?? 0,
    '★4': g.difficultyCounts[4] ?? 0,
    '★5': g.difficultyCounts[5] ?? 0,
  }));

  return (
    <AdminShell title="ALTゲーム分析" subtitle={`累計 ${data.totalPlaysAll}プレイ`} backHref="/admin">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <KpiTile icon="🎮" label="本日プレイ" value={`${data.totalPlaysToday}回`} sub={`累計 ${data.totalPlaysAll}回`} />
        <KpiTile icon="🏆" label="人気No.1" value={data.mostPopularGame ? gameLabel(data.mostPopularGame).replace(/^[^ ]+ /, '') : '—'} />
        {data.topAltStudent ? (
          <KpiTile
            icon="💰"
            label="ALT獲得No.1"
            value={`${data.topAltStudent.emoji} ${data.topAltStudent.name}`}
            sub={`+${data.topAltStudent.totalAlt} ALT`}
          />
        ) : (
          <KpiTile icon="💰" label="ALT獲得No.1" value="—" />
        )}
        <KpiTile icon="👥" label="参加生徒" value={`${data.byStudent.length}名`} />
      </div>

      {/* Game table */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>📊 ゲーム別成績</p>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                <th className="text-left">ゲーム</th>
                <th className="text-left text-[9px]">教科</th>
                <th className="text-right">今日</th>
                <th className="text-right">累計</th>
                <th className="text-right">平均</th>
                <th className="text-right">最高</th>
                <th className="text-left">最高者</th>
              </tr>
            </thead>
            <tbody>
              {data.byGame.map((g) => (
                <tr key={g.gameType} style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <td>{gameLabel(g.gameType)}</td>
                  <td className="text-[9px]" style={{ color: 'rgba(255,215,0,0.55)' }}>{GAME_TYPE_SUBJECT[g.gameType] ?? '—'}</td>
                  <td className="text-right">{g.todayPlays}</td>
                  <td className="text-right">{g.totalPlays}</td>
                  <td className="text-right">{g.avgScore}</td>
                  <td className="text-right">{g.bestScore}</td>
                  <td className="text-[10px]" style={{ color: 'rgba(255,215,0,0.6)' }}>
                    {g.bestEmoji ? `${g.bestEmoji} ${g.bestStudentName}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>

      {/* Difficulty stacked bar */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>⭐ 難易度別プレイ分布</p>
        <div style={{ width: '100%', height: Math.max(160, difficultyChart.length * 34) }}>
          <ResponsiveContainer>
            <BarChart data={difficultyChart} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
              <CartesianGrid stroke="rgba(255,215,0,0.08)" strokeDasharray="3 3" />
              <XAxis type="number" allowDecimals={false} tick={{ fill: 'rgba(255,215,0,0.55)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
              <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,215,0,0.75)', fontSize: 9 }} stroke="rgba(255,215,0,0.2)" />
              <Tooltip contentStyle={{ background: '#0f1428', border: '1px solid #ffd700', fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="★1" stackId="d" fill="#22c55e" />
              <Bar dataKey="★2" stackId="d" fill="#eab308" />
              <Bar dataKey="★3" stackId="d" fill="#f97316" />
              <Bar dataKey="★4" stackId="d" fill="#ef4444" />
              <Bar dataKey="★5" stackId="d" fill="#a855f7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AdminCard>

      {/* Student ranking */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🏅 生徒別プレイランキング</p>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
              <th className="text-left">生徒</th>
              <th className="text-right">回数</th>
              <th className="text-right">累計ALT</th>
              <th className="text-left">得意</th>
              <th className="text-right">最高★</th>
            </tr>
          </thead>
          <tbody>
            {data.byStudent.map((s) => (
              <tr key={s.childId} style={{ color: 'rgba(255,255,255,0.85)' }}>
                <td>{s.emoji} {s.name}</td>
                <td className="text-right">{s.plays}</td>
                <td className="text-right" style={{ color: '#ffd700' }}>+{s.totalAlt}</td>
                <td className="text-[10px]" style={{ color: 'rgba(255,215,0,0.6)' }}>
                  {s.topGame ? gameLabel(s.topGame).replace(/^[^ ]+ /, '') : '—'}
                </td>
                <td className="text-right">{'★'.repeat(s.topDifficulty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AdminCard>
    </AdminShell>
  );
}
