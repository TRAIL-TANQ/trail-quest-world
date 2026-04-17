/**
 * AdminStudentDetailPage — 生徒詳細。
 * 基本ステータス + タイムライン + デッキ使用 + ALTゲーム成績 + クエスト進捗 + 直近バトル + フィニッシャーTOP3
 */
import { useEffect, useState } from 'react';
import { useRoute } from 'wouter';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard, KpiTile } from '@/components/admin/AdminShell';
import { fetchStudentDetail, gameLabel, GAME_TYPE_SUBJECT, type StudentDetailPayload } from '@/lib/adminDashboardService';
import { fetchStudentTournamentRecords, type StudentTournamentRecord } from '@/lib/tournamentService';
import { DECK_KEYS, DECK_QUEST_INFO, type DeckKey, type QuestDifficulty } from '@/lib/questProgress';
import { DIVISION_LABELS, findStudentByChildId } from '@/data/students';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const DIFFICULTIES: QuestDifficulty[] = ['beginner', 'challenger', 'master', 'legend'];
const DIFFICULTY_SHORT: Record<QuestDifficulty, string> = {
  beginner:   '初',
  challenger: '中',
  master:     '上',
  legend:     '伝',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return iso.slice(5, 16).replace('T', ' ');
}

export default function AdminStudentDetailPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [, params] = useRoute('/admin/students/:childId');
  const childId = params ? decodeURIComponent(params.childId) : '';
  const [data, setData] = useState<StudentDetailPayload | null>(null);
  const [tournaments, setTournaments] = useState<StudentTournamentRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!childId) return;
    fetchStudentDetail(childId).then((d) => { if (!cancelled) setData(d); });
    fetchStudentTournamentRecords(childId).then((t) => { if (!cancelled) setTournaments(t); });
    return () => { cancelled = true; };
  }, [childId]);

  if (!data) {
    return (
      <AdminShell title="生徒詳細" backHref="/admin/students" backLabel="生徒一覧">
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      </AdminShell>
    );
  }

  const s = data.status;
  if (!s) {
    return (
      <AdminShell title="生徒詳細" backHref="/admin/students" backLabel="生徒一覧">
        <p className="text-center text-sm" style={{ color: '#f87171' }}>生徒が見つかりません: {childId}</p>
      </AdminShell>
    );
  }

  const deckChart = data.deckUsage.map((d) => ({ name: d.deckName, uses: d.uses, wins: d.wins }));

  return (
    <AdminShell
      title={`${s.emoji} ${s.name}`}
      subtitle={`${s.className} / 全21名中`}
      backHref="/admin/students"
      backLabel="生徒一覧"
    >
      {/* 基本KPI */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KpiTile icon="🎯" label="Lv" value={s.level} sub={`XP ${s.xp}`} />
        <KpiTile icon="🌟" label="ALT" value={s.altPoints} sub={`解放${s.deckUnlockedCount}/5`} />
        <KpiTile icon="⚔️" label="レート" value={s.rating} sub={`${s.wins}勝${s.losses}敗`} />
      </div>

      {/* Finisher TOP3 */}
      {data.finisherTop.length > 0 && (
        <AdminCard tone="gold" className="p-3 mb-3">
          <p className="text-[11px] font-bold mb-1.5" style={{ color: 'rgba(255,215,0,0.7)' }}>🏆 フィニッシャーTOP3</p>
          <div className="flex flex-col gap-1">
            {data.finisherTop.map((f, i) => (
              <div key={f.name} className="flex items-center justify-between text-[12px]">
                <span className="text-amber-100">
                  <span className="font-black mr-2" style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : '#cd7f32' }}>
                    {i + 1}
                  </span>
                  {f.name}
                </span>
                <span className="font-bold" style={{ color: '#ffd700' }}>×{f.count}</span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* タイムライン */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>📅 プレイ活動（直近30日）</p>
        {data.timeline.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだ記録なし</p>
        ) : (
          <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
            {data.timeline.map((day) => (
              <div key={day.date} className="pl-2" style={{ borderLeft: '2px solid rgba(255,215,0,0.4)' }}>
                <p className="text-[11px] font-bold" style={{ color: '#ffd700' }}>{day.date.slice(5)}</p>
                <ul className="list-disc pl-4 text-[10px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  {day.items.map((it, i) => (
                    <li key={i}>{it.text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {/* デッキ使用状況 */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>⚔️ デッキ使用状況</p>
        {data.deckUsage.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだバトル履歴なし</p>
        ) : (
          <>
            <div style={{ width: '100%', height: Math.max(120, data.deckUsage.length * 28) }}>
              <ResponsiveContainer>
                <BarChart data={deckChart} layout="vertical" margin={{ left: 60, right: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid stroke="rgba(255,215,0,0.08)" strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} tick={{ fill: 'rgba(255,215,0,0.55)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
                  <YAxis dataKey="name" type="category" tick={{ fill: 'rgba(255,215,0,0.75)', fontSize: 10 }} stroke="rgba(255,215,0,0.2)" />
                  <Tooltip contentStyle={{ background: '#0f1428', border: '1px solid #ffd700', fontSize: 11 }} />
                  <Bar dataKey="uses" fill="#ffd700" />
                  <Bar dataKey="wins" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-[11px] mt-2">
              <thead>
                <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                  <th className="text-left">デッキ</th>
                  <th className="text-right">回数</th>
                  <th className="text-right">勝率</th>
                  <th className="text-right">最終</th>
                </tr>
              </thead>
              <tbody>
                {data.deckUsage.map((d) => (
                  <tr key={d.deckKey} style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <td>{d.icon} {d.deckName}</td>
                    <td className="text-right">{d.uses}</td>
                    <td className="text-right">{d.uses > 0 ? `${Math.round(d.winRate * 100)}%` : '—'}</td>
                    <td className="text-right text-[10px] text-amber-200/50">{formatDate(d.lastUsedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </AdminCard>

      {/* ALTゲーム成績 */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🌟 ALTゲーム成績</p>
        {data.altGameStats.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだプレイ履歴なし</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                <th className="text-left">ゲーム</th>
                <th className="text-left text-[9px]">教科</th>
                <th className="text-right">回数</th>
                <th className="text-right">ベスト</th>
                <th className="text-right">最高★</th>
                <th className="text-right">ALT</th>
              </tr>
            </thead>
            <tbody>
              {data.altGameStats.map((g) => (
                <tr key={g.gameType} style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <td>{gameLabel(g.gameType)}</td>
                  <td className="text-[9px]" style={{ color: 'rgba(255,215,0,0.55)' }}>{GAME_TYPE_SUBJECT[g.gameType] ?? '—'}</td>
                  <td className="text-right">{g.plays}</td>
                  <td className="text-right">{g.bestScore}</td>
                  <td className="text-right">{'★'.repeat(g.maxDifficulty)}</td>
                  <td className="text-right" style={{ color: '#ffd700' }}>+{g.totalAlt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminCard>

      {/* クエスト進捗 */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>📖 デッキクエスト進捗</p>
        <table className="w-full text-[11px]">
          <thead>
            <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
              <th className="text-left">デッキ</th>
              {DIFFICULTIES.map((d) => (
                <th key={d} className="text-center">{DIFFICULTY_SHORT[d]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DECK_KEYS.map((dk) => {
              const info = DECK_QUEST_INFO[dk as DeckKey];
              const rowData = data.questProgress[dk];
              return (
                <tr key={dk} style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <td>{info.icon} {info.name}</td>
                  {DIFFICULTIES.map((d) => (
                    <td key={d} className="text-center">
                      {rowData?.[d]?.cleared ? (
                        <span style={{ color: d === 'legend' ? '#ffd700' : '#22c55e' }}>
                          {d === 'legend' ? '🏆' : '✅'}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.25)' }}>—</span>
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminCard>

      {/* 対人戦績 */}
      <AdminCard tone="green" className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(34,197,94,0.9)' }}>🆚 対人戦績</p>
        {(data.pvpStats.wins + data.pvpStats.losses) === 0 ? (
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだ対人戦の記録がありません</p>
        ) : (
          <>
            <div className="flex gap-3 text-[12px] mb-2">
              <span style={{ color: '#22c55e' }}><strong className="text-lg">{data.pvpStats.wins}</strong>勝</span>
              <span style={{ color: '#f87171' }}><strong className="text-lg">{data.pvpStats.losses}</strong>敗</span>
              <span style={{ color: '#ffd700' }}>勝率 <strong>{Math.round(data.pvpStats.winRate * 100)}%</strong></span>
            </div>
            {data.pvpStats.topOpponentName && (
              <p className="text-[11px] mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>
                🔥 最多対戦: {data.pvpStats.topOpponentName}（{data.pvpStats.topOpponentBattles}戦）
              </p>
            )}
            {data.pvpStats.recentPvp.length > 0 && (
              <ul className="flex flex-col gap-1 text-[11px]">
                {data.pvpStats.recentPvp.map((b) => {
                  const opp = b.opponentId ? findStudentByChildId(b.opponentId) : null;
                  const info = DECK_QUEST_INFO[b.deckKey as DeckKey];
                  return (
                    <li key={b.id} className="flex items-center justify-between" style={{ color: 'rgba(255,255,255,0.85)' }}>
                      <span>
                        {b.result === 'win' ? '🏆' : '💀'} vs {opp?.emoji} {opp?.name ?? b.opponentId}
                        {info && <span className="ml-1 text-[10px]" style={{ color: 'rgba(255,215,0,0.5)' }}>[{info.name}]</span>}
                        {b.finisherCardName && <span className="ml-1 text-[10px]" style={{ color: 'rgba(255,215,0,0.7)' }}>/ {b.finisherCardName}</span>}
                      </span>
                      <span className="text-[9px]" style={{ color: 'rgba(255,215,0,0.5)' }}>{formatDate(b.playedAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </AdminCard>

      {/* 大会戦績 */}
      <AdminCard tone="purple" className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(168,85,247,0.9)' }}>🏆 大会戦績</p>
        {tournaments.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだ大会参加履歴なし</p>
        ) : (
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                <th className="text-left">大会</th>
                <th className="text-left">部門</th>
                <th className="text-right">結果</th>
                <th className="text-left">受賞</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t) => {
                const resultLabel = t.result === 'champion' ? '🏆 優勝' : t.result === 'runner_up' ? '🥈 準優勝'
                  : t.result === 'third' ? '🥉 3位' : t.result === 'ongoing' ? '進行中' : '出場';
                return (
                  <tr key={t.tournamentId} style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <td>{t.name}</td>
                    <td className="text-[10px]" style={{ color: 'rgba(255,215,0,0.6)' }}>{DIVISION_LABELS[t.division]}</td>
                    <td className="text-right" style={{ color: t.result === 'champion' ? '#ffd700' : t.result === 'ongoing' ? 'rgba(255,255,255,0.5)' : '#fff' }}>
                      {resultLabel}
                    </td>
                    <td className="text-[10px]" style={{ color: '#ffd700' }}>{t.rewards.join(', ') || '—'}</td>
                  </tr>
                );
              })}
              <tr>
                <td colSpan={4} className="text-[10px] pt-2" style={{ color: 'rgba(255,215,0,0.55)' }}>
                  出場{tournaments.length}回 / 優勝{tournaments.filter((x) => x.result === 'champion').length}回 /
                  入賞{tournaments.filter((x) => x.result === 'champion' || x.result === 'runner_up' || x.result === 'third').length}回
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </AdminCard>

      {/* フィニッシャー分析 TOP5 */}
      {data.finisherAllTop5.length > 0 && (
        <AdminCard className="p-3 mb-3">
          <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🎯 フィニッシャー分析TOP5（全バトル通算）</p>
          <ol className="flex flex-col gap-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
            {data.finisherAllTop5.map((f, i) => (
              <li key={f.name} className="flex items-center justify-between">
                <span>
                  <span className="font-black mr-2" style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)' }}>
                    {i + 1}
                  </span>
                  {f.name}
                </span>
                <span style={{ color: 'rgba(255,215,0,0.75)' }}>{f.count}回（{Math.round(f.share * 100)}%）</span>
              </li>
            ))}
          </ol>
        </AdminCard>
      )}

      {/* 直近バトル10試合 */}
      <AdminCard className="p-3 mb-3">
        <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🕐 直近10試合</p>
        {data.recentBattles.length === 0 ? (
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだバトル履歴なし</p>
        ) : (
          <ul className="flex flex-col gap-1 text-[11px]">
            {data.recentBattles.map((b) => {
              const info = DECK_QUEST_INFO[b.deckKey as DeckKey];
              return (
                <li key={b.id} className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <span style={{ color: b.result === 'win' ? '#22c55e' : '#ef4444' }}>
                    {b.result === 'win' ? '🏆' : '💀'}
                  </span>
                  <span className="truncate">
                    {info?.icon ?? '📦'} {info?.name ?? b.deckKey}
                    {b.finisherCardName && ` / ${b.finisherCardName}`}
                  </span>
                  <span className="ml-auto text-[9px]" style={{ color: 'rgba(255,215,0,0.5)' }}>
                    {formatDate(b.playedAt)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </AdminCard>
    </AdminShell>
  );
}
