/**
 * TournamentJoinPage — 生徒が現在開催中の大会に参加する画面。
 * 自分の部門の大会のみ一覧表示。参加済みは「参加済み ✅ 開始を待ってね」。
 * 総当たり/決勝フェイズ中は自分の試合結果を参照表示（手動入力は管理者）。
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { useUserStore } from '@/lib/stores';
import { findStudentByChildId } from '@/data/students';
import {
  joinTournament, leaveTournament,
  listTournaments, listMatches, listRewards,
  type Tournament, type TournamentMatch, type TournamentReward,
} from '@/lib/tournamentService';
import { DECK_QUEST_INFO, type DeckKey } from '@/lib/questProgress';
import { toast } from 'sonner';

const PHASE_LABELS: Record<Tournament['phase'], string> = {
  recruiting: '参加受付中', round_robin: '総当たり中', finals: '決勝進行中', finished: '終了',
};
const PHASE_COLORS: Record<Tournament['phase'], string> = {
  recruiting: '#60a5fa', round_robin: '#eab308', finals: '#ef4444', finished: '#22c55e',
};

export default function TournamentJoinPage() {
  const userId = useUserStore((s) => s.user.id);
  const student = findStudentByChildId(userId);
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [matchesMap, setMatchesMap] = useState<Record<string, TournamentMatch[]>>({});
  const [rewardsMap, setRewardsMap] = useState<Record<string, TournamentReward[]>>({});

  const reload = useCallback(async () => {
    const all = await listTournaments();
    const filtered = student ? all.filter((t) => t.division === student.division) : [];
    setTournaments(filtered);
    // load matches for each ongoing tournament
    const mm: Record<string, TournamentMatch[]> = {};
    const rm: Record<string, TournamentReward[]> = {};
    await Promise.all(filtered.map(async (t) => {
      mm[t.id] = await listMatches(t.id);
      rm[t.id] = await listRewards(t.id);
    }));
    setMatchesMap(mm);
    setRewardsMap(rm);
  }, [student]);

  useEffect(() => { void reload(); }, [reload]);

  const handleJoin = async (id: string) => {
    const ok = await joinTournament(id, userId);
    if (ok) { toast.success('参加しました！'); await reload(); }
    else toast.error('参加できませんでした');
  };

  const handleLeave = async (id: string) => {
    const ok = await leaveTournament(id, userId);
    if (ok) { toast.success('参加を取り消しました'); await reload(); }
    else toast.error('取り消せませんでした');
  };

  if (!student) {
    return (
      <div className="px-4 pt-6 pb-6 text-center">
        <p className="text-sm" style={{ color: 'rgba(255,215,0,0.6)' }}>生徒ログインが必要です</p>
        <Link href="/"><a className="text-[12px] underline" style={{ color: '#ffd700' }}>ホームへ</a></Link>
      </div>
    );
  }

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <Link href="/">
          <button className="text-[12px] px-2 py-1 rounded"
            style={{ background: 'rgba(255,215,0,0.1)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.25)' }}>
            ← もどる
          </button>
        </Link>
        <h1 className="text-lg font-bold" style={{ color: '#ffd700' }}>🏆 大会</h1>
      </div>

      <p className="text-[11px] mb-3" style={{ color: 'rgba(255,215,0,0.55)' }}>
        あなたの部門: {student.emoji} {student.className}
      </p>

      {!tournaments && (
        <p className="text-center text-sm" style={{ color: 'rgba(255,215,0,0.5)' }}>読み込み中...</p>
      )}
      {tournaments && tournaments.length === 0 && (
        <div className="rounded-xl p-6 text-center"
          style={{ background: 'rgba(26,31,58,0.9)', border: '1px solid rgba(255,215,0,0.2)' }}>
          <div className="text-4xl mb-2">🎌</div>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>いま開催中の大会はありません</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(tournaments ?? []).map((t) => {
          const joined = t.participants.includes(userId);
          const myMatches = (matchesMap[t.id] ?? []).filter((m) => m.player1Id === userId || m.player2Id === userId);
          const myRewards = (rewardsMap[t.id] ?? []).filter((r) => r.childId === userId);

          return (
            <div key={t.id} className="rounded-xl p-4"
              style={{
                background: 'linear-gradient(135deg, rgba(26,31,58,0.95), rgba(14,20,45,0.95))',
                border: '1.5px solid rgba(255,215,0,0.3)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded"
                  style={{
                    background: `${PHASE_COLORS[t.phase]}22`,
                    color: PHASE_COLORS[t.phase],
                    border: `1px solid ${PHASE_COLORS[t.phase]}66`,
                  }}>
                  {PHASE_LABELS[t.phase]}
                </span>
                {joined && t.phase === 'recruiting' && (
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold"
                    style={{ background: 'rgba(34,197,94,0.18)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.4)' }}>
                    ✅ 参加済み
                  </span>
                )}
              </div>

              <p className="text-base font-black text-amber-100 mb-2">{t.name}</p>
              <p className="text-[11px] mb-3" style={{ color: 'rgba(255,255,255,0.6)' }}>
                参加 {t.participants.length}名 / 決勝 {t.finalsSize}人
              </p>

              {t.phase === 'recruiting' && !joined && (
                <button onClick={() => handleJoin(t.id)}
                  className="w-full py-2.5 rounded-lg text-sm font-black"
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #d4a500)',
                    color: '#0b1128',
                    boxShadow: '0 2px 10px rgba(255,215,0,0.3)',
                  }}>
                  参加する！
                </button>
              )}
              {t.phase === 'recruiting' && joined && (
                <>
                  <p className="text-[11px] text-center mb-2" style={{ color: 'rgba(255,215,0,0.7)' }}>
                    開始を待ってね！
                  </p>
                  <button onClick={() => handleLeave(t.id)}
                    className="w-full py-1.5 rounded-lg text-[11px] font-bold"
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    参加をやめる
                  </button>
                </>
              )}

              {(t.phase === 'round_robin' || t.phase === 'finals') && joined && (
                <div>
                  <p className="text-[11px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>あなたの対戦</p>
                  {myMatches.length === 0 ? (
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>—</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-[11px]">
                      {myMatches.map((m) => {
                        const isP1 = m.player1Id === userId;
                        const opponentId = isP1 ? m.player2Id : m.player1Id;
                        const opponent = findStudentByChildId(opponentId);
                        const done = Boolean(m.winnerId);
                        const won = m.winnerId === userId;
                        const myDeck = isP1 ? m.player1Deck : m.player2Deck;
                        const myFinisher = isP1 ? m.player1Finisher : m.player2Finisher;
                        return (
                          <li key={m.id} className="flex items-center justify-between px-2 py-1 rounded"
                            style={{
                              background: done ? (won ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)') : 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(255,215,0,0.15)',
                              color: 'rgba(255,255,255,0.85)',
                            }}>
                            <span>
                              vs {opponent?.emoji} {opponent?.name ?? opponentId}
                              {m.bracket !== 'round_robin' && (
                                <span className="ml-1 text-[9px]"
                                  style={{ color: 'rgba(239,68,68,0.8)' }}>
                                  [{m.bracket === 'semi' ? '準決勝' : m.bracket === 'final' ? '決勝' : '3位決定戦'}]
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] font-bold">
                              {done ? (
                                <>
                                  {won ? <span style={{ color: '#22c55e' }}>🏆 勝利</span>
                                    : <span style={{ color: '#f87171' }}>💀 敗北</span>}
                                  {myDeck && <span className="ml-1" style={{ color: 'rgba(255,215,0,0.5)' }}>
                                    {DECK_QUEST_INFO[myDeck as DeckKey]?.name ?? myDeck}
                                  </span>}
                                  {myFinisher && <span className="ml-1" style={{ color: 'rgba(255,215,0,0.7)' }}>/ {myFinisher}</span>}
                                </>
                              ) : (
                                <span style={{ color: 'rgba(255,215,0,0.6)' }}>待機中</span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}

              {t.phase === 'finished' && (
                <div>
                  <p className="text-[11px] font-bold mb-1" style={{ color: 'rgba(255,215,0,0.7)' }}>🏆 結果</p>
                  <p className="text-[12px]" style={{ color: '#ffd700' }}>
                    優勝: {t.championId ? findStudentByChildId(t.championId)?.name ?? t.championId : '—'}
                  </p>
                  {myRewards.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] font-bold mb-0.5" style={{ color: 'rgba(34,197,94,0.8)' }}>✨ あなたの受賞</p>
                      <ul className="text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {myRewards.map((r) => (
                          <li key={r.id}>{r.rewardType} (+{r.altAmount} ALT) {r.titleText ? `「${r.titleText}」` : ''}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
