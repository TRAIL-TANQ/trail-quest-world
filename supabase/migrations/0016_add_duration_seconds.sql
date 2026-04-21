-- =====================================================================
-- duration_seconds カラム追加
--
-- 保護者ダッシュボードの「学習時間」集計のため、
-- battle_history / alt_game_scores 両テーブルにプレイ秒数を記録する。
--
-- battle_history.duration_seconds : バトル開始（デッキ確定→第1回戦開始）
--                                   から終了までの経過秒数
-- alt_game_scores.duration_seconds : ALTゲームのスタート→終了までの秒数
--
-- 既存レコードは DEFAULT 0（時間不明）として扱う。
-- 新規INSERT時にアプリ側で正確な値をセットする。
-- =====================================================================

set client_encoding = 'UTF8';

alter table public.battle_history
  add column if not exists duration_seconds integer not null default 0;

alter table public.alt_game_scores
  add column if not exists duration_seconds integer not null default 0;

comment on column public.battle_history.duration_seconds is
  'バトル開始から終了までの秒数（0 は未計測レコード）';
comment on column public.alt_game_scores.duration_seconds is
  'ALTゲームのプレイ時間秒数（0 は未計測レコード）';
