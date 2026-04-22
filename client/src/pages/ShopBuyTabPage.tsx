/**
 * ShopBuyTabPage (Commit E)
 *
 * ALTショップ「直販」タブ本体。
 * - 全 226 枚のカードを card_market_prices + COLLECTION_CARDS から表示
 * - 現在の market buy price と所持枚数を併記
 * - ALT 残高不足はボタン disabled + 「ALT不足」表示
 * - クリック → 確認ダイアログ → market_buy_card RPC → gacha_pulls に source='shop_buy' で追加
 *
 * 保護カード (NON_SELLABLE_CARD_IDS) も **購入は可能** (仕様)。
 * 売却制限との非対称性に注意。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useUserStore } from '@/lib/stores';
import { COLLECTION_CARDS } from '@/lib/cardData';
import {
  buyCard,
  buyPriceDeltaPercent,
  fetchMarketPrices,
  fetchOwnedCards,
  formatBuyErrorReason,
  type MarketPrice,
} from '@/lib/marketService';
import type { CollectionRarity } from '@/lib/types';

interface BuyEntry {
  card_id: string;
  name: string;
  rarity: CollectionRarity;
  imageUrl: string;
  description: string;
  buy_price: number;
  sell_price: number;
  base_price: number;
  owned_count: number;
}

interface Props {
  altBalance: number;
  onAltBalanceChange?: (newBalance: number) => void;
}

type RarityFilter = 'all' | CollectionRarity;
type SortKey = 'price_asc' | 'price_desc' | 'rarity';

const RARITY_ORDER: Record<CollectionRarity, number> = { SSR: 0, SR: 1, R: 2, N: 3 };
const RARITY_COLOR: Record<CollectionRarity, string> = {
  SSR: '#ef4444',
  SR: '#f59e0b',
  R: '#3b82f6',
  N: '#9ca3af',
};

export default function ShopBuyTabPage({ altBalance, onAltBalanceChange }: Props) {
  const user = useUserStore((s) => s.user);
  const updateAlt = useUserStore((s) => s.updateAlt);

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<BuyEntry[]>([]);
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('price_asc');

  const [confirmCard, setConfirmCard] = useState<BuyEntry | null>(null);
  const [buying, setBuying] = useState(false);

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

      const result: BuyEntry[] = [];
      for (const card of COLLECTION_CARDS) {
        const price = priceMap.get(card.id);
        if (!price) continue;
        result.push({
          card_id: card.id,
          name: card.name,
          rarity: card.rarity,
          imageUrl: card.imageUrl,
          description: card.description,
          buy_price: price.current_buy_price,
          sell_price: price.current_sell_price,
          base_price: price.base_price,
          owned_count: ownCounts.get(card.id) ?? 0,
        });
      }
      setEntries(result);
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ---------- Filter + Sort ----------
  const filteredSorted = useMemo(() => {
    let list = [...entries];
    if (rarityFilter !== 'all') {
      list = list.filter((c) => c.rarity === rarityFilter);
    }
    list.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          return a.buy_price - b.buy_price;
        case 'price_desc':
          return b.buy_price - a.buy_price;
        case 'rarity':
          return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
      }
    });
    return list;
  }, [entries, rarityFilter, sortBy]);

  // ---------- Buy flow ----------
  const requestBuy = (card: BuyEntry) => {
    if (altBalance < card.buy_price) {
      toast.error('ALT残高が不足しています');
      return;
    }
    setConfirmCard(card);
  };

  const doBuy = async () => {
    if (!confirmCard) return;
    setBuying(true);
    const result = await buyCard(user.id, confirmCard.card_id);
    setBuying(false);

    if (!result.success) {
      toast.error(formatBuyErrorReason(result.reason));
      setConfirmCard(null);
      return;
    }

    const spent = result.buy_price ?? 0;
    toast.success(`${confirmCard.name} を ${spent} ALT で購入しました！`);

    // Update local store (delta) + parent balance (absolute from RPC response)
    updateAlt(-spent);
    if (typeof result.alt_balance_after === 'number') {
      onAltBalanceChange?.(result.alt_balance_after);
    }

    // Reflect locally: increment owned_count, refresh prices from server response
    setEntries((prev) =>
      prev.map((c) =>
        c.card_id === confirmCard.card_id
          ? {
              ...c,
              owned_count: c.owned_count + 1,
              buy_price: result.new_buy_price ?? c.buy_price,
              sell_price: result.new_sell_price ?? c.sell_price,
            }
          : c,
      ),
    );
    setConfirmCard(null);
  };

  // ---------- Render ----------
  if (loading) {
    return <div className="text-center text-amber-200/50 text-xs py-12">読み込み中…</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl p-6 text-center text-[11px] text-amber-200/50"
        style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.15)' }}>
        直販できるカードがありません。
        <br />市場データの初期化が必要です (管理者は 0030_card_market_seed.sql を実行)。
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
          <option value="price_asc">購入価格 ↑</option>
          <option value="price_desc">購入価格 ↓</option>
          <option value="rarity">レアリティ順</option>
        </select>
        <span className="text-[10px] text-amber-200/50 ml-auto">
          全 {entries.length} 種
        </span>
      </div>

      {/* ===== Card grid ===== */}
      <div className="grid grid-cols-2 gap-3">
        {filteredSorted.map((card, i) => {
          const rarityColor = RARITY_COLOR[card.rarity];
          const deltaPct = buyPriceDeltaPercent(card.buy_price, card.base_price);
          const cannotAfford = altBalance < card.buy_price;
          return (
            <div
              key={card.card_id}
              className="rounded-xl overflow-hidden transition-all duration-200 animate-slide-up relative"
              style={{
                animationDelay: `${Math.min(i, 20) * 30}ms`,
                background:
                  'linear-gradient(135deg, rgba(21,29,59,0.95), rgba(14,20,45,0.95))',
                border: `1.5px solid ${rarityColor}55`,
                boxShadow: `0 2px 12px rgba(0,0,0,0.3), 0 0 8px ${rarityColor}15`,
              }}
            >
              <div className="aspect-square relative overflow-hidden">
                <img
                  src={card.imageUrl}
                  alt={card.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
                {/* Rarity badge (top-left) */}
                <div
                  className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    background: 'rgba(0,0,0,0.7)',
                    color: rarityColor,
                    border: `1px solid ${rarityColor}55`,
                  }}
                >
                  {card.rarity}
                </div>
                {/* Owned count badge (top-right) */}
                {card.owned_count > 0 && (
                  <div
                    className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: 'rgba(34,197,94,0.22)',
                      color: '#22c55e',
                      border: '1px solid rgba(34,197,94,0.4)',
                    }}
                  >
                    所持 {card.owned_count}
                  </div>
                )}
                {/* Trend badge (bottom-left) */}
                {deltaPct !== 0 && (
                  <div
                    className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold"
                    style={{
                      background: 'rgba(0,0,0,0.6)',
                      color: deltaPct > 0 ? '#ef4444' : '#22c55e',
                    }}
                  >
                    {deltaPct > 0 ? '↑' : '↓'} {Math.abs(deltaPct)}%
                  </div>
                )}
              </div>

              <div
                className="p-2.5"
                style={{ borderTop: `1px solid ${rarityColor}22` }}
              >
                <p className="text-xs font-bold text-amber-100 mb-1 truncate">{card.name}</p>
                <p className="text-[10px] text-amber-200/55 mb-2">
                  購入:{' '}
                  <span className="text-cyan-300 font-bold text-[11px]">{card.buy_price}</span>{' '}
                  ALT
                </p>
                <button
                  onClick={() => requestBuy(card)}
                  disabled={cannotAfford}
                  className="w-full py-1.5 rounded-lg text-[11px] font-bold transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-55"
                  style={{
                    background: cannotAfford
                      ? 'rgba(120,120,140,0.12)'
                      : 'linear-gradient(135deg, rgba(6,182,212,0.25), rgba(6,182,212,0.1))',
                    color: cannotAfford ? 'rgba(200,200,220,0.5)' : '#06b6d4',
                    border: cannotAfford
                      ? '1px solid rgba(120,120,140,0.25)'
                      : '1px solid rgba(6,182,212,0.45)',
                  }}
                >
                  {cannotAfford ? 'ALT不足' : '🏪 購入する'}
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
          onClick={() => !buying && setConfirmCard(null)}
        >
          <div
            className="rounded-xl p-4 max-w-xs w-full"
            style={{
              background:
                'linear-gradient(135deg, rgba(21,29,59,0.98), rgba(14,20,45,0.98))',
              border: '1px solid rgba(6,182,212,0.4)',
              boxShadow: '0 0 28px rgba(6,182,212,0.22)',
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
                {confirmCard.rarity}
                {confirmCard.owned_count > 0 && ` ・ 所持 ${confirmCard.owned_count} 枚`}
              </p>
            </div>

            <div
              className="text-center mb-3 p-2.5 rounded-lg"
              style={{
                background: 'rgba(6,182,212,0.08)',
                border: '1px solid rgba(6,182,212,0.22)',
              }}
            >
              <div className="text-[10px] text-amber-200/60 mb-0.5">購入価格</div>
              <div className="text-xl font-bold text-cyan-300">
                {confirmCard.buy_price}{' '}
                <span className="text-xs text-cyan-300/70 font-bold">ALT</span>
              </div>
              <div className="text-[10px] text-amber-200/50 mt-1">
                購入後の残高: {altBalance - confirmCard.buy_price} ALT
              </div>
            </div>

            <div className="text-[10px] text-amber-200/55 mb-3 leading-relaxed px-1">
              ⚠️ 購入後24時間は同じカードの売却ができません。
              本当に購入しますか？
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmCard(null)}
                disabled={buying}
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
                onClick={doBuy}
                disabled={buying}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                style={{
                  background:
                    'linear-gradient(135deg, rgba(6,182,212,0.35), rgba(6,182,212,0.15))',
                  color: '#06b6d4',
                  border: '1px solid rgba(6,182,212,0.5)',
                  boxShadow: '0 0 8px rgba(6,182,212,0.15)',
                }}
              >
                {buying ? '処理中…' : '🏪 購入する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
