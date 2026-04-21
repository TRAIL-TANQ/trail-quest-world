-- ======================================================================
-- 0032_fix_market_sell_child_id_type.sql
-- Commit C.1: market_sell_card の child_status.child_id 型不整合修正
--
-- 背景:
--   0031 では child_status.child_id を text として扱っていたが、本番 DB
--   では uuid 型だった (手動作成、CREATE TABLE 文が git 履歴に無い)。
--   他のテーブル (gacha_pulls / card_transactions / quest_progress 等) は
--   全て text のため、child_status だけが uuid という schema drift がある。
--   schema 統一は影響範囲が広いため別 Issue で扱う。本 migration では
--   RPC 側で明示キャストして吸収する。
--
-- 関連エビデンス:
--   - 0002_gacha.sql:22                      gacha_pulls.child_id        text
--   - 0017_parent_invite_codes.sql:11        parent_invite_codes.child_id text
--   - 0029_card_market.sql                   card_transactions.child_id  text
--   - client/src/lib/quizService.ts:273      if (!isUuid(childId)) ...
--   - 0031 適用後の実行結果                  ERROR: operator does not exist: uuid = text
--
-- 修正内容:
--   - 関数シグネチャは 0031 と同一 (p_child_id text, p_card_id text)
--   - 関数内で v_child_uuid := p_child_id::uuid へキャスト
--   - invalid_text_representation 例外を握って child_not_found で返す
--     (ゲスト / 管理者の非 UUID アカウント対策)
--   - child_status 照会 2 箇所のみ v_child_uuid を使い、他テーブルは
--     text の p_child_id のまま
--
-- 再適用安全: create or replace function で 0031 の関数を上書きする。
-- ======================================================================

set client_encoding = 'UTF8';

-- ----------------------------------------------------------------------
-- market_sell_card (0031 の上書き、child_id 型不整合修正版)
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
  v_child_uuid       uuid;
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

  -- child_status.child_id は uuid 型。RPC 入力は text で受けるため明示キャスト。
  -- UUID 形式でない文字列 (ゲスト / 管理者の Japanese child_id 等) は
  -- child_not_found として扱う (DB 側にデータが無いのと同義)。
  begin
    v_child_uuid := p_child_id::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end;

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

  -- (2) child_status.alt_points を排他ロックで取得 (uuid 比較)
  select alt_points into v_current_alt
    from public.child_status
   where child_id = v_child_uuid
   for update;

  if not found then
    return jsonb_build_object('success', false, 'reason', 'child_not_found');
  end if;

  -- (3) クールダウン判定: 同 card_id を 24 時間以内に取得していたら拒否
  --     gacha_pulls.child_id は text のため p_child_id をそのまま使う
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
  --     card_transactions.child_id は text のため p_child_id をそのまま使う
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
   where child_id = v_child_uuid;  -- uuid 比較

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
  'カードを運営に売却する RPC (0032 で child_status.child_id uuid 型対応)。'
  'child_status は uuid 型、他のテーブルは text 型という既存の schema drift を '
  'RPC 内で吸収する。UUID 形式でない child_id は child_not_found を返す。';


-- ----------------------------------------------------------------------
-- 確認クエリ (手動実行用)
-- ----------------------------------------------------------------------
--
-- -- 修正前 (0031) の関数定義がどうなっているか確認
-- select proname, prosrc
--   from pg_proc
--  where proname = 'market_sell_card'
--    and pronamespace = (select oid from pg_namespace where nspname = 'public');
--
-- -- 非 UUID テスト (child_not_found が返るはず)
-- -- select public.market_sell_card('test-child-id', 'card-001');
--
-- -- 保護カードテスト (not_sellable が返るはず、child_id の型に関わらず)
-- -- select public.market_sell_card('00000000-0000-0000-0000-000000000000', 'card-203');
--
-- -- 正常に存在しない UUID child_id (child_not_found が返るはず)
-- -- select public.market_sell_card('00000000-0000-0000-0000-000000000000', 'card-001');
