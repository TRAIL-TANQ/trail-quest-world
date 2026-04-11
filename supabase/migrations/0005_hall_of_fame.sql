-- =====================================================================
-- Change 11: Hall of Fame - Decks that cleared 5-0 in solo mode
--
-- Run this file in the Supabase SQL Editor.
--
-- 1 table:
--   hall_of_fame : Snapshot of decks that swept all 5 rounds in a stage.
--
-- Columns:
--   id          uuid primary key
--   child_id    text not null             - owner
--   deck_data   jsonb not null            - array of BattleCard snapshots
--   total_fans  integer not null          - sum of fans earned in the cleared match
--   stage_id    integer                   - nullable, for free-play entries
--   cleared_at  timestamptz default now()
--
-- Notes:
--   - deck_data is stored as jsonb so the full deck (name, rarity, power, etc.)
--     can be rendered on HallOfFamePage without re-fetching card definitions.
--   - Indexed by (child_id, cleared_at desc) for fast "my hall of fame" lookups.
--   - RLS explicitly disabled (temporary measure for anon key + no-auth usage).
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.hall_of_fame (
  id          uuid primary key default gen_random_uuid(),
  child_id    text not null,
  deck_data   jsonb not null,
  total_fans  integer not null default 0 check (total_fans >= 0),
  stage_id    integer,
  cleared_at  timestamptz not null default now()
);

create index if not exists idx_hall_of_fame_child_time
  on public.hall_of_fame (child_id, cleared_at desc);

alter table public.hall_of_fame disable row level security;
