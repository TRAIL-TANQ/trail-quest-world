/**
 * ShopSellTabPage (Commit D)
 *
 * ALTショップ「売却」タブ本体。
 * - 所持カード (gacha_pulls の FIFO) を一覧表示
 * - 現在の market sell price を card_market_prices から取得
 * - 保護カード (NON_SELLABLE_CARD_IDS) はグレーアウト
 * - クリック→確認ダイアログ→market_sell_card RPC→反映
 *
 * Deck-equipped card の grayed-out は Commit G で追加予定。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useUserStore } from '@/lib/stores';
import { COLLECTION_CARDS } from '@/lib/cardData';
import { isCardSellable } from '@/lib/knowledgeCards';
import {
  fetchMarketPrices,
  fetchOwnedCards,
  formatSellErrorReason,
  priceDeltaPercent,
  sellCard,
  type MarketPrice,
} from '@/lib/marketService';
import type { CollectionRarity } from '@/lib/types';

interface OwnedEntry {
  card_id: string;
  name: string;
  rarity: CollectionRarity;
  imageUrl: string;
  count: number;
  sell_price: number;
  buy_price: number;
  base_price: number;
  sellable: boolean;
}

interface Props {
  onAltBalanceChange?: (newBalance: number) => void;
}

type RarityFilter = 'all' | CollectionRarity;
type SortKey = 'price_desc' | 'price_asc' | 'rarity';

const RARITY_ORDER: Record<CollectionRarity, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
const RARITY_COLOR: Record<CollectionRarity, string> = {
  SSR: '#ef4444',
  SR: '#f59e0b',
  R: '#3b82f6',
  N: '#9ca3af',
};

export default function ShopSellTabPage({ onAltBalanceChange }: Props) {
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);

  const [loading, setLoading] = useState(true);
  const [owned, setOwned] = useState<OwnedEntry[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('price_desc');

  const [confirmCard, setConfirmCard] = useState<OwnedEntry | null>(null);
  const [selling, setSelling] = useState(false);

  // ---------- Load ----------
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [priceList, ownCounts] = await Promise.all([
        fetchMarketPrices(),
        fetchOwnedCards(user.id),
      ]);
      const priceMap = new Map<string, MarketPrice>(
        priceList.map((p) => [p.card_id, p]),
      );

      const entries: OwnedEntry[] = [];
      for (const [cardId, count] of Array.from(ownCounts.entries())) {
        const card = COLLECTION_CARDS.find((c) => c.id === cardId);
        const price = priceMap.get(cardId);
        if (!card || !price) continue;
        entries.push({
          card_id: cardId,
          name: card.name,
          rarity: card.rarity,
          imageUrl: card.imageUrl,
          count,
          sell_price: price.current_sell_price,
          buy_price: price.current_buy_price,
          base_price: price.base_price,
          sellable: isCardSellable(cardId),
        });
      }
      setOwned(entries);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ---------- Filter + Sort ----------
  const filteredSorted = useMemo(() => {
    let list = [...owned];
    if (rarityFilter !== 'all') {
      list = list.filter((c) => c.rarity === rarityFilter);
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'price_desc':
          return b.sell_price - a.sell_price;
        case 'price_asc':
          return a.sell_price - b.sell_price;
        case 'rarity':
          return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      }
    });
    return list;
  }, [owned, rarityFilter, sortBy]);

  // ---------- Sell flow ----------
  const requestSell = (card: OwnedEntry) => {
    if (!card.sellable) {
      toast.info('このカードは進化に必要なため売却できません');
      return;
    }
    setConfirmCard(card);
  };

  const doSell = async () => {
    if (!confirmCard) return;
    setSelling(true);
    const result = await sellCard(user.id, confirmCard.card_id);
    setSelling(false);

    if (!result.success) {
      toast.error(formatSellErrorReason(result.reason));
      setConfirmCard(null);
      return;
    }

    const gained = result.sell_price ?? 0;
    toast.success(`${confirmCard.name} を ${gained} ALT で売却しました！`);

    // Update local store (delta) + parent balance (absolute from RPC response)
    updateAlt(+gained);
    if (typeof result.alt_balance_after === 'number') {
      onAltBalanceChange?.(result.alt_balance_after);
    }

    // Reflect in local list: decrement count, refresh prices from response
    setOwned((prev) =>
      prev
        .map((c) =>
          c.card_id === confirmCard.card_id
            ? {
                ...c,
                count: c.count - 1,
                sell_price: result.new_sell_price ?? c.sell_price,
                buy_price: result.new_buy_price ?? c.buy_price,
              }
            : c,
        )
        .filter((c) => c.count > 0),
    );
    setConfirmCard(null);
  };

  // ---------- Render ----------
  if (loading) {
    return <div className="text-center text-amber-200/50 text-xs py-12">読み込み中…</div>;
  }

  if (owned.length === 0) {
    return (
      <div className="rounded-xl p-6 text-center text-[11px] text-amber-200/50"
        style={{ background: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.15)' }}>
        売却できる所持カードがまだありません。
        <br />ガチャやバトル報酬でカードを集めてみましょう。
      </div>
    );
  }

  return (
    <>
      {/* ===== Filter + Sort bar ===== */}
      <div className="flex gap-2 mb-3 items-center flex-wrap">
        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as RarityFilter)}
          className="px-2 py-1 rounded text-xs font-bold"
          style={{
            background: 'rgba(21,29,59,0.9)',
            color: '#fcd34d',
            border: '1px solid rgba(255,215,0,0.25)',
          }}
        >
          <option value="all">全レアリティ</option>
          <option value="SSR">SSR</option>
          <option value="SR">SR</option>
          <option value="R">R</option>
          <option value="N">N</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-2 py-1 rounded text-xs font-bold"
          style={{
            background: 'rgba(21,29,59,0.9)',
            color: '#fcd34d',
            border: '1px solid rgba(255,215,0,0.25)',
          }}
        >
          <option value="price_desc">売却価格 ↓</option>
          <option value="price_asc">売却価格 ↑</option>
          <option value="rarity">レアリティ順</option>
        </select>
        <span className="text-[10px] text-amber-200/50 ml-auto">
          合計 {owned.reduce((acc, c) => acc + c.count, 0)} 枚
        </span>
      </div>

      {/* ===== Card grid ===== */}
      <div className="grid grid-cols-2 gap-3">
        {filteredSorted.map((card, i) => {
          const rarityColor = RARITY_COLOR[card.rarity];
          const deltaPct = priceDeltaPercent(card.sell_price, card.base_price);
          return (
            <div
              key={card.card_id}
              className="rounded-xl overflow-hidden transition-all duration-200 animate-slide-up relative"
              style={{
                animationDelay: `${i * 40}ms`,
                background:
                  'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: card.sellable
                  ? `1.5px solid ${rarityColor}55`
                  : '1.5px solid rgba(120,120,140,0.3)',
                opacity: card.sellable ? 1 : 0.55,
                boxShadow: card.sellable
                  ? `0 2px 12px rgba(0,0,0,0.3), 0 0 8px ${rarityColor}15`
                  : '0 2px 12px rgba(0,0,0,0.3)',
              }}
            >
              {/* Image */}
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full h-full object-contain"
                  style={{ filter: card.sellable ? 'none' : 'grayscale(0.85) brightness(0.8)' }}
                  loading="lazy"
                />
                {/* Rarity + count badge (top-left) */}
                <div
                  className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    color: rarityColor,
                    border: `1px solid ${rarityColor}55`,
                  }}
                >
                  {card.rarity} × {card.count}
                </div>
                {/* Trend badge (top-right) */}
                {card.sellable && deltaPct !== 0 && (
                  <div
                    className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: 'rgba(0,0,0,0.6)',
                      color: deltaPct > 0 ? '#22c55e' : '#ef4444',
                    }}
                  >
                    {deltaPct > 0 ? '↑' : '↓'} {Math.abs(deltaPct)}%
                  </div>
                )}
                {/* Protected overlay */}
                {!card.sellable && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center"
                    style={{ background: 'rgba(11,17,40,0.55)' }}
                  >
                    <span className="text-3xl mb-1">🔒</span>
                    <span className="text-[10px] font-bold text-amber-200/85 px-2 text-center leading-tight">
                      進化に必要なため
                      <br />
                      売却不可
                    </span>
                  </div>
                )}
              </div>

              {/* Info + button */}
              <div
                className="p-2.5"
                style={{
                  borderTop: card.sellable
                    ? `1px solid ${rarityColor}22`
                    : '1px solid rgba(120,120,140,0.2)',
                }}
              >
                <p className="text-xs font-bold text-amber-100 mb-1 truncate">{card.name}</p>
                <p className="text-[10px] text-amber-200/55 mb-2">
                  売却価格:{' '}
                  <span className="text-amber-300 font-bold text-[11px]">{card.sell_price}</span>{' '}
                  ALT
                </p>
                <button
                  onClick={() => requestSell(card)}
                  disabled={!card.sellable}
                  className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:cursor-not-allowed"
                  style={
                    card.sellable
                      ? {
                          background:
                            'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))',
                          color: '#22c55e',
                          border: '1px solid rgba(34,197,94,0.45)',
                        }
                      : {
                          background: 'rgba(120,120,140,0.12)',
                          color: 'rgba(200,200,220,0.5)',
                          border: '1px solid rgba(120,120,140,0.25)',
                        }
                  }
                >
                  {card.sellable ? '💰 売却する' : '🔒 売却不可'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== Confirm dialog ===== */}
      {confirmCard && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.72)' }}
          onClick={() => !selling && setConfirmCard(null)}
        >
          <div
            className="rounded-xl p-4 max-w-xs w-full"
            style={{
              background:
                'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '1px solid rgba(34,197,94,0.4)',
              boxShadow: '0 0 28px rgba(34,197,94,0.22)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-3">
              <img
                src={confirmCard.imageUrl}
                alt={confirmCard.name}
                className="w-24 h-24 mx-auto mb-2 rounded-lg object-contain"
              />
              <h3 className="text-sm font-bold text-amber-100">{confirmCard.name}</h3>
              <p className="text-[10px] text-amber-200/50">
                {confirmCard.rarity} ・ 所持 {confirmCard.count} 枚
              </p>
            </div>

            <div
              className="text-center mb-3 p-2.5 rounded-lg"
              style={{
                background: 'rgba(34,197,94,0.08)',
                border: '1px solid rgba(34,197,94,0.22)',
              }}
            >
              <div className="text-[10px] text-amber-200/60 mb-0.5">売却価格</div>
              <div className="text-xl font-bold text-green-400">
                {confirmCard.sell_price}{' '}
                <span className="text-xs text-green-400/70 font-bold">ALT</span>
              </div>
            </div>

            <div className="text-[10px] text-amber-200/55 mb-3 leading-relaxed px-1">
              ⚠️ 売却後24時間は同じカードの再売却ができません。
              本当に売却しますか？
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCard(null)}
                disabled={selling}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                style={{
                  background: 'rgba(120,120,140,0.12)',
                  color: 'rgba(200,200,220,0.7)',
                  border: '1px solid rgba(120,120,140,0.25)',
                }}
              >
                キャンセル
              </button>
              <button
                onClick={doSell}
                disabled={selling}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(34,197,94,0.35), rgba(34,197,94,0.15))',
                  color: '#22c55e',
                  border: '1px solid rgba(34,197,94,0.5)',
                  boxShadow: '0 0 8px rgba(34,197,94,0.15)',
                }}
              >
                {selling ? '処理中…' : '💰 売却する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
