/**
 * AdminTournamentDetailPage — 大会詳細 & 進行管理。
 * Phase に応じてUIを切り替え、管理者が手動で試合結果を入力/Phase遷移/賞品付与できる。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import AdminGuard from '@/components/admin/AdminGuard';
import AdminShell, { AdminCard, KpiTile } from '@/components/admin/AdminShell';
import {
  awardRewards,
  computeStandings,
  finishTournament,
  getTournament,
  listMatches,
  listRewards,
  listTournaments,
  materializeFinalsRound3,
  REWARD_ALT,
  startFinals,
  startRoundRobin,
  tournamentOrdinal,
  updateMatchResult,
  type StandingRow,
  type Tournament,
  type TournamentMatch,
  type TournamentReward,
} from '@/lib/tournamentService';
import { DIVISION_LABELS, findStudentByChildId, studentsByDivision } from '@/data/students';
import { savePvPBattleHistory } from '@/lib/battleHistoryService';
import { DECK_KEY_TO_STARTER_ID, DECK_QUEST_INFO, AVAILABLE_DECK_KEYS, type DeckKey } from '@/lib/questProgress';
import { toast } from 'sonner';

function studentName(id: string): string {
  const s = findStudentByChildId(id);
  return s ? `${s.emoji} ${s.name}` : id;
}

function shortId(id: string): string { return id.split('_')[1] ?? id; }

interface MatchResultFormProps {
  match: TournamentMatch;
  onSaved: () => void;
}

function MatchResultForm({ match, onSaved }: MatchResultFormProps) {
  const [winner, setWinner] = useState<string>(match.winnerId ?? match.player1Id);
  const [p1Deck, setP1Deck] = useState(match.player1Deck ?? '');
  const [p2Deck, setP2Deck] = useState(match.player2Deck ?? '');
  const [p1Finisher, setP1Finisher] = useState(match.player1Finisher ?? '');
  const [p2Finisher, setP2Finisher] = useState(match.player2Finisher ?? '');
  const [p1Fans, setP1Fans] = useState(String(match.player1Fans || 0));
  const [p2Fans, setP2Fans] = useState(String(match.player2Fans || 0));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const winP1Fans = Number(p1Fans) || 0;
    const winP2Fans = Number(p2Fans) || 0;
    const ok = await updateMatchResult({
      matchId: match.id,
      winnerId: winner,
      player1Deck: p1Deck || null,
      player2Deck: p2Deck || null,
      player1Finisher: p1Finisher || null,
      player2Finisher: p2Finisher || null,
      player1Fans: winP1Fans,
      player2Fans: winP2Fans,
    });
    // battle_history にも記録（手動入力でも対人戦として残す）
    if (ok) {
      const winnerIsP1 = winner === match.player1Id;
      await savePvPBattleHistory({
        winnerId: winnerIsP1 ? match.player1Id : match.player2Id,
        loserId:  winnerIsP1 ? match.player2Id : match.player1Id,
        winnerDeckKey: winnerIsP1 ? (p1Deck || 'custom') : (p2Deck || 'custom'),
        loserDeckKey:  winnerIsP1 ? (p2Deck || 'custom') : (p1Deck || 'custom'),
        winnerFinisherName: winnerIsP1 ? (p1Finisher || null) : (p2Finisher || null),
        loserFinisherName:  winnerIsP1 ? (p2Finisher || null) : (p1Finisher || null),
        winnerFans: winnerIsP1 ? winP1Fans : winP2Fans,
        loserFans:  winnerIsP1 ? winP2Fans : winP1Fans,
        roundsPlayed: 3,
      });
    }
    setSaving(false);
    if (!ok) { toast.error('保存に失敗しました'); return; }
    toast.success('結果を保存しました');
    onSaved();
  };

  return (
    <AdminCard className="p-3 mb-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold" style={{ color: 'rgba(255,215,0,0.7)' }}>
          {match.bracket === 'round_robin' ? `第${match.matchOrder}試合` : match.bracket === 'semi' ? '準決勝' : match.bracket === 'final' ? '決勝' : '3位決定戦'}
        </span>
        {match.winnerId && (
          <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'rgba(34,197,94,0.18)', color: '#22c55e' }}>
            入力済み
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 mb-2 text-[12px]">
        <span className="flex-1 text-right">{studentName(match.player1Id)}</span>
        <span style={{ color: 'rgba(255,215,0,0.6)' }}>VS</span>
        <span className="flex-1">{studentName(match.player2Id)}</span>
      </div>

      <div className="flex gap-2 mb-2">
        <button
          onClick={() => setWinner(match.player1Id)}
          className="flex-1 rounded-md py-1.5 text-[11px] font-black"
          style={{
            background: winner === match.player1Id ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.04)',
            color: winner === match.player1Id ? '#22c55e' : 'rgba(255,255,255,0.5)',
            border: winner === match.player1Id ? '1.5px solid #22c55e' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {shortId(match.player1Id)} 勝ち
        </button>
        <button
          onClick={() => setWinner(match.player2Id)}
          className="flex-1 rounded-md py-1.5 text-[11px] font-black"
          style={{
            background: winner === match.player2Id ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.04)',
            color: winner === match.player2Id ? '#22c55e' : 'rgba(255,255,255,0.5)',
            border: winner === match.player2Id ? '1.5px solid #22c55e' : '1px solid rgba(255,255,255,0.15)',
          }}
        >
          {shortId(match.player2Id)} 勝ち
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>P1デッキ</p>
          <select value={p1Deck} onChange={(e) => setP1Deck(e.target.value)}
            className="w-full rounded-md py-1 px-1.5 text-[11px]"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }}>
            <option value="">—</option>
            {AVAILABLE_DECK_KEYS.map((k) => <option key={k} value={k}>{DECK_QUEST_INFO[k as DeckKey].name}</option>)}
            <option value="custom">マイデッキ</option>
          </select>
        </div>
        <div>
          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>P2デッキ</p>
          <select value={p2Deck} onChange={(e) => setP2Deck(e.target.value)}
            className="w-full rounded-md py-1 px-1.5 text-[11px]"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }}>
            <option value="">—</option>
            {AVAILABLE_DECK_KEYS.map((k) => <option key={k} value={k}>{DECK_QUEST_INFO[k as DeckKey].name}</option>)}
            <option value="custom">マイデッキ</option>
          </select>
        </div>
        <div>
          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>P1フィニッシャー</p>
          <input type="text" value={p1Finisher} onChange={(e) => setP1Finisher(e.target.value)}
            placeholder="カード名"
            className="w-full rounded-md py-1 px-1.5 text-[11px]"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }} />
        </div>
        <div>
          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>P2フィニッシャー</p>
          <input type="text" value={p2Finisher} onChange={(e) => setP2Finisher(e.target.value)}
            placeholder="カード名"
            className="w-full rounded-md py-1 px-1.5 text-[11px]"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }} />
        </div>
        <div>
          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>P1ファン</p>
          <input type="number" inputMode="numeric" value={p1Fans} onChange={(e) => setP1Fans(e.target.value)}
            className="w-full rounded-md py-1 px-1.5 text-[11px]"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }} />
        </div>
        <div>
          <p className="text-[9px] mb-0.5" style={{ color: 'rgba(255,215,0,0.5)' }}>P2ファン</p>
          <input type="number" inputMode="numeric" value={p2Fans} onChange={(e) => setP2Fans(e.target.value)}
            className="w-full rounded-md py-1 px-1.5 text-[11px]"
            style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }} />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-1.5 rounded-md text-[11px] font-black"
        style={{ background: 'linear-gradient(135deg, #ffd700, #d4a500)', color: '#0b1128', opacity: saving ? 0.5 : 1 }}>
        {saving ? '保存中...' : '結果を保存'}
      </button>
    </AdminCard>
  );
}

export default function AdminTournamentDetailPage() {
  return <AdminGuard><Inner /></AdminGuard>;
}

function Inner() {
  const [, params] = useRoute('/admin/tournaments/:id');
  const id = params?.id ?? '';
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [rewards, setRewards] = useState<TournamentReward[]>([]);
  const [standings, setStandings] = useState<StandingRow[]>([]);
  const [ordinal, setOrdinal] = useState(1);

  const [mvpId, setMvpId] = useState<string>('');
  const [fightSpiritId, setFightSpiritId] = useState<string>('');
  const [awarding, setAwarding] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [t, m, r, st, all] = await Promise.all([
      getTournament(id), listMatches(id), listRewards(id), computeStandings(id), listTournaments(),
    ]);
    setTournament(t);
    setMatches(m);
    setRewards(r);
    setStandings(st);
    setOrdinal(t ? tournamentOrdinal(all, t.id) : 1);
    // Finals 4人制: 準決勝が埋まったら決勝+3位決定戦を実体化
    if (t && t.phase === 'finals' && t.finalsSize === 4) {
      const semis = m.filter((mm) => mm.bracket === 'semi');
      const final = m.find((mm) => mm.bracket === 'final');
      if (semis.length === 2 && semis.every((mm) => mm.winnerId) && !final) {
        const ok = await materializeFinalsRound3(id);
        if (ok) {
          const m2 = await listMatches(id);
          setMatches(m2);
        }
      }
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  const recruitingCanStart = (tournament?.participants.length ?? 0) >= 2;
  const rrDone = useMemo(() => {
    const rrs = matches.filter((m) => m.bracket === 'round_robin');
    return rrs.length > 0 && rrs.every((m) => m.winnerId);
  }, [matches]);
  const finalsDone = useMemo(() => {
    if (!tournament) return false;
    if (tournament.finalsSize === 2) {
      const f = matches.find((m) => m.bracket === 'final');
      return Boolean(f?.winnerId);
    }
    const f = matches.find((m) => m.bracket === 'final');
    const third = matches.find((m) => m.bracket === 'third_place');
    return Boolean(f?.winnerId) && Boolean(third?.winnerId);
  }, [tournament, matches]);

  const rrMatches = matches.filter((m) => m.bracket === 'round_robin');
  const finalsMatches = matches.filter((m) => m.bracket !== 'round_robin');

  const finalMatch = matches.find((m) => m.bracket === 'final');
  const thirdMatch = matches.find((m) => m.bracket === 'third_place');

  // Best finisher 自動算出（RR+Finals全体で最多フィニッシャーのプレイヤー）
  const bestFinisherChildId = useMemo(() => {
    const count = new Map<string, number>();
    matches.forEach((m) => {
      if (!m.winnerId) return;
      // 勝者のフィニッシャーをカウント
      if (m.winnerId === m.player1Id && m.player1Finisher) {
        count.set(m.player1Id, (count.get(m.player1Id) ?? 0) + 1);
      } else if (m.winnerId === m.player2Id && m.player2Finisher) {
        count.set(m.player2Id, (count.get(m.player2Id) ?? 0) + 1);
      }
    });
    let best: string | null = null;
    let max = 0;
    count.forEach((c, id) => { if (c > max) { max = c; best = id; } });
    return best;
  }, [matches]);

  const handleAward = async () => {
    if (!tournament || !finalMatch?.winnerId) return;
    setAwarding(true);
    const runnerUpId = finalMatch.player1Id === finalMatch.winnerId ? finalMatch.player2Id : finalMatch.player1Id;
    const thirdId = thirdMatch?.winnerId ?? null;
    const ok = await awardRewards({
      tournamentId: tournament.id,
      championId: finalMatch.winnerId,
      runnerUpId,
      thirdId,
      mvpId: mvpId || null,
      bestFinisherId: bestFinisherChildId,
      fightSpiritId: fightSpiritId || null,
      tournamentNumber: ordinal,
    });
    if (ok) {
      await finishTournament(tournament.id, mvpId || null);
      toast.success('賞品を付与しました');
      await reload();
    } else {
      toast.error('付与に失敗しました');
    }
    setAwarding(false);
  };

  if (!tournament) {
    return (
      <AdminShell title="大会詳細" backHref="/admin/tournaments" backLabel="大会一覧">
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      </AdminShell>
    );
  }

  const divisionStudents = studentsByDivision(tournament.division);

  return (
    <AdminShell
      title={tournament.name}
      subtitle={`${DIVISION_LABELS[tournament.division]} / 決勝 ${tournament.finalsSize}人`}
      backHref="/admin/tournaments" backLabel="大会一覧"
    >
      {/* KPI */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <KpiTile icon="👥" label="参加者" value={tournament.participants.length} />
        <KpiTile icon="🗂️" label="Phase" value={tournament.phase} />
        <KpiTile icon="🏆" label="王者" value={tournament.championId ? shortId(tournament.championId) : '—'} />
      </div>

      {/* Phase 1: 参加受付 */}
      {tournament.phase === 'recruiting' && (
        <AdminCard tone="blue" className="p-3 mb-3">
          <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(96,165,250,0.9)' }}>📝 参加受付中</p>
          {tournament.participants.length === 0 ? (
            <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>まだ参加者がいません</p>
          ) : (
            <ul className="flex flex-wrap gap-1 text-[11px] mb-2">
              {tournament.participants.map((pid) => (
                <li key={pid} className="px-2 py-0.5 rounded"
                  style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)', color: 'rgba(255,255,255,0.85)' }}>
                  {studentName(pid)}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[9px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
            部門: {DIVISION_LABELS[tournament.division]} / 対象候補 {divisionStudents.length}名
          </p>
          <button
            onClick={async () => {
              const ok = await startRoundRobin(tournament.id);
              if (!ok) toast.error('開始できません（2人以上必要）');
              else { toast.success('総当たり戦を開始しました'); await reload(); }
            }}
            disabled={!recruitingCanStart}
            className="w-full py-2 rounded-lg text-[12px] font-black"
            style={{
              background: recruitingCanStart ? 'linear-gradient(135deg, #eab308, #ca8a04)' : 'rgba(255,255,255,0.05)',
              color: recruitingCanStart ? '#0b1128' : 'rgba(255,255,255,0.3)',
              opacity: recruitingCanStart ? 1 : 0.5,
            }}
          >
            {recruitingCanStart ? '参加を締め切り、総当たり戦を開始' : '参加者が2人以上必要です'}
          </button>
        </AdminCard>
      )}

      {/* Standings */}
      {(tournament.phase === 'round_robin' || tournament.phase === 'finals' || tournament.phase === 'finished') && standings.length > 0 && (
        <AdminCard className="p-3 mb-3">
          <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>🏅 総当たり順位</p>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ color: 'rgba(255,215,0,0.6)' }}>
                <th className="text-left">#</th>
                <th className="text-left">名前</th>
                <th className="text-right">勝</th>
                <th className="text-right">敗</th>
                <th className="text-right">勝点</th>
                <th className="text-right">ファン差</th>
                <th className="text-right">消化</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.childId} style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <td style={{ color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : 'rgba(255,255,255,0.4)' }}>
                    {i + 1}
                  </td>
                  <td>{s.emoji} {s.name}</td>
                  <td className="text-right" style={{ color: '#22c55e' }}>{s.wins}</td>
                  <td className="text-right" style={{ color: '#f87171' }}>{s.losses}</td>
                  <td className="text-right">{s.points}</td>
                  <td className="text-right" style={{ color: s.fanDiff > 0 ? '#22c55e' : s.fanDiff < 0 ? '#f87171' : 'rgba(255,255,255,0.5)' }}>
                    {s.fanDiff > 0 ? '+' : ''}{s.fanDiff}
                  </td>
                  <td className="text-right text-[10px]" style={{ color: 'rgba(255,215,0,0.5)' }}>{s.played}/{s.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </AdminCard>
      )}

      {/* Phase 2: 総当たり試合 */}
      {tournament.phase === 'round_robin' && (
        <>
          <AdminCard className="p-3 mb-3">
            <p className="text-[11px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>⚔️ 総当たり試合（手動入力）</p>
            <p className="text-[9px] mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
              消化済み {rrMatches.filter((m) => m.winnerId).length}/{rrMatches.length}
            </p>
          </AdminCard>
          {rrMatches.map((m) => <MatchResultForm key={m.id} match={m} onSaved={reload} />)}

          <AdminCard tone="gold" className="p-3 mb-3">
            <button
              onClick={async () => {
                const ok = await startFinals(tournament.id);
                if (!ok) toast.error('開始できません（参加者数不足か試合未完了）');
                else { toast.success('決勝トーナメントへ進みました'); await reload(); }
              }}
              disabled={!rrDone}
              className="w-full py-2 rounded-lg text-[12px] font-black"
              style={{
                background: rrDone ? 'linear-gradient(135deg, #ffd700, #d4a500)' : 'rgba(255,255,255,0.05)',
                color: rrDone ? '#0b1128' : 'rgba(255,255,255,0.3)',
                opacity: rrDone ? 1 : 0.5,
              }}
            >
              {rrDone ? '総当たり終了 → 決勝トーナメントへ' : '全試合の結果入力が必要です'}
            </button>
          </AdminCard>
        </>
      )}

      {/* Phase 3: 決勝 */}
      {tournament.phase === 'finals' && (
        <>
          <AdminCard tone="red" className="p-3 mb-3">
            <p className="text-[11px] font-bold mb-1" style={{ color: 'rgba(239,68,68,0.9)' }}>🔥 決勝トーナメント</p>
          </AdminCard>
          {finalsMatches.map((m) => <MatchResultForm key={m.id} match={m} onSaved={reload} />)}

          {finalsDone && (
            <AdminCard tone="gold" className="p-3 mb-3">
              <p className="text-[11px] font-bold mb-2" style={{ color: 'rgba(255,215,0,0.9)' }}>🎖️ 特別賞（任意）</p>
              <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>MVP</label>
              <select value={mvpId} onChange={(e) => setMvpId(e.target.value)}
                className="w-full rounded-md py-1 px-1.5 text-[11px] mb-2"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }}>
                <option value="">（指定なし）</option>
                {tournament.participants.map((pid) => (
                  <option key={pid} value={pid}>{studentName(pid)}</option>
                ))}
              </select>
              <label className="block text-[10px] mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>ファイトスピリット賞</label>
              <select value={fightSpiritId} onChange={(e) => setFightSpiritId(e.target.value)}
                className="w-full rounded-md py-1 px-1.5 text-[11px] mb-2"
                style={{ background: 'rgba(0,0,0,0.3)', color: '#fff', border: '1px solid rgba(255,215,0,0.2)' }}>
                <option value="">（指定なし）</option>
                {tournament.participants.map((pid) => (
                  <option key={pid} value={pid}>{studentName(pid)}</option>
                ))}
              </select>
              {bestFinisherChildId && (
                <p className="text-[10px] mb-2" style={{ color: 'rgba(255,215,0,0.6)' }}>
                  ベストフィニッシャー賞（自動）: {studentName(bestFinisherChildId)}
                </p>
              )}
              <button
                onClick={handleAward}
                disabled={awarding}
                className="w-full py-2 rounded-lg text-[12px] font-black"
                style={{
                  background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                  color: '#0b1128',
                  opacity: awarding ? 0.5 : 1,
                }}
              >
                {awarding ? '付与中...' : '🏆 賞品を付与して大会終了'}
              </button>
              <p className="text-[9px] mt-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                優勝+{REWARD_ALT.champion} / 準優勝+{REWARD_ALT.runner_up} / 3位+{REWARD_ALT.third} / 特別賞各+{REWARD_ALT.mvp} ALT
              </p>
            </AdminCard>
          )}
        </>
      )}

      {/* Phase 4: 終了 */}
      {tournament.phase === 'finished' && (
        <AdminCard tone="gold" className="p-4 mb-3 text-center">
          <div className="text-5xl mb-2">🏆</div>
          <p className="text-[10px] mb-1" style={{ color: 'rgba(255,215,0,0.6)' }}>優勝</p>
          <p className="text-xl font-black mb-3" style={{ color: '#ffd700' }}>
            {tournament.championId ? studentName(tournament.championId) : '—'}
          </p>
          {rewards.length > 0 && (
            <ul className="text-left text-[11px] flex flex-col gap-1"
              style={{ color: 'rgba(255,255,255,0.85)' }}>
              {rewards.map((r) => (
                <li key={r.id} className="flex justify-between px-2 py-1 rounded"
                  style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,215,0,0.2)' }}>
                  <span>{r.rewardType} — {studentName(r.childId)}</span>
                  <span style={{ color: '#ffd700' }}>+{r.altAmount} ALT</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      )}
    </AdminShell>
  );
}
