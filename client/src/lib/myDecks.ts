/**
 * My Decks — オリジナルデッキ構築機能
 * - 所持カード管理（N+R全て、gacha/SSR解放由来）
 * - マイデッキ作成・保存（localStorage）
 * - 最大3デッキまで、1デッキ15枚、SSR≤1, SR≤2, 同名≤3
 */
import { supabase } from './supabase';
import { getAuth } from './auth';
import {
  ALL_BATTLE_CARDS,
  EVOLUTION_ONLY_CARDS,
  type BattleCard,
  type CardRarity,
} from './knowledgeCards';
import {
  loadQuestProgress,
  isSSRUnlocked,
  DECK_SSR_CARDS,
  DECK_KEYS,
  type QuestProgressData,
} from './questProgress';

// ===== Rules =====

export const MY_DECK_SIZE = 15;
export const MY_DECK_MAX_SSR = 1;
export const MY_DECK_MAX_SR = 2;
export const MY_DECK_MAX_SAME_NAME = 3;
export const MY_DECK_MAX_DECKS = 3;

// ===== Types =====

export interface MyDeckCardEntry {
  card_id: string;
  count: number;
}

export interface MyDeck {
  id: string;            // local uuid
  child_id: string;
  deck_name: string;
  cards: MyDeckCardEntry[];
  created_at: string;
  updated_at: string;
}

// ===== LocalStorage I/O =====

const LS_KEY_PREFIX = 'kc_my_decks_';

function lsKey(childId: string): string {
  return `${LS_KEY_PREFIX}${childId}`;
}

export function loadMyDecks(childId?: string): MyDeck[] {
  const id = childId ?? getAuth().childId ?? 'guest';
  try {
    const raw = localStorage.getItem(lsKey(id));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MyDeck[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMyDecks(decks: MyDeck[], childId?: string): void {
  const id = childId ?? getAuth().childId ?? 'guest';
  try {
    localStorage.setItem(lsKey(id), JSON.stringify(decks));
  } catch (e) {
    console.warn('[MyDecks] save failed:', e);
  }
  // Fire-and-forget Supabase sync (table may not exist yet; ignore errors)
  void syncToSupabase(id, decks);
}

async function syncToSupabase(childId: string, decks: MyDeck[]): Promise<void> {
  if (!childId || childId.startsWith('user-') || childId === 'guest') return;
  try {
    // Upsert each deck. Requires user_decks table (see migration 0009_user_decks.sql)
    for (const deck of decks) {
      await supabase.from('user_decks').upsert({
        id: deck.id,
        child_id: childId,
        deck_name: deck.deck_name,
        cards: deck.cards,
        updated_at: deck.updated_at,
      }, { onConflict: 'id' });
    }
  } catch {
    // offline / missing table — localStorage remains authoritative
  }
}

// ===== Ownership =====

/**
 * Owned card set.
 * v1 rules:
 *   - All N cards: always owned
 *   - All R cards: always owned (common pool)
 *   - SR: from gacha_pulls only (legend unlock adds SSRs, not SRs in current design)
 *   - SSR: from gacha_pulls + DECK_SSR_CARDS of legend-cleared decks
 *   - EVOLUTION_ONLY cards: never draftable
 */
export interface OwnershipResult {
  ownedNames: Set<string>;
  ownedByRarity: Record<CardRarity, string[]>;
}

export async function computeOwnership(childId: string): Promise<OwnershipResult> {
  const ownedNames = new Set<string>();

  // 1) All N + R cards baseline
  for (const c of ALL_BATTLE_CARDS) {
    if (EVOLUTION_ONLY_CARDS.has(c.name)) continue;
    if (c.rarity === 'N' || c.rarity === 'R') ownedNames.add(c.name);
  }

  // 2) SSR from legend-cleared decks
  const progress: QuestProgressData = loadQuestProgress();
  for (const deckKey of DECK_KEYS) {
    if (isSSRUnlocked(progress, deckKey)) {
      for (const ssrName of DECK_SSR_CARDS[deckKey] ?? []) {
        ownedNames.add(ssrName);
      }
    }
  }

  // 3) Gacha pulls: distinct card_ids → names
  if (childId && !childId.startsWith('user-') && childId !== 'guest') {
    try {
      const { data } = await supabase
        .from('gacha_pulls')
        .select('card_id')
        .eq('child_id', childId);
      if (data) {
        const pulledIds = new Set(data.map((d) => d.card_id));
        for (const c of ALL_BATTLE_CARDS) {
          if (EVOLUTION_ONLY_CARDS.has(c.name)) continue;
          if (pulledIds.has(c.id)) ownedNames.add(c.name);
        }
      }
    } catch { /* offline */ }
  }

  const byRarity: Record<CardRarity, string[]> = { N: [], R: [], SR: [], SSR: [] };
  for (const c of ALL_BATTLE_CARDS) {
    if (ownedNames.has(c.name) && !EVOLUTION_ONLY_CARDS.has(c.name)) {
      byRarity[c.rarity].push(c.name);
    }
  }
  // dedupe by name (since ALL_BATTLE_CARDS may have variants)
  for (const r of ['N','R','SR','SSR'] as const) {
    byRarity[r] = Array.from(new Set(byRarity[r]));
  }

  return { ownedNames, ownedByRarity: byRarity };
}

// ===== Validation =====

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  totalCount: number;
  ssrCount: number;
  srCount: number;
}

export function validateMyDeck(entries: MyDeckCardEntry[]): ValidationResult {
  const errors: string[] = [];
  let total = 0;
  let ssr = 0;
  let sr = 0;

  for (const e of entries) {
    const card = ALL_BATTLE_CARDS.find((c) => c.id === e.card_id);
    if (!card) {
      errors.push(`未知のカード: ${e.card_id}`);
      continue;
    }
    total += e.count;
    if (card.rarity === 'SSR') ssr += e.count;
    if (card.rarity === 'SR') sr += e.count;
    if (e.count > MY_DECK_MAX_SAME_NAME) {
      errors.push(`${card.name} は最大${MY_DECK_MAX_SAME_NAME}枚まで`);
    }
  }

  if (total !== MY_DECK_SIZE) errors.push(`デッキは${MY_DECK_SIZE}枚ちょうどにしてください（現在${total}枚）`);
  if (ssr > MY_DECK_MAX_SSR) errors.push(`SSRは${MY_DECK_MAX_SSR}枚まで`);
  if (sr > MY_DECK_MAX_SR) errors.push(`SRは${MY_DECK_MAX_SR}枚まで`);

  return {
    valid: errors.length === 0,
    errors,
    totalCount: total,
    ssrCount: ssr,
    srCount: sr,
  };
}

// ===== Helpers =====

export function newDeckId(): string {
  return `mydeck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyDeck(childId: string, deckName = 'マイデッキ'): MyDeck {
  const now = new Date().toISOString();
  return {
    id: newDeckId(),
    child_id: childId,
    deck_name: deckName,
    cards: [],
    created_at: now,
    updated_at: now,
  };
}

/** Expand cards array into actual BattleCard list (with fresh ids for battle) */
export function buildMyDeckCards(deck: MyDeck): BattleCard[] {
  const out: BattleCard[] = [];
  for (const entry of deck.cards) {
    const base = ALL_BATTLE_CARDS.find((c) => c.id === entry.card_id);
    if (!base) continue;
    for (let i = 0; i < entry.count; i++) {
      out.push({ ...base, id: `${base.id}-md-${i}-${Date.now()}` });
    }
  }
  return out;
}
