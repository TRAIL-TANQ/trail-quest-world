-- Migration: v2.0.2-02 既存30カードに counter_value 振り分け
-- 依存: 0039 (counter_value カラム存在前提)
-- 実行: 0039 の次に実行
--
-- ロジック:
--   Step 1: 全 character カードを counter_value = 1 (基本値)
--   Step 2: 強キャラ (cost 6+ destroy系 / リーダー級) は counter_value = 0 で上書き
--   Step 3: 防御トリガー持ちは counter_value = 2 で上書き
--   → 最終分布: 0=8件、1=18件、2=4件、合計30件

-- ----------------------------------------------------------------------------
-- Step 1: 基本値 = 1
-- ----------------------------------------------------------------------------
UPDATE public.battle_cards_meta
   SET counter_value = 1
 WHERE card_type = 'character';

-- ----------------------------------------------------------------------------
-- Step 2: 強キャラ counter_value = 0
-- (場に出してプレッシャーを与える設計、カウンターには使わせない)
-- ----------------------------------------------------------------------------
UPDATE public.battle_cards_meta
   SET counter_value = 0
 WHERE card_id IN (
   'card_napoleon',
   'card_nobunaga',
   'card_amazon',
   'card_giant_snake',
   'card_great_wall',
   'card_qin_shi_huang',
   'card_jeanne_saint',
   'card_wolf'
 );

-- ----------------------------------------------------------------------------
-- Step 3: 防御トリガー counter_value = 2 (上書き、card_cross は最終 +2)
-- ----------------------------------------------------------------------------
UPDATE public.battle_cards_meta
   SET counter_value = 2
 WHERE card_id IN (
   'card_anaconda',
   'card_terracotta_army',
   'card_cross',
   'card_templar'
 );

-- ----------------------------------------------------------------------------
-- 検証クエリ (実行後 kk が分布を確認、コメントのまま残置で OK)
-- ----------------------------------------------------------------------------
-- SELECT counter_value, COUNT(*) AS cnt
--   FROM public.battle_cards_meta
--  WHERE card_type = 'character'
--  GROUP BY counter_value
--  ORDER BY counter_value;
-- 期待: 0=8件、1=18件、2=4件、合計30件
