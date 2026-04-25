-- Migration: v2.0.2-05 イベントカード 15 枚 INSERT
-- 依存: 0039
-- 実行: 0042 の次に実行
--
-- イベントカードの特徴:
--   - 1 回プレイ → 効果発動 → 墓地へ
--   - リーダー専用 10 枚 (color = リーダー色) + 共通 5 枚 (color = colorless)
--
-- 画像 (Manus Pro 生成済 + 既存流用):
--   ev_waterloo          → /images/cards/waterloo.png            (既存)
--   ev_honnoji           → /images/cards/honnoji.png             (既存)
--   ev_renaissance       → /images/cards/mona-lisa.png           (既存流用)
--   ev_heliocentric      → /images/cards/heliocentric.png        (既存)
--   ev_genji_writing     → /images/cards/waka.png                (既存流用)
--   ev_pillow_morning    → /images/cards/paper.png               (既存流用)
--   ev_river_flood       → /images/cards/amazon-river.png        (既存流用)
--   ev_moonlight_hunt    → /images/cards/howl.png                (既存流用)
--   ev_jeanne_oracle     → /images/cards/saint-jeanne.png        (既存流用)
--   ev_great_wall_build  → /images/cards/great-wall.png          (既存流用)
--   ev_great_storm       → /images/cards/wind-tunnel.png         (既存流用)
--   ev_lunar_eclipse     → /images/cards/lunar-eclipse.png       (Manus 生成)
--   ev_spring_arrival    → /images/cards/spring-arrival.png      (Manus 生成)
--   ev_earthquake_global → /images/cards/earthquake-global.png   (Manus 生成)
--   ev_scout             → /images/cards/ashigaru.png            (既存流用)

INSERT INTO public.battle_cards_meta (
  card_id, color, cost, attack_power, defense_power,
  is_leader, card_type, trigger_type, counter_value,
  event_effect_type, event_effect_data,
  effect_text
) VALUES
  -- ============ リーダー専用 10 ============
  ('ev_waterloo', 'red', 5, 0, 0, false, 'event', NULL, 0,
   'buff_my_chars_atk', '{"atk_bonus": 2, "duration": "this_turn"}'::jsonb,
   '場のキャラ全員 atk +2 (このターン)'),

  ('ev_honnoji', 'red', 6, 0, 0, false, 'event', NULL, 0,
   'destroy_enemy_char', '{"target_count": 1, "rule": "any"}'::jsonb,
   '敵キャラ 1 体を強制破壊'),

  ('ev_renaissance', 'blue', 5, 0, 0, false, 'event', NULL, 0,
   'both_draw_self_extra', '{"both_count": 2, "self_extra": 1}'::jsonb,
   '両者 2 ドロー、自分はさらに 1 ドロー'),

  ('ev_heliocentric', 'blue', 4, 0, 0, false, 'event', NULL, 0,
   'reveal_then_discard', '{"reveal": 1, "discard": 1}'::jsonb,
   '相手の手札 1 枚見て 1 枚捨てさせる'),

  ('ev_genji_writing', 'blue', 3, 0, 0, false, 'event', NULL, 0,
   'scry_then_pick', '{"scry": 3, "pick": 1}'::jsonb,
   '山札上 3 枚を見て 1 枚を手札に'),

  ('ev_pillow_morning', 'blue', 3, 0, 0, false, 'event', NULL, 0,
   'draw_and_buff', '{"draw": 1, "atk_bonus": 2, "target": "1_char"}'::jsonb,
   '1 ドロー + 自分のキャラ 1 体 atk +2 (このターン)'),

  ('ev_river_flood', 'green', 6, 0, 0, false, 'event', NULL, 0,
   'debuff_all_enemies_atk', '{"atk_debuff": 1, "duration": "this_turn"}'::jsonb,
   '敵キャラ全員 atk -1 (このターン)'),

  ('ev_moonlight_hunt', 'green', 4, 0, 0, false, 'event', NULL, 0,
   'rest_release_all_my_chars', '{}'::jsonb,
   '自分のキャラ全員のレストを解除'),

  ('ev_jeanne_oracle', 'yellow', 5, 0, 0, false, 'event', NULL, 0,
   'heal_life', '{"life_bonus": 1}'::jsonb,
   'ライフ +1'),

  ('ev_great_wall_build', 'purple', 7, 0, 0, false, 'event', NULL, 0,
   'buff_leader_def', '{"def_bonus": 5, "duration": "until_next_opponent_turn_end"}'::jsonb,
   'リーダー def +5 (次の相手ターン終了まで)'),

  -- ============ 共通 5 ============
  ('ev_great_storm', 'colorless', 4, 0, 0, false, 'event', NULL, 0,
   'rest_all_chars', '{}'::jsonb,
   '両者のキャラ全員をレスト状態に'),

  ('ev_lunar_eclipse', 'colorless', 3, 0, 0, false, 'event', NULL, 0,
   'opponent_cant_play_chars', '{"duration": "this_turn"}'::jsonb,
   '相手はこのターン キャラを場に出せない'),

  ('ev_spring_arrival', 'colorless', 2, 0, 0, false, 'event', NULL, 0,
   'buff_my_chars_atk', '{"atk_bonus": 1, "duration": "this_turn"}'::jsonb,
   '自分のキャラ全員 atk +1 (このターン)'),

  ('ev_earthquake_global', 'colorless', 5, 0, 0, false, 'event', NULL, 0,
   'destroy_low_cost_chars', '{"max_cost": 3, "scope": "both_sides"}'::jsonb,
   'コスト 3 以下のキャラを両者全員破壊'),

  ('ev_scout', 'colorless', 1, 0, 0, false, 'event', NULL, 0,
   'reveal_opponent_hand_all', '{}'::jsonb,
   '相手の手札を全部見る');

-- ----------------------------------------------------------------------------
-- 検証クエリ (15 件 INSERT されたか確認)
-- ----------------------------------------------------------------------------
-- SELECT card_id, color, cost, event_effect_type, event_effect_data
--   FROM public.battle_cards_meta WHERE card_type = 'event' ORDER BY card_id;
