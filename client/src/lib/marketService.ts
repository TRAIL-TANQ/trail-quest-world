/**
 * TRAIL Card Market Service
 *
 * Thin wrapper over Supabase RPCs and table reads for the card market
 * feature (CARD_MARKET_SPEC.md v1.1).
 *
 * Responsibilities:
 *   - sellCard()                   → market_sell_card RPC (Commit C/C.1)
 *   - fetchMarketPrices()          → card_market_prices direct SELECT
 *   - fetchMyCardTransactions()    → fetch_my_card_transactions RPC
 *   - fetchOwnedCards()            → gacha_pulls aggregation (FIFO ownership)
 *   - formatSellErrorReason()      → Japanese UI error messages
 *
 * Buy-side (market_buy_card) lands in Commit E.
 */

import { supabase } from './supabase';
import type { CollectionRarity } from './types';

// ==========================================================================
// Types
// ==========================================================================

export type MarketSellReason =
  | 'child_id_required'
  | 'card_id_required'
  | 'not_sellable'
  | 'child_not_found'
  | 'cooldown_24h'
  | 'card_not_owned'
  | 'daily_sell_limit'
  | 'card_not_listed'
  | 'rpc_error';

export interface MarketSellResult {
  success: boolean;
  reason?: MarketSellReason;
  sell_price?: number;
  alt_balance_after?: number;
  new_buy_price?: number;
  new_sell_price?: number;
  coefficient?: number;
  net_demand?: number;
}

export interface MarketPrice {
  card_id: string;
  rarity: CollectionRarity;
  base_price: number;
  current_buy_price: number;
  current_sell_price: number;
  total_purchases: number;
  total_sales: number;
  last_updated: string;
}

export interface CardTransactionRow {
  id: string;
  child_id: string;
  card_id: string;
  transaction_type: 'buy' | 'sell';
  price: number;
  alt_balance_after: number;
  created_at: string;
}

// ==========================================================================
// Sell
// ==========================================================================

/**
 * Sell one copy of a card at the current market sell price.
 * Server-side handles: protected-card check, FOR UPDATE locks,
 * 24h cooldown, 50/day limit, dynamic repricing, ±30% daily guard.
 */
export async function sellCard(
  childId: string,
  cardId: string,
): Promise<MarketSellResult> {
  try {
    const { data, error } = await supabase.rpc('market_sell_card', {
      p_child_id: childId,
      p_card_id: cardId,
    });
    if (error) {
      console.error('[MarketService] sellCard RPC error:', error);
      return { success: false, reason: 'rpc_error' };
    }
    return (data ?? { success: false, reason: 'rpc_error' }) as MarketSellResult;
  } catch (err) {
    console.error('[MarketService] sellCard threw:', err);
    return { success: false, reason: 'rpc_error' };
  }
}

// ==========================================================================
// Reads
// ==========================================================================

/** All current market prices. RLS allows anon SELECT. */
export async function fetchMarketPrices(): Promise<MarketPrice[]> {
  const { data, error } = await supabase
    .from('card_market_prices')
    .select(
      'card_id, rarity, base_price, current_buy_price, current_sell_price, total_purchases, total_sales, last_updated',
    );
  if (error) {
    console.error('[MarketService] fetchMarketPrices error:', error);
    return [];
  }
  return (data ?? []) as MarketPrice[];
}

/** The current user's card transaction history, newest first. */
export async function fetchMyCardTransactions(
  childId: string,
  limit = 50,
): Promise<CardTransactionRow[]> {
  const { data, error } = await supabase.rpc('fetch_my_card_transactions', {
    p_child_id: childId,
    p_limit: limit,
  });
  if (error) {
    console.error('[MarketService] fetchMyCardTransactions error:', error);
    return [];
  }
  return (data ?? []) as CardTransactionRow[];
}

/**
 * Count the cards the user owns. Reads gacha_pulls — each row represents
 * one copy (same card_id may appear multiple times).
 *
 * Returns: Map<card_id, count>
 */
export async function fetchOwnedCards(
  childId: string,
): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from('gacha_pulls')
    .select('card_id')
    .eq('child_id', childId);
  if (error) {
    console.error('[MarketService] fetchOwnedCards error:', error);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { card_id: string }).card_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ==========================================================================
// UI helpers
// ==========================================================================

/** Japanese error message for UI toasts. */
export function formatSellErrorReason(reason?: MarketSellReason): string {
  switch (reason) {
    case 'child_id_required':
      return 'ユーザーIDが不明です';
    case 'card_id_required':
      return 'カードが選択されていません';
    case 'not_sellable':
      return 'このカードは進化に必要なため売却できません';
    case 'child_not_found':
      return 'ユーザー情報が見つかりません';
    case 'cooldown_24h':
      return '取得から24時間以内のため、まだ売却できません';
    case 'card_not_owned':
      return 'このカードを所持していません';
    case 'daily_sell_limit':
      return '1日の売却上限 (50枚) に達しました';
    case 'card_not_listed':
      return 'このカードは市場に登録されていません';
    default:
      return '売却に失敗しました。通信をご確認ください';
  }
}

/** Difference percentage vs. the rarity-base sell price (for the trend badge). */
export function priceDeltaPercent(sellPrice: number, basePrice: number): number {
  const baseSell = basePrice * 0.6;
  if (baseSell <= 0) return 0;
  return Math.round((sellPrice / baseSell - 1) * 100);
}
