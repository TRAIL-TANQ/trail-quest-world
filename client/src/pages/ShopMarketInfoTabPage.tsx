/**
 * ShopMarketInfoTabPage (Commit F)
 *
 * ALTショップ「市場情報」タブ本体 (Phase 1 簡易版)。
 * 既存の fetchMarketPrices() だけでデータ取得、新 RPC なし。
 *
 * Phase 1 の 3 セクション:
 *   🔥 高騰中 TOP5      : (current_buy_price - base_price) / base_price 降順
 *   📉 暴落中 TOP5      : 同 ratio 昇順 (負値優先)
 *   💰 最も取引された TOP5 : total_purchases + total_sales 降順
 *
 * Phase 2 へ先送り (意図的にスコープ外):
 *   - カード詳細モーダル
 *   - 全件検索/ソート (直販タブと機能重複のため)
 *   - 日次スナップショット / 7日チャート
 *   - 市場ニュース
 */
import { useEffect, useMemo, useState } from 'react';

import { COLLECTION_CARDS } from '@/lib/cardData';
import { fetchMarketPrices, type MarketPrice } from '@/lib/marketService';
import type { CollectionRarity } from '@/lib/types';

const RARITY_COLOR: Record<CollectionRarity, string> = {
  SSR: '#ef4444',
  SR: '#f59e0b',
  R: '#3b82f6',
  N: '#9ca3af',
};

const RISING_COLOR = '#ef4444';   // 赤 — 高騰
const FALLING_COLOR = '#3b82f6';  // 青 — 暴落
const TRADED_COLOR = '#f59e0b';   // 橙 — 取引数

interface MarketEntry extends MarketPrice {
  name: string;
  imageUrl: string;
  delta: number;          // (current_buy - base) / base
  totalTrades: number;    // total_purchases + total_sales
}

function resolveEntries(prices: MarketPrice[]): MarketEntry[] {
  const out: MarketEntry[] = [];
  for (const p of prices) {
    const card = COLLECTION_CARDS.find((c) => c.id === p.card_id);
    if (!card) continue; // cardData にないカード (旧 seed など) は除外
    const delta = p.base_price > 0
      ? (p.current_buy_price - p.base_price) / p.base_price
      : 0;
    out.push({
      ...p,
      name: card.name,
      imageUrl: card.imageUrl,
      delta,
      totalTrades: p.total_purchases + p.total_sales,
    });
  }
  return out;
}

function formatPct(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

// ======================================================================
// Entry row (1 card)
// ======================================================================
function MarketRow({
  entry,
  badge,
  badgeColor,
}: {
  entry: MarketEntry;
  badge: string;
  badgeColor: string;
}) {
  const rarityColor = RARITY_COLOR[entry.rarity];
  return (
    <div
      className="flex items-center gap-3 p-2 rounded-lg transition-all"
      style={{
        background: 'rgba(21,29,59,0.6)',
        border: '1px solid rgba(255,215,0,0.08)',
      }}
    >
      <div
        className="w-12 h-12 rounded-lg flex-shrink-0 overflow-hidden"
        style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${rarityColor}55` }}
      >
        <img
          src={entry.imageUrl}
          alt={entry.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span
            className="px-1.5 py-0.5 rounded text-[9px] font-black leading-none"
            style={{
              background: `${rarityColor}22`,
              color: rarityColor,
              border: `1px solid ${rarityColor}55`,
            }}
          >
            {entry.rarity}
          </span>
          <span className="text-[12px] font-bold text-amber-100 truncate">
            {entry.name}
          </span>
        </div>
        <div className="text-[10px] text-amber-200/60">
          買 <span style={{ color: '#fcd34d' }}>{entry.current_buy_price}</span>
          {' / '}
          売 <span style={{ color: '#fcd34d' }}>{entry.current_sell_price}</span>
        </div>
      </div>
      <div
        className="px-2 py-1 rounded text-[11px] font-black leading-none flex-shrink-0"
        style={{
          background: `${badgeColor}22`,
          color: badgeColor,
          border: `1px solid ${badgeColor}55`,
        }}
      >
        {badge}
      </div>
    </div>
  );
}

// ======================================================================
// Section (1 TOP5 block)
// ======================================================================
function Section({
  title,
  color,
  entries,
  emptyMsg,
  badgeFor,
}: {
  title: string;
  color: string;
  entries: MarketEntry[];
  emptyMsg: string;
  badgeFor: (e: MarketEntry) => string;
}) {
  return (
    <div
      className="rounded-xl p-3"
      style={{
        background: 'linear-gradient(135deg, rgba(21,29,59,0.9), rgba(14,20,45,0.9))',
        border: `1px solid ${color}33`,
        boxShadow: `0 2px 12px rgba(0,0,0,0.3), inset 0 0 16px ${color}08`,
      }}
    >
      <h2
        className="text-sm font-black mb-2"
        style={{ color, textShadow: `0 0 10px ${color}55` }}
      >
        {title}
      </h2>
      {entries.length === 0 ? (
        <div
          className="text-center text-[11px] py-6 rounded-lg"
          style={{
            background: 'rgba(255,255,255,0.02)',
            color: 'rgba(255,215,0,0.45)',
          }}
        >
          {emptyMsg}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((e) => (
            <MarketRow
              key={e.card_id}
              entry={e}
              badge={badgeFor(e)}
              badgeColor={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ======================================================================
// Main page
// ======================================================================
export default function ShopMarketInfoTabPage() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<MarketEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const prices = await fetchMarketPrices();
      if (cancelled) return;
      setEntries(resolveEntries(prices));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const { rising, falling, traded } = useMemo(() => {
    const rising = [...entries]
      .filter((e) => e.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 5);

    const falling = [...entries]
      .filter((e) => e.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 5);

    const traded = [...entries]
      .sort((a, b) => b.totalTrades - a.totalTrades)
      .slice(0, 5);

    return { rising, falling, traded };
  }, [entries]);

  if (loading) {
    return (
      <div className="text-center text-amber-200/50 text-xs py-12">
        市場データを読み込み中…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="rounded-xl p-6 text-center text-[11px] text-amber-200/50"
        style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}
      >
        市場データがありません。
        <br />管理者は 0030_card_market_seed.sql を実行してください。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* PC: 2列 (高騰 + 暴落) / モバイル: 1列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Section
          title="🔥 高騰中 TOP5"
          color={RISING_COLOR}
          entries={rising}
          emptyMsg="まだ高騰カードはありません"
          badgeFor={(e) => formatPct(e.delta)}
        />
        <Section
          title="📉 暴落中 TOP5"
          color={FALLING_COLOR}
          entries={falling}
          emptyMsg="まだ暴落カードはありません"
          badgeFor={(e) => formatPct(e.delta)}
        />
      </div>

      {/* 取引数 TOP5: フル幅 */}
      <Section
        title="💰 最も取引された TOP5"
        color={TRADED_COLOR}
        entries={traded}
        emptyMsg="まだ取引データがありません"
        badgeFor={(e) => `${e.totalTrades} 回`}
      />
    </div>
  );
}
