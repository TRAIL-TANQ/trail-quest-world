-- =====================================================================
-- user_decks : プレイヤーが自作したオリジナルデッキ保存用
--
-- localStorage がプライマリストレージ。Supabase は同期バックアップ。
-- 1プレイヤーあたり最大 3 デッキ（アプリ側で制限、DBでは非強制）。
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.user_decks (
  id          text primary key,              -- "mydeck-<ts>-<rand>"
  child_id    text not null,
  deck_name   text not null default 'マイデッキ',
  cards       jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_user_decks_child on public.user_decks (child_id);

-- RLS is disabled to match the rest of the schema (anon key, no-auth)
alter table public.user_decks disable row level security;
