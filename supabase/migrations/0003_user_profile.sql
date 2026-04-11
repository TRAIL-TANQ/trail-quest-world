-- =====================================================================
-- 変更17: ユーザープロファイル永続化
--
-- Supabase SQL Editor でこのファイルを実行してください。
-- 既存の child_status / shop_items / gacha_* と同じ DB に追加されます。
--
-- 1 table:
--   user_profile : nickname / avatar_type をユーザーごとに保持
--
-- 注意:
--   - child_id は text 型（既存 child_status.child_id と揃える）
--   - avatar_type は 'boy' | 'girl' の2値制約
--   - equipped_avatar_id / 購入済みスキンは shop_items / owned_skins /
--     equipped_skin の既存テーブルで管理される（重複を避けるため profile では
--     基本情報のみ扱う）
--   - RLS は明示的に無効化（anon key + 認証なし運用の暫定措置）
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.user_profile (
  child_id     text primary key,
  nickname     text not null default '',
  avatar_type  text not null default 'boy' check (avatar_type in ('boy', 'girl')),
  updated_at   timestamptz not null default now()
);

alter table public.user_profile disable row level security;
