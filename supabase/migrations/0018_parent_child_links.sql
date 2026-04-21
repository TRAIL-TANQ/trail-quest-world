-- ======================================================================
-- 0018_parent_child_links.sql
-- 保護者ダッシュボード: LINE UIDと子IDの紐付けテーブル
-- 1保護者:N子対応、兄弟姉妹の保護者は複数行持つ
-- ======================================================================

set client_encoding = 'UTF8';

create table if not exists public.parent_child_links (
  id                      bigserial primary key,
  line_uid                text not null,
  child_id                text not null,
  display_name            text,
  notification_report     boolean not null default true,
  notification_tournament boolean not null default true,
  notification_unlock     boolean not null default true,
  linked_at               timestamptz not null default now(),
  unique(line_uid, child_id)
);

create index if not exists idx_links_line_uid
  on public.parent_child_links(line_uid);

create index if not exists idx_links_child_id
  on public.parent_child_links(child_id);

alter table public.parent_child_links enable row level security;

create policy "deny_anon_links"
  on public.parent_child_links
  for all
  to anon
  using (false);

comment on table public.parent_child_links is
  '保護者(LINE UID)と子(child_id)の紐付け。1:N対応。';
comment on column public.parent_child_links.display_name is
  'LINEプロフィール名のキャッシュ（verify時に更新）';
comment on column public.parent_child_links.notification_report is
  '週次レポート通知のON/OFF';
comment on column public.parent_child_links.notification_tournament is
  '大会結果通知のON/OFF';
comment on column public.parent_child_links.notification_unlock is
  '解放通知のON/OFF';
