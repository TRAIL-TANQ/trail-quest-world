/**
 * AdminTournamentsPage — 大会一覧 + 新規作成。
 * 各行タップで /admin/tournaments/:id（詳細ページ）へ。
 */
import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard } from '@/components/admin/AdminShell';
import { createTournament, listTournaments, type Tournament } from '@/lib/tournamentService';
import { DIVISION_LABELS, type Division } from '@/data/students';
import { toast } from 'sonner';

const PHASE_LABELS: Record<Tournament['phase'], string> = {
  recruiting:  '参加受付中',
  round_robin: '総当たり中',
  finals:      '決勝進行中',
  finished:    '終了',
};

const PHASE_COLORS: Record<Tournament['phase'], string> = {
  recruiting:  '#60a5fa',
  round_robin: '#eab308',
  finals:      '#ef4444',
  finished:    '#22c55e',
};

export default function AdminTournamentsPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [division, setDivision] = useState<Division>('elementary');
  const [finalsSize, setFinalsSize] = useState<2 | 4>(2);
  const [submitting, setSubmitting] = useState(false);

  const reload = () => { void listTournaments().then(setTournaments); };
  useEffect(() => { reload(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('大会名を入力してください'); return; }
    setSubmitting(true);
    const t = await createTournament({ name: name.trim(), division, finalsSize });
    setSubmitting(false);
    if (!t) { toast.error('作成に失敗しました'); return; }
    toast.success(`「${t.name}」を作成しました`);
    setShowCreate(false);
    setName('');
    reload();
  };

  return (
    <AdminShell title="大会管理" subtitle="対人戦トーナメントの作成と進行" backHref="/admin">
      <button
        onClick={() => setShowCreate((v) => !v)}
        className="w-full mb-3 rounded-xl py-2.5 text-sm font-black transition-all active:scale-[0.98]"
        style={{
          background: showCreate ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #ffd700, #d4a500)',
          color: showCreate ? 'rgba(255,215,0,0.8)' : '#0b1128',
          border: showCreate ? '1.5px solid rgba(255,215,0,0.4)' : '2px solid #c5a03f',
          boxShadow: showCreate ? 'none' : '0 2px 10px rgba(255,215,0,0.25)',
        }}
      >
        {showCreate ? 'キャンセル' : '＋ 新しい大会を作る'}
      </button>

      {showCreate && (
        <AdminCard tone="gold" className="p-4 mb-3">
          <label className="block text-[11px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>大会名</label>
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="第1回TRAILカップ"
            className="w-full px-3 py-2 rounded-lg text-sm mb-3"
            style={{ background: 'rgba(0,0,0,0.4)', color: '#fff', border: '1.5px solid rgba(255,215,0,0.3)', outline: 'none' }}
          />

          <label className="block text-[11px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>部門</label>
          <div className="flex gap-2 mb-3">
            {(Object.keys(DIVISION_LABELS) as Division[]).map((d) => (
              <button
                key={d}
                onClick={() => setDivision(d)}
                className="flex-1 rounded-lg py-2 text-[12px] font-black"
                style={{
                  background: division === d ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                  color: division === d ? '#ffd700' : 'rgba(255,215,0,0.55)',
                  border: division === d ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,215,0,0.15)',
                }}
              >
                {DIVISION_LABELS[d]}
              </button>
            ))}
          </div>

          <label className="block text-[11px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>決勝進出人数</label>
          <div className="flex gap-2 mb-4">
            {[2, 4].map((n) => (
              <button
                key={n}
                onClick={() => setFinalsSize(n as 2 | 4)}
                className="flex-1 rounded-lg py-2 text-[12px] font-black"
                style={{
                  background: finalsSize === n ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                  color: finalsSize === n ? '#ffd700' : 'rgba(255,215,0,0.55)',
                  border: finalsSize === n ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,215,0,0.15)',
                }}
              >
                {n}人（{n === 2 ? '決勝1試合' : '準決勝+決勝+3位決定戦'}）
              </button>
            ))}
          </div>

          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full py-2.5 rounded-xl text-sm font-black"
            style={{
              background: 'linear-gradient(135deg, #ffd700, #d4a500)',
              color: '#0b1128',
              boxShadow: '0 2px 10px rgba(255,215,0,0.25)',
              opacity: submitting ? 0.5 : 1,
            }}
          >
            {submitting ? '作成中...' : '大会を作成'}
          </button>
        </AdminCard>
      )}

      {!tournaments && <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>}
      {tournaments && tournaments.length === 0 && (
        <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
          まだ大会がありません
        </p>
      )}

      <div className="flex flex-col gap-2">
        {(tournaments ?? []).map((t) => (
          <Link key={t.id} href={`/admin/tournaments/${t.id}`}>
            <div>
              <AdminCard className="p-3 active:scale-[0.99] transition-transform cursor-pointer">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: 'rgba(255,215,0,0.1)', color: 'rgba(255,215,0,0.7)', border: '1px solid rgba(255,215,0,0.25)' }}>
                    {DIVISION_LABELS[t.division]}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                    style={{ background: `${PHASE_COLORS[t.phase]}22`, color: PHASE_COLORS[t.phase], border: `1px solid ${PHASE_COLORS[t.phase]}66` }}>
                    {PHASE_LABELS[t.phase]}
                  </span>
                </div>
                <p className="text-sm font-bold text-amber-100">{t.name}</p>
                <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                  <span>参加 {t.participants.length}名 / 決勝 {t.finalsSize}人</span>
                  {t.championId && (
                    <span style={{ color: '#ffd700' }}>🏆 {t.championId.split('_')[1]}</span>
                  )}
                </div>
              </AdminCard>
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
