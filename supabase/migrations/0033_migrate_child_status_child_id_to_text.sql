-- ======================================================================
-- 0033_migrate_child_status_child_id_to_text.sql
-- Commit D.1 (Path F): child_status.child_id を uuid → text に統一
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
--   - gacha_pulls.child_id  = text ("個別_さとる" のような論理 ID)
--   - FK child_status_child_id_fkey = public.children(id) を参照
--   - children テーブル     = 0 行、app コード参照ゼロ (orphan)
--   - 他に children.id を参照する FK = なし
--
-- 方針: Path F (最小変更、ゼロリスク)
--   - FK child_status_child_id_fkey を DROP (children が orphan なので参照整合性の意義なし)
--   - child_status の RLS ポリシーを save → DROP → ALTER → recreate
--   - child_status.child_id を text に変換
--   - children テーブルは放置 (0 行、app 非参照、別 Issue で整理)
--
-- 適用履歴:
--   - 2026-04-21 初回試行 (v1): "cannot alter type of a column used in a
--     policy definition" エラー。RLS ポリシーが child_id を参照していたため。
--   - 2026-04-21 再試行 (v2): RLS ポリシー save/restore 実装。今度は
--     "foreign key constraint cannot be implemented" エラー (FK が uuid 参照)。
--   - 2026-04-21 本版 (v3): FK DROP を追加。Path F 診断で children が
--     orphan と確定したため FK 再作成は行わない。
--
-- 関連 follow-up (別 Issue、本 migration のスコープ外):
--   - children テーブル自体の整理 (DROP するか、migration 管理下に置くか)
--   - child_status の baseline migration (CREATE TABLE) 作成
--   - quizService.ts:273 の isUuid() ガード撤廃
--   - 既存プレイヤーの localStorage ALT → child_status.alt_points 移行
-- ======================================================================

set client_encoding = 'UTF8';

-- ---------- FK + RLS ポリシーを退避してから型変換 ----------
-- child_id 列を参照する FK と RLS ポリシーがあると ALTER COLUMN TYPE できないため、
-- それらを先に DROP してから ALTER し、RLS ポリシーのみ元の定義で再作成する。
-- FK は Path F の方針で再作成しない (children が orphan、参照整合性の実質意義なし)。
--
-- DO block 全体は 1 トランザクションで実行されるため、途中で失敗すれば
-- FK / ポリシー / 列型の全てが元の状態にロールバックされる。
do $$
declare
  v_policies  jsonb;
  v_pol       record;
  v_roles     text;
  v_create    text;
begin
  -- Step 0: 既知の FK を DROP (children.id への参照を外す)
  alter table public.child_status
    drop constraint if exists child_status_child_id_fkey;
  raise notice '[0033] dropped FK if exists: child_status_child_id_fkey';

  -- Step 1: child_status の全ポリシーを JSONB として保存
  select jsonb_agg(
           jsonb_build_object(
             'policyname', policyname,
             'cmd',        cmd,
             'roles',      roles,
             'qual',       qual,
             'with_check', with_check
           )
         )
    into v_policies
    from pg_policies
   where schemaname = 'public'
     and tablename  = 'child_status';

  -- Step 2: 既存ポリシーを DROP (型変換のブロッカーを解除)
  if v_policies is not null then
    for v_pol in
      select *
        from jsonb_to_recordset(v_policies)
          as x(policyname text, cmd text, roles text[], qual text, with_check text)
    loop
      execute format('drop policy if exists %I on public.child_status', v_pol.policyname);
      raise notice '[0033] dropped policy: %', v_pol.policyname;
    end loop;
  end if;

  -- Step 3: 列型を変換 (uuid → text)
  alter table public.child_status
    alter column child_id type text using child_id::text;
  raise notice '[0033] child_status.child_id altered to text';

  -- Step 4: 保存しておいたポリシーを再作成 (FK は再作成しない)
  if v_policies is not null then
    for v_pol in
      select *
        from jsonb_to_recordset(v_policies)
          as x(policyname text, cmd text, roles text[], qual text, with_check text)
    loop
      v_create := format('create policy %I on public.child_status', v_pol.policyname);

      -- FOR <cmd> (ALL / SELECT / INSERT / UPDATE / DELETE)
      if v_pol.cmd is not null then
        v_create := v_create || ' for ' || v_pol.cmd;
      end if;

      -- TO <roles>
      if v_pol.roles is not null and array_length(v_pol.roles, 1) > 0 then
        select string_agg(quote_ident(r), ', ')
          into v_roles
          from unnest(v_pol.roles) as r;
        v_create := v_create || ' to ' || v_roles;
      end if;

      -- USING (<qual>)
      if v_pol.qual is not null then
        v_create := v_create || ' using (' || v_pol.qual || ')';
      end if;

      -- WITH CHECK (<with_check>)
      if v_pol.with_check is not null then
        v_create := v_create || ' with check (' || v_pol.with_check || ')';
      end if;

      execute v_create;
      raise notice '[0033] recreated policy: %', v_create;
    end loop;
  end if;
end $$;

comment on column public.child_status.child_id is
  '論理 child_id (text)。他の全テーブルと統一。例: "個別_さとる" / "スターター_はるか"。'
  '2026-04-21 に uuid → text へ変更 (0033 Path F: FK と RLS policy を退避してから ALTER)。';


-- ---------- 確認クエリ (手動実行用) ----------
--
-- -- 型が text になったか確認
-- select column_name, data_type, udt_name
--   from information_schema.columns
--  where table_schema = 'public'
--    and table_name = 'child_status'
--    and column_name = 'child_id';
-- -- 期待: data_type='text', udt_name='text'
--
-- -- FK が消えているか確認
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint c
--   join pg_class t on t.oid = c.conrelid
--  where t.relname = 'child_status' and c.contype = 'f';
-- -- 期待: 0 行 (child_status_child_id_fkey は DROP 済み)
--
-- -- RLS ポリシーが元通り再作成されたか確認
-- select policyname, cmd, roles, qual, with_check
--   from pg_policies
--  where schemaname = 'public' and tablename = 'child_status';
-- -- 期待: ALTER 前と同じ行が並ぶ (policyname / cmd / qual / with_check すべて一致)
