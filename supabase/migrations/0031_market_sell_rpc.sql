-- ======================================================================
-- 0031_market_sell_rpc.sql
-- Phase 1 (Commit C): カード売却 RPC + 取引履歴取得 RPC
--
-- 実装内容 (CARD_MARKET_SPEC.md v1.1 準拠):
--   market_sell_card(p_child_id, p_card_id)
--     1. 保護カード判定 (NON_SELLABLE_CARD_IDS、10枚ハードコード)
--     2. child_status.alt_points を排他ロックで取得
--     3. 同一 card_id のクールダウン判定 (24時間以内の取得があれば拒否)
--     4. カード所持確認 (FIFO で最古の gacha_pulls 行を排他ロック)
--     5. 1日売却上限判定 (50枚/24h)
--     6. card_market_prices を排他ロックで取得
--     7. ALT 加算 + card_transactions に 'sell' で記録
--     8. gacha_pulls から最古の1行を削除 (所持枚数−1)
--     9. 動的価格再計算 (calculatePrice)
--        係数 = clamp((total_purchases - total_sales) / 50 + 1, 0.3, 3.0)
--        buy  = round(base_price * 係数)
--        sell = round(buy * 0.6)
--    10. ±30% 価格変動ガード (前日 JST の snapshot と比較)
--    11. card_market_prices.current_buy_price / current_sell_price 更新
--
--   fetch_my_card_transactions(p_child_id, p_limit)
--     本人の取引履歴を新しい順で返す。anon 全拒否な card_transactions の
--     読み取り窓口として SECURITY DEFINER で提供。
--
-- RLS / 権限:
--   - 両 RPC とも SECURITY DEFINER、anon ロールに grant execute
--   - 参考 migration: 0020_consume_invite_code.sql, 0028_admin_generate_weekly_report.sql
--
-- NON_SELLABLE_CARD_IDS は client/src/lib/knowledgeCards.ts と同期必須。
-- カード改定時は両方を更新し、Commit H のテストで整合性を保証する。
-- ======================================================================

set client_encoding = 'UTF8';

-- ----------------------------------------------------------------------
-- market_sell_card: カードを運営に売却し、ALT を受け取る
-- ----------------------------------------------------------------------
create or replace function public.market_sell_card(
  p_child_id text,
  p_card_id  text
) returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_is_protected     boolean;
  v_current_alt      integer;
  v_new_alt          integer;
  v_acquisition_id   uuid;
  v_daily_sell_count integer;
  v_base_price       integer;
  v_current_buy      integer;
  v_current_sell     integer;
  v_total_purchases  integer;
  v_total_sales      integer;
  v_new_total_sales  integer;
  v_net_demand       integer;
  v_coefficient      numeric;
  v_new_buy_price    integer;
  v_new_sell_price   integer;
  v_yesterday_buy    integer;
  v_min_buy          integer;
  v_max_buy          integer;
begin
  -- 引数バリデーション
  if p_child_id is null or p_child_id = '' then
    return jsonb_build_object('success', false, 'reason', 'child_id_required');
  end if;
  if p_card_id is null or p_card_id = '' then
    return jsonb_build_object('success', false, 'reason', 'card_id_required');
  end if;

  -- (1) 保護カード判定 (NON_SELLABLE_CARD_IDS)
  -- 進化専用7枚 + 進化トリガー3枚。
  -- client/src/lib/knowledgeCards.ts の NON_SELLABLE_CARD_IDS と同期必須。
  v_is_protected := p_card_id in (
    'card-202',  -- 聖女ジャンヌ       (SSR、進化専用)
    'card-165',  -- 大蛇                (SR,  進化専用)
    'card-206',  -- 万能の天才          (SSR、進化専用)
    'card-188',  -- 明智光秀            (SR,  進化専用)
    'card-189',  -- 愛宕百韻            (SR,  進化専用)
    'card-190',  -- 天王山              (SR,  進化専用)
    'card-191',  -- 三日天下            (SR,  進化専用)
    'card-187',  -- 本能寺の変          (SSR、進化トリガー)
    'card-163',  -- 焚書坑儒            (SSR、進化トリガー)
    'card-203'   -- 火刑                (N,   進化トリガー、低レア保護)
  );
  if v_is_protected then
    return jsonb_build_object('success', false, 'reason', 'not_sellable');
  end if;

  -- (2) child_status.alt_points を排他ロックで取得
  select alt_points into v_current_alt
    from public.child_status
   where child_id = p_child_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end if;

  -- (3) クールダウン判定: 同 card_id を 24 時間以内に取得していたら拒否
  --     (ガチャ / 直販 / クエスト報酬 / 市場購入 どの経路でも直近取得をブロック)
  if exists (
    select 1
      from public.gacha_pulls
     where child_id = p_child_id
       and card_id  = p_card_id
       and pulled_at > now() - interval '24 hours'
  ) then
    return jsonb_build_object('success', false, 'reason', 'cooldown_24h');
  end if;

  -- (4) カード所持確認 (FIFO で最古の 1 行を排他ロック)
  select id into v_acquisition_id
    from public.gacha_pulls
   where child_id = p_child_id
     and card_id  = p_card_id
   order by pulled_at asc
   limit 1
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'card_not_owned');
  end if;

  -- (5) 1 日売却上限判定 (50 枚/24 時間)
  select count(*) into v_daily_sell_count
    from public.card_transactions
   where child_id          = p_child_id
     and transaction_type  = 'sell'
     and created_at        > now() - interval '24 hours';

  if v_daily_sell_count >= 50 then
    return jsonb_build_object('success', false, 'reason', 'daily_sell_limit');
  end if;

  -- (6) 価格マスタを排他ロックで取得
  select base_price, current_buy_price, current_sell_price, total_purchases, total_sales
    into v_base_price, v_current_buy, v_current_sell, v_total_purchases, v_total_sales
    from public.card_market_prices
   where card_id = p_card_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'card_not_listed');
  end if;

  -- (7) ALT 加算 + 取引履歴記録
  v_new_alt := v_current_alt + v_current_sell;

  update public.child_status
     set alt_points = v_new_alt
   where child_id = p_child_id;

  insert into public.card_transactions
    (child_id, card_id, transaction_type, price, alt_balance_after)
    values
    (p_child_id, p_card_id, 'sell', v_current_sell, v_new_alt);

  -- (8) 所持レコード削除 (FIFO、最古の 1 行)
  delete from public.gacha_pulls where id = v_acquisition_id;

  -- (9) 動的価格再計算 (calculatePrice)
  --     売却完了後の total_sales で再計算する (売却の影響を反映させる)
  v_new_total_sales := v_total_sales + 1;
  v_net_demand      := v_total_purchases - v_new_total_sales;
  v_coefficient     := greatest(0.3, least(3.0, (v_net_demand::numeric / 50.0) + 1.0));
  v_new_buy_price   := round(v_base_price * v_coefficient)::integer;

  -- (10) ±30% 価格変動ガード (前日 JST スナップショット比)
  --      card_price_history に前日 (Asia/Tokyo) の行がある場合のみ適用。
  --      初日などスナップショットが無い期間はガード無し (係数クランプのみ)。
  select buy_price into v_yesterday_buy
    from public.card_price_history
   where card_id       = p_card_id
     and snapshot_date = ((now() at time zone 'Asia/Tokyo')::date - 1)
   limit 1;

  if v_yesterday_buy is not null then
    v_min_buy := ceil (v_yesterday_buy * 0.7)::integer;
    v_max_buy := floor(v_yesterday_buy * 1.3)::integer;
    if v_new_buy_price < v_min_buy then
      v_new_buy_price := v_min_buy;
    elsif v_new_buy_price > v_max_buy then
      v_new_buy_price := v_max_buy;
    end if;
  end if;

  -- CHECK 制約 (current_buy_price > 0, current_sell_price > 0) を満たすよう下限保証
  if v_new_buy_price < 1 then
    v_new_buy_price := 1;
  end if;
  v_new_sell_price := greatest(1, round(v_new_buy_price * 0.6)::integer);

  -- (11) 価格マスタ更新
  update public.card_market_prices
     set total_sales        = v_new_total_sales,
         current_buy_price  = v_new_buy_price,
         current_sell_price = v_new_sell_price,
         last_updated       = now()
   where card_id = p_card_id;

  return jsonb_build_object(
    'success',           true,
    'sell_price',        v_current_sell,
    'alt_balance_after', v_new_alt,
    'new_buy_price',     v_new_buy_price,
    'new_sell_price',    v_new_sell_price,
    'coefficient',       v_coefficient,
    'net_demand',        v_net_demand
  );
end;
$$;

grant execute on function public.market_sell_card(text, text) to anon;

comment on function public.market_sell_card is
  'カードを運営に売却する RPC。SELECT FOR UPDATE で排他制御し、売却後に'
  '動的価格再計算 (calculatePrice) と ±30% ガードを適用して card_market_prices を'
  '更新する。NON_SELLABLE_CARD_IDS (10 枚) は拒否する。';


-- ----------------------------------------------------------------------
-- fetch_my_card_transactions: 本人の取引履歴を新しい順で返す
--   card_transactions は anon 全拒否 RLS のため、読み取りはこの RPC 経由。
-- ----------------------------------------------------------------------
create or replace function public.fetch_my_card_transactions(
  p_child_id text,
  p_limit    integer default 50
) returns setof public.card_transactions
security definer
set search_path = public
language sql
stable
as $$
  select *
    from public.card_transactions
   where child_id = p_child_id
   order by created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

grant execute on function public.fetch_my_card_transactions(text, integer) to anon;

comment on function public.fetch_my_card_transactions is
  '本人の card_transactions を新しい順で返す SECURITY DEFINER 窓口。'
  'p_limit は 1〜500 にクランプされる。';


-- ----------------------------------------------------------------------
-- 確認クエリ (手動実行用、本 migration では実行しない)
-- ----------------------------------------------------------------------
--
-- -- 関数の存在確認
-- select proname, prosecdef, pg_catalog.pg_get_function_result(oid)
--   from pg_proc
--  where proname in ('market_sell_card', 'fetch_my_card_transactions')
--    and pronamespace = (select oid from pg_namespace where nspname = 'public');
--
-- -- 実行権限確認 (anon が execute 可能か)
-- select r.rolname, p.proname,
--        has_function_privilege(r.oid, p.oid, 'execute') as can_exec
--   from pg_proc p
--   cross join pg_roles r
--  where p.proname in ('market_sell_card', 'fetch_my_card_transactions')
--    and p.pronamespace = (select oid from pg_namespace where nspname = 'public')
--    and r.rolname = 'anon';
--
-- -- 動作テスト (gacha_pulls に該当 child / card の行が必要)
-- -- select public.market_sell_card('test_child', 'card-001');
-- -- select * from public.fetch_my_card_transactions('test_child', 10);
