-- ======================================================================
-- 0019_weekly_reports.sql
-- 保護者ダッシュボード: AI週次レポートのキャッシュテーブル
-- 月曜5:00 JST に cron 生成、必要時オンデマンドで fallback 生成
-- ======================================================================

set client_encoding = 'UTF8';

create table if not exists public.weekly_reports (
  id              bigserial primary key,
  child_id        text not null,
  week_start      date not null,
  week_end        date not null,
  generated_at    timestamptz not null default now(),
  generated_by    text not null default 'cron',
  battle_wins     integer not null default 0,
  battle_losses   integer not null default 0,
  alt_game_count  integer not null default 0,
  alt_gained      integer not null default 0,
  study_seconds   integer not null default 0,
  content         jsonb not null,
  read_at         timestamptz,
  feedback_useful boolean,
  feedback_note   text,
  unique(child_id, week_start)
);

create index if not exists idx_reports_child_week
  on public.weekly_reports(child_id, week_start desc);

alter table public.weekly_reports enable row level security;

create policy "deny_anon_reports"
  on public.weekly_reports
  for all
  to anon
  using (false);

comment on table public.weekly_reports is
  'AI週次レポート。月曜朝にcronで生成、fallbackはオンデマンド。';
comment on column public.weekly_reports.week_start is
  'レポート対象週の月曜日';
comment on column public.weekly_reports.week_end is
  'レポート対象週の日曜日';
comment on column public.weekly_reports.generated_by is
  '生成元: ''cron'' または ''ondemand''';
comment on column public.weekly_reports.content is
  'AI生成コンテンツ(JSONB): summary / insights / praise_points / suggestions / daily_alt / battle_results';
comment on column public.weekly_reports.study_seconds is
  'その週の学習時間合計（battle_history + alt_game_scores の duration_seconds を合計）';
