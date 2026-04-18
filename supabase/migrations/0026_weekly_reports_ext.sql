-- ======================================================================
-- 0027_weekly_reports_ext.sql
-- Phase C: weekly_reports に AI 生成メタデータ列を追加
--   * generation_model         : 使用した Claude モデル名（例 claude-sonnet-4-6）
--   * generation_duration_ms   : API 呼び出しの所要ミリ秒
--   * api_cost_jpy             : 呼び出し 1 回の概算コスト（円）
--
-- ai_comment（kk の声の 200〜300 字コメント）は content jsonb 内の
-- キー 'ai_comment' として格納する前提。新規カラムは追加しない
-- （既存 0019 の設計を踏襲 — AI出力は全て content 内）。
-- ======================================================================

set client_encoding = 'UTF8';

alter table public.weekly_reports
  add column if not exists generation_model text;

alter table public.weekly_reports
  add column if not exists generation_duration_ms integer
    check (generation_duration_ms is null or generation_duration_ms >= 0);

alter table public.weekly_reports
  add column if not exists api_cost_jpy numeric(10,4)
    check (api_cost_jpy is null or api_cost_jpy >= 0);

comment on column public.weekly_reports.generation_model is
  '生成に使った Claude モデル名。NULL は旧データ（Phase C 以前）。';
comment on column public.weekly_reports.generation_duration_ms is
  'Claude API 呼び出しの所要ミリ秒。パフォーマンス監視・回帰検出用。';
comment on column public.weekly_reports.api_cost_jpy is
  'この呼び出しの概算コスト（円）。tokens_in/out から算出。';

-- 運用用ビュー: 月次 API コスト集計
create or replace view public.weekly_reports_cost_by_month as
select
  date_trunc('month', generated_at) as month,
  generation_model,
  count(*)                          as reports,
  sum(api_cost_jpy)                 as total_cost_jpy,
  avg(generation_duration_ms)::int  as avg_duration_ms
from public.weekly_reports
where api_cost_jpy is not null
group by 1, 2
order by 1 desc, 2;

comment on view public.weekly_reports_cost_by_month is
  '月次の AI レポート生成コスト・所要時間集計。予算管理用。';
