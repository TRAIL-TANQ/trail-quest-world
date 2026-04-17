-- =====================================================================
-- alt_game_scores.difficulty 追加
-- 計算バトル・比較バトルに 5段階（★1〜★5）の難易度選択を導入。
-- 既存レコードは DEFAULT 1（かんたん）として扱う。
-- =====================================================================

set client_encoding = 'UTF8';

alter table public.alt_game_scores
  add column if not exists difficulty integer not null default 1;

-- 難易度別集計・ランキング用のインデックス
create index if not exists idx_alt_game_type_diff
  on public.alt_game_scores (game_type, difficulty, played_at desc);
