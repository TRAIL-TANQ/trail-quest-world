-- Migration: v2.0.2-01 ALTER TABLE for equipment / counter / event
-- 依存: 0038 (battle_cards_meta テーブル存在前提)
-- 実行: 0038 の次に実行
--
-- 内容:
--   1. card_type CHECK 制約追加 (既存はDEFAULT 'character'のみで CHECK なし)
--   2. power カラムに DEFAULT 0 設定 (新カード INSERT で省略可能に)
--   3. v2.0.2 新規カラム 6 個 (counter_value, equipment_*, event_*)
--   4. インデックス 2 個 (card_type, equipment_target_leader_id)

-- ----------------------------------------------------------------------------
-- 1. card_type CHECK 制約
-- ----------------------------------------------------------------------------
ALTER TABLE public.battle_cards_meta
  DROP CONSTRAINT IF EXISTS battle_cards_meta_card_type_check;

ALTER TABLE public.battle_cards_meta
  ADD CONSTRAINT battle_cards_meta_card_type_check
    CHECK (card_type IN ('character', 'equipment', 'event', 'counter'));

-- ----------------------------------------------------------------------------
-- 2. power DEFAULT 0 (廃止予定だが INSERT 互換性のため、v2.1 で DROP 予定)
-- ----------------------------------------------------------------------------
ALTER TABLE public.battle_cards_meta ALTER COLUMN power SET DEFAULT 0;

-- ----------------------------------------------------------------------------
-- 3. v2.0.2 新規カラム
-- ----------------------------------------------------------------------------

-- 全カード共通: カウンター時の defense ボーナス値 (0-5)
ALTER TABLE public.battle_cards_meta
  ADD COLUMN IF NOT EXISTS counter_value integer NOT NULL DEFAULT 0
    CHECK (counter_value >= 0 AND counter_value <= 5);

-- 装備専用: 対象リーダー (FK)
ALTER TABLE public.battle_cards_meta
  ADD COLUMN IF NOT EXISTS equipment_target_leader_id text
    REFERENCES public.battle_leaders(id) ON DELETE SET NULL;

-- 装備専用: 効果種別 ('permanent' | 'per_turn' | 'once_only')
ALTER TABLE public.battle_cards_meta
  ADD COLUMN IF NOT EXISTS equipment_effect_type text
    CHECK (equipment_effect_type IN ('permanent', 'per_turn', 'once_only')
           OR equipment_effect_type IS NULL);

-- 装備専用: 効果データ (jsonb、{atk_bonus: 2} 等)
ALTER TABLE public.battle_cards_meta
  ADD COLUMN IF NOT EXISTS equipment_effect_data jsonb;

-- イベント / カウンタープレイ時: 効果種別識別子
ALTER TABLE public.battle_cards_meta
  ADD COLUMN IF NOT EXISTS event_effect_type text;

-- イベント / カウンタープレイ時: 効果データ (jsonb)
ALTER TABLE public.battle_cards_meta
  ADD COLUMN IF NOT EXISTS event_effect_data jsonb;

-- ----------------------------------------------------------------------------
-- 4. インデックス (検索パフォーマンス)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_battle_cards_meta_card_type
  ON public.battle_cards_meta(card_type);

CREATE INDEX IF NOT EXISTS idx_battle_cards_meta_equipment_target
  ON public.battle_cards_meta(equipment_target_leader_id)
  WHERE equipment_target_leader_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 検証クエリ (実行後 kk が確認用、コメントのまま残置で OK)
-- ----------------------------------------------------------------------------
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name='battle_cards_meta'
--  ORDER BY ordinal_position;
