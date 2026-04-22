-- ======================================================================
-- 0035_market_buy_rpc.sql
-- Phase 1 (Commit E): 直販購入 RPC (market_buy_card)
--
-- 実装内容 (CARD_MARKET_SPEC.md v1.1 準拠):
--   market_buy_card(p_child_id, p_card_id)
--     1. 引数バリデーション (child_id, card_id)
--     2. child_status UPSERT + 排他ロックで取得 (0034 と同じパターン)
--     3. 1日購入上限判定 (100 枚/24h)
--     4. card_market_prices を排他ロックで取得
--     5. ALT 残高チェック → insufficient_alt
--     6. ALT 減算
--     7. card_transactions に 'buy' で記録
--     8. gacha_pulls に source='shop_buy' で INSERT (カード付与)
--     9. 動的価格再計算 (total_purchases += 1)
--    10. ±30% 価格変動ガード (前日 JST スナップショット比)
--    11. card_market_prices.current_buy_price / current_sell_price 更新
--
-- 売却 (0034) との差分:
--   - 保護カード判定なし (NON_SELLABLE は売却のみ、購入は全カード可)
--   - クールダウン判定なし (購入は即可能、24h はあくまで sell のみ)
--   - 1日上限は 100 枚 (売却の 50 より甘い)
--   - ALT は減算、total_purchases を 1 加算
--   - gacha_pulls に新規行 INSERT (source='shop_buy')
--
-- RLS / 権限:
--   SECURITY DEFINER、anon ロールに grant execute。
-- ======================================================================

set client_encoding = 'UTF8';

-- ----------------------------------------------------------------------
-- market_buy_card: カードを運営から購入し、ALT を支払う
-- ----------------------------------------------------------------------
create or replace function public.market_buy_card(
  p_child_id text,
  p_card_id  text
) returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_current_alt       integer;
  v_new_alt           integer;
  v_daily_buy_count   integer;
  v_rarity            text;
  v_base_price        integer;
  v_current_buy       integer;
  v_current_sell      integer;
  v_total_purchases   integer;
  v_total_sales       integer;
  v_new_total_purch   integer;
  v_net_demand        integer;
  v_coefficient       numeric;
  v_new_buy_price     integer;
  v_new_sell_price    integer;
  v_yesterday_buy     integer;
  v_min_buy           integer;
  v_max_buy           integer;
begin
  -- 引数バリデーション
  if p_child_id is null or p_child_id = '' then
    return jsonb_build_object('success', false, 'reason', 'child_id_required');
  end if;
  if p_card_id is null or p_card_id = '' then
    return jsonb_build_object('success', false, 'reason', 'card_id_required');
  end if;

  -- (1) child_status UPSERT + 排他ロック
  --     行が無ければ level=1/xp=0/alt_points=0 で作成、既存行は触らない。
  insert into public.child_status (child_id, level, xp, alt_points)
    values (p_child_id, 1, 0, 0)
    on conflict (child_id) do nothing;

  select alt_points into v_current_alt
    from public.child_status
   where child_id = p_child_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end if;

  -- (2) 1 日購入上限判定 (100 枚/24 時間)
  select count(*) into v_daily_buy_count
    from public.card_transactions
   where child_id          = p_child_id
     and transaction_type  = 'buy'
     and created_at        > now() - interval '24 hours';

  if v_daily_buy_count >= 100 then
    return jsonb_build_object('success', false, 'reason', 'daily_buy_limit');
  end if;

  -- (3) 価格マスタを排他ロックで取得
  select rarity, base_price, current_buy_price, current_sell_price,
         total_purchases, total_sales
    into v_rarity, v_base_price, v_current_buy, v_current_sell,
         v_total_purchases, v_total_sales
    from public.card_market_prices
   where card_id = p_card_id
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'card_not_listed');
  end if;

  -- (4) ALT 残高チェック
  if v_current_alt < v_current_buy then
    return jsonb_build_object(
      'success',      false,
      'reason',       'insufficient_alt',
      'required_alt', v_current_buy,
      'current_alt',  v_current_alt
    );
  end if;

  -- (5) ALT 減算
  v_new_alt := v_current_alt - v_current_buy;
  update public.child_status
     set alt_points = v_new_alt
   where child_id = p_child_id;

  -- (6) 取引履歴記録
  insert into public.card_transactions
    (child_id, card_id, transaction_type, price, alt_balance_after)
    values
    (p_child_id, p_card_id, 'buy', v_current_buy, v_new_alt);

  -- (7) カード付与 (gacha_pulls に新規行 INSERT)
  --     source='shop_buy' で市場経由の取得と区別。
  --     gacha_type は 'normal' 固定 (shop_buy はガチャではないが、
  --     CHECK 制約内の値から選択)。pity_count は 0。
  insert into public.gacha_pulls
    (child_id, card_id, rarity, gacha_type, pity_count, source)
    values
    (p_child_id, p_card_id, v_rarity, 'normal', 0, 'shop_buy');

  -- (8) 動的価格再計算 (calculatePrice)
  --     購入後の total_purchases で再計算 (購入の影響を反映)。
  v_new_total_purch := v_total_purchases + 1;
  v_net_demand      := v_new_total_purch - v_total_sales;
  v_coefficient     := greatest(0.3, least(3.0, (v_net_demand::numeric / 50.0) + 1.0));
  v_new_buy_price   := round(v_base_price * v_coefficient)::integer;

  -- (9) ±30% 価格変動ガード (前日 JST スナップショット比)
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

  if v_new_buy_price < 1 then
    v_new_buy_price := 1;
  end if;
  v_new_sell_price := greatest(1, round(v_new_buy_price * 0.6)::integer);

  -- (10) 価格マスタ更新
  update public.card_market_prices
     set total_purchases    = v_new_total_purch,
         current_buy_price  = v_new_buy_price,
         current_sell_price = v_new_sell_price,
         last_updated       = now()
   where card_id = p_card_id;

  return jsonb_build_object(
    'success',           true,
    'buy_price',         v_current_buy,
    'alt_balance_after', v_new_alt,
    'new_buy_price',     v_new_buy_price,
    'new_sell_price',    v_new_sell_price,
    'coefficient',       v_coefficient,
    'net_demand',        v_net_demand
  );
end;
$$;

grant execute on function public.market_buy_card(text, text) to anon;

comment on function public.market_buy_card is
  '直販購入 RPC (0035)。current_buy_price で ALT を減算、gacha_pulls に '
  'source=''shop_buy'' で新規行 INSERT。購入後に動的価格再計算 + ±30% ガード。'
  '保護カード判定・クールダウンは無し (購入は即可)。1日上限 100 枚。';


-- ----------------------------------------------------------------------
-- 確認クエリ (手動実行用)
-- ----------------------------------------------------------------------
--
-- -- 関数存在 + 実行権限確認
-- select r.rolname, has_function_privilege(r.oid, p.oid, 'execute') as can_exec
--   from pg_proc p cross join pg_roles r
--  where p.proname = 'market_buy_card'
--    and p.pronamespace = (select oid from pg_namespace where nspname='public')
--    and r.rolname in ('anon','authenticated','service_role');
-- 期待: 3 行、全て can_exec=true
--
-- -- 残高不足テスト (child_status の alt_points を少なめにしてから)
-- -- select public.market_buy_card('個別_テスト', 'card-202'); -- SSR=5000
-- 期待: {"success": false, "reason": "insufficient_alt",
--        "required_alt": 5000, "current_alt": ...}
--
-- -- 正常購入テスト (十分な残高がある child_id で)
-- -- select public.market_buy_card('個別_テスト', 'card-011'); -- N=50
-- 期待: {"success": true, "buy_price": 50, "alt_balance_after": <残高-50>, ...}
-- -- 続けて確認: gacha_pulls に source='shop_buy' 行が増えたか
-- -- select * from public.gacha_pulls where child_id='個別_テスト' order by pulled_at desc limit 1;
