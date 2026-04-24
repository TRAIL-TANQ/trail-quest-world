// ============================================================================
// battleService.ts
// TRAIL QUEST WORLD - Battle System v2.0 MVP
// Supabase 連携層 (battle_* 系テーブル) + ランタイム state 構築
// ============================================================================
//
// 責務:
//   - battle_leaders / battle_cards_meta / battle_decks / battle_deck_cards を取得
//   - preset デッキを BattleCardInstance[] へ展開
//   - battle_sessions に INSERT / UPDATE
//   - ゲスト/管理者/モニターは DB 書込をスキップ (synthetic sessionId を発行)
// ============================================================================

import { nanoid } from 'nanoid';
import { COLLECTION_CARDS } from './cardData';
import { supabase } from './supabase';
import { isAdmin, isGuest, isMonitor } from './auth';
import { createInitialState } from './battle/battleEngine';
import type {
  BattleCardInstance,
  BattleCardMetaRow,
  BattleDeckCardRow,
  BattleDeckRow,
  BattleDifficulty,
  BattleLeaderRow,
  BattleResult,
  BattleState,
} from './battle/battleTypes';

// ---- カード名 / 画像 の lookup (cardData.ts = 既存 226 枚マスタから取得) ----

let cardDisplayCache: Map<string, { name: string; imageUrl: string }> | null = null;
function getCardDisplay(cardId: string): { name: string; imageUrl: string } {
  if (!cardDisplayCache) {
    cardDisplayCache = new Map();
    for (const c of COLLECTION_CARDS) {
      cardDisplayCache.set(c.id, { name: c.name, imageUrl: c.imageUrl });
    }
  }
  return cardDisplayCache.get(cardId) ?? { name: cardId, imageUrl: '' };
}

// ---- 取得 API ----

export async function fetchLeaders(): Promise<BattleLeaderRow[]> {
  const { data, error } = await supabase
    .from('battle_leaders')
    .select('*')
    .order('id');
  if (error) {
    console.warn('[battleService] fetchLeaders failed:', error.message);
    return [];
  }
  return (data as BattleLeaderRow[]) ?? [];
}

export async function fetchCards(): Promise<BattleCardMetaRow[]> {
  const { data, error } = await supabase.from('battle_cards_meta').select('*');
  if (error) {
    console.warn('[battleService] fetchCards failed:', error.message);
    return [];
  }
  return (data as BattleCardMetaRow[]) ?? [];
}

export interface PresetDeck {
  deck: BattleDeckRow;
  cards: BattleDeckCardRow[];
}

export async function fetchPresetDecks(): Promise<PresetDeck[]> {
  const { data: decks, error: deckErr } = await supabase
    .from('battle_decks')
    .select('*')
    .eq('is_preset', true)
    .order('id');
  if (deckErr) {
    console.warn('[battleService] fetchPresetDecks (decks) failed:', deckErr.message);
    return [];
  }
  if (!decks || decks.length === 0) return [];

  const deckRows = decks as BattleDeckRow[];
  const ids = deckRows.map((d) => d.id);

  const { data: cards, error: cardsErr } = await supabase
    .from('battle_deck_cards')
    .select('*')
    .in('deck_id', ids);
  if (cardsErr) {
    console.warn('[battleService] fetchPresetDecks (cards) failed:', cardsErr.message);
    return deckRows.map((d) => ({ deck: d, cards: [] }));
  }

  const byDeck = new Map<number, BattleDeckCardRow[]>();
  for (const dc of (cards as BattleDeckCardRow[]) ?? []) {
    const list = byDeck.get(dc.deck_id) ?? [];
    list.push(dc);
    byDeck.set(dc.deck_id, list);
  }
  return deckRows.map((d) => ({ deck: d, cards: byDeck.get(d.id) ?? [] }));
}

// ---- デッキ展開 (BattleDeckCardRow[] → BattleCardInstance[]) ----

/**
 * preset deck を BattleCardInstance[] (30 枚) に展開。
 * count > 1 の行は同じカードを count 回複製し、それぞれ一意な instanceId を持たせる。
 */
export function expandDeck(
  deckCards: BattleDeckCardRow[],
  cardMetaById: Map<string, BattleCardMetaRow>,
): BattleCardInstance[] {
  const out: BattleCardInstance[] = [];
  for (const dc of deckCards) {
    const meta = cardMetaById.get(dc.card_id);
    if (!meta) {
      console.warn(`[battleService] expandDeck: unknown card_id ${dc.card_id}`);
      continue;
    }
    const display = getCardDisplay(dc.card_id);
    for (let i = 0; i < dc.count; i++) {
      out.push({
        instanceId: nanoid(10),
        cardId: dc.card_id,
        name: display.name,
        cost: meta.cost,
        power: meta.power,
        attackPower: meta.attack_power,
        defensePower: meta.defense_power,
        color: meta.color,
        cardType: meta.card_type,
        effectText: meta.effect_text,
      });
    }
  }
  return out;
}

// ---- セッション開始 / 終了 ----

export interface StartBattleParams {
  childId: string;
  p1LeaderId: string;
  p1DeckId: number;
  p2LeaderId: string;
  p2DeckId: number;
  difficulty: BattleDifficulty;
}

export interface StartBattleResult {
  sessionId: number; // guest/admin/monitor は synthetic (負値)
  initialState: BattleState;
}

export async function startBattle(
  params: StartBattleParams,
): Promise<StartBattleResult> {
  const [leaders, cards, presetDecks] = await Promise.all([
    fetchLeaders(),
    fetchCards(),
    fetchPresetDecks(),
  ]);

  const leaderById = new Map(leaders.map((l) => [l.id, l]));
  const cardMetaById = new Map(cards.map((c) => [c.card_id, c]));
  const deckById = new Map(presetDecks.map((d) => [d.deck.id, d]));

  const p1Leader = leaderById.get(params.p1LeaderId);
  const p2Leader = leaderById.get(params.p2LeaderId);
  if (!p1Leader) throw new Error(`p1 leader not found: ${params.p1LeaderId}`);
  if (!p2Leader) throw new Error(`p2 leader not found: ${params.p2LeaderId}`);

  const p1DeckEntry = deckById.get(params.p1DeckId);
  const p2DeckEntry = deckById.get(params.p2DeckId);
  if (!p1DeckEntry) throw new Error(`p1 deck not found: ${params.p1DeckId}`);
  if (!p2DeckEntry) throw new Error(`p2 deck not found: ${params.p2DeckId}`);

  const p1DeckCards = expandDeck(p1DeckEntry.cards, cardMetaById);
  const p2DeckCards = expandDeck(p2DeckEntry.cards, cardMetaById);

  // DB 書込 (guest/admin/monitor はスキップ)
  let sessionId: number;
  if (isGuest() || isAdmin() || isMonitor()) {
    sessionId = -Date.now(); // synthetic id, 負値で「ローカル専用」を示す
  } else {
    const { data, error } = await supabase
      .from('battle_sessions')
      .insert({
        player1_id: params.childId,
        player1_leader: params.p1LeaderId,
        player1_deck_id: params.p1DeckId,
        player2_id: 'ai',
        player2_leader: params.p2LeaderId,
        player2_deck_id: params.p2DeckId,
        difficulty: params.difficulty,
        turn_count: 0,
        duration_seconds: 0,
        alt_earned: 0,
      })
      .select('id')
      .single();
    if (error || !data) {
      console.warn('[battleService] startBattle insert failed:', error?.message);
      sessionId = -Date.now();
    } else {
      sessionId = (data as { id: number }).id;
    }
  }

  const initialState = createInitialState(
    String(sessionId),
    params.childId,
    p1Leader,
    p1DeckCards,
    p2Leader,
    p2DeckCards,
    params.difficulty,
  );

  return { sessionId, initialState };
}

/**
 * セッションを終局結果で更新。
 * guest/admin/monitor または synthetic sessionId (負値) の場合はスキップ。
 */
export async function finishBattle(
  sessionId: number,
  result: BattleResult,
): Promise<void> {
  if (sessionId < 0) return;
  if (isGuest() || isAdmin() || isMonitor()) return;

  const { error } = await supabase
    .from('battle_sessions')
    .update({
      winner: result.winner,
      turn_count: result.turnCount,
      duration_seconds: result.durationSeconds,
      alt_earned: result.altEarned,
      state_snapshot: result.finalState,
    })
    .eq('id', sessionId);
  if (error) {
    console.warn('[battleService] finishBattle failed:', error.message);
  }
}

/**
 * リーダーのカード画像 URL を取得。
 * battle_leaders.image_url をそのまま使うが、null/空文字ならフォールバック。
 */
export function leaderImageUrl(leader: BattleLeaderRow | null | undefined): string {
  if (!leader) return '';
  return leader.image_url?.trim() || '';
}
