-- =====================================================================
-- battle_history : バトル履歴（管理者ダッシュボード用）
--
-- 記録タイミング: バトル終了時（勝敗問わず）に1件 INSERT。
-- 管理者(admin)/モニター(monitor) のバトルは記録しない（子供データのみ）。
-- PvP バトルはデッキ情報が曖昧なので今回のスコープでは対象外。
--
-- deck_key: questProgress.DeckKey と同じキー（'jeanne' 等）。
--           マイデッキなど特定デッキに紐付けできない場合は 'custom' 。
-- result: 'win' | 'lose'
-- opponent_type: 'npc' | 'pvp'
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.battle_history (
  id                  uuid primary key default gen_random_uuid(),
  child_id            text not null,
  deck_key            text not null,
  opponent_type       text not null default 'npc',
  stage               integer,
  result              text not null check (result in ('win', 'lose')),
  total_fans          integer,
  opponent_fans       integer,
  finisher_card_id    text,
  finisher_card_name  text,
  rounds_played       integer,
  played_at           timestamptz not null default now()
);

create index if not exists idx_battle_child on public.battle_history (child_id, played_at desc);
create index if not exists idx_battle_deck  on public.battle_history (deck_key, played_at desc);
create index if not exists idx_battle_date  on public.battle_history (played_at desc);
create index if not exists idx_battle_finisher on public.battle_history (finisher_card_name);

-- 既存テーブル（alt_game_scores/child_status 等）と同じ運用:
-- anon キー経由で insert できるよう RLS は無効化。公開前に必ず RLS ポリシー設計。
alter table public.battle_history disable row level security;
