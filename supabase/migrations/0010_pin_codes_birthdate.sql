-- =====================================================================
-- pin_codes に生年月日カラムを追加（新規登録フォーム対応）
-- - birth_year  : 生年（2010〜2020）
-- - birth_month : 生月（1〜12）
-- - birth_day   : 生日（1〜31）
-- 学年はクライアント側で生年月日から自動計算（4月区切り）
-- =====================================================================

set client_encoding = 'UTF8';

alter table public.pin_codes
  add column if not exists birth_year  integer check (birth_year between 2005 and 2025),
  add column if not exists birth_month integer check (birth_month between 1 and 12),
  add column if not exists birth_day   integer check (birth_day between 1 and 31);
