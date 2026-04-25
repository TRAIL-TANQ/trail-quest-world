-- Migration: v2.0.2-03 装備カード 10 枚 INSERT
-- 依存: 0039 (新カラム存在前提)
-- 実行: 0040 の次に実行
--
-- 装備の効果種別:
--   permanent : 永続 (装備中ずっと有効)
--   per_turn  : 毎ターン (cost フェイズで発動)
--   once_only : 1回限り (装備時に一度だけ発動)
--
-- 画像 (Manus Pro 生成済 + 既存流用):
--   eq_napoleon_bicorne     → /images/cards/napoleon-bicorne.png   (Manus 生成)
--   eq_nobunaga_matchlock   → /images/cards/gun.png                 (既存流用)
--   eq_davinci_codex        → /images/cards/research-notes.png      (既存流用)
--   eq_galileo_telescope    → /images/cards/telescope.png           (既存流用)
--   eq_murasaki_genji       → /images/cards/tale-of-genji.png       (既存流用)
--   eq_seishonagon_pillowbook → /images/cards/makura-no-soshi.png   (既存流用)
--   eq_amazon_blessing      → /images/cards/amazon-blessing.png     (Manus 生成)
--   eq_wolf_howl            → /images/cards/moonlight-howl.png      (既存流用)
--   eq_jeanne_holysword     → /images/cards/holy-sword.png          (既存流用)
--   eq_qin_wallstone        → /images/cards/great-wall.png          (既存流用)
--
-- カード名: TS 側 (battleService.ts CARD_IMAGE_OVERRIDES + 別名前マスタ) で管理
-- (Phase 2 で 35 件追加予定)

INSERT INTO public.battle_cards_meta (
  card_id, color, cost, attack_power, defense_power,
  is_leader, card_type, trigger_type, counter_value,
  equipment_target_leader_id,
  equipment_effect_type, equipment_effect_data,
  effect_text
) VALUES
  -- ナポレオン: 三角帽 (永続 atk +2)
  ('eq_napoleon_bicorne', 'red', 3, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_napoleon',
   'permanent', '{"atk_bonus": 2}'::jsonb,
   'リーダー攻撃力 +2 (永続)'),

  -- 信長: 火縄銃 (永続 atk +3, def -1)
  ('eq_nobunaga_matchlock', 'red', 4, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_nobunaga',
   'permanent', '{"atk_bonus": 3, "def_bonus": -1}'::jsonb,
   'リーダー攻撃力 +3、防御力 -1 (永続)'),

  -- ダ・ヴィンチ: 万能手帳 (毎ターン +1 ドロー)
  ('eq_davinci_codex', 'blue', 3, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_davinci',
   'per_turn', '{"draw_per_turn": 1}'::jsonb,
   'コストフェイズ毎にカードを 1 枚ドロー'),

  -- ガリレオ: 望遠鏡 (毎ターン 相手手札1枚見る)
  ('eq_galileo_telescope', 'blue', 4, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_galileo',
   'per_turn', '{"reveal_opponent_hand": 1}'::jsonb,
   'コストフェイズ毎に相手手札 1 枚見る'),

  -- 紫式部: 源氏物語 (永続 max hand +2)
  ('eq_murasaki_genji', 'blue', 4, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_murasaki',
   'permanent', '{"max_hand_bonus": 2}'::jsonb,
   '手札上限 +2 (永続)'),

  -- 清少納言: 枕草子 (1回限り 墓地→手札)
  ('eq_seishonagon_pillowbook', 'blue', 3, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_sei_shonagon',
   'once_only', '{"revive_from_graveyard": 1}'::jsonb,
   '装備時、墓地から好きなカード 1 枚を手札に戻す (1回限り)'),

  -- アマゾン: 大河の祝福 (永続 def +3)
  ('eq_amazon_blessing', 'green', 4, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_amazon',
   'permanent', '{"def_bonus": 3}'::jsonb,
   'リーダー防御力 +3 (永続)'),

  -- オオカミ: 月夜の遠吠え (永続 自身atk+1, 味方atk+1)
  ('eq_wolf_howl', 'green', 3, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_wolf',
   'permanent', '{"atk_bonus": 1, "ally_atk_bonus": 1}'::jsonb,
   'リーダー攻撃力 +1、味方キャラ全員 atk +1 (永続)'),

  -- ジャンヌ: 聖剣 (永続 atk +3)
  ('eq_jeanne_holysword', 'yellow', 4, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_jeanne',
   'permanent', '{"atk_bonus": 3}'::jsonb,
   'リーダー攻撃力 +3 (永続)'),

  -- 始皇帝: 万里の長城の石 (永続 def +4)
  ('eq_qin_wallstone', 'purple', 5, 0, 0,
   false, 'equipment', NULL, 0,
   'leader_qin',
   'permanent', '{"def_bonus": 4}'::jsonb,
   'リーダー防御力 +4 (永続)');

-- ----------------------------------------------------------------------------
-- 検証クエリ (10 件 INSERT されたか確認)
-- ----------------------------------------------------------------------------
-- SELECT card_id, equipment_target_leader_id, equipment_effect_type, equipment_effect_data
--   FROM public.battle_cards_meta WHERE card_type = 'equipment' ORDER BY card_id;
