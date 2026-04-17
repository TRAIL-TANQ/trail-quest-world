/**
 * Tournament Service
 * 大会のCRUD・総当たり生成・順位計算・賞品付与を担当する。
 *
 * 4フェイズ遷移: recruiting → round_robin → finals → finished
 *
 * 注意:
 *   - 管理者/モニターは参加対象外（participantsへの追加もしない）
 *   - 決勝トーナメントは finals_size=2（決勝1試合） or 4（準決勝2 + 決勝 + 3位決定戦）
 *   - 同順位タイブレーク: 勝点 → ファン差 → 直接対決 → フィニッシャー数
 */
import { supabase } from './supabase';
import { updateChildStatus } from './quizService';
import type { Division } from '@/data/students';
import { findStudentByChildId } from '@/data/students';

export type TournamentPhase = 'recruiting' | 'round_robin' | 'finals' | 'finished';
export type TournamentBracket = 'round_robin' | 'semi' | 'final' | 'third_place';
export type TournamentRewardType = 'champion' | 'runner_up' | 'third' | 'mvp' | 'best_finisher' | 'fight_spirit';

export interface Tournament {
  id: string;
  name: string;
  division: Division;
  finalsSize: 2 | 4;
  phase: TournamentPhase;
  participants: string[];
  championId: string | null;
  mvpId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: number;
  matchOrder: number;
  bracket: TournamentBracket | null;
  player1Id: string;
  player2Id: string;
  player1Deck: string | null;
  player2Deck: string | null;
  winnerId: string | null;
  player1Finisher: string | null;
  player2Finisher: string | null;
  player1Fans: number;
  player2Fans: number;
  playedAt: string | null;
}

export interface TournamentReward {
  id: string;
  tournamentId: string;
  childId: string;
  rewardType: TournamentRewardType;
  altAmount: number;
  titleText: string | null;
  awardedAt: string;
}

export interface StandingRow {
  childId: string;
  name: string;
  emoji: string;
  wins: number;
  losses: number;
  points: number;      // 勝ち3点
  fanDiff: number;     // 自分のファン - 相手のファン
  played: number;
  total: number;
  finisherCount: number; // 自分がフィニッシャーを決めた試合数
}

// ===== row mapping =====

function rowToTournament(r: Record<string, unknown>): Tournament {
  return {
    id:           r.id as string,
    name:         r.name as string,
    division:     r.division as Division,
    finalsSize:   ((r.finals_size as number) === 4 ? 4 : 2),
    phase:        r.phase as TournamentPhase,
    participants: (r.participants as string[] | null) ?? [],
    championId:   (r.champion_id as string | null) ?? null,
    mvpId:        (r.mvp_id as string | null) ?? null,
    createdAt:    r.created_at as string,
    finishedAt:   (r.finished_at as string | null) ?? null,
  };
}

function rowToMatch(r: Record<string, unknown>): TournamentMatch {
  return {
    id:              r.id as string,
    tournamentId:    r.tournament_id as string,
    round:           r.round as number,
    matchOrder:      r.match_order as number,
    bracket:         (r.bracket as TournamentBracket | null) ?? null,
    player1Id:       r.player1_id as string,
    player2Id:       r.player2_id as string,
    player1Deck:     (r.player1_deck as string | null) ?? null,
    player2Deck:     (r.player2_deck as string | null) ?? null,
    winnerId:        (r.winner_id as string | null) ?? null,
    player1Finisher: (r.player1_finisher as string | null) ?? null,
    player2Finisher: (r.player2_finisher as string | null) ?? null,
    player1Fans:     (r.player1_fans as number | null) ?? 0,
    player2Fans:     (r.player2_fans as number | null) ?? 0,
    playedAt:        (r.played_at as string | null) ?? null,
  };
}

function rowToReward(r: Record<string, unknown>): TournamentReward {
  return {
    id:            r.id as string,
    tournamentId:  r.tournament_id as string,
    childId:       r.child_id as string,
    rewardType:    r.reward_type as TournamentRewardType,
    altAmount:     (r.alt_amount as number | null) ?? 0,
    titleText:     (r.title_text as string | null) ?? null,
    awardedAt:     r.awarded_at as string,
  };
}

// ===== CRUD =====

export async function listTournaments(): Promise<Tournament[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map((r) => rowToTournament(r as Record<string, unknown>));
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return rowToTournament(data as Record<string, unknown>);
}

export interface CreateTournamentInput {
  name: string;
  division: Division;
  finalsSize: 2 | 4;
}

export async function createTournament(input: CreateTournamentInput): Promise<Tournament | null> {
  const { data, error } = await supabase
    .from('tournaments')
    .insert({ name: input.name, division: input.division, finals_size: input.finalsSize })
    .select('*')
    .single();
  if (error || !data) { console.warn('[Tournament] create failed:', error?.message); return null; }
  return rowToTournament(data as Record<string, unknown>);
}

export async function joinTournament(tournamentId: string, childId: string): Promise<boolean> {
  const t = await getTournament(tournamentId);
  if (!t || t.phase !== 'recruiting') return false;
  if (t.participants.includes(childId)) return true; // already in
  const next = [...t.participants, childId];
  const { error } = await supabase.from('tournaments').update({ participants: next }).eq('id', tournamentId);
  return !error;
}

export async function leaveTournament(tournamentId: string, childId: string): Promise<boolean> {
  const t = await getTournament(tournamentId);
  if (!t || t.phase !== 'recruiting') return false;
  const next = t.participants.filter((id) => id !== childId);
  const { error } = await supabase.from('tournaments').update({ participants: next }).eq('id', tournamentId);
  return !error;
}

export async function listMatches(tournamentId: string): Promise<TournamentMatch[]> {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('match_order', { ascending: true });
  if (error || !data) return [];
  return data.map((r) => rowToMatch(r as Record<string, unknown>));
}

export async function listRewards(tournamentId: string): Promise<TournamentReward[]> {
  const { data, error } = await supabase
    .from('tournament_rewards')
    .select('*')
    .eq('tournament_id', tournamentId);
  if (error || !data) return [];
  return data.map((r) => rowToReward(r as Record<string, unknown>));
}

// ===== Phase transition =====

/** 参加締切 → 総当たり試合を自動生成して phase='round_robin' へ。 */
export async function startRoundRobin(tournamentId: string): Promise<boolean> {
  const t = await getTournament(tournamentId);
  if (!t || t.phase !== 'recruiting') return false;
  if (t.participants.length < 2) return false;

  // 総当たり = 全 C(n,2) 組み合わせ
  const ids = t.participants;
  const matches: Array<Omit<TournamentMatch, 'id'>> = [];
  let order = 1;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      matches.push({
        tournamentId,
        round: 1,
        matchOrder: order++,
        bracket: 'round_robin',
        player1Id: ids[i],
        player2Id: ids[j],
        player1Deck: null, player2Deck: null,
        winnerId: null,
        player1Finisher: null, player2Finisher: null,
        player1Fans: 0, player2Fans: 0,
        playedAt: null,
      });
    }
  }

  const inserts = matches.map((m) => ({
    tournament_id: m.tournamentId,
    round:         m.round,
    match_order:   m.matchOrder,
    bracket:       m.bracket,
    player1_id:    m.player1Id,
    player2_id:    m.player2Id,
  }));
  const { error: insErr } = await supabase.from('tournament_matches').insert(inserts);
  if (insErr) { console.warn('[Tournament] insert matches failed:', insErr.message); return false; }

  const { error: upErr } = await supabase.from('tournaments').update({ phase: 'round_robin' }).eq('id', tournamentId);
  return !upErr;
}

/** 総当たり終了 → 上位者を決勝ブラケットへ。phase='finals' に遷移。 */
export async function startFinals(tournamentId: string): Promise<boolean> {
  const t = await getTournament(tournamentId);
  if (!t || t.phase !== 'round_robin') return false;

  const standings = await computeStandings(tournamentId);
  const top = standings.slice(0, t.finalsSize);
  if (top.length < t.finalsSize) return false;

  const inserts: Array<Record<string, unknown>> = [];
  if (t.finalsSize === 2) {
    inserts.push({
      tournament_id: tournamentId,
      round: 2, match_order: 1, bracket: 'final',
      player1_id: top[0].childId, player2_id: top[1].childId,
    });
  } else {
    // 準決勝: 1位 vs 4位、2位 vs 3位
    inserts.push({
      tournament_id: tournamentId,
      round: 2, match_order: 1, bracket: 'semi',
      player1_id: top[0].childId, player2_id: top[3].childId,
    });
    inserts.push({
      tournament_id: tournamentId,
      round: 2, match_order: 2, bracket: 'semi',
      player1_id: top[1].childId, player2_id: top[2].childId,
    });
    // 決勝・3位決定戦は準決勝勝者が確定してから作成（startFinals時点ではスタブとして作成しない）
  }

  const { error: insErr } = await supabase.from('tournament_matches').insert(inserts);
  if (insErr) { console.warn('[Tournament] insert finals failed:', insErr.message); return false; }
  const { error: upErr } = await supabase.from('tournaments').update({ phase: 'finals' }).eq('id', tournamentId);
  return !upErr;
}

/** 準決勝2試合が確定したら 決勝 + 3位決定戦 を自動生成。 */
export async function materializeFinalsRound3(tournamentId: string): Promise<boolean> {
  const t = await getTournament(tournamentId);
  if (!t || t.finalsSize !== 4 || t.phase !== 'finals') return false;
  const matches = await listMatches(tournamentId);
  const semis = matches.filter((m) => m.bracket === 'semi');
  if (semis.length !== 2 || semis.some((m) => !m.winnerId)) return false;
  const alreadyFinal = matches.some((m) => m.bracket === 'final');
  if (alreadyFinal) return true; // already materialized

  const [a, b] = semis;
  const finalP1 = a.winnerId!;
  const finalP2 = b.winnerId!;
  const thirdP1 = a.player1Id === finalP1 ? a.player2Id : a.player1Id;
  const thirdP2 = b.player1Id === finalP2 ? b.player2Id : b.player1Id;

  const { error } = await supabase.from('tournament_matches').insert([
    { tournament_id: tournamentId, round: 3, match_order: 1, bracket: 'final',       player1_id: finalP1, player2_id: finalP2 },
    { tournament_id: tournamentId, round: 3, match_order: 2, bracket: 'third_place', player1_id: thirdP1, player2_id: thirdP2 },
  ]);
  return !error;
}

/** 決勝ブラケット全試合終了後に champion を確定して phase='finished' に遷移。 */
export async function finishTournament(tournamentId: string, mvpId?: string | null): Promise<boolean> {
  const matches = await listMatches(tournamentId);
  const finalM = matches.find((m) => m.bracket === 'final');
  if (!finalM || !finalM.winnerId) return false;

  const { error } = await supabase
    .from('tournaments')
    .update({
      phase: 'finished',
      champion_id: finalM.winnerId,
      mvp_id: mvpId ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq('id', tournamentId);
  return !error;
}

// ===== Match result update =====

export interface MatchResultInput {
  matchId: string;
  winnerId: string;
  player1Deck?: string | null;
  player2Deck?: string | null;
  player1Finisher?: string | null;
  player2Finisher?: string | null;
  player1Fans?: number;
  player2Fans?: number;
}

export async function updateMatchResult(input: MatchResultInput): Promise<boolean> {
  const { error } = await supabase.from('tournament_matches').update({
    winner_id:         input.winnerId,
    player1_deck:      input.player1Deck ?? null,
    player2_deck:      input.player2Deck ?? null,
    player1_finisher:  input.player1Finisher ?? null,
    player2_finisher:  input.player2Finisher ?? null,
    player1_fans:      input.player1Fans ?? 0,
    player2_fans:      input.player2Fans ?? 0,
    played_at:         new Date().toISOString(),
  }).eq('id', input.matchId);
  return !error;
}

// ===== Standings =====

export async function computeStandings(tournamentId: string): Promise<StandingRow[]> {
  const [t, matches] = await Promise.all([getTournament(tournamentId), listMatches(tournamentId)]);
  if (!t) return [];
  const rrMatches = matches.filter((m) => m.bracket === 'round_robin');

  const map = new Map<string, StandingRow>();
  t.participants.forEach((id) => {
    const rec = findStudentByChildId(id);
    map.set(id, {
      childId: id,
      name: rec?.name ?? id,
      emoji: rec?.emoji ?? '👤',
      wins: 0, losses: 0, points: 0,
      fanDiff: 0, played: 0,
      total: t.participants.length - 1,
      finisherCount: 0,
    });
  });

  rrMatches.forEach((m) => {
    if (!m.winnerId) return;
    const p1 = map.get(m.player1Id);
    const p2 = map.get(m.player2Id);
    if (!p1 || !p2) return;
    p1.played += 1; p2.played += 1;
    p1.fanDiff += m.player1Fans - m.player2Fans;
    p2.fanDiff += m.player2Fans - m.player1Fans;
    if (m.winnerId === m.player1Id) {
      p1.wins += 1; p1.points += 3;
      p2.losses += 1;
    } else if (m.winnerId === m.player2Id) {
      p2.wins += 1; p2.points += 3;
      p1.losses += 1;
    }
    if (m.player1Finisher) p1.finisherCount += 1;
    if (m.player2Finisher) p2.finisherCount += 1;
  });

  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.fanDiff !== a.fanDiff) return b.fanDiff - a.fanDiff;
    // 直接対決
    const head = rrMatches.find((m) =>
      (m.player1Id === a.childId && m.player2Id === b.childId) ||
      (m.player1Id === b.childId && m.player2Id === a.childId),
    );
    if (head?.winnerId === a.childId) return -1;
    if (head?.winnerId === b.childId) return 1;
    if (b.finisherCount !== a.finisherCount) return b.finisherCount - a.finisherCount;
    return a.name.localeCompare(b.name, 'ja');
  });
  return arr;
}

// ===== Rewards =====

export const REWARD_ALT: Record<TournamentRewardType, number> = {
  champion:       500,
  runner_up:      300,
  third:          200,
  mvp:            100,
  best_finisher:  100,
  fight_spirit:   100,
};

export interface AwardRewardsInput {
  tournamentId: string;
  championId: string;
  runnerUpId?: string | null;
  thirdId?: string | null;
  mvpId?: string | null;
  bestFinisherId?: string | null;
  fightSpiritId?: string | null;
  tournamentNumber: number; // 「第N回」のN
}

/**
 * 賞品付与: tournament_rewards に追記 + 各受賞者の child_status.alt_points を加算。
 * 既に付与済みかは tournament_rewards を見て重複を避ける。
 */
export async function awardRewards(input: AwardRewardsInput): Promise<boolean> {
  const existing = await listRewards(input.tournamentId);
  const existingKey = new Set(existing.map((r) => `${r.childId}|${r.rewardType}`));

  const entries: Array<{ childId: string; type: TournamentRewardType; title?: string }> = [];
  const label = (n: number) => `第${n}回チャンピオン🏆`;

  entries.push({ childId: input.championId, type: 'champion', title: label(input.tournamentNumber) });
  if (input.runnerUpId)    entries.push({ childId: input.runnerUpId,    type: 'runner_up' });
  if (input.thirdId)       entries.push({ childId: input.thirdId,       type: 'third' });
  if (input.mvpId)         entries.push({ childId: input.mvpId,         type: 'mvp' });
  if (input.bestFinisherId) entries.push({ childId: input.bestFinisherId, type: 'best_finisher' });
  if (input.fightSpiritId) entries.push({ childId: input.fightSpiritId, type: 'fight_spirit' });

  const rows = entries
    .filter((e) => !existingKey.has(`${e.childId}|${e.type}`))
    .map((e) => ({
      tournament_id: input.tournamentId,
      child_id:      e.childId,
      reward_type:   e.type,
      alt_amount:    REWARD_ALT[e.type],
      title_text:    e.title ?? null,
    }));
  if (rows.length > 0) {
    const { error } = await supabase.from('tournament_rewards').insert(rows);
    if (error) { console.warn('[Tournament] rewards insert failed:', error.message); return false; }
  }

  // ALT加算
  for (const e of entries) {
    if (existingKey.has(`${e.childId}|${e.type}`)) continue;
    await updateChildStatus(e.childId, REWARD_ALT[e.type], 0);
  }

  return true;
}

// ===== Analysis helpers =====

/** 指定 childId の大会参加履歴をまとめる（生徒詳細用）。 */
export interface StudentTournamentRecord {
  tournamentId: string;
  name: string;
  division: Division;
  phase: TournamentPhase;
  result: 'champion' | 'runner_up' | 'third' | 'participated' | 'ongoing';
  rewards: TournamentRewardType[];
  deckUsedCounts: Record<string, number>;
}

export async function fetchStudentTournamentRecords(childId: string): Promise<StudentTournamentRecord[]> {
  const tournaments = await listTournaments();
  const participated = tournaments.filter((t) => t.participants.includes(childId));
  const rewardsAll = await Promise.all(participated.map((t) => listRewards(t.id)));
  const matchesAll = await Promise.all(participated.map((t) => listMatches(t.id)));

  return participated.map((t, i) => {
    const rewards = rewardsAll[i].filter((r) => r.childId === childId).map((r) => r.rewardType);
    const matches = matchesAll[i];
    let result: StudentTournamentRecord['result'] = 'participated';
    if (t.phase !== 'finished') result = 'ongoing';
    else if (t.championId === childId) result = 'champion';
    else if (rewards.includes('runner_up')) result = 'runner_up';
    else if (rewards.includes('third')) result = 'third';

    const deckCount: Record<string, number> = {};
    matches.forEach((m) => {
      if (m.player1Id === childId && m.player1Deck) deckCount[m.player1Deck] = (deckCount[m.player1Deck] ?? 0) + 1;
      if (m.player2Id === childId && m.player2Deck) deckCount[m.player2Deck] = (deckCount[m.player2Deck] ?? 0) + 1;
    });

    return {
      tournamentId: t.id,
      name: t.name,
      division: t.division,
      phase: t.phase,
      result,
      rewards,
      deckUsedCounts: deckCount,
    };
  });
}

/** 「大会優勝経験あり」「準優勝あり」「特別賞あり」バッジ判定（ランキング画面用）。 */
export interface TournamentBadges {
  hasChampion: boolean;
  hasRunnerUp: boolean;
  hasSpecialAward: boolean;
}

export async function fetchTournamentBadges(): Promise<Record<string, TournamentBadges>> {
  const { data } = await supabase.from('tournament_rewards').select('child_id, reward_type');
  const map: Record<string, TournamentBadges> = {};
  (data ?? []).forEach((r) => {
    const cid = r.child_id as string;
    const type = r.reward_type as TournamentRewardType;
    if (!map[cid]) map[cid] = { hasChampion: false, hasRunnerUp: false, hasSpecialAward: false };
    if (type === 'champion')   map[cid].hasChampion = true;
    if (type === 'runner_up')  map[cid].hasRunnerUp = true;
    if (type === 'mvp' || type === 'best_finisher' || type === 'fight_spirit') {
      map[cid].hasSpecialAward = true;
    }
  });
  return map;
}

/** 「第N回」の N を listTournaments の新しい順で数える（表示用）。 */
export function tournamentOrdinal(tournaments: Tournament[], id: string): number {
  const sorted = [...tournaments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return sorted.findIndex((t) => t.id === id) + 1;
}
