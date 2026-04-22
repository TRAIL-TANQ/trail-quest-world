-- ======================================================================
-- 0038_study_game_seed.sql
-- STUDY_GAME_SPEC v1.2 Phase A Commit B: 勉強ゲーム 動作確認用 seed (1 問)
--
-- 目的:
--   Phase A の round-trip 動作確認 (fetch_questions → UI 表示 → submit_answer →
--   quiz_answer_logs INSERT) を最小データで通すための 1 問だけ投入。
--
-- 投入内容:
--   math_q4c_easy_001 (算数 4択 easy) × 1 問のみ
--
-- 60 問の本投入は kk 作成後に別 migration 0039_ で追加する。
-- FU-012 教訓: Supabase Studio から直接 INSERT しないこと。必ず migration 経由。
--
-- 参考:
--   STUDY_GAME_SPEC v1.2 §問題マスタ作成ガイド (INSERT 雛形 / id 命名規則 /
--   wrong_answers JSONB 構造)
-- ======================================================================

set client_encoding = 'UTF8';

insert into public.quiz_questions (
  id, subject, mode, difficulty,
  question_text, correct_answer, wrong_answers, explanation, is_active
) values (
  'math_q4c_easy_001',
  'math', 'quiz_4choice', 'easy',
  '15 × 24 = ?',
  '360',
  '[
    {"answer": "340", "pattern": "calculation_error"},
    {"answer": "380", "pattern": "calculation_error"},
    {"answer": "410", "pattern": "place_value_error"}
  ]'::jsonb,
  '15 × 24 = 15 × (20+4) = 300 + 60 = 360',
  true
)
on conflict (id) do nothing;


-- ======================================================================
-- 検証クエリ (kk が Supabase SQL Editor で migration 適用後に実行)
-- ======================================================================
--
-- SELECT id, subject, mode, difficulty, question_text, is_active
--   FROM public.quiz_questions
--  ORDER BY id;
-- -- 期待: 1 行
-- --   math_q4c_easy_001 | math | quiz_4choice | easy | 15 × 24 = ? | t
