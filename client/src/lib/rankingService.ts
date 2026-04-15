/**
 * Ranking Service
 * 6カテゴリのランキング集計。全て Supabase から集計して返す。
 * ゲスト（child_id が 'user-' で始まる）とローカル admin は除外。
 */
import { supabase } from './supabase';

export type RankingCategory =
  | 'overall'
  | 'wins'
  | 'winrate'
  | 'collection'
  | 'quest'
  | 'alt';

export interface RankingEntry {
  childId: string;
  nickname: string;
  rank: number;
  primary: number;   // 並び順に使う主値（rating/wins/winrate%/collectionCount/questClearCount/alt）
  secondary?: string; // 補足表示
}

// ============================================================
// 称号（ビギナー〜レジェンド）
// ============================================================

export interface Title {
  key: string;
  label: string;
  emoji: string;
  color: string;
  minRating: number;
  maxRating: number | null;
}

export const TITLE_TABLE: Title[] = [
  { key: 'beginner',    label: 'ビギナー',       emoji: '🟤', color: '#a16207', minRating: 0,    maxRating: 999 },
  { key: 'challenger',  label: 'チャレンジャー', emoji: '⚪', color: '#e5e7eb', minRating: 1000, maxRating: 1199 },
  { key: 'fighter',     label: 'ファイター',     emoji: '🟡', color: '#ffd700', minRating: 1200, maxRating: 1399 },
  { key: 'expert',      label: 'エキスパート',   emoji: '🔵', color: '#3b82f6', minRating: 1400, maxRating: 1599 },
  { key: 'master',      label: 'マスター',       emoji: '🟣', color: '#a855f7', minRating: 1600, maxRating: 1799 },
  { key: 'legend',      label: 'レジェンド',     emoji: '🔴', color: '#ef4444', minRating: 1800, maxRating: null },
];

export function getTitle(rating: number): Title {
  for (const t of TITLE_TABLE) {
    if (t.maxRating === null || rating <= t.maxRating) {
      if (rating >= t.minRating) return t;
    }
  }
  return TITLE_TABLE[0];
}

// ============================================================
// helpers
// ============================================================

function isExcluded(childId: string): boolean {
  return childId.startsWith('user-') || childId.startsWith('guest-') || childId === 'admin';
}

async function fetchNicknameMap(childIds: string[]): Promise<Record<string, string>> {
  if (childIds.length === 0) return {};
  const { data, error } = await supabase
    .from('user_profile')
    .select('child_id, nickname')
    .in('child_id', childIds);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.nickname) map[row.child_id] = row.nickname;
  }
  return map;
}

function rank<T>(items: T[], getVal: (x: T) => number, limit = 50): Array<T & { rank: number }> {
  return items
    .sort((a, b) => getVal(b) - getVal(a))
    .slice(0, limit)
    .map((x, i) => ({ ...x, rank: i + 1 }));
}

// ============================================================
// 1. 🏆 総合ランキング（Eloレート順）
// ============================================================

export async function fetchOverallRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('child_status')
    .select('child_id, rating, wins, losses')
    .order('rating', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const rows = data.filter((r) => !isExcluded(r.child_id));
  const nicknames = await fetchNicknameMap(rows.map((r) => r.child_id));
  return rank(
    rows.map((r) => ({
      childId: r.child_id,
      nickname: nicknames[r.child_id] || '名無し',
      primary: r.rating ?? 1000,
      secondary: `${r.wins ?? 0}勝 ${r.losses ?? 0}敗`,
    })),
    (x) => x.primary,
  );
}

// ============================================================
// 2. ⚔️ 勝利数ランキング
// ============================================================

export async function fetchWinsRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('child_status')
    .select('child_id, wins, losses')
    .order('wins', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const rows = data.filter((r) => !isExcluded(r.child_id));
  const nicknames = await fetchNicknameMap(rows.map((r) => r.child_id));
  return rank(
    rows.map((r) => {
      const w = r.wins ?? 0;
      const l = r.losses ?? 0;
      const total = w + l;
      const winRate = total > 0 ? Math.round((w / total) * 100) : 0;
      return {
        childId: r.child_id,
        nickname: nicknames[r.child_id] || '名無し',
        primary: w,
        secondary: `勝率 ${winRate}%`,
      };
    }),
    (x) => x.primary,
  );
}

// ============================================================
// 3. 📊 勝率ランキング（最低10戦）
// ============================================================

export async function fetchWinRateRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('child_status')
    .select('child_id, wins, losses');
  if (error || !data) return [];
  const rows = data
    .filter((r) => !isExcluded(r.child_id))
    .map((r) => ({
      childId: r.child_id,
      wins: r.wins ?? 0,
      losses: r.losses ?? 0,
      total: (r.wins ?? 0) + (r.losses ?? 0),
    }))
    .filter((r) => r.total >= 10);
  const nicknames = await fetchNicknameMap(rows.map((r) => r.childId));
  return rank(
    rows.map((r) => {
      const winRate = Math.round((r.wins / r.total) * 1000) / 10; // 1桁
      return {
        childId: r.childId,
        nickname: nicknames[r.childId] || '名無し',
        primary: winRate,
        secondary: `${r.wins}勝 ${r.losses}敗`,
      };
    }),
    (x) => x.primary,
  );
}

// ============================================================
// 4. 🃏 コレクションランキング（distinct card_id 数）
// ============================================================

export async function fetchCollectionRanking(totalCards = 100): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('gacha_pulls')
    .select('child_id, card_id');
  if (error || !data) return [];

  const byChild: Record<string, Set<string>> = {};
  for (const row of data) {
    if (isExcluded(row.child_id)) continue;
    if (!byChild[row.child_id]) byChild[row.child_id] = new Set();
    byChild[row.child_id].add(row.card_id);
  }
  const entries = Object.entries(byChild).map(([childId, set]) => ({
    childId,
    count: set.size,
  }));
  const nicknames = await fetchNicknameMap(entries.map((e) => e.childId));
  return rank(
    entries.map((e) => ({
      childId: e.childId,
      nickname: nicknames[e.childId] || '名無し',
      primary: e.count,
      secondary: `${Math.round((e.count / totalCards) * 100)}%`,
    })),
    (x) => x.primary,
  );
}

// ============================================================
// 5. 📖 クエストランキング（クリアしたクエスト数）
// ============================================================

export async function fetchQuestClearRanking(totalQuests = 32): Promise<RankingEntry[]> {
  // 8デッキ × 4難易度 = 32 quests 既定
  const { data, error } = await supabase
    .from('quest_progress')
    .select('child_id, cleared')
    .eq('cleared', true);
  if (error || !data) return [];

  const byChild: Record<string, number> = {};
  for (const row of data) {
    if (isExcluded(row.child_id)) continue;
    byChild[row.child_id] = (byChild[row.child_id] ?? 0) + 1;
  }
  const entries = Object.entries(byChild).map(([childId, count]) => ({ childId, count }));
  const nicknames = await fetchNicknameMap(entries.map((e) => e.childId));
  return rank(
    entries.map((e) => ({
      childId: e.childId,
      nickname: nicknames[e.childId] || '名無し',
      primary: e.count,
      secondary: `${Math.round((e.count / totalQuests) * 100)}%`,
    })),
    (x) => x.primary,
  );
}

// ============================================================
// 6. 🌟 ALTランキング
// ============================================================

export async function fetchAltRanking(): Promise<RankingEntry[]> {
  const { data, error } = await supabase
    .from('child_status')
    .select('child_id, alt_points')
    .order('alt_points', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  const rows = data.filter((r) => !isExcluded(r.child_id));
  const nicknames = await fetchNicknameMap(rows.map((r) => r.child_id));
  return rank(
    rows.map((r) => ({
      childId: r.child_id,
      nickname: nicknames[r.child_id] || '名無し',
      primary: r.alt_points ?? 0,
    })),
    (x) => x.primary,
  );
}

// ============================================================
// Category meta
// ============================================================

export const RANKING_CATEGORIES: Array<{
  id: RankingCategory;
  label: string;
  emoji: string;
  primaryLabel: string;
  formatPrimary: (v: number) => string;
  fetch: () => Promise<RankingEntry[]>;
}> = [
  { id: 'overall',    label: '総合',       emoji: '🏆', primaryLabel: 'レート', formatPrimary: (v) => `${v}`,          fetch: fetchOverallRanking },
  { id: 'wins',       label: '勝利数',     emoji: '⚔️', primaryLabel: '勝利',   formatPrimary: (v) => `${v}勝`,        fetch: fetchWinsRanking },
  { id: 'winrate',    label: '勝率',       emoji: '📊', primaryLabel: '勝率',   formatPrimary: (v) => `${v}%`,         fetch: fetchWinRateRanking },
  { id: 'collection', label: 'コレクション', emoji: '🃏', primaryLabel: '枚数',   formatPrimary: (v) => `${v}枚`,        fetch: fetchCollectionRanking },
  { id: 'quest',      label: 'クエスト',    emoji: '📖', primaryLabel: 'クリア', formatPrimary: (v) => `${v}個`,        fetch: fetchQuestClearRanking },
  { id: 'alt',        label: 'ALT',        emoji: '🌟', primaryLabel: 'ALT',    formatPrimary: (v) => v.toLocaleString(), fetch: fetchAltRanking },
];
