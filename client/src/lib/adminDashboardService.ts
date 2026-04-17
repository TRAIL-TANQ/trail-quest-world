/**
 * Admin Dashboard Service
 * Supabase のテーブル（child_status / battle_history / alt_game_scores /
 * quest_progress / quiz_history / hall_of_fame）から管理者ダッシュボード用の
 * 集計データを取得する。生徒は 21名固定なのでクライアント側で集計する。
 *
 * child_id が STUDENTS に載っていない（管理者/モニター/ゲスト）レコードは
 * isExcludedChildId でフィルタして除外する。
 */
import { supabase } from './supabase';
import { STUDENTS, findStudentByChildId, studentsByDivision, type StudentRecord, type Division } from '@/data/students';
import { DECK_KEYS, AVAILABLE_DECK_KEYS, DECK_QUEST_INFO, type DeckKey, type QuestDifficulty } from './questProgress';

// ===== Types =====

export interface StudentStatus {
  childId: string;
  name: string;
  className: string;
  classAbbr: string;
  emoji: string;
  altPoints: number;
  level: number;
  xp: number;
  rating: number;
  wins: number;
  losses: number;
  winRate: number;            // 0-1
  deckUnlockedCount: number;  // 解放済みデッキ数（beginner クリア）
  ssrUnlockedCount: number;   // legend クリアしたデッキ数
  updatedAt: string | null;
  lastActiveAt: string | null; // 最終アクティビティ（battle/alt_game/quiz の中で最新）
}

export interface AltGameScore {
  id: string;
  childId: string;
  gameType: string;
  difficulty: number;
  score: number;
  maxLevel: number | null;
  maxCombo: number | null;
  altEarned: number;
  playedAt: string;
}

export interface BattleRecord {
  id: string;
  childId: string;
  deckKey: string;
  opponentType: string;
  opponentId: string | null;
  opponentDeckKey: string | null;
  stage: number | null;
  result: 'win' | 'lose';
  totalFans: number | null;
  opponentFans: number | null;
  finisherCardId: string | null;
  finisherCardName: string | null;
  roundsPlayed: number | null;
  playedAt: string;
}

export interface QuizRecord {
  id: string;
  childId: string;
  deckKey: string;
  difficulty: number;
  correct: boolean;
  answeredAt: string;
}

export interface QuestProgressRow {
  childId: string;
  deckKey: string;
  difficulty: 'beginner' | 'challenger' | 'master' | 'legend';
  cleared: boolean;
  correctCount: number;
}

// ===== Helpers =====

const STUDENT_CHILD_IDS = new Set(STUDENTS.map((s) => `${s.classAbbr}_${s.name}`));

function isStudentChildId(childId: string): boolean {
  return STUDENT_CHILD_IDS.has(childId);
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10); // 'YYYY-MM-DD'
}

function todayKeyJST(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + (now.getTimezoneOffset() + 9 * 60) * 60000);
  return jst.toISOString().slice(0, 10);
}

// ===== Raw fetch wrappers =====

export async function fetchAllChildStatuses(): Promise<StudentStatus[]> {
  const [{ data: cs }, { data: qp }] = await Promise.all([
    supabase.from('child_status').select('child_id, alt_points, xp, level, rating, wins, losses, updated_at'),
    supabase.from('quest_progress').select('child_id, deck_key, difficulty, cleared, correct_count'),
  ]);

  const qpByChild = new Map<string, QuestProgressRow[]>();
  (qp ?? []).forEach((row) => {
    if (!isStudentChildId(row.child_id)) return;
    const list = qpByChild.get(row.child_id) ?? [];
    list.push({
      childId: row.child_id,
      deckKey: row.deck_key,
      difficulty: row.difficulty,
      cleared: row.cleared,
      correctCount: row.correct_count ?? 0,
    });
    qpByChild.set(row.child_id, list);
  });

  const csByChild = new Map<string, {
    altPoints: number; xp: number; level: number; rating: number;
    wins: number; losses: number; updatedAt: string | null;
  }>();
  (cs ?? []).forEach((row) => {
    csByChild.set(row.child_id, {
      altPoints: row.alt_points ?? 0,
      xp: row.xp ?? 0,
      level: row.level ?? 1,
      rating: row.rating ?? 1000,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      updatedAt: row.updated_at ?? null,
    });
  });

  return STUDENTS.map((s): StudentStatus => {
    const childId = `${s.classAbbr}_${s.name}`;
    const status = csByChild.get(childId);
    const qpRows = qpByChild.get(childId) ?? [];
    const unlockedDecks = new Set(qpRows.filter((r) => r.difficulty === 'beginner' && r.cleared).map((r) => r.deckKey));
    const ssrDecks = new Set(qpRows.filter((r) => r.difficulty === 'legend' && r.cleared).map((r) => r.deckKey));
    const wins = status?.wins ?? 0;
    const losses = status?.losses ?? 0;
    const total = wins + losses;
    return {
      childId,
      name: s.name,
      className: s.className,
      classAbbr: s.classAbbr,
      emoji: s.emoji,
      altPoints: status?.altPoints ?? 0,
      level: status?.level ?? 1,
      xp: status?.xp ?? 0,
      rating: status?.rating ?? 1000,
      wins,
      losses,
      winRate: total > 0 ? wins / total : 0,
      deckUnlockedCount: unlockedDecks.size,
      ssrUnlockedCount: ssrDecks.size,
      updatedAt: status?.updatedAt ?? null,
      lastActiveAt: status?.updatedAt ?? null, // 簡易的に updated_at を使う
    };
  });
}

export async function fetchBattleHistory(): Promise<BattleRecord[]> {
  const { data } = await supabase
    .from('battle_history')
    .select('id, child_id, deck_key, opponent_type, opponent_id, opponent_deck_key, stage, result, total_fans, opponent_fans, finisher_card_id, finisher_card_name, rounds_played, played_at')
    .order('played_at', { ascending: false });
  return (data ?? []).filter((r) => isStudentChildId(r.child_id)).map((r) => ({
    id: r.id,
    childId: r.child_id,
    deckKey: r.deck_key,
    opponentType: r.opponent_type,
    opponentId: r.opponent_id ?? null,
    opponentDeckKey: r.opponent_deck_key ?? null,
    stage: r.stage,
    result: r.result as 'win' | 'lose',
    totalFans: r.total_fans,
    opponentFans: r.opponent_fans,
    finisherCardId: r.finisher_card_id,
    finisherCardName: r.finisher_card_name,
    roundsPlayed: r.rounds_played,
    playedAt: r.played_at,
  }));
}

export async function fetchAltGameScores(): Promise<AltGameScore[]> {
  const { data } = await supabase
    .from('alt_game_scores')
    .select('id, child_id, game_type, difficulty, score, max_level, max_combo, alt_earned, played_at')
    .order('played_at', { ascending: false });
  return (data ?? []).filter((r) => isStudentChildId(r.child_id)).map((r) => ({
    id: r.id,
    childId: r.child_id,
    gameType: r.game_type,
    difficulty: r.difficulty ?? 1,
    score: r.score,
    maxLevel: r.max_level,
    maxCombo: r.max_combo,
    altEarned: r.alt_earned,
    playedAt: r.played_at,
  }));
}

export async function fetchQuizHistory(): Promise<QuizRecord[]> {
  const { data } = await supabase
    .from('quiz_history')
    .select('id, child_id, deck_key, difficulty, correct, answered_at')
    .order('answered_at', { ascending: false })
    .limit(2000);
  return (data ?? []).filter((r) => isStudentChildId(r.child_id)).map((r) => ({
    id: r.id,
    childId: r.child_id,
    deckKey: r.deck_key,
    difficulty: r.difficulty,
    correct: r.correct,
    answeredAt: r.answered_at,
  }));
}

export async function fetchQuestProgressRows(): Promise<QuestProgressRow[]> {
  const { data } = await supabase
    .from('quest_progress')
    .select('child_id, deck_key, difficulty, cleared, correct_count');
  return (data ?? []).filter((r) => isStudentChildId(r.child_id)).map((r) => ({
    childId: r.child_id,
    deckKey: r.deck_key,
    difficulty: r.difficulty,
    cleared: r.cleared,
    correctCount: r.correct_count ?? 0,
  }));
}

// ===== Aggregations =====

/** トップダッシュボード用サマリー */
export interface DashboardOverview {
  totalStudents: number;
  todayLoginCount: number;
  todayBattleCount: number;
  overallWinRate: number;
  todayAltEarned: number;
  altBreakdown: { source: 'battle' | 'quest' | 'altgame'; amount: number }[];
  dauByDate: { date: string; count: number }[]; // 過去7日
  mau: number;
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const [students, battles, altGames, quizzes] = await Promise.all([
    fetchAllChildStatuses(),
    fetchBattleHistory(),
    fetchAltGameScores(),
    fetchQuizHistory(),
  ]);

  const today = todayKeyJST();
  const todayBattles = battles.filter((b) => toDateKey(b.playedAt) === today);
  const totalBattles = battles.length;
  const totalWins = battles.filter((b) => b.result === 'win').length;
  const overallWinRate = totalBattles > 0 ? totalWins / totalBattles : 0;

  // 今日獲得ALT（ALTゲームは alt_earned / バトルは仮に勝ち30,負け5 / クエストは quiz_history から推計せずバトルとしてカウントしない）
  const altFromAltGamesToday = altGames
    .filter((g) => toDateKey(g.playedAt) === today)
    .reduce((sum, g) => sum + g.altEarned, 0);
  const altFromBattleToday = todayBattles.reduce((s, b) => s + (b.result === 'win' ? 30 : 5), 0);
  // quest は quiz_history の正解あたり 1 ALT で推計（DIFFICULTY_INFO ベース）
  const altFromQuestToday = quizzes
    .filter((q) => q.correct && toDateKey(q.answeredAt) === today)
    .length;

  const todayAltEarned = altFromAltGamesToday + altFromBattleToday + altFromQuestToday;

  // DAU: 過去7日間の「日付ごとにアクティビティがあった生徒数」
  const dayActivity = new Map<string, Set<string>>();
  const accum = (childId: string, iso: string) => {
    const d = toDateKey(iso);
    if (!dayActivity.has(d)) dayActivity.set(d, new Set());
    dayActivity.get(d)!.add(childId);
  };
  battles.forEach((b) => accum(b.childId, b.playedAt));
  altGames.forEach((g) => accum(g.childId, g.playedAt));
  quizzes.forEach((q) => accum(q.childId, q.answeredAt));

  const last7Dates: string[] = [];
  const base = new Date(`${today}T00:00:00+09:00`);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    last7Dates.push(d.toISOString().slice(0, 10));
  }
  const dauByDate = last7Dates.map((date) => ({
    date,
    count: dayActivity.get(date)?.size ?? 0,
  }));

  // MAU: 過去30日
  const mauSet = new Set<string>();
  const thirtyAgo = new Date(base); thirtyAgo.setDate(thirtyAgo.getDate() - 30);
  const isoThirty = thirtyAgo.toISOString();
  battles.forEach((b) => { if (b.playedAt >= isoThirty) mauSet.add(b.childId); });
  altGames.forEach((g) => { if (g.playedAt >= isoThirty) mauSet.add(g.childId); });
  quizzes.forEach((q) => { if (q.answeredAt >= isoThirty) mauSet.add(q.childId); });

  return {
    totalStudents: students.length,
    todayLoginCount: dayActivity.get(today)?.size ?? 0,
    todayBattleCount: todayBattles.length,
    overallWinRate,
    todayAltEarned,
    altBreakdown: [
      { source: 'battle', amount: altFromBattleToday },
      { source: 'quest', amount: altFromQuestToday },
      { source: 'altgame', amount: altFromAltGamesToday },
    ],
    dauByDate,
    mau: mauSet.size,
  };
}

// ===== Student Detail =====

export interface StudentTimelineDay {
  date: string;
  items: { kind: 'battle' | 'altgame' | 'quiz'; text: string }[];
}

export interface StudentDeckUsage {
  deckKey: string;
  deckName: string;
  icon: string;
  uses: number;
  wins: number;
  winRate: number;
  lastUsedAt: string | null;
}

export interface StudentAltGameStats {
  gameType: string;
  plays: number;
  bestScore: number;
  maxDifficulty: number;
  totalAlt: number;
}

export interface StudentDetailPayload {
  status: StudentStatus | null;
  timeline: StudentTimelineDay[];
  deckUsage: StudentDeckUsage[];
  altGameStats: StudentAltGameStats[];
  questProgress: Record<string, Record<QuestDifficulty, { cleared: boolean; correct: number }>>;
  recentBattles: BattleRecord[];
  finisherTop: { name: string; count: number }[];
  pvpStats: {
    wins: number;
    losses: number;
    winRate: number;
    topOpponentName: string | null;
    topOpponentBattles: number;
    recentPvp: BattleRecord[];
  };
  finisherAllTop5: { name: string; count: number; share: number }[];
}

export async function fetchStudentDetail(childId: string): Promise<StudentDetailPayload> {
  const [students, battles, altGames, quizzes, questProgressRows] = await Promise.all([
    fetchAllChildStatuses(),
    fetchBattleHistory(),
    fetchAltGameScores(),
    fetchQuizHistory(),
    fetchQuestProgressRows(),
  ]);
  const status = students.find((s) => s.childId === childId) ?? null;

  const myBattles = battles.filter((b) => b.childId === childId);
  const myGames = altGames.filter((g) => g.childId === childId);
  const myQuizzes = quizzes.filter((q) => q.childId === childId);
  const myQp = questProgressRows.filter((q) => q.childId === childId);

  // Timeline: group by date, last 30 days
  const tlMap = new Map<string, { kind: 'battle' | 'altgame' | 'quiz'; text: string }[]>();
  const pushItem = (date: string, item: { kind: 'battle' | 'altgame' | 'quiz'; text: string }) => {
    const list = tlMap.get(date) ?? [];
    list.push(item);
    tlMap.set(date, list);
  };

  // バトル: 日付ごとに件数と勝敗をまとめる
  const battleByDate = new Map<string, BattleRecord[]>();
  myBattles.forEach((b) => {
    const d = toDateKey(b.playedAt);
    battleByDate.set(d, [...(battleByDate.get(d) ?? []), b]);
  });
  battleByDate.forEach((arr, date) => {
    const wins = arr.filter((b) => b.result === 'win').length;
    pushItem(date, { kind: 'battle', text: `バトル${arr.length}回（${wins}勝${arr.length - wins}敗）` });
  });

  // ALTゲーム: 日付ごとにゲーム種別でまとめる
  const altByDate = new Map<string, Map<string, number>>();
  myGames.forEach((g) => {
    const d = toDateKey(g.playedAt);
    const m = altByDate.get(d) ?? new Map<string, number>();
    m.set(g.gameType, (m.get(g.gameType) ?? 0) + 1);
    altByDate.set(d, m);
  });
  altByDate.forEach((gameMap, date) => {
    gameMap.forEach((cnt, gt) => {
      pushItem(date, { kind: 'altgame', text: `${gt} ×${cnt}回` });
    });
  });

  // クエスト(quiz_history): 日付ごとにデッキでまとめる
  const quizByDate = new Map<string, Map<string, { total: number; correct: number }>>();
  myQuizzes.forEach((q) => {
    const d = toDateKey(q.answeredAt);
    const m = quizByDate.get(d) ?? new Map<string, { total: number; correct: number }>();
    const cur = m.get(q.deckKey) ?? { total: 0, correct: 0 };
    cur.total += 1;
    if (q.correct) cur.correct += 1;
    m.set(q.deckKey, cur);
    quizByDate.set(d, m);
  });
  quizByDate.forEach((deckMap, date) => {
    deckMap.forEach((rec, dk) => {
      pushItem(date, { kind: 'quiz', text: `クエスト(${dk}) ${rec.correct}/${rec.total}` });
    });
  });

  const timeline: StudentTimelineDay[] = Array.from(tlMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30)
    .map(([date, items]) => ({ date, items }));

  // Deck usage
  const usageMap = new Map<string, { uses: number; wins: number; lastUsedAt: string | null }>();
  myBattles.forEach((b) => {
    const cur = usageMap.get(b.deckKey) ?? { uses: 0, wins: 0, lastUsedAt: null };
    cur.uses += 1;
    if (b.result === 'win') cur.wins += 1;
    if (!cur.lastUsedAt || cur.lastUsedAt < b.playedAt) cur.lastUsedAt = b.playedAt;
    usageMap.set(b.deckKey, cur);
  });
  const deckUsage: StudentDeckUsage[] = Array.from(usageMap.entries()).map(([deckKey, u]) => {
    const info = DECK_QUEST_INFO[deckKey as DeckKey];
    return {
      deckKey,
      deckName: info?.name ?? deckKey,
      icon: info?.icon ?? '📦',
      uses: u.uses,
      wins: u.wins,
      winRate: u.uses > 0 ? u.wins / u.uses : 0,
      lastUsedAt: u.lastUsedAt,
    };
  }).sort((a, b) => b.uses - a.uses);

  // ALTゲーム成績
  const agStatMap = new Map<string, StudentAltGameStats>();
  myGames.forEach((g) => {
    const cur = agStatMap.get(g.gameType) ?? {
      gameType: g.gameType, plays: 0, bestScore: 0, maxDifficulty: 1, totalAlt: 0,
    };
    cur.plays += 1;
    if (g.score > cur.bestScore) cur.bestScore = g.score;
    if (g.difficulty > cur.maxDifficulty) cur.maxDifficulty = g.difficulty;
    cur.totalAlt += g.altEarned;
    agStatMap.set(g.gameType, cur);
  });
  const altGameStats = Array.from(agStatMap.values()).sort((a, b) => b.plays - a.plays);

  // Quest progress
  const questProgress: Record<string, Record<QuestDifficulty, { cleared: boolean; correct: number }>> = {};
  for (const dk of DECK_KEYS) {
    questProgress[dk] = {
      beginner:   { cleared: false, correct: 0 },
      challenger: { cleared: false, correct: 0 },
      master:     { cleared: false, correct: 0 },
      legend:     { cleared: false, correct: 0 },
    };
  }
  myQp.forEach((q) => {
    if (!questProgress[q.deckKey]) return;
    questProgress[q.deckKey][q.difficulty] = { cleared: q.cleared, correct: q.correctCount };
  });

  // Recent battles (10)
  const recentBattles = myBattles.slice(0, 10);

  // Finisher top 3 + top 5 (with share)
  const finisherCount = new Map<string, number>();
  myBattles.forEach((b) => {
    if (b.finisherCardName) {
      finisherCount.set(b.finisherCardName, (finisherCount.get(b.finisherCardName) ?? 0) + 1);
    }
  });
  const totalFinishers = Array.from(finisherCount.values()).reduce((a, b) => a + b, 0);
  const finisherSorted = Array.from(finisherCount.entries()).sort((a, b) => b[1] - a[1]);
  const finisherTop = finisherSorted.slice(0, 3).map(([name, count]) => ({ name, count }));
  const finisherAllTop5 = finisherSorted.slice(0, 5).map(([name, count]) => ({
    name, count, share: totalFinishers > 0 ? count / totalFinishers : 0,
  }));

  // PvP stats
  const myPvP = myBattles.filter((b) => b.opponentType === 'pvp');
  const pvpWins = myPvP.filter((b) => b.result === 'win').length;
  const pvpLosses = myPvP.length - pvpWins;
  const opponentCount = new Map<string, number>();
  myPvP.forEach((b) => {
    if (!b.opponentId) return;
    opponentCount.set(b.opponentId, (opponentCount.get(b.opponentId) ?? 0) + 1);
  });
  let topOppId: string | null = null;
  let topCount = 0;
  opponentCount.forEach((c, id) => { if (c > topCount) { topCount = c; topOppId = id; } });
  const topOpp = topOppId ? findStudentByChildId(topOppId) : null;

  const pvpStats = {
    wins: pvpWins,
    losses: pvpLosses,
    winRate: myPvP.length > 0 ? pvpWins / myPvP.length : 0,
    topOpponentName: topOpp?.name ?? null,
    topOpponentBattles: topCount,
    recentPvp: myPvP.slice(0, 5),
  };

  return { status, timeline, deckUsage, altGameStats, questProgress, recentBattles, finisherTop, pvpStats, finisherAllTop5 };
}

// ===== Deck Analysis =====

export interface DeckAnalysisRow {
  deckKey: string;
  deckName: string;
  icon: string;
  uses: number;
  wins: number;
  winRate: number;
  share: number; // 全バトル中の使用率
  topFinishers: { name: string; count: number; share: number }[];
}

export async function fetchDeckAnalysis(): Promise<DeckAnalysisRow[]> {
  const battles = await fetchBattleHistory();
  const npcBattles = battles.filter((b) => b.opponentType === 'npc');
  const totalUses = npcBattles.length;

  const byDeck = new Map<string, BattleRecord[]>();
  npcBattles.forEach((b) => {
    byDeck.set(b.deckKey, [...(byDeck.get(b.deckKey) ?? []), b]);
  });

  // 解放済み5デッキのみを集計対象に。'custom' は参考表示として残す。
  const deckKeysToShow = [...AVAILABLE_DECK_KEYS as string[], 'custom'];

  return deckKeysToShow.map((dk): DeckAnalysisRow => {
    const list = byDeck.get(dk) ?? [];
    const uses = list.length;
    const wins = list.filter((b) => b.result === 'win').length;
    const info = DECK_QUEST_INFO[dk as DeckKey];

    // Finisher top 3 per deck
    const fm = new Map<string, number>();
    list.forEach((b) => {
      if (b.finisherCardName) fm.set(b.finisherCardName, (fm.get(b.finisherCardName) ?? 0) + 1);
    });
    const totalFinisher = Array.from(fm.values()).reduce((a, b) => a + b, 0);
    const topFinishers = Array.from(fm.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({
        name, count, share: totalFinisher > 0 ? count / totalFinisher : 0,
      }));

    return {
      deckKey: dk,
      deckName: info?.name ?? dk,
      icon: info?.icon ?? '📦',
      uses,
      wins,
      winRate: uses > 0 ? wins / uses : 0,
      share: totalUses > 0 ? uses / totalUses : 0,
      topFinishers,
    };
  }).sort((a, b) => b.uses - a.uses);
}

// ===== Card Analysis =====

export interface CardAnalysisRow {
  name: string;
  count: number;
  share: number;
  cardId: string | null;
}

export async function fetchCardAnalysis(): Promise<CardAnalysisRow[]> {
  const battles = await fetchBattleHistory();
  const fm = new Map<string, { count: number; cardId: string | null }>();
  battles.forEach((b) => {
    if (b.finisherCardName) {
      const cur = fm.get(b.finisherCardName) ?? { count: 0, cardId: b.finisherCardId };
      cur.count += 1;
      if (!cur.cardId && b.finisherCardId) cur.cardId = b.finisherCardId;
      fm.set(b.finisherCardName, cur);
    }
  });
  const total = Array.from(fm.values()).reduce((a, b) => a + b.count, 0);
  return Array.from(fm.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([name, v]) => ({
      name, count: v.count, cardId: v.cardId,
      share: total > 0 ? v.count / total : 0,
    }));
}

// ===== ALT Game Analysis =====

export interface AltGameTotalsRow {
  gameType: string;
  todayPlays: number;
  totalPlays: number;
  avgScore: number;
  bestScore: number;
  bestChildId: string | null;
  bestStudentName: string | null;
  bestEmoji: string | null;
  difficultyCounts: Record<number, number>; // 1..5
}

export interface AltGameAnalysis {
  totalPlaysToday: number;
  totalPlaysAll: number;
  mostPopularGame: string | null;
  topAltStudent: { childId: string; name: string; emoji: string; totalAlt: number } | null;
  byGame: AltGameTotalsRow[];
  byStudent: {
    childId: string; name: string; emoji: string;
    plays: number; totalAlt: number;
    topGame: string | null; topDifficulty: number;
  }[];
}

export async function fetchAltGameAnalysis(): Promise<AltGameAnalysis> {
  const games = await fetchAltGameScores();
  const today = todayKeyJST();

  const studentLookup = (id: string): StudentRecord | null => findStudentByChildId(id);

  // Group by game
  const byGame = new Map<string, AltGameScore[]>();
  games.forEach((g) => {
    byGame.set(g.gameType, [...(byGame.get(g.gameType) ?? []), g]);
  });

  const byGameOut: AltGameTotalsRow[] = Array.from(byGame.entries()).map(([gameType, rows]) => {
    const todayCount = rows.filter((r) => toDateKey(r.playedAt) === today).length;
    const scores = rows.map((r) => r.score);
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const best = rows.reduce<AltGameScore | null>((acc, r) => (!acc || r.score > acc.score ? r : acc), null);
    const rec = best ? studentLookup(best.childId) : null;
    const dc: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    rows.forEach((r) => { dc[r.difficulty] = (dc[r.difficulty] ?? 0) + 1; });
    return {
      gameType,
      todayPlays: todayCount,
      totalPlays: rows.length,
      avgScore: Math.round(avg * 10) / 10,
      bestScore: best?.score ?? 0,
      bestChildId: best?.childId ?? null,
      bestStudentName: rec?.name ?? null,
      bestEmoji: rec?.emoji ?? null,
      difficultyCounts: dc,
    };
  }).sort((a, b) => b.totalPlays - a.totalPlays);

  // Group by student
  const studentMap = new Map<string, { plays: number; totalAlt: number; gameCount: Map<string, number>; maxDiff: number }>();
  games.forEach((g) => {
    const cur = studentMap.get(g.childId) ?? { plays: 0, totalAlt: 0, gameCount: new Map(), maxDiff: 1 };
    cur.plays += 1;
    cur.totalAlt += g.altEarned;
    cur.gameCount.set(g.gameType, (cur.gameCount.get(g.gameType) ?? 0) + 1);
    if (g.difficulty > cur.maxDiff) cur.maxDiff = g.difficulty;
    studentMap.set(g.childId, cur);
  });
  const byStudent = Array.from(studentMap.entries()).map(([childId, v]) => {
    const rec = studentLookup(childId);
    let topGame: string | null = null;
    let topCount = 0;
    v.gameCount.forEach((c, gt) => { if (c > topCount) { topCount = c; topGame = gt; } });
    return {
      childId,
      name: rec?.name ?? childId,
      emoji: rec?.emoji ?? '👤',
      plays: v.plays,
      totalAlt: v.totalAlt,
      topGame,
      topDifficulty: v.maxDiff,
    };
  }).sort((a, b) => b.plays - a.plays);

  const totalPlaysToday = games.filter((g) => toDateKey(g.playedAt) === today).length;
  const topAltStudent = byStudent.reduce<AltGameAnalysis['topAltStudent']>((acc, s) => {
    if (!acc || s.totalAlt > acc.totalAlt) {
      return { childId: s.childId, name: s.name, emoji: s.emoji, totalAlt: s.totalAlt };
    }
    return acc;
  }, null);

  return {
    totalPlaysToday,
    totalPlaysAll: games.length,
    mostPopularGame: byGameOut[0]?.gameType ?? null,
    topAltStudent,
    byGame: byGameOut,
    byStudent,
  };
}

// ===== PvP Analysis =====

export type PvPScope = 'elementary' | 'middle' | 'all';

export interface PvPCell {
  wins: number;     // row 視点の勝利数（row が列の相手に勝った回数）
  losses: number;   // row 視点の敗北数
  latest: BattleRecord | null;
}

export interface PvPRankingEntry {
  childId: string;
  name: string;
  emoji: string;
  className: string;
  wins: number;
  losses: number;
  winRate: number;
  topOpponentId: string | null;
  topOpponentName: string | null;
  topOpponentBattles: number;
}

export interface PvPRivalPair {
  a: { childId: string; name: string; emoji: string };
  b: { childId: string; name: string; emoji: string };
  totalBattles: number;
  aWins: number;
  bWins: number;
}

export interface PvPAnalysis {
  students: StudentRecord[];
  matrix: Record<string, Record<string, PvPCell>>; // matrix[rowId][colId]
  rankings: PvPRankingEntry[];
  rivals: PvPRivalPair[];
}

export async function fetchPvPAnalysis(scope: PvPScope): Promise<PvPAnalysis> {
  const battles = await fetchBattleHistory();
  const pvpBattles = battles.filter((b) => b.opponentType === 'pvp' && b.opponentId);

  // 対象生徒を絞る
  let pool: StudentRecord[];
  if (scope === 'all') pool = STUDENTS;
  else pool = studentsByDivision(scope);
  const poolIds = new Set(pool.map((s) => `${s.classAbbr}_${s.name}`));

  // Matrix 初期化
  const matrix: Record<string, Record<string, PvPCell>> = {};
  pool.forEach((a) => {
    matrix[`${a.classAbbr}_${a.name}`] = {};
    pool.forEach((b) => {
      if (a === b) return;
      matrix[`${a.classAbbr}_${a.name}`][`${b.classAbbr}_${b.name}`] = { wins: 0, losses: 0, latest: null };
    });
  });

  // Fill matrix
  const recordByPair = new Map<string, BattleRecord[]>();
  pvpBattles.forEach((b) => {
    if (!b.opponentId) return;
    if (!poolIds.has(b.childId) || !poolIds.has(b.opponentId)) return;
    const cell = matrix[b.childId]?.[b.opponentId];
    if (!cell) return;
    if (b.result === 'win') cell.wins += 1;
    else cell.losses += 1;
    if (!cell.latest || cell.latest.playedAt < b.playedAt) cell.latest = b;

    const key = [b.childId, b.opponentId].sort().join('|');
    const arr = recordByPair.get(key) ?? [];
    arr.push(b);
    recordByPair.set(key, arr);
  });

  // Rankings
  const rankingMap = new Map<string, { wins: number; losses: number; oppCount: Map<string, number> }>();
  pool.forEach((s) => {
    const cid = `${s.classAbbr}_${s.name}`;
    rankingMap.set(cid, { wins: 0, losses: 0, oppCount: new Map() });
  });
  pvpBattles.forEach((b) => {
    if (!b.opponentId) return;
    if (!poolIds.has(b.childId) || !poolIds.has(b.opponentId)) return;
    const rec = rankingMap.get(b.childId);
    if (!rec) return;
    if (b.result === 'win') rec.wins += 1;
    else rec.losses += 1;
    rec.oppCount.set(b.opponentId, (rec.oppCount.get(b.opponentId) ?? 0) + 1);
  });

  const rankings: PvPRankingEntry[] = pool.map((s) => {
    const cid = `${s.classAbbr}_${s.name}`;
    const rec = rankingMap.get(cid)!;
    const total = rec.wins + rec.losses;
    let topOppId: string | null = null;
    let topCount = 0;
    rec.oppCount.forEach((c, id) => { if (c > topCount) { topCount = c; topOppId = id; } });
    const topOpp = topOppId ? findStudentByChildId(topOppId) : null;
    return {
      childId: cid,
      name: s.name,
      emoji: s.emoji,
      className: s.className,
      wins: rec.wins,
      losses: rec.losses,
      winRate: total > 0 ? rec.wins / total : 0,
      topOpponentId: topOppId,
      topOpponentName: topOpp?.name ?? null,
      topOpponentBattles: topCount,
    };
  }).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.winRate - a.winRate;
  });

  // Rivals: unique pair 毎の集計。対戦回数3以上をライバル認定。
  const rivals: PvPRivalPair[] = [];
  recordByPair.forEach((arr, key) => {
    const [id1, id2] = key.split('|');
    if (arr.length < 3) return; // 3戦未満はライバルとしない
    const rec1 = findStudentByChildId(id1);
    const rec2 = findStudentByChildId(id2);
    if (!rec1 || !rec2) return;
    let id1Wins = 0;
    let id2Wins = 0;
    arr.forEach((b) => {
      if (b.childId === id1 && b.result === 'win') id1Wins += 1;
      else if (b.childId === id2 && b.result === 'win') id2Wins += 1;
    });
    // arr には両者視点の2レコードずつ入っているので÷2
    rivals.push({
      a: { childId: id1, name: rec1.name, emoji: rec1.emoji },
      b: { childId: id2, name: rec2.name, emoji: rec2.emoji },
      totalBattles: Math.floor(arr.length / 2),
      aWins: id1Wins,
      bWins: id2Wins,
    });
  });
  rivals.sort((a, b) => b.totalBattles - a.totalBattles);

  return { students: pool, matrix, rankings, rivals: rivals.slice(0, 10) };
}

// ===== game_type → 表示名 =====

export const GAME_TYPE_LABELS: Record<string, string> = {
  keisan_battle:    '🔢 計算バトル',
  hikaku_battle:    '⚡ 比較バトル',
  bunsu_battle:     '🔵 分数バトル',
  shousuu_battle:   '🟢 小数バトル',
  kanji_flash:      '📝 漢字フラッシュ',
  yojijukugo:       '🎌 四字熟語',
  kotowaza_puzzle:  '🔀 ことわざパズル',
  bunsho_narabe:    '📖 文章並べ替え',
  todofuken_touch:  '🗾 都道府県タッチ',
  kenchou_quiz:     '🏙️ 県庁所在地',
  kokki_flash:      '🌍 国旗フラッシュ',
  nihonichi:        '🏔️ 日本一',
};

export const GAME_TYPE_SUBJECT: Record<string, '算数' | '国語' | '地理'> = {
  keisan_battle:    '算数', hikaku_battle:    '算数',
  bunsu_battle:     '算数', shousuu_battle:   '算数',
  kanji_flash:      '国語', yojijukugo:       '国語',
  kotowaza_puzzle:  '国語', bunsho_narabe:    '国語',
  todofuken_touch:  '地理', kenchou_quiz:     '地理',
  kokki_flash:      '地理', nihonichi:        '地理',
};

export function gameLabel(gameType: string): string {
  return GAME_TYPE_LABELS[gameType] ?? gameType;
}

export function difficultyLabel(diff: number): string {
  return '★'.repeat(Math.max(1, Math.min(5, diff)));
}
