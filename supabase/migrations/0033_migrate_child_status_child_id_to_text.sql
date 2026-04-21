-- ======================================================================
-- 0033_migrate_child_status_child_id_to_text.sql
-- Commit D.1 (Path A): child_status.child_id を uuid → text に統一
--
-- 背景:
--   child_status テーブルは CREATE TABLE 文が git history に存在せず、
--   Supabase 管理画面から手動作成された結果、child_id が uuid 型になっていた。
--   他の全テーブル (gacha_pulls / card_transactions / quest_progress /
--   parent_invite_codes / user_profile 等) は text 型で、生徒の論理 ID
--   (例: "個別_さとる" / "スターター_はるか") を格納している。
--   この drift により、本番の生徒アカウントは child_status に書き込めず、
--   ALT / XP / rating が長期間 DB 永続化されていなかった
--   (quizService.ts:273 の isUuid() ガードで静かに skip されていた)。
--
-- kk による 2026-04-21 診断結果:
--   - child_status 件数 = 0 (データロスなし、型変更は完全に安全)
--   - gacha_pulls.child_id の実データは text 形式 (例: "個別_さとる")
--   - child_status の child_id を参照する FK 制約は現状なし
--
-- 本 migration は schema drift を解消する最小変更。副作用ゼロ、
-- 市場機能 (0029-0032) が本番で動作するための前提条件。
--
-- 関連 follow-up (別 Issue):
--   - children テーブル (診断で発見された生徒マスタ候補) の位置づけ整理
--   - child_status の baseline migration (CREATE TABLE) 作成
--   - quizService.ts:273 の isUuid() ガード撤廃
--   - 既存プレイヤーの localStorage ALT → child_status.alt_points 移行
-- ======================================================================

set client_encoding = 'UTF8';

-- ---------- 型変換 ----------
-- child_id uuid → text に変更。既存行 (0 件) は uuid を text 表現に変換。
-- 参照する FK は存在しないため、DROP → ALTER → 再作成のブロックは不要。
alter table public.child_status
  alter column child_id type text using child_id::text;

comment on column public.child_status.child_id is
  '論理 child_id (text)。他の全テーブルと統一。例: "個別_さとる" / "スターター_はるか"。'
  '2026-04-21 に uuid → text へ変更 (0033)。';


-- ---------- 確認クエリ (手動実行用) ----------
--
-- -- 型が text になったか確認
-- select column_name, data_type, udt_name
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'child_status'
--    and column_name = 'child_id';
-- 期待: data_type='text', udt_name='text'
--
-- -- 試しに非 UUID child_id で行を insert できるか
-- -- (ロールバック前提、本番では実行しない)
-- -- begin;
-- -- insert into public.child_status (child_id, level, xp, alt_points)
-- --   values ('個別_テスト', 1, 0, 100);
-- -- select child_id, alt_points from public.child_status where child_id = '個別_テスト';
-- -- rollback;
