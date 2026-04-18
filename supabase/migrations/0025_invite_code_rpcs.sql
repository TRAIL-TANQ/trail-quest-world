-- ======================================================================
-- 0025_invite_code_rpcs.sql
-- 保護者ダッシュボード: 招待コード 発行 / 削除 / 再発行 の RPC
--
-- セキュリティ方針（Phase B1 暫定）:
--   * SECURITY DEFINER で実装し、anon ロールに EXECUTE を付与する。
--   * 管理者判定はクライアント側 AdminGuard.tsx の isAdmin() で行う。
--     これは既存の生徒管理・大会管理 RPC と同水準の防御レベル。
--
-- TODO（spec v6 §17「Supabase RLS 設定（公開前必須）」の一環）:
--   * Supabase Auth 導入時に RLS + auth.jwt() role claim で厳格化する
--   * anon ロールの EXECUTE 権限を剥奪する
--   * parent_invite_codes / invite_code_logs に RLS ポリシーを張る
-- ======================================================================

set client_encoding = 'UTF8';

-- ----------------------------------------------------------------------
-- 内部ヘルパー: 招待コードを 1 件生成
--   ALPHABET = 30 文字（0,1,I,O,L,l 等の紛らわしい文字を除外）
--   形式: 'TRAIL-XXXXXX'（プレフィックス + 6 桁）
-- ----------------------------------------------------------------------
create or replace function public.generate_invite_code()
returns text as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result   text := '';
  i        int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, floor(random() * 30 + 1)::int, 1);
  end loop;
  return 'TRAIL-' || result;
end;
$$ language plpgsql;

-- 衝突チェック付き。10 回リトライしても衝突するなら例外。
create or replace function public.generate_unique_invite_code()
returns text as $$
declare
  candidate text;
  attempt   int := 0;
begin
  loop
    candidate := public.generate_invite_code();
    perform 1 from public.parent_invite_codes where code = candidate;
    if not found then
      return candidate;
    end if;
    attempt := attempt + 1;
    if attempt > 10 then
      raise exception 'Failed to generate unique invite code after 10 attempts';
    end if;
  end loop;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------
-- admin_create_invite_code: 招待コードを新規発行
--   戻り値: { success, id, code, expires_at } or { success=false, error }
--   child_id カラムには後方互換のため target_children[1] を入れる。
-- ----------------------------------------------------------------------
create or replace function public.admin_create_invite_code(
  p_target_children text[],
  p_parent_name     text default null,
  p_relationship    text default null,
  p_memo            text default null
) returns jsonb
security definer
language plpgsql
as $$
declare
  v_code         text;
  v_id           uuid;
  v_expires_at   timestamptz;
  v_legacy_child text;
begin
  if array_length(p_target_children, 1) is null then
    return jsonb_build_object('success', false, 'error', 'target_children_required');
  end if;

  v_code         := public.generate_unique_invite_code();
  v_expires_at   := now() + interval '72 hours';
  v_legacy_child := p_target_children[1];

  insert into public.parent_invite_codes (
    code, child_id, target_children, parent_name, relationship, memo,
    created_at, expires_at, created_by
  ) values (
    v_code, v_legacy_child, p_target_children, p_parent_name, p_relationship, p_memo,
    now(), v_expires_at, 'admin'
  ) returning id into v_id;

  insert into public.invite_code_logs (code, action, actor, metadata)
  values (
    v_code, 'created', 'admin',
    jsonb_build_object(
      'target_children', p_target_children,
      'parent_name',     p_parent_name
    )
  );

  return jsonb_build_object(
    'success',    true,
    'id',         v_id,
    'code',       v_code,
    'expires_at', v_expires_at
  );
end;
$$;

-- ----------------------------------------------------------------------
-- admin_delete_invite_code: 未使用コードを削除
--   使用済みコードは削除不可（監査証跡のため残す）
-- ----------------------------------------------------------------------
create or replace function public.admin_delete_invite_code(p_id uuid)
returns jsonb
security definer
language plpgsql
as $$
declare
  v_code    text;
  v_used_at timestamptz;
begin
  select code, used_at into v_code, v_used_at
    from public.parent_invite_codes where id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  if v_used_at is not null then
    return jsonb_build_object('success', false, 'error', 'already_used');
  end if;

  delete from public.parent_invite_codes where id = p_id;

  insert into public.invite_code_logs (code, action, actor)
  values (v_code, 'deleted', 'admin');

  return jsonb_build_object('success', true);
end;
$$;

-- ----------------------------------------------------------------------
-- admin_regenerate_invite_code: 旧コードを削除して新コードを発行
--   target_children / parent_name / relationship / memo は旧レコードから引き継ぐ
-- ----------------------------------------------------------------------
create or replace function public.admin_regenerate_invite_code(p_id uuid)
returns jsonb
security definer
language plpgsql
as $$
declare
  v_old_code         text;
  v_target_children  text[];
  v_parent_name      text;
  v_relationship     text;
  v_memo             text;
  v_new_code         text;
  v_new_id           uuid;
  v_new_expires_at   timestamptz;
  v_legacy_child     text;
begin
  select code, target_children, parent_name, relationship, memo
    into v_old_code, v_target_children, v_parent_name, v_relationship, v_memo
    from public.parent_invite_codes where id = p_id;

  if not found then
    return jsonb_build_object('success', false, 'error', 'not_found');
  end if;

  delete from public.parent_invite_codes where id = p_id;

  v_new_code       := public.generate_unique_invite_code();
  v_new_expires_at := now() + interval '72 hours';
  v_legacy_child   := v_target_children[1];

  insert into public.parent_invite_codes (
    code, child_id, target_children, parent_name, relationship, memo,
    created_at, expires_at, created_by
  ) values (
    v_new_code, v_legacy_child, v_target_children, v_parent_name, v_relationship, v_memo,
    now(), v_new_expires_at, 'admin'
  ) returning id into v_new_id;

  insert into public.invite_code_logs (code, action, actor, metadata)
  values (
    v_new_code, 'regenerated', 'admin',
    jsonb_build_object('old_code', v_old_code)
  );

  return jsonb_build_object(
    'success',    true,
    'id',         v_new_id,
    'code',       v_new_code,
    'expires_at', v_new_expires_at
  );
end;
$$;

-- ----------------------------------------------------------------------
-- anon ロールに EXECUTE 付与（Phase B1 暫定）
-- TODO: 本番公開前に剥奪し、Supabase Auth の role claim でガードする
-- ----------------------------------------------------------------------
grant execute on function public.admin_create_invite_code(text[], text, text, text) to anon;
grant execute on function public.admin_delete_invite_code(uuid) to anon;
grant execute on function public.admin_regenerate_invite_code(uuid) to anon;
