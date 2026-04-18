-- ======================================================================
-- 0023_extend_parent_invite_codes.sql
-- 保護者ダッシュボード: parent_invite_codes を拡張
--   * code を TRAIL-XXXXXX (= 12 文字) 対応に型拡張
--   * id uuid 追加（UNIQUE、admin_* RPC の p_id で参照）
--   * target_children text[] 追加（複数子対応、既存 child_id からデータ移行）
--   * parent_name / relationship / memo 追加
--   * status 算出 View parent_invite_codes_with_status 作成
--     （PostgreSQL は STORED generated column に NOW() を使えないため
--      View 側で都度算出する設計）
--   * child_id カラムは後方互換のため残す（0020_consume_invite_code 参照）
-- ======================================================================

set client_encoding = 'UTF8';

-- code: varchar(6) → varchar(12)
alter table public.parent_invite_codes
  alter column code type varchar(12);

-- id uuid: UNIQUE 制約のみ（PK は既存の code を維持）
alter table public.parent_invite_codes
  add column if not exists id uuid not null default gen_random_uuid();
-- 本番の実在名に揃える: parent_invite_codes_id_unique
create unique index if not exists parent_invite_codes_id_unique
  on public.parent_invite_codes(id);

-- target_children / parent_name / relationship / memo
alter table public.parent_invite_codes
  add column if not exists target_children text[] not null default '{}'::text[];
alter table public.parent_invite_codes
  add column if not exists parent_name  text;
alter table public.parent_invite_codes
  add column if not exists relationship text;
alter table public.parent_invite_codes
  add column if not exists memo         text;

-- 既存 child_id を target_children に移行（target_children が未設定の行のみ）
update public.parent_invite_codes
   set target_children = array[child_id]
 where child_id is not null
   and (target_children is null or target_children = '{}'::text[]);

-- 一覧取得用ビュー: status を都度算出
create or replace view public.parent_invite_codes_with_status as
select
  p.*,
  case
    when p.used_at is not null       then 'used'
    when p.expires_at < now()        then 'expired'
    else                                  'active'
  end as status
from public.parent_invite_codes p;

-- 発行日時の降順ソート（一覧画面のデフォルトソート用）と
-- 有効期限の全件インデックス（一覧フィルタ/期限切れ判定用）。
-- 既存 0017 の idx_invite_expires は used_at IS NULL の部分インデックスのため、
-- 期限切れ（used_at IS NOT NULL で expires_at を見たいケース）には別途必要。
create index if not exists idx_invite_codes_created
  on public.parent_invite_codes(created_at desc);
create index if not exists idx_invite_codes_expires_all
  on public.parent_invite_codes(expires_at);

comment on column public.parent_invite_codes.id is
  '内部ID（admin_* RPC の p_id に渡す UUID）。PK は code のままで、id は UNIQUE。';
comment on column public.parent_invite_codes.target_children is
  '紐付け対象の生徒ID配列。例: {''スターター_はるか'',''ベーシック_えりく''}';
comment on column public.parent_invite_codes.parent_name is
  '保護者名（任意、50 文字まで想定）';
comment on column public.parent_invite_codes.relationship is
  '続柄（mother/father/grandparent/other、任意）';
comment on column public.parent_invite_codes.memo is
  '管理メモ（任意、200 文字まで想定）';
comment on view public.parent_invite_codes_with_status is
  '招待コード一覧（status 算出つき）。active/used/expired の 3 値を付与。';
