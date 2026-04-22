-- ======================================================================
-- 0036_migrate_remaining_child_id_to_text.sql
-- Phase 2 of child_id uuid→text migration (continuation of 0033 Path Z).
--
-- Targets (all 4 created via Supabase Studio, no tracked DDL in migrations/):
--   daily_missions, diagnoses, parent_reports, quiz_attempts
--
-- kk diagnostic 2026-04-22:
--   - 4 テーブル全て child_id = uuid NOT NULL、行数 0 (データロスなし)
--   - outbound FK: children / users / schools を参照 (親が orphan/空)
--   - inbound FK: chat_logs.diagnosis_id_fkey → diagnoses
--     chat_logs 24 行、全てに対して diagnosis_id IS NULL (論理破綻)
--   - RLS: children / users JOIN を前提とした旧ポリシー (children 空で実質機能せず)
--
-- 影響:
--   quizService.ts:210 の saveQuizAttempt は uuid 型のため INSERT を silent skip、
--   実在する生徒 (text child_id "個別_さとる" 等) のクイズ履歴は長期間 DB に
--   書き込まれていなかった。本 migration で可能になる。
--
-- 方針 (Path A, kk 承認 2026-04-22):
--   1. chat_logs.diagnosis_id_fkey を DROP (論理破綻 FK、データ本体 24 行は保全)
--   2. 4 テーブルを DROP TABLE ... CASCADE で全依存ごと破棄
--   3. text child_id で最小再作成
--      - quiz_attempts: saveQuizAttempt が INSERT する 6 カラム + id + default
--      - dormant 3: id / child_id / created_at のみ (将来 ALTER で拡張)
--   4. RLS:
--      - quiz_attempts: enable + anon INSERT only (SELECT/UPDATE/DELETE deny)
--      - dormant 3:     enable, ポリシー無し = anon 全 op deny
--   5. outbound FK は全撤廃 (children/users/schools が orphan なので意義なし)
--
-- FOLLOW_UPS:
--   - FU-002: children / users / schools テーブルの orphan 整理
--   - FU-003: chat_logs ↔ diagnoses の FK 再設計
--   - FU-004: dormant 3 テーブルの本来仕様定義
-- ======================================================================

set client_encoding = 'UTF8';

begin;

-- ---------- Step 1: inbound FK から解除 ----------
-- chat_logs は 24 行あるが全て diagnosis_id IS NULL、FK は論理的に孤立済み。
-- FK だけ落とし、chat_logs 本体のデータは完全保全。
alter table if exists public.chat_logs
  drop constraint if exists chat_logs_diagnosis_id_fkey;


-- ---------- Step 2: 4 テーブルを CASCADE で破棄 ----------
-- CASCADE で以下を一括破棄:
--   - 各テーブルの RLS ポリシー (children/users JOIN の旧ポリシー)
--   - outbound FK (children/users/schools 参照)
--   - その他の view/trigger/rule (あれば)
-- 全テーブル 0 行のためデータロスなし。
drop table if exists public.quiz_attempts   cascade;
drop table if exists public.diagnoses       cascade;
drop table if exists public.daily_missions  cascade;
drop table if exists public.parent_reports  cascade;


-- ---------- Step 3: quiz_attempts 再作成 (active use) ----------
-- quizService.ts:213-221 の INSERT 文に合わせて 6 カラム + id/answered_at default
-- を復元。outbound FK は撤廃 (child_id は text の論理 ID)。
create table public.quiz_attempts (
  id          uuid        primary key default gen_random_uuid(),
  child_id    text        not null,
  quiz_id     text        not null,
  selected    smallint    not null,
  is_correct  boolean     not null,
  xp_earned   integer     not null default 0,
  answered_at timestamptz not null default now()
);

create index idx_quiz_attempts_child_id
  on public.quiz_attempts (child_id);
create index idx_quiz_attempts_answered_at_desc
  on public.quiz_attempts (answered_at desc);

-- RLS: anon INSERT のみ許可、SELECT/UPDATE/DELETE は policy 無しで deny
alter table public.quiz_attempts enable row level security;
create policy quiz_attempts_anon_insert on public.quiz_attempts
  for insert to anon
  with check (true);

comment on table public.quiz_attempts is
  'クイズ回答ログ (active)。2026-04-22 Path A で uuid→text 化 (0036)。'
  'anon INSERT のみ許可、他 op は policy 無しで deny。';
comment on column public.quiz_attempts.child_id is
  '論理 child_id (text)。他テーブルと共通。例: "個別_さとる"。';


-- ---------- Step 4: dormant 3 テーブル再作成 (skeleton) ----------
-- 2026-04-22 時点でアプリ参照ゼロ。真の仕様が決まったら ALTER で拡張。
-- RLS enable + policy 無し = anon 全 op deny。

create table public.daily_missions (
  id         uuid        primary key default gen_random_uuid(),
  child_id   text        not null,
  created_at timestamptz not null default now()
);
create index idx_daily_missions_child_id on public.daily_missions (child_id);
alter table public.daily_missions enable row level security;
comment on table public.daily_missions is
  'dormant (2026-04-22 時点アプリ参照ゼロ)。真の仕様決定後に拡張予定。'
  'RLS enable、policy 無し = anon 全 op deny。';

create table public.diagnoses (
  id         uuid        primary key default gen_random_uuid(),
  child_id   text        not null,
  created_at timestamptz not null default now()
);
create index idx_diagnoses_child_id on public.diagnoses (child_id);
alter table public.diagnoses enable row level security;
comment on table public.diagnoses is
  'dormant (2026-04-22 時点アプリ参照ゼロ)。旧 chat_logs.diagnosis_id の参照先。'
  'RLS enable、policy 無し = anon 全 op deny。';

create table public.parent_reports (
  id         uuid        primary key default gen_random_uuid(),
  child_id   text        not null,
  created_at timestamptz not null default now()
);
create index idx_parent_reports_child_id on public.parent_reports (child_id);
alter table public.parent_reports enable row level security;
comment on table public.parent_reports is
  'dormant (2026-04-22 時点アプリ参照ゼロ)。weekly_reports が主実装系。'
  'RLS enable、policy 無し = anon 全 op deny。';

commit;


-- ======================================================================
-- 手動確認クエリ (migration 適用後に実行)
-- ======================================================================
--
-- -- (a) 4 テーブルの child_id 型が text になったか
-- select table_name, column_name, data_type
--   from information_schema.columns
--  where table_schema='public'
--    and table_name in ('quiz_attempts','daily_missions','diagnoses','parent_reports')
--    and column_name='child_id'
--  order by table_name;
-- -- 期待: 4 行、全て text
--
-- -- (b) chat_logs の FK 撤廃確認
-- select conname from pg_constraint
--  where conrelid='public.chat_logs'::regclass and contype='f';
-- -- 期待: diagnosis_id_fkey が消えている (他 FK は元々無いか残存)
--
-- -- (c) quiz_attempts の RLS ポリシー確認
-- select policyname, cmd, roles::text, qual, with_check
--   from pg_policies
--  where schemaname='public' and tablename='quiz_attempts';
-- -- 期待: 1 行 (quiz_attempts_anon_insert, INSERT, {anon}, with_check=true)
--
-- -- (d) dormant 3 テーブルに policy が無いことを確認
-- select tablename, count(*) as policy_count
--   from pg_policies
--  where schemaname='public'
--    and tablename in ('daily_missions','diagnoses','parent_reports')
--  group by tablename;
-- -- 期待: 0 行 (policy 無し = anon 全 op deny)
--
-- -- (e) text child_id で INSERT テスト (rollback 前提)
-- -- begin;
-- --   insert into public.quiz_attempts (child_id, quiz_id, selected, is_correct, xp_earned)
-- --     values ('個別_テスト', 'q-001', 0, true, 10);
-- --   select * from public.quiz_attempts;
-- -- rollback;
-- -- 期待: 1 行、child_id='個別_テスト'、answered_at=now
