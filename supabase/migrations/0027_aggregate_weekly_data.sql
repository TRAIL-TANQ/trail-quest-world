-- ======================================================================
-- 0028_aggregate_weekly_data.sql
-- Phase C: 週次レポート生成のための生徒別集計 RPC
--
--   aggregate_weekly_data(p_child_id text, p_week_start date) returns jsonb
--
-- 返却 JSON（Edge Function → Claude プロンプトに組み込む想定）:
-- {
--   "child_id": "...",
--   "week_start": "2026-04-13",
--   "week_end":   "2026-04-19",
--   "battle":   { total, wins, losses, win_rate, duration_seconds,
--                 by_deck: [{deck_key,uses,wins}],
--                 finisher_top: [{name,count}] },
--   "alt_game": { count, total_alt_earned, duration_seconds,
--                 by_type: [{game_type,count,best_score,total_alt}] },
--   "quiz":     { total_answered, correct, accuracy,
--                 weak_decks: [{deck_key,accuracy,wrong}] },
--   "gacha":    { total_pulls, ssr_count, sr_count,
--                 highlights: [{card_id,rarity,pulled_at}] },
--   "tournament": { participated, results: [...] },
--   "study":    { total_duration_seconds,
--                 daily: [{date,seconds}] },
--   "alt_earned_this_week": <sum of alt_earned in alt_game_scores>,
--   "notable_events": [
--     { type: 'ssr' | 'tournament' | 'big_day' | 'streak', text, date }
--   ]
-- }
--
-- 注: child_status には ALT 履歴が残らない（現在値のみ）ため、
--     「週内に獲得した ALT」= alt_game_scores.alt_earned の合計 を採用。
--     残高差分は Phase C2 以降で alt_balance_snapshots テーブル等を
--     導入するまで計算不能。
-- ======================================================================

set client_encoding = 'UTF8';

create or replace function public.aggregate_weekly_data(
  p_child_id   text,
  p_week_start date
) returns jsonb
language plpgsql
stable
as $$
declare
  v_week_end      date := p_week_start + 6;  -- 月曜起点で日曜まで
  v_ts_start      timestamptz := (p_week_start)::timestamptz;
  v_ts_end        timestamptz := (p_week_start + 7)::timestamptz;  -- exclusive

  v_battle        jsonb;
  v_alt_game      jsonb;
  v_quiz          jsonb;
  v_gacha         jsonb;
  v_tournament    jsonb;
  v_study         jsonb;
  v_alt_earned    integer;
  v_notable       jsonb;
begin
  -- ========== battle ==========
  with b as (
    select *
      from public.battle_history
     where child_id = p_child_id
       and played_at >= v_ts_start
       and played_at <  v_ts_end
  ),
  agg as (
    select
      count(*)                                                     as total,
      count(*) filter (where result = 'win')                       as wins,
      count(*) filter (where result = 'lose')                      as losses,
      coalesce(sum(duration_seconds), 0)                           as duration_seconds
    from b
  ),
  by_deck as (
    select jsonb_agg(jsonb_build_object(
             'deck_key', deck_key,
             'uses', uses,
             'wins', wins
           ) order by uses desc)                                   as arr
    from (
      select deck_key,
             count(*) as uses,
             count(*) filter (where result = 'win') as wins
        from b
       group by deck_key
    ) d
  ),
  fin as (
    select jsonb_agg(jsonb_build_object(
             'name', finisher_card_name,
             'count', c
           ) order by c desc)                                      as arr
    from (
      select finisher_card_name, count(*) as c
        from b
       where finisher_card_name is not null
       group by finisher_card_name
       order by c desc
       limit 5
    ) f
  )
  select jsonb_build_object(
    'total',            a.total,
    'wins',             a.wins,
    'losses',           a.losses,
    'win_rate',         case when a.total > 0 then round(a.wins::numeric / a.total, 3) else 0 end,
    'duration_seconds', a.duration_seconds,
    'by_deck',          coalesce(by_deck.arr, '[]'::jsonb),
    'finisher_top',     coalesce(fin.arr, '[]'::jsonb)
  )
  into v_battle
  from agg a cross join by_deck cross join fin;

  -- ========== alt_game ==========
  with g as (
    select *
      from public.alt_game_scores
     where child_id = p_child_id
       and played_at >= v_ts_start
       and played_at <  v_ts_end
  ),
  agg as (
    select
      count(*)                           as cnt,
      coalesce(sum(alt_earned), 0)       as total_alt,
      coalesce(sum(duration_seconds), 0) as duration_seconds
    from g
  ),
  by_type as (
    select jsonb_agg(jsonb_build_object(
             'game_type',  game_type,
             'count',      cnt,
             'best_score', best_score,
             'total_alt',  total_alt
           ) order by cnt desc)                                   as arr
    from (
      select game_type,
             count(*)                as cnt,
             max(score)              as best_score,
             coalesce(sum(alt_earned), 0) as total_alt
        from g
       group by game_type
    ) t
  )
  select jsonb_build_object(
    'count',             a.cnt,
    'total_alt_earned',  a.total_alt,
    'duration_seconds',  a.duration_seconds,
    'by_type',           coalesce(by_type.arr, '[]'::jsonb)
  )
  into v_alt_game
  from agg a cross join by_type;

  v_alt_earned := (v_alt_game ->> 'total_alt_earned')::int;

  -- ========== quiz ==========
  with q as (
    select *
      from public.quiz_history
     where child_id = p_child_id
       and answered_at >= v_ts_start
       and answered_at <  v_ts_end
  ),
  agg as (
    select
      count(*)                               as total_answered,
      count(*) filter (where correct = true) as correct_cnt
    from q
  ),
  weak as (
    select jsonb_agg(jsonb_build_object(
             'deck_key', deck_key,
             'answered', answered,
             'wrong',    wrong,
             'accuracy', case when answered > 0 then round((answered - wrong)::numeric / answered, 3) else 0 end
           ) order by wrong desc)                               as arr
    from (
      select deck_key,
             count(*)                             as answered,
             count(*) filter (where correct = false) as wrong
        from q
       group by deck_key
       having count(*) filter (where correct = false) > 0
       order by wrong desc
       limit 3
    ) w
  )
  select jsonb_build_object(
    'total_answered', a.total_answered,
    'correct',        a.correct_cnt,
    'accuracy',       case when a.total_answered > 0
                           then round(a.correct_cnt::numeric / a.total_answered, 3)
                           else 0 end,
    'weak_decks',     coalesce(weak.arr, '[]'::jsonb)
  )
  into v_quiz
  from agg a cross join weak;

  -- ========== gacha ==========
  with p as (
    select *
      from public.gacha_pulls
     where child_id = p_child_id
       and pulled_at >= v_ts_start
       and pulled_at <  v_ts_end
  )
  select jsonb_build_object(
    'total_pulls',  count(*),
    'ssr_count',    count(*) filter (where rarity = 'SSR'),
    'sr_count',     count(*) filter (where rarity = 'SR'),
    'highlights',   coalesce((
      select jsonb_agg(jsonb_build_object(
               'card_id',   card_id,
               'rarity',    rarity,
               'pulled_at', pulled_at
             ) order by pulled_at)
        from p
       where rarity in ('SSR','SR')
       limit 10
    ), '[]'::jsonb)
  )
  into v_gacha
  from p;

  -- ========== tournament ==========
  -- 生徒が参加した（player1_id or player2_id）試合を週内で集計
  with m as (
    select tm.*,
           case when tm.player1_id = p_child_id then tm.player2_id else tm.player1_id end as opponent,
           (tm.winner_id = p_child_id)                                                    as won
      from public.tournament_matches tm
     where (tm.player1_id = p_child_id or tm.player2_id = p_child_id)
       and tm.played_at is not null
       and tm.played_at >= v_ts_start
       and tm.played_at <  v_ts_end
  )
  select jsonb_build_object(
    'participated',  count(distinct tournament_id),
    'matches',       count(*),
    'wins',          count(*) filter (where won),
    'details',       coalesce((
      select jsonb_agg(jsonb_build_object(
               'tournament_id', tournament_id,
               'bracket',       bracket,
               'round',         round,
               'opponent',      opponent,
               'won',           won
             ) order by played_at)
        from m
    ), '[]'::jsonb)
  )
  into v_tournament
  from m;

  -- ========== study time (daily distribution) ==========
  with daily as (
    select (played_at at time zone 'Asia/Tokyo')::date as day,
           sum(duration_seconds)                        as sec
      from public.battle_history
     where child_id = p_child_id
       and played_at >= v_ts_start
       and played_at <  v_ts_end
     group by 1
    union all
    select (played_at at time zone 'Asia/Tokyo')::date as day,
           sum(duration_seconds)                        as sec
      from public.alt_game_scores
     where child_id = p_child_id
       and played_at >= v_ts_start
       and played_at <  v_ts_end
     group by 1
  ),
  summed as (
    select day, sum(sec) as sec from daily group by day
  )
  select jsonb_build_object(
    'total_duration_seconds', coalesce(sum(sec), 0),
    'daily',                  coalesce(jsonb_agg(jsonb_build_object(
                                         'date',    to_char(day, 'YYYY-MM-DD'),
                                         'seconds', sec
                                       ) order by day), '[]'::jsonb)
  )
  into v_study
  from summed;

  -- ========== notable_events（自動抽出） ==========
  -- MVP: SSR 獲得 / 大会入賞 / 1日 ALT 大量獲得 / 連勝（最大連続数のみ）
  with ev_ssr as (
    select jsonb_build_object(
             'type', 'ssr',
             'text', 'SSR「' || card_id || '」を獲得',
             'date', to_char((pulled_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD')
           ) as e
      from public.gacha_pulls
     where child_id = p_child_id
       and rarity = 'SSR'
       and pulled_at >= v_ts_start
       and pulled_at <  v_ts_end
  ),
  ev_tournament as (
    select jsonb_build_object(
             'type', 'tournament',
             'text', case tr.reward_type
                       when 'champion'      then '大会で優勝 🏆'
                       when 'runner_up'     then '大会で準優勝 🥈'
                       when 'third'         then '大会で 3 位 🥉'
                       when 'mvp'           then '大会で MVP 獲得'
                       when 'best_finisher' then '大会でベストフィニッシャー'
                       else                      '大会で入賞'
                     end,
             'date', to_char((tr.awarded_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD')
           ) as e
      from public.tournament_rewards tr
     where tr.child_id = p_child_id
       and tr.awarded_at >= v_ts_start
       and tr.awarded_at <  v_ts_end
  ),
  ev_big_day as (
    select jsonb_build_object(
             'type', 'big_day',
             'text', day || ' に ALT を ' || sec || 'pt 獲得',
             'date', day::text
           ) as e
      from (
        select to_char((played_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD') as day,
               sum(alt_earned)::int as sec
          from public.alt_game_scores
         where child_id = p_child_id
           and played_at >= v_ts_start
           and played_at <  v_ts_end
         group by 1
        having sum(alt_earned) >= 100
      ) d
  ),
  all_events as (
    select e from ev_ssr
    union all
    select e from ev_tournament
    union all
    select e from ev_big_day
  )
  select coalesce(jsonb_agg(e order by e->>'date'), '[]'::jsonb)
    into v_notable
  from all_events;

  -- ========== final assembly ==========
  return jsonb_build_object(
    'child_id',              p_child_id,
    'week_start',            to_char(p_week_start, 'YYYY-MM-DD'),
    'week_end',              to_char(v_week_end,   'YYYY-MM-DD'),
    'battle',                v_battle,
    'alt_game',              v_alt_game,
    'quiz',                  v_quiz,
    'gacha',                 v_gacha,
    'tournament',            v_tournament,
    'study',                 v_study,
    'alt_earned_this_week',  v_alt_earned,
    'notable_events',        v_notable
  );
end;
$$;

grant execute on function public.aggregate_weekly_data(text, date) to anon;

comment on function public.aggregate_weekly_data is
  '指定生徒・指定週（月曜起点）のプレイ活動を集計して jsonb で返す。'
  'Edge Function (weekly-report-generator) が Claude API プロンプトへの投入前に呼ぶ。';
