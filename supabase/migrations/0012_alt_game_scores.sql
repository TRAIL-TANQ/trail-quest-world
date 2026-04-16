-- =====================================================================
-- alt_game_scores : ALTゲーム（ミニゲーム集）のスコア記録
-- 第1弾（2026-04）: 計算バトル / 比較バトル
-- 以降: 国語系 4 / 地理系 4 を追加予定
--
-- game_type は以下のいずれか:
--   keisan_battle     : 🔢 計算バトル
--   hikaku_battle     : ⚡ 比較バトル
--   kanji_flash       : 📝 漢字フラッシュ（予約）
--   yojijukugo        : 🎌 四字熟語クイズ（予約）
--   kotowaza_puzzle   : 🔀 ことわざパズル（予約）
--   bunsho_narabe     : 📖 文章並べ替え（予約）
--   todofuken         : 🗾 都道府県タッチ（予約）
--   kenchoushozaichi  : 🏙️ 県庁所在地クイズ（予約）
--   kokki_flash       : 🌍 国旗フラッシュ（予約）
--   nihonichi         : 🏔️ 日本一クイズ（予約）
--
-- max_level / max_combo は計算バトル用（他ゲームでは NULL 可）
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.alt_game_scores (
  id          uuid primary key default gen_random_uuid(),
  child_id    text not null,
  game_type   text not null,
  score       integer not null default 0,
  max_level   integer,
  max_combo   integer,
  alt_earned  integer not null default 0,
  played_at   timestamptz not null default now()
);

create index if not exists idx_alt_game_child on public.alt_game_scores (child_id, played_at desc);
create index if not exists idx_alt_game_type  on public.alt_game_scores (game_type, played_at desc);

-- 既存テーブル（child_status 等）と同じ運用: anon キー経由で insert できるよう RLS は無効化。
-- 公開前に必ず RLS ポリシーを設計し直すこと（child_id 詐称対策）。
alter table public.alt_game_scores disable row level security;
