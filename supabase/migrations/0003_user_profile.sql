-- =====================================================================
-- Change 17: User profile persistence
--
-- Run this file in the Supabase SQL Editor.
-- Adds tables to the same DB as existing child_status / shop_items / gacha_*.
--
-- 1 table:
--   user_profile : Holds nickname / avatar_type per user
--
-- Notes:
--   - child_id is text type (matches existing child_status.child_id)
--   - avatar_type is constrained to 'boy' | 'girl'
--   - equipped_avatar_id and purchased skins are managed in the existing
--     shop_items / owned_skins / equipped_skin tables. To avoid duplication,
--     this profile table only holds basic info.
--   - RLS is explicitly disabled (temporary measure for anon key + no-auth usage)
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.user_profile (
  child_id     text primary key,
  nickname     text not null default '',
  avatar_type  text not null default 'boy' check (avatar_type in ('boy', 'girl')),
  updated_at   timestamptz not null default now()
);

alter table public.user_profile disable row level security;
