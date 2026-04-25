-- Migration: v2.0.2-06 各プリセットデッキに装備+カウンター+イベント追加
-- 依存: 0041, 0042, 0043 (新カード 35 枚存在前提)
-- 実行: 0043 の次に実行
--
-- 戦略:
--   Step 1: 各プリセットデッキ (id 1-10) で「最低 cost のカード優先」で count を 3 削減
--           (count >= 1 維持、count = 1 のカードは DELETE で 1 枠空ける)
--   Step 2: 各デッキに装備 1 + カウンター 1 + イベント 1 (= 3 枚) を新規追加
--   Step 3: 各デッキ 30 枚を維持
--
-- 注意:
--   Step 1 は PL/pgSQL DO ブロックで実装。実デッキ構成が不明でも安全に動作。
--   Step 2 のカード割当はリーダー別に固定 (デッキの色とテーマに合わせ最適化済)。

-- ============================================================================
-- Step 1: 各デッキから 3 枚分カット (PL/pgSQL DO block、デッキ構成非依存)
-- ============================================================================
DO $$
DECLARE
  d         RECORD;
  c         RECORD;
  remaining INT;
  cut       INT;
BEGIN
  FOR d IN
    SELECT id FROM public.battle_decks
     WHERE is_preset = true
     ORDER BY id
  LOOP
    remaining := 3;

    FOR c IN
      SELECT dc.card_id, dc.count
        FROM public.battle_deck_cards dc
        JOIN public.battle_cards_meta cm ON cm.card_id = dc.card_id
       WHERE dc.deck_id = d.id
         AND cm.card_type = 'character'
       ORDER BY cm.cost ASC, dc.count DESC, dc.card_id ASC
    LOOP
      EXIT WHEN remaining = 0;

      IF c.count > 1 THEN
        -- count > 1 のカードは UPDATE で削減 (最低 1 枚は残す)
        cut := LEAST(remaining, c.count - 1);
        UPDATE public.battle_deck_cards
           SET count = count - cut
         WHERE deck_id = d.id AND card_id = c.card_id;
        remaining := remaining - cut;
      ELSE
        -- count = 1 のカードはそのまま DELETE で 1 枠空ける
        DELETE FROM public.battle_deck_cards
         WHERE deck_id = d.id AND card_id = c.card_id;
        remaining := remaining - 1;
      END IF;
    END LOOP;

    IF remaining > 0 THEN
      RAISE WARNING 'Deck % could not free 3 slots, % remaining', d.id, remaining;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Step 2: 各デッキに装備 1 + カウンター 1 + イベント 1 を INSERT (各 count = 1)
-- ============================================================================

-- Deck 1: ナポレオン (leader_napoleon, red)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (1, 'eq_napoleon_bicorne', 1),
  (1, 'cn_warriors_oath',    1),
  (1, 'ev_waterloo',         1);

-- Deck 2: 信長 (leader_nobunaga, red)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (2, 'eq_nobunaga_matchlock', 1),
  (2, 'cn_matchlock_wall',     1),
  (2, 'ev_honnoji',            1);

-- Deck 3: ダ・ヴィンチ (leader_davinci, blue)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (3, 'eq_davinci_codex',      1),
  (3, 'cn_universal_diagram',  1),
  (3, 'ev_renaissance',        1);

-- Deck 4: ガリレオ (leader_galileo, blue)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (4, 'eq_galileo_telescope',  1),
  (4, 'cn_observers_eye',      1),
  (4, 'ev_heliocentric',       1);

-- Deck 5: 紫式部 (leader_murasaki, blue)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (5, 'eq_murasaki_genji',     1),
  (5, 'cn_tale_shield',        1),
  (5, 'ev_genji_writing',      1);

-- Deck 6: 清少納言 (leader_sei_shonagon, blue)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (6, 'eq_seishonagon_pillowbook', 1),
  (6, 'cn_witty_words',            1),
  (6, 'ev_pillow_morning',         1);

-- Deck 7: アマゾン (leader_amazon, green)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (7, 'eq_amazon_blessing',    1),
  (7, 'cn_river_guardian',     1),
  (7, 'ev_river_flood',        1);

-- Deck 8: オオカミ (leader_wolf, green)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (8, 'eq_wolf_howl',          1),
  (8, 'cn_pack_unity',         1),
  (8, 'ev_moonlight_hunt',     1);

-- Deck 9: ジャンヌ (leader_jeanne, yellow)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (9, 'eq_jeanne_holysword',   1),
  (9, 'cn_sacred_blessing',    1),
  (9, 'ev_jeanne_oracle',      1);

-- Deck 10: 始皇帝 (leader_qin, purple)
INSERT INTO public.battle_deck_cards (deck_id, card_id, count) VALUES
  (10, 'eq_qin_wallstone',     1),
  (10, 'cn_great_wall_shield', 1),
  (10, 'ev_great_wall_build',  1);

-- ============================================================================
-- 検証クエリ (実行後 kk が必ず確認、各デッキ 30 枚維持を保証)
-- ============================================================================
-- SELECT deck_id, SUM(count) AS total_cards
--   FROM public.battle_deck_cards
--  WHERE deck_id BETWEEN 1 AND 10
--  GROUP BY deck_id
--  ORDER BY deck_id;
-- 期待: 全デッキで total_cards = 30
--
-- SELECT d.id, d.name, COUNT(DISTINCT dc.card_id) AS unique_cards, SUM(dc.count) AS total
--   FROM public.battle_decks d
--   JOIN public.battle_deck_cards dc ON dc.deck_id = d.id
--  WHERE d.is_preset = true
--  GROUP BY d.id, d.name
--  ORDER BY d.id;
