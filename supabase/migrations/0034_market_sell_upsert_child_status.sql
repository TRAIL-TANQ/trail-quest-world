-- ======================================================================
-- 0034_market_sell_upsert_child_status.sql
-- Commit D.1: market_sell_card の child_status 対応更新
--
-- 変更点 (0032 からの差分):
--   1. 0033 で child_status.child_id が text 化されたため、v_child_uuid の
--      cast ロジック (0032 で追加) を撤廃。RPC 内の比較を text = text に戻す。
--   2. child_status 行が存在しない場合に自動作成する UPSERT を追加。
--      現状 child_status は空で、pinService.ts からの INSERT も uuid 型
--      不整合で失敗してきた歴史がある。市場機能の初回使用時に行を作成し、
--      以降の sell は通常通り UPDATE。
--      初期値: level=1, xp=0, alt_points=0。localStorage の累積 ALT は
--      別 Issue で移行。
--
-- create or replace function で 0031 / 0032 の関数定義を上書きする。
-- NON_SELLABLE_CARD_IDS は client/src/lib/knowledgeCards.ts と同期必須。
-- ======================================================================

set client_encoding = 'UTF8';

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
  -- 進化専用 7 枚 + 進化トリガー 3 枚。
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

  -- (2) child_status UPSERT + 排他ロック取得
  --     pinService.ts からの初期化が過去に失敗してきたため、ここで初期化を兼ねる。
  --     既存行があれば何もせず、無ければ level=1/xp=0/alt_points=0 で作成。
  --     child_id に PK / unique 制約がある前提で on conflict do nothing。
  insert into public.child_status (child_id, level, xp, alt_points)
    values (p_child_id, 1, 0, 0)
    on conflict (child_id) do nothing;

  select alt_points into v_current_alt
    from public.child_status
    where child_id = p_child_id
    for update;

  if not found then
    -- 通常ここには来ない (直前の INSERT で保証されるはず)。
    -- on conflict 対象の制約が無いなど、DB schema 異常時の fail-safe。
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end if;

  -- (3) クールダウン判定: 同 card_id を 24 時間以内に取得していたら拒否
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
  v_new_total_sales := v_total_sales + 1;
  v_net_demand      := v_total_purchases - v_new_total_sales;
  v_coefficient     := greatest(0.3, least(3.0, (v_net_demand::numeric / 50.0) + 1.0));
  v_new_buy_price   := round(v_base_price * v_coefficient)::integer;

  -- (10) ±30% 価格変動ガード (前日 JST スナップショット比)
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
  'カード売却 RPC (0034 版)。0033 で child_status.child_id が text 化された'
  'ことを前提。child_status 行が無ければ UPSERT で初期化してから売却処理。'
  '他のロジック (排他ロック / 24h クールダウン / 50/日 / 動的価格 / ±30% ガード)'
  'は 0031 と同じ。';


-- ----------------------------------------------------------------------
-- 確認クエリ (手動実行用)
-- ----------------------------------------------------------------------
--
-- -- 関数が 0034 の内容で置き換わったか確認
-- select left(prosrc, 200) as head
--   from pg_proc
--  where proname = 'market_sell_card'
--    and pronamespace = (select oid from pg_namespace where nspname = 'public');
--
-- -- テスト: text child_id でエラーにならないこと
-- -- select public.market_sell_card('個別_テスト', 'card-001');
-- -- 期待: "card_not_owned" (child_status は自動作成される)
--
-- -- 自動作成された child_status 行を確認
-- -- select * from public.child_status where child_id = '個別_テスト';
-- -- 期待: 1 行 (level=1, xp=0, alt_points=0)
