-- =====================================================================
-- Change 10: Elo Ranking - Add rating / wins / losses to child_status
--
-- Run this file in the Supabase SQL Editor.
-- Modifies the existing child_status table by adding 3 nullable columns
-- with default values so existing rows are populated automatically.
--
-- Columns added:
--   rating  integer not null default 1000 : current Elo rating
--   wins    integer not null default 0    : total battle wins
--   losses  integer not null default 0    : total battle losses
--
-- Notes:
--   - Uses "ADD COLUMN IF NOT EXISTS" (Postgres 9.6+) so re-running the file
--     is safe even after the columns already exist.
--   - Rank bands (client-side, see ratingService.ts):
--       bronze    0 - 999
--       silver 1000 - 1299
--       gold   1300 - 1599
--       platinum 1600 - 1899
--       diamond 1900+
--   - Win/loss delta is computed client-side via calculateEloDelta and
--     written via updateChildStatusRating.
-- =====================================================================

set client_encoding = 'UTF8';

alter table public.child_status
  add column if not exists rating integer not null default 1000 check (rating >= 0);

alter table public.child_status
  add column if not exists wins integer not null default 0 check (wins >= 0);

alter table public.child_status
  add column if not exists losses integer not null default 0 check (losses >= 0);
