-- ======================================================================
-- 0029_card_market.sql
-- Phase 1 (Commit A): カード市場機能 DDL
--
--   3 新規テーブル:
--     card_market_prices    : 価格マスタ (カード毎の現在価格)
--     card_transactions     : 取引履歴 (監査 + 損益計算)
--     card_price_history    : 価格履歴 (日次スナップショット)
--
--   既存テーブル拡張:
--     gacha_pulls に source カラム追加
--       ('gacha' | 'shop_buy' | 'quest_reward' | 'market_buy')
--     既存データは DEFAULT により全て 'gacha' として扱う。
--
-- RLS 方針 (CARD_MARKET_SPEC.md v1.1 準拠):
--   - 価格マスタ / 価格履歴    → anon SELECT 公開、書き込みは SECURITY DEFINER RPC 経由のみ
--   - 取引履歴                 → anon 全拒否、読み取りも専用 RPC 経由
--   - このプロジェクトは Supabase Auth 未導入のため auth.uid() は使わない
--   - 参考 migration: 0020_consume_invite_code.sql, 0028_admin_generate_weekly_report.sql
--
-- 本 migration には初期データ投入は含めない (Commit B 以降)。
-- RPC 実装も含めない (Commit C 以降)。
-- ======================================================================

set client_encoding = 'UTF8';

-- ---------- card_market_prices ----------
-- 価格マスタ。1 card_id = 1 row。
-- 全ユーザーが SELECT 可能 (価格は公開情報)。
-- INSERT/UPDATE/DELETE は SECURITY DEFINER RPC 経由のみ。
create table if not exists public.card_market_prices (
  card_id            text primary key,
  rarity             text        not null check (rarity in ('N', 'R', 'SR', 'SSR')),
  base_price         integer     not null check (base_price > 0),
  current_buy_price  integer     not null check (current_buy_price > 0),
  current_sell_price integer     not null check (current_sell_price > 0),
  total_purchases    integer     not null default 0 check (total_purchases >= 0),
  total_sales        integer     not null default 0 check (total_sales >= 0),
  last_updated       timestamptz not null default now()
);

comment on table public.card_market_prices is
  'カード市場の現在価格マスタ。価格は RPC 経由でのみ更新される。';
comment on column public.card_market_prices.current_buy_price is
  '現在の購入価格 (プレイヤーが運営から買う時の価格)';
comment on column public.card_market_prices.current_sell_price is
  '現在の売却価格 (プレイヤーが運営に売る時の価格 = 買取価格)';

alter table public.card_market_prices enable row level security;

-- 読み取りは全員 (価格は公開情報)
drop policy if exists "public_read_card_market_prices" on public.card_market_prices;
create policy "public_read_card_market_prices"
  on public.card_market_prices
  for select
  using (true);

-- INSERT/UPDATE/DELETE ポリシーは作らない → anon 書き込み不可
-- SECURITY DEFINER RPC (postgres/service_role) からは書き込み可能


-- ---------- card_transactions ----------
-- 取引履歴。監査用、ALT残高スナップショットを保持。
-- 残高の正本は child_status.alt_points (本テーブルの alt_balance_after は監査情報)。
create table if not exists public.card_transactions (
  id                uuid        primary key default gen_random_uuid(),
  child_id          text        not null,
  card_id           text        not null,
  transaction_type  text        not null check (transaction_type in ('buy', 'sell')),
  price             integer     not null check (price > 0),
  alt_balance_after integer     not null,
  created_at        timestamptz not null default now()
);

comment on table public.card_transactions is
  'カード市場の取引履歴。全 buy/sell を記録する監査ログ。';
comment on column public.card_transactions.alt_balance_after is
  '取引後の ALT 残高 (監査用スナップショット。正本は child_status.alt_points)';

create index if not exists idx_card_transactions_child
  on public.card_transactions (child_id, created_at desc);
create index if not exists idx_card_transactions_card
  on public.card_transactions (card_id, created_at desc);

alter table public.card_transactions enable row level security;

-- anon は全操作拒否。読み取りも fetch_my_card_transactions RPC 経由。
drop policy if exists "deny_anon_card_transactions" on public.card_transactions;
create policy "deny_anon_card_transactions"
  on public.card_transactions
  for all
  to anon
  using (false)
  with check (false);


-- ---------- card_price_history ----------
-- 価格履歴。日次スナップショット (毎日 00:05 JST にバッチ投入想定、Phase 3)。
-- チャート表示 + 日次価格変動ガード (±30%) の基準値として利用。
create table if not exists public.card_price_history (
  id               uuid        primary key default gen_random_uuid(),
  card_id          text        not null,
  snapshot_date    date        not null,
  buy_price        integer     not null check (buy_price > 0),
  sell_price       integer     not null check (sell_price > 0),
  daily_purchases  integer     not null default 0 check (daily_purchases >= 0),
  daily_sales      integer     not null default 0 check (daily_sales >= 0),
  created_at       timestamptz not null default now(),
  unique (card_id, snapshot_date)
);

comment on table public.card_price_history is
  '価格の日次スナップショット。チャート表示と価格変動ガードの基準値。';

create index if not exists idx_card_price_history_card_date
  on public.card_price_history (card_id, snapshot_date desc);

alter table public.card_price_history enable row level security;

-- 読み取りは全員 (チャート表示のため)
drop policy if exists "public_read_card_price_history" on public.card_price_history;
create policy "public_read_card_price_history"
  on public.card_price_history
  for select
  using (true);

-- INSERT/UPDATE/DELETE ポリシーは作らない → anon 書き込み不可
-- 日次バッチ (Edge Function + service_role) から書き込む


-- ---------- gacha_pulls 拡張 ----------
-- カード取得経路を記録する source カラムを追加。
-- v1.1 で child_card_acquisitions 新規テーブル案を廃止し、gacha_pulls を
-- 全カード取得履歴の正本として統一 (source で区別)。
--
-- 既存レコードは DEFAULT 'gacha' により自動的に 'gacha' として扱われる。
alter table public.gacha_pulls
  add column if not exists source text not null default 'gacha'
    check (source in ('gacha', 'shop_buy', 'quest_reward', 'market_buy'));

comment on column public.gacha_pulls.source is
  'カード取得経路: gacha (ガチャ) / shop_buy (直販) / quest_reward (クエスト報酬) / market_buy (市場購入)';

-- 市場購入時のクールダウン判定 (同一card_idの最新pulled_at) 用インデックス
create index if not exists idx_gacha_pulls_child_card_date
  on public.gacha_pulls (child_id, card_id, pulled_at desc);


-- ---------- 確認クエリ (手動実行用、本 migration では実行しない) ----------
-- 以下のクエリで本 migration の適用結果を確認できる:
--
--   -- テーブル存在確認
--   select table_name from information_schema.tables
--    where table_schema = 'public'
--      and table_name in ('card_market_prices', 'card_transactions', 'card_price_history');
--
--   -- RLS状態確認
--   select c.relname, c.relrowsecurity, c.relforcerowsecurity
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and c.relname in ('card_market_prices', 'card_transactions', 'card_price_history');
--
--   -- ポリシー確認
--   select schemaname, tablename, policyname, cmd, roles, qual
--     from pg_policies
--    where schemaname = 'public'
--      and tablename in ('card_market_prices', 'card_transactions', 'card_price_history');
--
--   -- gacha_pulls.source 追加確認
--   select column_name, data_type, column_default
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name = 'gacha_pulls'
--      and column_name = 'source';
