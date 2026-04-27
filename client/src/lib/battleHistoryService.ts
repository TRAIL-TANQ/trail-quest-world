/**
 * Battle History Service
 * バトル終了時に 1 件だけ record する。管理者/モニター/ゲストは除外。
 *
 * deckKey は questProgress の DeckKey と同形式。
 * スターターデッキID（'starter-jeanne' 等）から逆引きするヘルパーも用意。
 */
import { supabase } from './supabase';
import { isAdmin, isMonitor, isGuest } from './auth';
import { DECK_KEY_TO_STARTER_ID, type DeckKey } from './questProgress';

export type BattleResult = 'win' | 'lose';
export type OpponentType = 'npc' | 'pvp';

export interface BattleHistoryInsert {
  childId: string;
  deckKey: string;             // 'jeanne' 等 または 'custom'
  opponentType?: OpponentType;
  opponentId?: string | null;  // 対人戦の相手 childId（NPC戦はNULL）
  opponentDeckKey?: string | null;
  stage?: number | null;
  result: BattleResult;
  totalFans?: number | null;
  opponentFans?: number | null;
  finisherCardId?: string | null;
  finisherCardName?: string | null;
  roundsPlayed?: number | null;
  durationSeconds?: number | null; // バトル開始〜終了の秒数（保護者ダッシュボード集計用）
}

/** StarterDeck id（'starter-jeanne' 等）から DeckKey を逆引き。見つからなければ 'custom'。 */
export function starterIdToDeckKey(starterId: string | null | undefined): string {
  if (!starterId) return 'custom';
  const entry = Object.entries(DECK_KEY_TO_STARTER_ID).find(([, sid]) => sid === starterId);
  return (entry?.[0] as DeckKey | undefined) ?? 'custom';
}

/** バトル履歴を保存する。ゲスト/管理者/モニターは黙ってスキップ。 */
export async function saveBattleHistory(input: BattleHistoryInsert): Promise<void> {
  if (isGuest() || isAdmin() || isMonitor()) return;
  try {
    const { error } = await supabase.from('battle_history').insert({
      child_id:           input.childId,
      deck_key:           input.deckKey,
      opponent_type:      input.opponentType ?? 'npc',
      opponent_id:        input.opponentId ?? null,
      opponent_deck_key:  input.opponentDeckKey ?? null,
      stage:              input.stage ?? null,
      result:             input.result,
      total_fans:         input.totalFans ?? null,
      opponent_fans:      input.opponentFans ?? null,
      finisher_card_id:   input.finisherCardId ?? null,
      finisher_card_name: input.finisherCardName ?? null,
      rounds_played:      input.roundsPlayed ?? null,
      duration_seconds:   input.durationSeconds ?? 0,
    });
    if (error) console.warn('[BattleHistory] insert failed:', error.message);
  } catch (err) {
    console.warn('[BattleHistory] saveBattleHistory threw:', err);
  }
}

/**
 * 対人戦（PvP/大会）のバトル結果を記録する。
 * - 勝者・敗者それぞれの視点でレコードを 1 件ずつ INSERT（計2件）。
 * - 管理者/モニターが当事者の場合、その本人のレコードはスキップされる（service 側で判定）。
 * - supabase.insert を2回並列実行して失敗は個別 warn。
 */
export interface PvPBattleRecord {
  winnerId: string;
  loserId: string;
  winnerDeckKey: string;
  loserDeckKey: string;
  winnerFinisherId?: string | null;
  winnerFinisherName?: string | null;
  loserFinisherId?: string | null;
  loserFinisherName?: string | null;
  winnerFans?: number | null;
  loserFans?: number | null;
  roundsPlayed?: number | null;
  durationSeconds?: number | null; // バトル開始〜終了の秒数（保護者ダッシュボード集計用）
}

export async function savePvPBattleHistory(rec: PvPBattleRecord): Promise<void> {
  const adminSelf = isAdmin() || isMonitor() || isGuest();

  // 個別に saveBattleHistory を呼ぶが、当事者が自身のセッションでない場合も保存したい。
  // ただし本関数はログイン中ユーザーのセッションから呼ばれる前提なので、その場合の
  // 相手側レコードは「別端末から保存される」のが本来。教室運用・手動入力を想定して
  // ここでは両側を insert する（isGuest/admin チェックが false の場合）。
  if (adminSelf) {
    // 管理者/モニターが自分で試合した場合、相手側だけ記録したいケースもあるが、
    // ここでは一旦スキップして仕様どおり「admin の戦績は残さない」を優先。
    return;
  }

  const rows = [
    {
      child_id:           rec.winnerId,
      deck_key:           rec.winnerDeckKey,
      opponent_type:      'pvp',
      opponent_id:        rec.loserId,
      opponent_deck_key:  rec.loserDeckKey,
      stage:              null,
      result:             'win',
      total_fans:         rec.winnerFans ?? null,
      opponent_fans:      rec.loserFans ?? null,
      finisher_card_id:   rec.winnerFinisherId ?? null,
      finisher_card_name: rec.winnerFinisherName ?? null,
      rounds_played:      rec.roundsPlayed ?? null,
      duration_seconds:   rec.durationSeconds ?? 0,
    },
    {
      child_id:           rec.loserId,
      deck_key:           rec.loserDeckKey,
      opponent_type:      'pvp',
      opponent_id:        rec.winnerId,
      opponent_deck_key:  rec.winnerDeckKey,
      stage:              null,
      result:             'lose',
      total_fans:         rec.loserFans ?? null,
      opponent_fans:      rec.winnerFans ?? null,
      finisher_card_id:   rec.loserFinisherId ?? null,
      finisher_card_name: rec.loserFinisherName ?? null,
      rounds_played:      rec.roundsPlayed ?? null,
      duration_seconds:   rec.durationSeconds ?? 0,
    },
  ];
  try {
    const { error } = await supabase.from('battle_history').insert(rows);
    if (error) console.warn('[BattleHistory] pvp insert failed:', error.message);
  } catch (err) {
    console.warn('[BattleHistory] savePvPBattleHistory threw:', err);
  }
}
