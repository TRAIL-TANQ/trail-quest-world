/**
 * Generate supabase/migrations/0030_card_market_seed.sql from the
 * card master in client/src/lib/cardData.ts.
 *
 * Output: INSERT INTO public.card_market_prices (...) VALUES (...), ...;
 *         for every card in COLLECTION_CARDS. Uses ON CONFLICT DO NOTHING
 *         so reruns are safe.
 *
 * Base prices per rarity (CARD_MARKET_SPEC.md v1.1):
 *   N   = 50       (sell 30)
 *   R   = 200      (sell 120)
 *   SR  = 1000     (sell 600)
 *   SSR = 5000     (sell 3000)
 *
 * Usage:
 *   pnpm run generate-market-prices
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { COLLECTION_CARDS } from '../client/src/lib/cardData';
import type { CollectionRarity } from '../client/src/lib/types';

const BASE_PRICE: Record<CollectionRarity, number> = {
  N: 50,
  R: 200,
  SR: 1000,
  SSR: 5000,
};

const SELL_MULTIPLIER = 0.6;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function main(): void {
  const seen = new Set<string>();
  const rows: string[] = [];
  const rarityCount: Record<CollectionRarity, number> = { N: 0, R: 0, SR: 0, SSR: 0 };

  for (const card of COLLECTION_CARDS) {
    if (seen.has(card.id)) {
      console.warn(`[skip] duplicate card_id: ${card.id}`);
      continue;
    }
    seen.add(card.id);

    const base = BASE_PRICE[card.rarity];
    if (!base) {
      console.error(`[error] unknown rarity ${card.rarity} for ${card.id}`);
      process.exit(1);
    }

    const sell = Math.round(base * SELL_MULTIPLIER);
    const escapedId = card.id.replace(/'/g, "''");
    rows.push(
      `  ('${escapedId}', '${card.rarity}', ${base}, ${base}, ${sell}, 0, 0)`,
    );
    rarityCount[card.rarity]++;
  }

  const header =
    `-- ======================================================================\n` +
    `-- 0030_card_market_seed.sql\n` +
    `-- Phase 1 (Commit B): card_market_prices 初期データ投入\n` +
    `--\n` +
    `-- 生成元: scripts/generate-market-prices.ts\n` +
    `-- 入力  : client/src/lib/cardData.ts (COLLECTION_CARDS)\n` +
    `-- 生成枚数: ${rows.length}` +
    ` (N=${rarityCount.N} / R=${rarityCount.R} / SR=${rarityCount.SR} / SSR=${rarityCount.SSR})\n` +
    `--\n` +
    `-- レアリティ別基準価格 (CARD_MARKET_SPEC.md v1.1):\n` +
    `--   N  : base=50,   buy=50,   sell=30\n` +
    `--   R  : base=200,  buy=200,  sell=120\n` +
    `--   SR : base=1000, buy=1000, sell=600\n` +
    `--   SSR: base=5000, buy=5000, sell=3000\n` +
    `--\n` +
    `-- 動的価格計算 (calculatePrice) は Commit C の RPC 内で実装予定。\n` +
    `-- ここでは初期状態 (係数 1.0 = base 価格) を投入する。\n` +
    `--\n` +
    `-- 再実行安全: on conflict (card_id) do nothing により重複 INSERT 時は\n` +
    `-- 何もしない。カード追加時は pnpm run generate-market-prices で再生成する。\n` +
    `-- ======================================================================\n`;

  const sql =
    header +
    `\n` +
    `set client_encoding = 'UTF8';\n` +
    `\n` +
    `insert into public.card_market_prices\n` +
    `  (card_id, rarity, base_price, current_buy_price, current_sell_price, total_purchases, total_sales)\n` +
    `values\n` +
    rows.join(',\n') +
    `\n` +
    `on conflict (card_id) do nothing;\n`;

  const outputPath = resolve(__dirname, '../supabase/migrations/0030_card_market_seed.sql');
  writeFileSync(outputPath, sql, 'utf-8');

  console.log(`Wrote ${rows.length} rows to ${outputPath}`);
  console.log(`  N:   ${rarityCount.N}`);
  console.log(`  R:   ${rarityCount.R}`);
  console.log(`  SR:  ${rarityCount.SR}`);
  console.log(`  SSR: ${rarityCount.SSR}`);
}

main();
