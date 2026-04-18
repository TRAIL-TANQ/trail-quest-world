-- ======================================================================
-- 0028_admin_generate_weekly_report.sql
-- Phase C: 週次レポート キャッシュ取得 RPC
--
--   admin_generate_weekly_report(p_child_id, p_week_start, p_force := false)
--
-- 動作:
--   1. 引数 p_week_start が NULL なら Asia/Tokyo 基準の「先週月曜日」に補完
--   2. weekly_reports にキャッシュが存在し p_force=false なら
--      そのコンテンツを { source: 'cache', ... } で返す
--   3. キャッシュ無し or p_force=true なら
--      { source: 'needs_generation', child_id, week_start } を返す
--      → クライアント側で supabase.functions.invoke('generate-weekly-report')
--        を呼び直して生成する
--
-- なぜ pg_net で Edge Function を直接叩かないか:
--   * pg_net は非同期で結果取得が煩雑（ポーリング必要）
--   * クライアントから直接 Edge Function を invoke する方が UX 的に自然
--     （10〜20秒ローディングの間、ユーザー操作のキャンセルも可）
--   * この RPC は「キャッシュの有無を安全に問い合わせる SECURITY DEFINER
--     窓口」として利用する。保護者ダッシュボード（後で別アプリ化）の
--     anon クライアントでも叩ける前提。
--
-- セキュリティ方針（Phase B1 と同水準の暫定運用）:
--   SECURITY DEFINER + anon GRANT。公開前に Supabase Auth で厳格化。
-- ======================================================================

set client_encoding = 'UTF8';

-- Asia/Tokyo 基準で先週の月曜日を返すヘルパー
create or replace function public._previous_monday()
returns date
language sql
stable
as $$
  select (
    (now() at time zone 'Asia/Tokyo')::date
    - ((extract(dow from (now() at time zone 'Asia/Tokyo'))::int + 6) % 7)
    - 7
  )::date;
$$;

grant execute on function public._previous_monday() to anon;

-- ----------------------------------------------------------------------
-- admin_generate_weekly_report: キャッシュ取得 or 生成指示フラグを返す
-- ----------------------------------------------------------------------
create or replace function public.admin_generate_weekly_report(
  p_child_id   text,
  p_week_start date    default null,
  p_force      boolean default false
) returns jsonb
security definer
language plpgsql
stable  -- キャッシュ行を更新しないため stable で問題ない
as $$
declare
  v_week_start date := coalesce(p_week_start, public._previous_monday());
  v_row        public.weekly_reports;
begin
  if p_child_id is null or p_child_id = '' then
    return jsonb_build_object('source', 'error', 'error', 'child_id_required');
  end if;

  if p_force then
    return jsonb_build_object(
      'source',     'needs_generation',
      'child_id',   p_child_id,
      'week_start', to_char(v_week_start, 'YYYY-MM-DD'),
      'reason',     'force'
    );
  end if;

  select *
    into v_row
    from public.weekly_reports
   where child_id   = p_child_id
     and week_start = v_week_start
   limit 1;

  if found then
    return jsonb_build_object(
      'source',        'cache',
      'child_id',      p_child_id,
      'week_start',    to_char(v_row.week_start, 'YYYY-MM-DD'),
      'week_end',      to_char(v_row.week_end,   'YYYY-MM-DD'),
      'generated_at',  v_row.generated_at,
      'generated_by',  v_row.generated_by,
      'battle_wins',   v_row.battle_wins,
      'battle_losses', v_row.battle_losses,
      'alt_game_count',v_row.alt_game_count,
      'alt_gained',    v_row.alt_gained,
      'study_seconds', v_row.study_seconds,
      'content',       v_row.content,
      'generation_model',       v_row.generation_model,
      'generation_duration_ms', v_row.generation_duration_ms,
      'api_cost_jpy',           v_row.api_cost_jpy
    );
  end if;

  return jsonb_build_object(
    'source',     'needs_generation',
    'child_id',   p_child_id,
    'week_start', to_char(v_week_start, 'YYYY-MM-DD')
  );
end;
$$;

grant execute on function public.admin_generate_weekly_report(text, date, boolean) to anon;

comment on function public.admin_generate_weekly_report is
  'weekly_reports のキャッシュを取得するか、生成が必要な旨を返す。'
  'p_force=true なら常に needs_generation を返す（kk の強制再生成用）。'
  'needs_generation を受けたクライアントは supabase.functions.invoke('
  '  ''generate-weekly-report'', { body: { child_id, week_start } }'
  ') を呼んで生成する。';
