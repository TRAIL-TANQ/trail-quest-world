-- ======================================================================
-- 0033_migrate_child_status_child_id_to_text.sql
-- Commit D.1 (Path Z): child_status を DROP → text child_id で再作成
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
--   - child_status 件数     = 0 (データロスなし)
--   - children 件数         = 0、アプリコード参照ゼロ (orphan)
--   - FK child_status_child_id_fkey = public.children(id) を参照
--   - child_status の RLS ポリシー child_status_own は USING 句内で
--     children(id) に対して uuid 比較を行っている (3 層の依存)
--
-- 適用履歴 (今回で 4 回目、複数段階の drift):
--   - v1 (2026-04-21): ALTER COLUMN TYPE で
--     "cannot alter type of a column used in a policy definition"
--   - v2: RLS ポリシー save/restore 実装 →
--     "foreign key constraint cannot be implemented"
--   - v3: FK DROP 追加 →
--     "operator does not exist: text = uuid"
--     (ポリシー USING 句内の children(id) uuid 比較が残っていた)
--   - v4 (本版、Path Z): DROP TABLE ... CASCADE で全依存を切り、
--     text child_id で再作成。app が期待する 8 カラム構成で復元。
--
-- Path Z を選んだ理由:
--   - v1→v2→v3 と 3 段階で依存が発覚し、ALTER 方式は隠れた依存が残る
--   - データロスゼロ (child_status は 0 行) なので DROP CASCADE 可
--   - CREATE TABLE で schema を git 管理下に置ける (baseline 化)
--   - Path F より 1 回で確実に終わる、Phase 1 最短距離
--
-- 復元カラム (adminDashboardService.ts:103 の SELECT 一覧を正とした):
--   child_id / level / xp / alt_points / rating / wins / losses /
--   created_at / updated_at
--
-- RLS 方針:
--   gacha_pulls / user_profile / quest_progress 等の兄弟 text child_id
--   テーブルと同じく DISABLE ROW LEVEL SECURITY。市場機能は
--   SECURITY DEFINER RPC 経由、その他機能は anon 直読み書きという
--   このプロジェクトの既存パターンを踏襲。
--
-- 関連 follow-up (別 Issue、本 migration のスコープ外):
--   - children テーブル (orphan) の整理 (DROP するか残すか)
--   - child_status_own の代替ポリシー復活検討 (Supabase Auth 導入時)
--   - quizService.ts:273 の isUuid() ガード撤廃
--   - 既存プレイヤーの localStorage ALT → child_status.alt_points 移行
-- ======================================================================

set client_encoding = 'UTF8';

-- ---------- Step 1: 既存 child_status を全依存ごと DROP ----------
-- CASCADE で以下が一緒に消える:
--   - FK child_status_child_id_fkey (children.id 参照)
--   - RLS ポリシー child_status_own (USING 句で children(id) uuid 比較)
--   - その他 child_status に依存する view / trigger / rule (あれば)
-- child_status は 0 行のためデータロスなし。
drop table if exists public.child_status cascade;


-- ---------- Step 2: text child_id で child_status を再作成 ----------
-- adminDashboardService.ts:103 の SELECT 一覧に合わせた 8 カラム +
-- 整合性のための created_at / CHECK 制約。
create table public.child_status (
  child_id    text        primary key,
  level       integer     not null default 1    check (level >= 1),
  xp          integer     not null default 0    check (xp >= 0),
  alt_points  integer     not null default 0    check (alt_points >= 0),
  rating      integer     not null default 1000,
  wins        integer     not null default 0    check (wins >= 0),
  losses      integer     not null default 0    check (losses >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.child_status is
  '生徒ごとのステータス (ALT/XP/level/rating/wins/losses)。'
  '2026-04-21 Path Z で uuid → text に再構築 (0033 v4)。'
  'RLS は他の text child_id テーブルと同じく disabled。';
comment on column public.child_status.child_id is
  '論理 child_id (text)。他の全テーブル (gacha_pulls / card_transactions 等) と共通。'
  '例: "個別_さとる" / "スターター_はるか"。';
comment on column public.child_status.alt_points is 'ALT 残高 (市場機能の正本)';
comment on column public.child_status.rating is 'バトルレーティング (Elo)、default 1000';


-- ---------- Step 3: RLS disabled (兄弟テーブルと揃える) ----------
-- gacha_pulls / user_profile / quest_progress / quiz_history / alt_game_scores
-- 等は全て RLS DISABLE。Supabase Auth 未導入のためポリシーで enforce
-- できない現状ではこれがプロジェクトの既存パターン。
alter table public.child_status disable row level security;


-- ---------- Step 4: 基本インデックス ----------
-- rating / alt_points で降順ソート (ranking page) する既存クエリのため。
-- 0 行でも pg_class 登録されていれば将来のパフォーマンスは担保される。
create index if not exists idx_child_status_rating_desc
  on public.child_status (rating desc);
create index if not exists idx_child_status_alt_points_desc
  on public.child_status (alt_points desc);


-- ---------- 確認クエリ (手動実行用) ----------
--
-- -- (a) テーブル構造確認
-- select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--  where table_schema = 'public' and table_name = 'child_status'
--  order by ordinal_position;
-- -- 期待: 9 カラム、child_id=text、他は integer / timestamptz
--
-- -- (b) FK / ポリシーが残っていないか確認
-- select conname from pg_constraint c join pg_class t on t.oid=c.conrelid
--  where t.relname='child_status' and c.contype='f';
-- -- 期待: 0 行
--
-- select policyname from pg_policies
--  where schemaname='public' and tablename='child_status';
-- -- 期待: 0 行
--
-- -- (c) text child_id でテスト INSERT (ロールバック前提)
-- -- begin;
-- --   insert into public.child_status (child_id) values ('個別_テスト');
-- --   select * from public.child_status where child_id = '個別_テスト';
-- -- rollback;
-- -- 期待: 1 行、alt_points=0, level=1, rating=1000 等の default 値
