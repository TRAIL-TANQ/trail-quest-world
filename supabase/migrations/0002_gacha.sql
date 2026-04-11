-- =====================================================================
-- Change 7: Gacha system Supabase persistence
--
-- Run this file in the Supabase SQL Editor.
-- Adds tables to the same DB as existing child_status / shop_items.
--
-- 2 tables:
--   gacha_pulls : Individual gacha pull history (all records saved)
--   gacha_pity  : Pity counters (one row per user, normal / premium)
--
-- Notes:
--   - child_id is text type (matches existing child_status.child_id)
--   - RLS is explicitly disabled (temporary measure for anon key + no-auth usage)
-- =====================================================================

set client_encoding = 'UTF8';

-- ---------- gacha_pulls ----------
-- 1 pull = 1 row. A 10-pull inserts 10 rows at once.
create table if not exists public.gacha_pulls (
  id            uuid primary key default gen_random_uuid(),
  child_id      text not null,
  card_id       text not null,
  rarity        text not null check (rarity in ('N', 'R', 'SR', 'SSR')),
  gacha_type    text not null check (gacha_type in ('normal', 'premium')),
  pity_count    integer not null default 0 check (pity_count >= 0),
  pulled_at     timestamptz not null default now()
);

create index if not exists idx_gacha_pulls_child_time
  on public.gacha_pulls (child_id, pulled_at desc);

alter table public.gacha_pulls disable row level security;

-- ---------- gacha_pity ----------
-- 1 row per user. Holds pity counters for normal and premium separately.
create table if not exists public.gacha_pity (
  child_id             text primary key,
  normal_pity          integer not null default 0 check (normal_pity >= 0),
  premium_pity         integer not null default 0 check (premium_pity >= 0),
  updated_at           timestamptz not null default now()
);

alter table public.gacha_pity disable row level security;
