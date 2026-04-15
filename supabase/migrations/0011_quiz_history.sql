-- =====================================================================
-- quiz_history : クイズ回答履歴（苦手問題分析・経営ダッシュボード用）
-- trail-quest-world 側でクイズ回答時に INSERT、ダッシュボード側で分析参照
--
-- difficulty は整数: 1=beginner / 2=challenger / 3=master / 4=legend
-- =====================================================================

set client_encoding = 'UTF8';

create table if not exists public.quiz_history (
  id                uuid primary key default gen_random_uuid(),
  child_id          text not null,
  deck_key          text not null,
  difficulty        integer not null check (difficulty between 1 and 4),
  question_text     text not null,
  selected_answer   text not null default '',
  correct_answer    text not null default '',
  correct           boolean not null,
  answered_at       timestamptz not null default now()
);

create index if not exists idx_quiz_history_child      on public.quiz_history (child_id, answered_at desc);
create index if not exists idx_quiz_history_deck_diff  on public.quiz_history (deck_key, difficulty);
create index if not exists idx_quiz_history_wrong      on public.quiz_history (child_id, correct) where correct = false;

alter table public.quiz_history disable row level security;
