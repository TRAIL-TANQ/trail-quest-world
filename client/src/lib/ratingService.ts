/**
 * Rating Service - Elo レーティング計算 + Supabase 更新 (変更10)
 *
 * ・初期レート 1000
 * ・勝利 +20〜+40、敗北 -40〜-20 にクランプ
 * ・K = 40 (同レート同士で勝者 +20 / 敗者 -20)
 *
 * ランク帯:
 *   Bronze    0 - 999
 *   Silver 1000 - 1299
 *   Gold   1300 - 1599
 *   Platinum 1600 - 1899
 *   Diamond 1900 -
 */
import { supabase } from './supabase';
import { isGuest } from './auth';

export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

export interface RankInfo {
  tier: RankTier;
  label: string;
  color: string;
  emoji: string;
  minRating: number;
  maxRating: number | null;
}

export const RANK_TABLE: RankInfo[] = [
  { tier: 'bronze',   label: 'ブロンズ',     color: '#cd7f32', emoji: '🥉', minRating: 0,    maxRating: 999 },
  { tier: 'silver',   label: 'シルバー',     color: '#c0c0c0', emoji: '🥈', minRating: 1000, maxRating: 1299 },
  { tier: 'gold',     label: 'ゴールド',     color: '#ffd700', emoji: '🥇', minRating: 1300, maxRating: 1599 },
  { tier: 'platinum', label: 'プラチナ',     color: '#67e8f9', emoji: '💠', minRating: 1600, maxRating: 1899 },
  { tier: 'diamond',  label: 'ダイヤモンド', color: '#a855f7', emoji: '💎', minRating: 1900, maxRating: null },
];

export function getRank(rating: number): RankInfo {
  for (const rank of RANK_TABLE) {
    if (rank.maxRating === null || rating <= rank.maxRating) {
      if (rating >= rank.minRating) return rank;
    }
  }
  return RANK_TABLE[0];
}

/**
 * Elo 差分を計算。
 *   expected = 1 / (1 + 10^((opp - player) / 400))
 *   raw      = K * (score - expected)
 *   K = 40, score = 1 (win) or 0 (loss)
 * 勝利は [+20, +40]、敗北は [-40, -20] にクランプ（仕様準拠）。
 */
export function calculateEloDelta(playerRating: number, opponentRating: number, won: boolean): number {
  const K = 40;
  const expected = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
  const raw = K * ((won ? 1 : 0) - expected);
  const rounded = Math.round(raw);
  if (won) return Math.max(20, Math.min(40, rounded));
  return Math.min(-20, Math.max(-40, rounded));
}

/** ソロモードのステージ i に対する NPC 仮想レート */
export function npcRatingForStage(stageId: number): number {
  // stages.ts の aiRating と整合するよう 800 + stage * 130 あたりで spread
  // （正確な数値は stages.ts の aiRating フィールドを使うのが正しい）
  return Math.max(800, 800 + stageId * 130);
}

// ---------- Supabase I/O ----------

export interface RatingStatus {
  rating: number;
  wins: number;
  losses: number;
}

/** child_status から rating / wins / losses を取得 */
export async function fetchRatingStatus(childId: string): Promise<RatingStatus | null> {
  const { data, error } = await supabase
    .from('child_status')
    .select('rating, wins, losses')
    .eq('child_id', childId)
    .maybeSingle();
  if (error) {
    console.error('[RatingService] fetch error:', error);
    return null;
  }
  if (!data) return { rating: 1000, wins: 0, losses: 0 };
  return {
    rating: data.rating ?? 1000,
    wins: data.wins ?? 0,
    losses: data.losses ?? 0,
  };
}

/**
 * バトル結果を child_status に反映。Elo delta + win/loss カウンタを一括更新。
 * 戻り値は新しい rating / wins / losses。
 */
export async function applyRatingChange(
  childId: string,
  opponentRating: number,
  won: boolean,
): Promise<{ newRating: number; delta: number; wins: number; losses: number } | null> {
  if (isGuest()) {
    // Guest mode: return a local-only calculation
    const delta = calculateEloDelta(1000, opponentRating, won);
    return { newRating: Math.max(0, 1000 + delta), delta, wins: won ? 1 : 0, losses: won ? 0 : 1 };
  }
  const current = await fetchRatingStatus(childId);
  if (!current) return null;

  const delta = calculateEloDelta(current.rating, opponentRating, won);
  const newRating = Math.max(0, current.rating + delta);
  const newWins = current.wins + (won ? 1 : 0);
  const newLosses = current.losses + (won ? 0 : 1);

  const { error } = await supabase
    .from('child_status')
    .update({ rating: newRating, wins: newWins, losses: newLosses })
    .eq('child_id', childId);
  if (error) {
    console.error('[RatingService] update error:', error);
    return null;
  }
  return { newRating, delta, wins: newWins, losses: newLosses };
}
