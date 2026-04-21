-- ======================================================================
-- 0017_parent_invite_codes.sql
-- 保護者ダッシュボード: 招待コード管理テーブル
-- 管理者が発行する6桁コード、72h有効、使い切り
-- ======================================================================

set client_encoding = 'UTF8';

create table if not exists public.parent_invite_codes (
  code             varchar(6) primary key,
  child_id         text not null,
  created_by       text not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  used_at          timestamptz,
  used_by_line_uid text
);

create index if not exists idx_invite_child
  on public.parent_invite_codes(child_id);

create index if not exists idx_invite_expires
  on public.parent_invite_codes(expires_at)
  where used_at is null;

alter table public.parent_invite_codes enable row level security;

create policy "deny_anon_invite_codes"
  on public.parent_invite_codes
  for all
  to anon
  using (false);

comment on table public.parent_invite_codes is
  '保護者連携用の招待コード。管理者が発行、72h有効、使い切り。';
comment on column public.parent_invite_codes.code is
  '6桁の招待コード（ゼロ埋め文字列）';
comment on column public.parent_invite_codes.child_id is
  '紐付け対象の生徒ID（例: リミットレス_れお）';
comment on column public.parent_invite_codes.used_by_line_uid is
  '使用した保護者のLINE UID（使用時に記録）';
