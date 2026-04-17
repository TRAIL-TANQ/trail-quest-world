/**
 * AdminDashboardPage — 👑 管理者ダッシュボードのトップ。
 * サマリーカード4つ + MenuButton リンク4つ + DAU折れ線グラフ。
 */
import { useEffect, useState } from 'react';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard, KpiTile } from '@/components/admin/AdminShell';
import MenuButton from '@/components/ui/MenuButton';
import { fetchDashboardOverview, type DashboardOverview } from '@/lib/adminDashboardService';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

function formatPct(v: number) { return `${Math.round(v * 1000) / 10}%`; }

function shortDate(iso: string): string {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}` : iso;
}

export default function AdminDashboardPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardOverview()
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminShell title="管理者ダッシュボード" subtitle="全体サマリーと分析メニュー">
      {!data && !error && (
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      )}
      {error && (
        <AdminCard tone="red" className="p-4 text-center text-sm" >
          <span style={{ color: '#f87171' }}>データ取得失敗: {error}</span>
        </AdminCard>
      )}

      {data && (
        <>
          {/* サマリーカード（2列グリッド） */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <KpiTile
              icon="👥"
              label="総生徒数"
              value={`${data.totalStudents}名`}
              sub={`本日ログイン ${data.todayLoginCount}名`}
            />
            <KpiTile
              icon="⚔️"
              label="本日バトル"
              value={`${data.todayBattleCount}回`}
              sub={`全体勝率 ${formatPct(data.overallWinRate)}`}
            />
            <KpiTile
              icon="🌟"
              label="本日ALT獲得"
              value={`+${data.todayAltEarned}`}
              sub={`B:${data.altBreakdown[0].amount} / Q:${data.altBreakdown[1].amount} / G:${data.altBreakdown[2].amount}`}
            />
            <KpiTile
              icon="📊"
              label="MAU(30日)"
              value={`${data.mau}名`}
              sub={`本日DAU ${data.dauByDate[data.dauByDate.length - 1]?.count ?? 0}名`}
            />
          </div>

          {/* DAU折れ線 */}
          <AdminCard className="p-3 mb-4">
            <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>
              📈 過去7日間のDAU
            </p>
            <div style={{ width: '100%', height: 140 }}>
              <ResponsiveContainer>
                <LineChart data={data.dauByDate.map((d) => ({ date: shortDate(d.date), count: d.count }))}>
                  <CartesianGrid stroke="rgba(255,215,0,0.08)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: 'rgba(255,215,0,0.55)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
                  <YAxis allowDecimals={false} tick={{ fill: 'rgba(255,215,0,0.55)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
                  <Tooltip contentStyle={{ background: '#0f1428', border: '1px solid #ffd700', fontSize: 11 }} />
                  <Line type="monotone" dataKey="count" stroke="#ffd700" strokeWidth={2} dot={{ r: 3, fill: '#ffd700' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AdminCard>

          {/* メニューリンク */}
          <div className="flex flex-col" style={{ gap: 10 }}>
            <MenuButton
              href="/admin/students"
              icon="👥"
              title="生徒一覧"
              subtitle="21名の詳細データを確認"
              gradient="linear-gradient(135deg, #1a3a5c 0%, #2980b9 55%, #3498db 100%)"
            />
            <MenuButton
              href="/admin/decks"
              icon="⚔️"
              title="デッキ分析"
              subtitle="人気ランキング・勝率・フィニッシャー率"
              gradient="linear-gradient(135deg, #8b1a1a 0%, #c0392b 55%, #e74c3c 100%)"
            />
            <MenuButton
              href="/admin/cards"
              icon="🃏"
              title="カード分析"
              subtitle="フィニッシャーTOP20とレアリティ別集計"
              gradient="linear-gradient(135deg, #4c1d95 0%, #7c3aed 55%, #a855f7 100%)"
            />
            <MenuButton
              href="/admin/alt-games"
              icon="🌟"
              title="ALTゲーム分析"
              subtitle="ゲーム別/難易度別プレイ傾向"
              gradient="linear-gradient(135deg, #78530b 0%, #d4a500 55%, #ffd700 100%)"
            />
            <MenuButton
              href="/admin/pvp"
              icon="🆚"
              title="対人戦績"
              subtitle="部門別マトリクス・個人ランキング"
              gradient="linear-gradient(135deg, #059669 0%, #10b981 55%, #34d399 100%)"
            />
            <MenuButton
              href="/admin/tournaments"
              icon="🏆"
              title="大会管理"
              subtitle="TRAILカップの作成・進行・賞品付与"
              gradient="linear-gradient(135deg, #be185d 0%, #db2777 55%, #ec4899 100%)"
            />
            <MenuButton
              href="/admin/shop-order"
              icon="🛠️"
              title="ショップ並び順"
              subtitle="アバターアイテムの表示順序を編集"
              gradient="linear-gradient(135deg, #1f2937 0%, #4b5563 55%, #6b7280 100%)"
            />
          </div>
        </>
      )}
    </AdminShell>
  );
}
