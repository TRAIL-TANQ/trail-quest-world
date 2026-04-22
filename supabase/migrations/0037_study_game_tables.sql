-- ======================================================================
-- 0037_study_game_tables.sql
-- STUDY_GAME_SPEC v1.2 Phase A Commit A: 勉強ゲーム 3 テーブル新設
--
-- 背景:
--   ALT ゲーム強化のため 4択モード + パネル破壊モードを追加。
--   教育分析のため、回答ログを既存 quiz_attempts とは別テーブルに分離。
--     quiz_attempts     : 4 バトルモード (計算/比較/分数/小数) の履歴 (0036 で text 化済)
--     quiz_answer_logs  : 4択 / パネル破壊 の詳細回答ログ (本 migration で新設)
--
-- 新テーブル:
--   public.quiz_questions        問題マスタ (seed は 0038 + 0039 で別投入)
--   public.quiz_answer_logs      回答ログ (誤答分析・教師ダッシュボード用)
--   public.panel_break_sessions  パネル破壊セッション履歴 (Phase C で使用開始)
--
-- RLS 方針 (STUDY_GAME_SPEC v1.2 §RLS 方針):
--   quiz_questions        anon SELECT only  (読み取りマスタ)
--   quiz_answer_logs      anon INSERT only  (書き込み専用、集計は service_role / RPC 経由)
--   panel_break_sessions  anon INSERT only  (同上)
--
-- subject 値:
--   Phase A 運用は 'math' のみ。他教科展開時に enum 拡張
--   → FU-015: 多科目展開時 subject enum マイグレーション
--
-- ALT 報酬 (STUDY_GAME_SPEC v1.2 §ALT 報酬):
--   quiz_answer_logs.alt_earned / panel_break_sessions.alt_earned に監査スナップショット記録。
--   ALT 残高の正本は child_status.alt_points (本 alt_earned は集計用)。
--   日次 3 回制限は localStorage 側で管理 (v1.2 論点3 確認済、DB 化は見送り)。
--
-- error_pattern enum (STUDY_GAME_SPEC v1.2 §error_pattern enum 定義):
--   calculation_error / carry_forget / place_value_error /
--   operation_order_error / sign_error / unit_conversion_error /
--   fraction_misunderstanding / decimal_misunderstanding /
--   misreading / time_out / other
--   DB 側で CHECK 制約により enum 逸脱を拒否。
--
-- FU 教訓:
--   FU-012: Supabase Studio 経由の手動テーブル追加禁止 → 本 migration で正規作成
--   FU-013: RLS 未設定事故再発防止 → 末尾に RLS 確認クエリをコメント併記
--
-- 本 migration には初期データ投入は含めない (Commit B / 0038 以降)。
-- ======================================================================

set client_encoding = 'UTF8';

-- ---------- quiz_questions ----------
-- 問題マスタ。全生徒クライアントが anon で SELECT。
-- INSERT/UPDATE/DELETE は migration / service_role 経由のみ (FU-012 教訓)。
create table if not exists public.quiz_questions (
  id             text        primary key,
  subject        text        not null check (subject in (
    'math', 'japanese', 'geography', 'science', 'social'
  )),
  mode           text        not null check (mode in ('quiz_4choice', 'panel_break')),
  difficulty     text        not null check (difficulty in (
    'easy', 'medium', 'hard', 'extreme'
  )),
  question_text  text        not null,
  correct_answer text        not null,
  wrong_answers  jsonb       not null,
  explanation    text,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now()
);

comment on table public.quiz_questions is
  '勉強ゲーム問題マスタ (4択 / パネル破壊)。Phase A は subject=math, mode=quiz_4choice のみ運用。';
comment on column public.quiz_questions.subject is
  'Phase A は math 固定。将来他教科展開時に CHECK 拡張 (FU-015)。';
comment on column public.quiz_questions.wrong_answers is
  'JSONB: [{value, error_pattern, error_detail?}]。error_pattern は 11 種 enum から選択 (spec §error_pattern enum 定義)。';
comment on column public.quiz_questions.is_active is
  '公開フラグ。FALSE の問題は anon SELECT ポリシーで除外される (ソフト削除)。DELETE は quiz_answer_logs の question_id 参照整合性を壊すため避ける。';

create index if not exists idx_quiz_questions_lookup
  on public.quiz_questions (subject, mode, difficulty);

-- 公開問題のみに絞った部分 index。RLS SELECT policy (is_active = true) と同条件のため、
-- 生徒クライアントの fetch_questions 系クエリが確実にこの index を使う。
create index if not exists idx_quiz_questions_active
  on public.quiz_questions (subject, mode, difficulty)
  where is_active = true;

alter table public.quiz_questions enable row level security;

-- 旧 policy 名で作成済みの環境 (ローカル再適用時) 用に両方 DROP してから CREATE
drop policy if exists "public_read_quiz_questions" on public.quiz_questions;
drop policy if exists "quiz_questions_anon_select" on public.quiz_questions;
create policy "quiz_questions_anon_select"
  on public.quiz_questions
  for select
  to anon
  using (is_active = true);

-- INSERT/UPDATE/DELETE ポリシーは作らない → anon 書き込み不可
-- service_role / SECURITY DEFINER RPC / migration からは書き込み可


-- ---------- quiz_answer_logs ----------
-- 回答ログ。クライアントから anon INSERT。
-- SELECT/UPDATE/DELETE は service_role / RPC 経由のみ。
create table if not exists public.quiz_answer_logs (
  id               uuid        primary key default gen_random_uuid(),
  child_id         text        not null,
  subject          text        not null,
  mode             text        not null check (mode in ('quiz_4choice', 'panel_break')),
  question_id      text        not null,
  selected_answer  text,
  is_correct       boolean     not null,
  response_time_ms integer     check (response_time_ms is null or response_time_ms >= 0),
  error_pattern    text        check (
    error_pattern is null or error_pattern in (
      'calculation_error', 'carry_forget', 'place_value_error',
      'operation_order_error', 'sign_error', 'unit_conversion_error',
      'fraction_misunderstanding', 'decimal_misunderstanding',
      'misreading', 'time_out', 'other'
    )
  ),
  error_detail     text,
  alt_earned       integer     not null default 0 check (alt_earned >= 0),
  created_at       timestamptz not null default now()
);

comment on table public.quiz_answer_logs is
  '勉強ゲーム (4択 / パネル破壊) の回答ログ。誤答分析・教師ダッシュボード用 (Phase B で UI 化)。';
comment on column public.quiz_answer_logs.subject is
  'Phase A は math 固定 (FU-015 で enum 化検討)。';
comment on column public.quiz_answer_logs.error_pattern is
  '誤答分類 enum (11 種)。正解時は NULL。spec §error_pattern enum 定義を参照。';
comment on column public.quiz_answer_logs.error_detail is
  '問題固有の誤答詳細 (任意フリーテキスト)。quiz_questions.wrong_answers[].error_detail から転写。';
comment on column public.quiz_answer_logs.alt_earned is
  '当該回答で加算された ALT の監査スナップショット。日次上限超過時は 0。正本残高は child_status.alt_points。';

-- 生徒ごとの時系列参照 (直近ログ取得)
create index if not exists idx_quiz_logs_child_time
  on public.quiz_answer_logs (child_id, created_at desc);

-- 誤答パターン集計 (is_correct = false 限定の sparse index)
create index if not exists idx_quiz_logs_error_pattern
  on public.quiz_answer_logs (error_pattern)
  where is_correct = false;

-- 日次セッション集計 (JST 基準の DATE 値でグルーピング)
create index if not exists idx_quiz_logs_child_daily
  on public.quiz_answer_logs (
    child_id,
    (date(created_at at time zone 'Asia/Tokyo'))
  );

alter table public.quiz_answer_logs enable row level security;

drop policy if exists "anon_insert_quiz_answer_logs" on public.quiz_answer_logs;
create policy "anon_insert_quiz_answer_logs"
  on public.quiz_answer_logs
  for insert
  to anon
  with check (true);

-- SELECT/UPDATE/DELETE ポリシーは作らない → anon はこれら全 op 不可


-- ---------- panel_break_sessions ----------
-- パネル破壊モードのセッションサマリ。Phase C で使用開始、Phase A 時点ではスキーマのみ用意。
create table if not exists public.panel_break_sessions (
  id               uuid        primary key default gen_random_uuid(),
  child_id         text        not null,
  subject          text        not null,
  difficulty       text        not null check (difficulty in (
    'easy', 'medium', 'hard', 'extreme'
  )),
  target_rule      text        not null,
  panels_destroyed integer     not null default 0 check (panels_destroyed >= 0),
  max_combo        integer     not null default 0 check (max_combo >= 0),
  total_score      integer     not null default 0 check (total_score >= 0),
  alt_earned       integer     not null default 0 check (alt_earned >= 0),
  duration_seconds integer     not null check (duration_seconds >= 0),
  created_at       timestamptz not null default now()
);

comment on table public.panel_break_sessions is
  'パネル破壊モードのセッション履歴。Phase C で実装使用開始。Phase A ではスキーマのみ定義。';
comment on column public.panel_break_sessions.target_rule is
  'お題ルール識別子 (例: sum_24 / prime_3 / common_multiple_12 など)。Phase C で enum 化検討。';

create index if not exists idx_panel_sessions_child
  on public.panel_break_sessions (child_id, created_at desc);

alter table public.panel_break_sessions enable row level security;

drop policy if exists "anon_insert_panel_break_sessions" on public.panel_break_sessions;
create policy "anon_insert_panel_break_sessions"
  on public.panel_break_sessions
  for insert
  to anon
  with check (true);

-- SELECT/UPDATE/DELETE ポリシーは作らない


-- ======================================================================
-- 検証クエリ (kk が Supabase SQL Editor で migration 適用後に実行)
-- FU-013 教訓: RLS 未設定事故の再発防止のため、投入直後に必ず (a) を確認すること
-- ======================================================================
--
-- -- (a) 3 テーブルが RLS ENABLE されているか
-- SELECT tablename, rowsecurity
--   FROM pg_tables
--  WHERE schemaname = 'public'
--    AND tablename IN ('quiz_questions', 'quiz_answer_logs', 'panel_break_sessions')
--  ORDER BY tablename;
-- -- 期待: rowsecurity = true の行が 3 行
--
-- -- (b) 各テーブルのポリシー / 対象 role / 対象 op を確認
-- SELECT tablename, policyname, cmd, roles
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN ('quiz_questions', 'quiz_answer_logs', 'panel_break_sessions')
--  ORDER BY tablename, policyname;
-- -- 期待:
-- --   quiz_questions        | quiz_questions_anon_select        | SELECT | {anon}
-- --   quiz_answer_logs      | anon_insert_quiz_answer_logs      | INSERT | {anon}
-- --   panel_break_sessions  | anon_insert_panel_break_sessions  | INSERT | {anon}
--
-- -- (c) error_pattern enum CHECK 制約が効いているか (失敗するはず)
-- -- INSERT INTO public.quiz_answer_logs
-- --   (child_id, subject, mode, question_id, is_correct, error_pattern)
-- --   VALUES ('test_check', 'math', 'quiz_4choice', 'dummy', false, 'invalid_pattern_xxx');
-- -- 期待: ERROR:  new row for relation "quiz_answer_logs" violates check constraint
--
-- -- (d) index 一覧 (PK + 作成した追加 index が揃っているか)
-- SELECT tablename, indexname
--   FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename IN ('quiz_questions', 'quiz_answer_logs', 'panel_break_sessions')
--  ORDER BY tablename, indexname;
-- -- 期待: index 6本 + PK 3本 = 9件
-- --   quiz_questions        | quiz_questions_pkey
-- --   quiz_questions        | idx_quiz_questions_lookup
-- --   quiz_questions        | idx_quiz_questions_active    (部分 index, is_active=TRUE のみ)
-- --   quiz_answer_logs      | quiz_answer_logs_pkey
-- --   quiz_answer_logs      | idx_quiz_logs_child_time
-- --   quiz_answer_logs      | idx_quiz_logs_error_pattern
-- --   quiz_answer_logs      | idx_quiz_logs_child_daily
-- --   panel_break_sessions  | panel_break_sessions_pkey
-- --   panel_break_sessions  | idx_panel_sessions_child
