-- ======================================================================
-- 0020_consume_invite_code.sql
-- 保護者ダッシュボード: 招待コード消費用のRPC関数
-- SECURITY DEFINER で排他処理、二重使用を防止
-- ======================================================================

set client_encoding = 'UTF8';

create or replace function public.consume_invite_code(
  p_code     text,
  p_line_uid text
) returns jsonb as $$
declare
  v_invite public.parent_invite_codes;
begin
  -- 有効なコードを排他ロックで取得
  select * into v_invite
  from public.parent_invite_codes
  where code = p_code
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    return jsonb_build_object(
      'success', false,
      'reason', 'invalid_or_expired'
    );
  end if;

  -- 消費を記録
  update public.parent_invite_codes
  set used_at = now(),
      used_by_line_uid = p_line_uid
  where code = p_code;

  -- 紐付けを作成（既にあればスキップ）
  insert into public.parent_child_links(line_uid, child_id)
  values (p_line_uid, v_invite.child_id)
  on conflict (line_uid, child_id) do nothing;

  return jsonb_build_object(
    'success', true,
    'child_id', v_invite.child_id
  );
end;
$$ language plpgsql security definer;

comment on function public.consume_invite_code is
  '招待コードを消費し、保護者と子を紐付ける。排他処理で二重使用防止。';
