-- ======================================================================
-- 0024_invite_code_logs.sql
-- 保護者ダッシュボード: 招待コードの監査ログ
--   発行(created) / 使用(used) / 削除(deleted) / 再発行(regenerated)
--   を全件記録する。保持期間は無期限（将来の監査用）。
-- ======================================================================

set client_encoding = 'UTF8';

create table if not exists public.invite_code_logs (
  id         uuid primary key default gen_random_uuid(),
  code       text not null,
  action     text not null
    check (action in ('created', 'used', 'deleted', 'regenerated')),
  actor      text not null,
  metadata   jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_invite_logs_code
  on public.invite_code_logs(code);

create index if not exists idx_invite_logs_created
  on public.invite_code_logs(created_at desc);

comment on table public.invite_code_logs is
  '招待コードの監査ログ。保持期間無期限、削除は運用上しない想定。';
comment on column public.invite_code_logs.action is
  'created / used / deleted / regenerated のいずれか';
comment on column public.invite_code_logs.actor is
  '操作者識別子（現状は固定で "admin"、Supabase Auth 導入後に実 UID）';
comment on column public.invite_code_logs.metadata is
  'アクション別の付随情報。created={target_children,parent_name}、'
  'regenerated={old_code} など';
