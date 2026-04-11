-- =====================================================================
-- 変更16: ショップ（アバタースキン） — テーブル定義のみ
--
-- このファイルを最初に実行してから、0001_shop_seed.sql を実行してください。
--
-- 3 tables:
--   shop_items     : 販売中のアバタースキン（管理者が追加・価格変更・ON/OFF）
--   owned_skins    : 各ユーザーが購入済みのスキン
--   equipped_skin  : 各ユーザーが現在装備しているスキン（1行=1ユーザー）
--
-- 注意:
--   - child_id は text 型（既存 child_status.child_id と揃える）
--   - shop_items.skin_key (text unique) でフロントの AVATAR_ITEMS キーと接続
--   - DB の name / description は英語。日本語表示はフロント側で skin_key を
--     キーにローカル i18n マップからルックアップする
--   - RLS は明示的に無効化（anon key + 認証なし運用の暫定措置）
-- =====================================================================

set client_encoding = 'UTF8';

-- ---------- shop_items ----------
create table if not exists public.shop_items (
  id               uuid primary key default gen_random_uuid(),
  skin_key         text unique not null,
  name             text not null,
  description      text,
  price_alt        integer not null default 0 check (price_alt >= 0),
  unlock_level     integer not null default 0 check (unlock_level >= 0),
  unlock_condition text,
  image_url        text not null,
  category         text not null default 'basic' check (category in ('basic', 'limited', 'event')),
  is_active        boolean not null default true,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

create index if not exists idx_shop_items_active_sort on public.shop_items (is_active, sort_order);

alter table public.shop_items disable row level security;

-- ---------- owned_skins ----------
create table if not exists public.owned_skins (
  id            uuid primary key default gen_random_uuid(),
  child_id      text not null,
  item_id       uuid not null references public.shop_items(id) on delete cascade,
  purchased_at  timestamptz not null default now(),
  unique (child_id, item_id)
);

create index if not exists idx_owned_skins_child on public.owned_skins (child_id);

alter table public.owned_skins disable row level security;

-- ---------- equipped_skin ----------
create table if not exists public.equipped_skin (
  child_id  text primary key,
  item_id   uuid references public.shop_items(id) on delete set null
);

alter table public.equipped_skin disable row level security;
