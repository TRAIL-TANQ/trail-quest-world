-- Migration: v2.0.2-04 カウンター専用カード 10 枚 INSERT
-- 依存: 0039
-- 実行: 0041 の次に実行
--
-- カウンターカードの特徴:
--   - counter_value: 防御時に追加されるボーナス値 (1-3)
--   - event_effect_*: プレイ時のイベント効果 (ハイブリッド型)
--   - 全 10 枚既存画像流用 (Manus Pro 生成不要)
--
-- 画像 (全て既存流用):
--   cn_warriors_oath     → /images/cards/war-banner.png
--   cn_matchlock_wall    → /images/cards/nagashino-formation.png
--   cn_universal_diagram → /images/cards/blueprint.png
--   cn_observers_eye     → /images/cards/microscope.png
--   cn_tale_shield       → /images/cards/lily-shield.png
--   cn_witty_words       → /images/cards/fude.png
--   cn_river_guardian    → /images/cards/anaconda.png
--   cn_pack_unity        → /images/cards/pack-law.png
--   cn_sacred_blessing   → /images/cards/prayer-light.png
--   cn_great_wall_shield → /images/cards/great-wall.png

INSERT INTO public.battle_cards_meta (
  card_id, color, cost, attack_power, defense_power,
  is_leader, card_type, trigger_type, counter_value,
  event_effect_type, event_effect_data,
  effect_text
) VALUES
  ('cn_warriors_oath', 'red', 2, 0, 0,
   false, 'counter', NULL, 2,
   'buff_my_chars_atk', '{"atk_bonus": 1, "duration": "this_turn"}'::jsonb,
   'カウンター時 +2 / プレイ時 場のキャラ全員 atk +1 (このターン)'),

  ('cn_matchlock_wall', 'red', 1, 0, 0,
   false, 'counter', NULL, 1,
   'reveal_opponent_hand', '{"reveal_count": 1}'::jsonb,
   'カウンター時 +1 / プレイ時 相手手札 1 枚見る'),

  ('cn_universal_diagram', 'blue', 2, 0, 0,
   false, 'counter', NULL, 2,
   'draw', '{"count": 1}'::jsonb,
   'カウンター時 +2 / プレイ時 1 ドロー'),

  ('cn_observers_eye', 'blue', 1, 0, 0,
   false, 'counter', NULL, 1,
   'peek_top_deck', '{"count": 1}'::jsonb,
   'カウンター時 +1 / プレイ時 山札の上 1 枚を見る'),

  ('cn_tale_shield', 'blue', 3, 0, 0,
   false, 'counter', NULL, 3,
   'revive_from_graveyard', '{"count": 1}'::jsonb,
   'カウンター時 +3 / プレイ時 墓地から 1 枚を手札へ'),

  ('cn_witty_words', 'blue', 2, 0, 0,
   false, 'counter', NULL, 2,
   'draw_then_discard', '{"draw": 1, "discard": 1}'::jsonb,
   'カウンター時 +2 / プレイ時 1 ドロー後 1 枚捨てる'),

  ('cn_river_guardian', 'green', 3, 0, 0,
   false, 'counter', NULL, 3,
   'heal_life', '{"life_bonus": 1}'::jsonb,
   'カウンター時 +3 / プレイ時 ライフ +1'),

  ('cn_pack_unity', 'green', 2, 0, 0,
   false, 'counter', NULL, 2,
   'rest_release_one', '{"count": 1}'::jsonb,
   'カウンター時 +2 / プレイ時 自分のキャラ 1 体のレストを解除'),

  ('cn_sacred_blessing', 'yellow', 2, 0, 0,
   false, 'counter', NULL, 2,
   'revive_from_graveyard', '{"count": 1}'::jsonb,
   'カウンター時 +2 / プレイ時 墓地から 1 枚を手札へ'),

  ('cn_great_wall_shield', 'purple', 3, 0, 0,
   false, 'counter', NULL, 3,
   'buff_leader_def', '{"def_bonus": 2, "duration": "this_turn"}'::jsonb,
   'カウンター時 +3 / プレイ時 リーダー def +2 (このターン)');

-- ----------------------------------------------------------------------------
-- 検証クエリ (10 件 INSERT されたか確認)
-- ----------------------------------------------------------------------------
-- SELECT card_id, counter_value, event_effect_type, event_effect_data
--   FROM public.battle_cards_meta WHERE card_type = 'counter' ORDER BY card_id;
