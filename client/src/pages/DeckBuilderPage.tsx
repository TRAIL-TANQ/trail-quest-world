/**
 * DeckBuilderPage - /deck-builder?id=<deckId>
 * マイデッキの新規作成 / 編集画面。
 * - 所持カードから15枚のオリジナルデッキを作る
 * - SSR≤1, SR≤2, 同名≤3
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { toast } from 'sonner';
import { useUserStore } from '@/lib/stores';
import { ALL_BATTLE_CARDS, type BattleCard, type CardRarity } from '@/lib/knowledgeCards';

type CategoryId = 'all' | 'great_people' | 'creatures' | 'world_heritage' | 'inventions' | 'discovery';
import {
  loadMyDecks,
  saveMyDecks,
  createEmptyDeck,
  validateMyDeck,
  computeOwnership,
  MY_DECK_SIZE,
  MY_DECK_MAX_SSR,
  MY_DECK_MAX_SR,
  MY_DECK_MAX_SAME_NAME,
  MY_DECK_MAX_DECKS,
  type MyDeck,
  type MyDeckCardEntry,
} from '@/lib/myDecks';
import { playTap } from '@/lib/sfx';

const CATEGORIES: Array<{ id: CategoryId; label: string; emoji: string }> = [
  { id: 'all',           label: '全て',     emoji: '🃏' },
  { id: 'great_people',  label: '偉人',     emoji: '👑' },
  { id: 'creatures',     label: '生き物',   emoji: '🐾' },
  { id: 'world_heritage', label: '世界遺産', emoji: '🏛️' },
  { id: 'inventions',    label: '発明',     emoji: '💡' },
  { id: 'discovery',     label: '発見',     emoji: '🔬' },
];

const RARITIES: Array<{ id: CardRarity | 'all'; label: string; color: string }> = [
  { id: 'all', label: '全て', color: '#e5e7eb' },
  { id: 'N',   label: 'N',    color: '#9ca3af' },
  { id: 'R',   label: 'R',    color: '#3b82f6' },
  { id: 'SR',  label: 'SR',   color: '#a855f7' },
  { id: 'SSR', label: 'SSR',  color: '#ffd700' },
];

function getParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function DeckBuilderPage() {
  const [, navigate] = useLocation();
  const userId = useUserStore((s) => s.user.id);
  const editId = getParam('id');

  const [deck, setDeck] = useState<MyDeck>(() => {
    const existing = editId ? loadMyDecks(userId).find((d) => d.id === editId) : null;
    return existing ?? createEmptyDeck(userId);
  });
  const [ownedNames, setOwnedNames] = useState<Set<string>>(new Set());
  const [loadingOwnership, setLoadingOwnership] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<CategoryId>('all');
  const [rarityFilter, setRarityFilter] = useState<CardRarity | 'all'>('all');

  useEffect(() => {
    let cancelled = false;
    computeOwnership(userId).then(({ ownedNames }) => {
      if (!cancelled) {
        setOwnedNames(ownedNames);
        setLoadingOwnership(false);
      }
    });
    return () => { cancelled = true; };
  }, [userId]);

  const validation = useMemo(() => validateMyDeck(deck.cards), [deck.cards]);

  const getCardCount = useCallback((cardId: string): number => {
    return deck.cards.find((c) => c.card_id === cardId)?.count ?? 0;
  }, [deck.cards]);

  const getNameCount = useCallback((name: string): number => {
    return deck.cards
      .filter((e) => {
        const card = ALL_BATTLE_CARDS.find((c) => c.id === e.card_id);
        return card?.name === name;
      })
      .reduce((sum, e) => sum + e.count, 0);
  }, [deck.cards]);

  const addCard = useCallback((card: BattleCard) => {
    const nameCount = getNameCount(card.name);
    const total = deck.cards.reduce((s, e) => s + e.count, 0);

    if (total >= MY_DECK_SIZE) {
      toast.error(`デッキは${MY_DECK_SIZE}枚までです`);
      return;
    }
    if (nameCount >= MY_DECK_MAX_SAME_NAME) {
      toast.error(`${card.name} は${MY_DECK_MAX_SAME_NAME}枚まで`);
      return;
    }
    const ssrCount = deck.cards.reduce((s, e) => {
      const c = ALL_BATTLE_CARDS.find((b) => b.id === e.card_id);
      return c?.rarity === 'SSR' ? s + e.count : s;
    }, 0);
    const srCount = deck.cards.reduce((s, e) => {
      const c = ALL_BATTLE_CARDS.find((b) => b.id === e.card_id);
      return c?.rarity === 'SR' ? s + e.count : s;
    }, 0);
    if (card.rarity === 'SSR' && ssrCount >= MY_DECK_MAX_SSR) {
      toast.error(`SSRは${MY_DECK_MAX_SSR}枚まで`);
      return;
    }
    if (card.rarity === 'SR' && srCount >= MY_DECK_MAX_SR) {
      toast.error(`SRは${MY_DECK_MAX_SR}枚まで`);
      return;
    }

    playTap();
    setDeck((prev) => {
      const existing = prev.cards.find((e) => e.card_id === card.id);
      const nextCards = existing
        ? prev.cards.map((e) => e.card_id === card.id ? { ...e, count: e.count + 1 } : e)
        : [...prev.cards, { card_id: card.id, count: 1 }];
      return { ...prev, cards: nextCards, updated_at: new Date().toISOString() };
    });
  }, [deck.cards, getNameCount]);

  const removeCard = useCallback((cardId: string) => {
    playTap();
    setDeck((prev) => {
      const nextCards = prev.cards
        .map((e) => e.card_id === cardId ? { ...e, count: e.count - 1 } : e)
        .filter((e) => e.count > 0);
      return { ...prev, cards: nextCards, updated_at: new Date().toISOString() };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (!validation.valid) {
      toast.error(validation.errors[0] ?? 'デッキ条件未達');
      return;
    }
    const decks = loadMyDecks(userId);
    const existingIdx = decks.findIndex((d) => d.id === deck.id);
    const saved = { ...deck, updated_at: new Date().toISOString() };
    let nextDecks: MyDeck[];
    if (existingIdx >= 0) {
      nextDecks = decks.map((d, i) => i === existingIdx ? saved : d);
    } else {
      if (decks.length >= MY_DECK_MAX_DECKS) {
        toast.error(`マイデッキは${MY_DECK_MAX_DECKS}個までです`);
        return;
      }
      nextDecks = [...decks, saved];
    }
    saveMyDecks(nextDecks, userId);
    toast.success(`${saved.deck_name} を保存しました`);
    navigate('/games/knowledge-challenger');
  }, [validation, deck, userId, navigate]);

  const handleDelete = useCallback(() => {
    if (!confirm(`${deck.deck_name} を削除しますか？`)) return;
    const decks = loadMyDecks(userId).filter((d) => d.id !== deck.id);
    saveMyDecks(decks, userId);
    toast.success('削除しました');
    navigate('/games/knowledge-challenger');
  }, [deck, userId, navigate]);

  // Owned cards pool (filtered by category/rarity)
  const ownedCards = useMemo(() => {
    const pool: BattleCard[] = [];
    const seen = new Set<string>();
    for (const c of ALL_BATTLE_CARDS) {
      if (seen.has(c.name)) continue;
      if (!ownedNames.has(c.name)) continue;
      if (categoryFilter !== 'all' && c.category !== categoryFilter) continue;
      if (rarityFilter !== 'all' && c.rarity !== rarityFilter) continue;
      seen.add(c.name);
      pool.push(c);
    }
    // Sort by rarity (SSR > SR > R > N), then name
    const order: Record<CardRarity, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
    pool.sort((a, b) => {
      const r = order[a.rarity] - order[b.rarity];
      return r !== 0 ? r : a.name.localeCompare(b.name, 'ja');
    });
    return pool;
  }, [ownedNames, categoryFilter, rarityFilter]);

  // Deck display: expand entries into flat array for rendering
  const deckDisplayCards = useMemo(() => {
    const out: Array<{ card: BattleCard; entryIdx: number }> = [];
    deck.cards.forEach((entry, entryIdx) => {
      const base = ALL_BATTLE_CARDS.find((c) => c.id === entry.card_id);
      if (!base) return;
      for (let i = 0; i < entry.count; i++) {
        out.push({ card: base, entryIdx });
      }
    });
    return out;
  }, [deck.cards]);

  return (
    <div className="min-h-screen flex flex-col pb-32"
      style={{ background: 'linear-gradient(180deg, #0b1128 0%, #151d3b 50%, #0e1430 100%)' }}>

      {/* Header */}
      <div className="px-3 py-2.5 shrink-0"
        style={{ background: 'rgba(11,17,40,0.95)', borderBottom: '1.5px solid rgba(255,215,0,0.3)' }}>
        <div className="flex items-center gap-2 mb-1">
          <button
            onClick={() => navigate('/games/knowledge-challenger')}
            className="tappable px-2 py-1 rounded text-[11px] font-bold"
            style={{ background: 'rgba(255,215,0,0.08)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.25)' }}>
            ← 戻る
          </button>
          <span className="text-base">🔨</span>
          <input
            value={deck.deck_name}
            onChange={(e) => setDeck((prev) => ({ ...prev, deck_name: e.target.value }))}
            className="flex-1 bg-transparent text-[14px] font-bold text-amber-100 border-b border-amber-200/30 px-1 min-w-0"
            placeholder="マイデッキ"
            maxLength={20}
          />
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-bold" style={{ color: validation.totalCount === MY_DECK_SIZE ? '#22c55e' : '#ff6b6b' }}>
            {validation.totalCount}/{MY_DECK_SIZE}枚
          </span>
          <span className="text-amber-200/70">
            SSR: <span style={{ color: validation.ssrCount > MY_DECK_MAX_SSR ? '#ff6b6b' : '#ffd700' }}>
              {validation.ssrCount}/{MY_DECK_MAX_SSR}
            </span>
          </span>
          <span className="text-amber-200/70">
            SR: <span style={{ color: validation.srCount > MY_DECK_MAX_SR ? '#ff6b6b' : '#a855f7' }}>
              {validation.srCount}/{MY_DECK_MAX_SR}
            </span>
          </span>
        </div>
      </div>

      {/* Deck (top scroll) */}
      <div className="shrink-0 px-3 py-2" style={{ background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,215,0,0.15)' }}>
        <p className="text-[11px] font-bold text-amber-100 mb-1.5">📋 デッキ（タップで除外）</p>
        {deckDisplayCards.length === 0 ? (
          <p className="text-[11px] text-amber-200/40 text-center py-3">下のカードをタップして追加</p>
        ) : (
          <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {deckDisplayCards.map(({ card }, idx) => (
              <button
                key={`${card.id}-${idx}`}
                onClick={() => removeCard(card.id)}
                className="shrink-0 w-14 relative rounded overflow-hidden active:scale-95 transition-transform"
                style={{ border: `1.5px solid ${rarityColor(card.rarity)}60` }}
              >
                <img src={card.imageUrl} alt={card.name}
                  className="w-full aspect-[3/4] object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                <div className="absolute inset-0 flex items-end justify-center pb-0.5"
                  style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(0,0,0,0.8))' }}>
                  <span className="text-[8px] font-bold text-white truncate px-0.5">{card.name}</span>
                </div>
                <span className="absolute top-0 right-0 text-[8px] font-black px-1"
                  style={{ background: rarityColor(card.rarity), color: '#0b1128' }}>{card.rarity}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="shrink-0 px-3 py-2 space-y-1.5">
        <div className="flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className="shrink-0 tappable px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors"
              style={categoryFilter === cat.id
                ? { background: 'rgba(255,215,0,0.25)', color: '#ffd700', border: '1px solid rgba(255,215,0,0.5)' }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {RARITIES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRarityFilter(r.id)}
              className="tappable flex-1 px-2 py-1 rounded-md text-[10px] font-black transition-colors"
              style={rarityFilter === r.id
                ? { background: `${r.color}30`, color: r.color, border: `1.5px solid ${r.color}` }
                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Owned cards grid */}
      <div className="flex-1 px-3 py-2 min-h-0 overflow-auto">
        <p className="text-[11px] font-bold text-amber-100 mb-1.5">
          🃏 所持カード（{ownedCards.length}種）
        </p>
        {loadingOwnership ? (
          <p className="text-[11px] text-amber-200/50 text-center py-8">読み込み中…</p>
        ) : ownedCards.length === 0 ? (
          <p className="text-[11px] text-amber-200/50 text-center py-8">該当するカードがありません</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {ownedCards.map((card) => {
              const inDeck = getNameCount(card.name);
              const canAdd = inDeck < MY_DECK_MAX_SAME_NAME;
              return (
                <button
                  key={card.id}
                  onClick={() => addCard(card)}
                  disabled={!canAdd}
                  className="relative rounded-lg overflow-hidden active:scale-95 transition-transform"
                  style={{
                    border: `1.5px solid ${rarityColor(card.rarity)}60`,
                    opacity: canAdd ? 1 : 0.4,
                    background: 'rgba(255,255,255,0.04)',
                  }}>
                  <img src={card.imageUrl} alt={card.name}
                    className="w-full aspect-[3/4] object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
                  <span className="absolute top-0.5 right-0.5 text-[9px] font-black px-1 rounded"
                    style={{ background: rarityColor(card.rarity), color: '#0b1128' }}>{card.rarity}</span>
                  {inDeck > 0 && (
                    <span className="absolute top-0.5 left-0.5 text-[10px] font-black px-1 rounded"
                      style={{ background: '#22c55e', color: '#fff' }}>×{inDeck}</span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 px-1 py-0.5"
                    style={{ background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))' }}>
                    <p className="text-[9px] font-bold text-white truncate">{card.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer: save / delete */}
      <div className="fixed bottom-0 left-0 right-0 px-3 py-2 space-y-1.5 z-10"
        style={{ background: 'rgba(11,17,40,0.96)', borderTop: '1.5px solid rgba(255,215,0,0.3)' }}>
        {!validation.valid && validation.errors.length > 0 && (
          <p className="text-[10px] text-red-300 text-center">⚠️ {validation.errors[0]}</p>
        )}
        <div className="flex gap-2">
          {editId && (
            <button
              onClick={handleDelete}
              className="tappable px-3 rounded-lg font-bold text-[12px]"
              style={{
                background: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
                border: '1.5px solid rgba(239,68,68,0.4)',
              }}>
              🗑️
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!validation.valid}
            className="tappable flex-1 py-3 rounded-lg font-black text-sm"
            style={{
              background: validation.valid
                ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                : 'rgba(90,90,100,0.4)',
              color: '#fff',
              boxShadow: validation.valid ? '0 3px 14px rgba(34,197,94,0.4)' : 'none',
              opacity: validation.valid ? 1 : 0.6,
            }}>
            💾 {editId ? '更新' : '保存'}
          </button>
        </div>
      </div>
    </div>
  );
}

function rarityColor(r: CardRarity): string {
  switch (r) {
    case 'SSR': return '#ffd700';
    case 'SR':  return '#a855f7';
    case 'R':   return '#3b82f6';
    case 'N':   return '#9ca3af';
  }
}
