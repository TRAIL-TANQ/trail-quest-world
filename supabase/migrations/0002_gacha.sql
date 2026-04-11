-- =====================================================================
-- 変更7: ガチャシステム Supabase 永続化
--
-- Supabase SQL Editor でこのファイルを実行してください。
-- 既存の child_status / shop_items と同じ DB に追加されます。
--
-- 2 tables:
--   gacha_pulls : 個別のガチャ引き履歴（全件保存）
--   gacha_pity  : 天井カウンタ（ユーザーごと normal / premium を保持）
--
-- 注意:
--   - child_id は text 型（既存 child_status.child_id と揃える）
--   - RLS は明示的に無効化（anon key + 認証なし運用の暫定措置）
-- =====================================================================

set client_encoding = 'UTF8';

-- ---------- gacha_pulls ----------
-- 1 引き = 1 行。10連は 10 行同時 insert される。
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
-- ユーザーごと 1 行。normal / premium それぞれの天井カウンタを保持。
create table if not exists public.gacha_pity (
  child_id             text primary key,
  normal_pity          integer not null default 0 check (normal_pity >= 0),
  premium_pity         integer not null default 0 check (premium_pity >= 0),
  updated_at           timestamptz not null default now()
);

alter table public.gacha_pity disable row level security;
