-- Migration: v2.0.2-00 既存 battle v2 テーブル定義の記録 (idempotent)
-- 依存: なし
-- 実行: kk が Supabase SQL Editor で順次実行 (本番 DB は既に作成済のため実質 NO-OP)
--
-- 目的:
--   v2.0-launch 時に Supabase Dashboard で手動作成された battle 系 5 テーブルの
--   定義を migrations 系列に記録する。CREATE TABLE IF NOT EXISTS のため、既存
--   テーブルには影響しない (新規環境セットアップ用)。
--
-- 注意:
--   本ファイルは SQL ② (information_schema.columns) の結果と client/src/lib/battle/
--   battleTypes.ts の型定義を元にしたベストエフォート再構築。kk が
--   `supabase db pull --schema public` で実テーブル定義を逆引きして上書きする
--   ことを推奨 (RLS / FK / 制約の細部まで再現する場合)。

-- ============================================================================
-- battle_leaders: リーダー (10件、life=4-7、attack/defense_power=各5)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.battle_leaders (
  id              text PRIMARY KEY,
  name            text NOT NULL,
  color           text NOT NULL,
  life            integer NOT NULL DEFAULT 3,
  power           integer NOT NULL DEFAULT 0,
  attack_power    integer NOT NULL DEFAULT 0,
  defense_power   integer NOT NULL DEFAULT 0,
  description     text,
  image_url       text,
  effect_text     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- battle_cards_meta: カードマスタ (既存30件、v2.0.2 で +35 = 65件想定)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.battle_cards_meta (
  card_id         text PRIMARY KEY,
  card_type       text NOT NULL DEFAULT 'character',
  cost            integer NOT NULL,
  power           integer NOT NULL,
  color           text NOT NULL,
  is_leader       boolean NOT NULL DEFAULT false,
  effect_text     text,
  attack_power    integer NOT NULL DEFAULT 0,
  defense_power   integer NOT NULL DEFAULT 0,
  trigger_type    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- battle_decks: デッキ (10件のプリセット + ユーザー作成デッキ)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.battle_decks (
  id              bigserial PRIMARY KEY,
  child_id        text NOT NULL,
  name            text NOT NULL,
  leader_id       text NOT NULL REFERENCES public.battle_leaders(id) ON DELETE RESTRICT,
  is_preset       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- battle_deck_cards: デッキ構成カード (各 deck 30枚 = 計300行 想定)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.battle_deck_cards (
  deck_id         bigint NOT NULL REFERENCES public.battle_decks(id) ON DELETE CASCADE,
  card_id         text NOT NULL REFERENCES public.battle_cards_meta(card_id) ON DELETE RESTRICT,
  count           integer NOT NULL CHECK (count >= 1 AND count <= 4),
  PRIMARY KEY (deck_id, card_id)
);

-- ============================================================================
-- battle_sessions: バトルセッション (進行中 + 履歴のスナップショット)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.battle_sessions (
  id                bigserial PRIMARY KEY,
  player1_id        text NOT NULL,
  player1_leader    text NOT NULL,
  player1_deck_id   bigint,
  player2_id        text NOT NULL DEFAULT 'ai',
  player2_leader    text NOT NULL,
  player2_deck_id   bigint,
  difficulty        text NOT NULL DEFAULT 'normal',
  winner            text,
  turn_count        integer NOT NULL DEFAULT 0,
  duration_seconds  integer NOT NULL DEFAULT 0,
  alt_earned        integer NOT NULL DEFAULT 0,
  state_snapshot    jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- インデックス
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_battle_decks_child_id     ON public.battle_decks(child_id);
CREATE INDEX IF NOT EXISTS idx_battle_decks_is_preset    ON public.battle_decks(is_preset) WHERE is_preset = true;
CREATE INDEX IF NOT EXISTS idx_battle_deck_cards_deck_id ON public.battle_deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_battle_sessions_player1   ON public.battle_sessions(player1_id);

-- ============================================================================
-- RLS は別 Migration で対応 (公開前必須、battle_history 0014 では disabled の前例あり)
-- ============================================================================
