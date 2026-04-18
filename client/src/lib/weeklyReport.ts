/**
 * Weekly Report Service (Phase C)
 *
 * 保護者ダッシュボード用の週次レポート取得/生成ラッパ。
 *
 * キャッシュ優先フロー:
 *   1. admin_generate_weekly_report RPC でキャッシュ確認
 *   2. source='cache' ならそのまま描画
 *   3. source='needs_generation' なら generate-weekly-report Edge Function
 *      を invoke して生成 → 返ってきたレポートを描画
 *
 * kk の強制再生成:
 *   generateReport() を直接呼ぶ（キャッシュをバイパス）。Edge Function は
 *   UPSERT するので再生成でも旧レコードを上書きする。
 */
import { supabase } from './supabase';

// ===== 型 =====

export interface ReportContent {
  ai_comment: string;
  light?:     boolean;
  summary: {
    battle:     { wins: number; losses: number; win_rate: number; top_deck?: string };
    alt_game:   { count: number; total_alt_earned: number };
    quiz:       { accuracy: number; total_answered: number };
    tournament: { participated: number; wins: number };
  };
  daily:      Array<{ date: string; seconds: number }>;
  highlights: Array<{ icon: string; text: string; date: string }>;
  // agg は詳細。UI では普段使わないが、kk デバッグ用に残す
  agg?: Record<string, unknown>;
}

export interface WeeklyReport {
  source:        'cache' | 'generated';
  child_id:      string;
  week_start:    string;  // 'YYYY-MM-DD'
  week_end:      string;  // 'YYYY-MM-DD'
  generated_at?: string;
  generated_by?: string;
  battle_wins:    number;
  battle_losses:  number;
  alt_game_count: number;
  alt_gained:     number;
  study_seconds:  number;
  content:        ReportContent;
  generation_model?:       string | null;
  generation_duration_ms?: number | null;
  api_cost_jpy?:           number | null;
}

export interface CacheMissResponse {
  source:     'needs_generation';
  child_id:   string;
  week_start: string;
  reason?:    string;
}

type RpcResponse = WeeklyReport | CacheMissResponse | { source: 'error'; error: string };

// ===== RPC キャッシュ取得 =====

/**
 * admin_generate_weekly_report RPC を叩く。
 * - 存在すれば WeeklyReport 型（source='cache'）
 * - 無ければ CacheMissResponse 型（source='needs_generation'）
 * - エラーは例外で throw
 */
export async function fetchCachedReport(
  childId: string,
  weekStart: string | null = null,
  force = false,
): Promise<WeeklyReport | CacheMissResponse> {
  const { data, error } = await supabase.rpc('admin_generate_weekly_report', {
    p_child_id:   childId,
    p_week_start: weekStart,
    p_force:      force,
  });
  if (error) throw new Error(`cache lookup failed: ${error.message}`);
  const r = data as RpcResponse;
  if (r.source === 'error') throw new Error(`cache lookup error: ${r.error}`);
  return r as WeeklyReport | CacheMissResponse;
}

// ===== Edge Function invoke =====

/**
 * generate-weekly-report Edge Function を叩いてレポートを生成する。
 * UPSERT なので何度呼んでも同じ週のレコードを上書きする（= 強制再生成）。
 */
export async function generateReport(
  childId: string,
  weekStart: string | null = null,
): Promise<WeeklyReport> {
  const { data, error } = await supabase.functions.invoke('generate-weekly-report', {
    body: { child_id: childId, ...(weekStart ? { week_start: weekStart } : {}) },
  });
  if (error) throw new Error(`generate failed: ${error.message}`);
  return data as WeeklyReport;
}

// ===== 統合ヘルパー =====

/**
 * キャッシュ優先 → 無ければ生成 → 返す。
 * force=true なら常に生成。
 */
export async function getOrGenerateReport(
  childId: string,
  weekStart: string | null = null,
  force = false,
): Promise<WeeklyReport> {
  if (!force) {
    const cached = await fetchCachedReport(childId, weekStart, false);
    if (cached.source === 'cache') return cached as WeeklyReport;
  }
  return generateReport(childId, weekStart);
}

// ===== 表示用フォーマッタ =====

export function formatStudySeconds(sec: number): string {
  if (sec < 60) return `${sec}秒`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm === 0 ? `${h}時間` : `${h}時間${rm}分`;
}

export function formatMonthDay(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[2])}/${Number(m[3])}`;
}
