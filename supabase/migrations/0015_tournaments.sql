-- =====================================================================
-- 0015: 対人戦績 & 大会システム
--
-- 追加:
--   - battle_history: opponent_id / opponent_deck_key を追加（対人戦の相手情報）
--   - tournaments: 大会本体
--   - tournament_matches: 大会内の各試合
--   - tournament_rewards: 賞品付与履歴
--   - tournament_match_rooms: 別端末対戦用のマッチングルーム（将来用）
--
-- battle_history の opponent_type は既に 'npc' | 'pvp' を格納する想定。
-- 対人戦では勝者/敗者それぞれの行を INSERT（childId=自分、opponent_id=相手）。
-- =====================================================================

set client_encoding = 'UTF8';

-- ===== battle_history: 対人戦フィールド追加 =====
alter table public.battle_history
  add column if not exists opponent_id         text,
  add column if not exists opponent_deck_key   text;

create index if not exists idx_battle_opponent on public.battle_history (opponent_id);
create index if not exists idx_battle_type     on public.battle_history (opponent_type);

-- ===== tournaments =====
create table if not exists public.tournaments (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  division      text not null check (division in ('elementary', 'middle')),
  finals_size   integer not null default 2 check (finals_size in (2, 4)),
  phase         text not null default 'recruiting' check (phase in ('recruiting', 'round_robin', 'finals', 'finished')),
  participants  text[] not null default '{}',
  champion_id   text,
  mvp_id        text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create index if not exists idx_tournament_phase on public.tournaments (phase, created_at desc);
create index if not exists idx_tournament_division on public.tournaments (division, phase);

-- ===== tournament_matches =====
create table if not exists public.tournament_matches (
  id                uuid primary key default gen_random_uuid(),
  tournament_id     uuid not null references public.tournaments(id) on delete cascade,
  round             integer not null,      -- 1..N. round_robin は 1、決勝は finals_size=2 の場合は 2、finals_size=4 なら 2(準決勝)/3(決勝/3位決定戦)
  match_order       integer not null,
  bracket           text,                  -- 'round_robin' | 'semi' | 'final' | 'third_place'
  player1_id        text not null,
  player2_id        text not null,
  player1_deck      text,
  player2_deck      text,
  winner_id         text,
  player1_finisher  text,
  player2_finisher  text,
  player1_fans      integer default 0,
  player2_fans      integer default 0,
  played_at         timestamptz
);

create index if not exists idx_tmatch_tournament on public.tournament_matches (tournament_id, round, match_order);
create index if not exists idx_tmatch_winner     on public.tournament_matches (winner_id);

-- ===== tournament_rewards =====
create table if not exists public.tournament_rewards (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references public.tournaments(id) on delete cascade,
  child_id       text not null,
  reward_type    text not null check (reward_type in ('champion','runner_up','third','mvp','best_finisher','fight_spirit')),
  alt_amount     integer not null default 0,
  title_text     text,
  awarded_at     timestamptz not null default now()
);

create index if not exists idx_treward_tournament on public.tournament_rewards (tournament_id);
create index if not exists idx_treward_child on public.tournament_rewards (child_id);

-- ===== tournament_match_rooms（別端末対戦用 / 将来用スタブ） =====
create table if not exists public.tournament_match_rooms (
  id                    uuid primary key default gen_random_uuid(),
  tournament_match_id   uuid references public.tournament_matches(id) on delete cascade,
  player1_id            text not null,
  player2_id            text not null,
  player1_ready         boolean not null default false,
  player2_ready         boolean not null default false,
  player1_deck          text,
  player2_deck          text,
  status                text not null default 'waiting' check (status in ('waiting','both_ready','battling','finished')),
  result_winner_id      text,
  created_at            timestamptz not null default now()
);

create index if not exists idx_matchroom_match  on public.tournament_match_rooms (tournament_match_id);
create index if not exists idx_matchroom_status on public.tournament_match_rooms (status);

-- 既存テーブルと同じ運用:
alter table public.tournaments              disable row level security;
alter table public.tournament_matches       disable row level security;
alter table public.tournament_rewards       disable row level security;
alter table public.tournament_match_rooms   disable row level security;
