/**
 * Hall of Fame Service - 5-0 クリアデッキの永続化 (変更11)
 *
 * テーブル: hall_of_fame
 *   id / child_id / deck_data (jsonb) / total_fans / stage_id / cleared_at
 *
 * 保存条件: 5 ラウンド全勝 (history.every(r => r.winner === 'player'))
 * 取得: child_id + cleared_at desc で直近 N 件を一覧表示
 */
import { supabase } from './supabase';
import type { BattleCard } from './knowledgeCards';

export interface HallOfFameEntry {
  id: string;
  child_id: string;
  deck_data: BattleCard[];
  total_fans: number;
  stage_id: number | null;
  cleared_at: string;
}

/** 5-0 クリアしたデッキを保存。バトル中に使ったデッキ（開始時 + 獲得分）を jsonb で丸ごと記録。 */
export async function saveHallOfFame(params: {
  childId: string;
  deck: BattleCard[];
  totalFans: number;
  stageId: number | null;
}): Promise<boolean> {
  const { childId, deck, totalFans, stageId } = params;
  const { error } = await supabase.from('hall_of_fame').insert({
    child_id: childId,
    deck_data: deck,
    total_fans: totalFans,
    stage_id: stageId,
  });
  if (error) {
    console.error('[HallOfFameService] save error:', error);
    return false;
  }
  return true;
}

/** 指定ユーザーの殿堂入り一覧（新しい順、最大 limit 件） */
export async function fetchHallOfFame(childId: string, limit = 50): Promise<HallOfFameEntry[]> {
  const { data, error } = await supabase
    .from('hall_of_fame')
    .select('id, child_id, deck_data, total_fans, stage_id, cleared_at')
    .eq('child_id', childId)
    .order('cleared_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[HallOfFameService] fetch error:', error);
    return [];
  }
  return (data ?? []) as HallOfFameEntry[];
}
