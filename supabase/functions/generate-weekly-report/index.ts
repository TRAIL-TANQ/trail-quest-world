// ======================================================================
// generate-weekly-report Edge Function (Phase C)
//
// POST /functions/v1/generate-weekly-report
// body: { child_id: string, week_start?: "YYYY-MM-DD" }
//   * week_start 省略時は Asia/Tokyo 基準の先週月曜日
//
// 処理:
//   1. aggregate_weekly_data RPC で生徒の週次集計を取得
//   2. study.total_duration_seconds < 300 (5分) なら AI 呼び出しを省略し
//      軽量レポートを UPSERT
//   3. それ以外は Claude API を呼び、生成コメントを content.ai_comment へ
//   4. weekly_reports に UPSERT（UPSERT のため再呼び出しで強制再生成）
//   5. レスポンスとして { source: 'generated', ...report } を返す
//
// Note: §3 プロンプト本文は未受領のため「kk の声」の第一稿 placeholder。
//       プロンプトを差し替えるときは SYSTEM_PROMPT / buildUserPrompt を編集。
// ======================================================================
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createServiceClient, jsonResponse } from '../_shared/supabase-client.ts';
import { callClaude } from '../_shared/anthropic.ts';

// ------------------------ プロンプト（§3 到着まで第一稿） ------------------------

const SYSTEM_PROMPT = `
あなたは TRAIL QUEST World（子ども向けの学習＋RPG カードゲーム）を運営する
先生「kk」です。児童の 1 週間のプレイ活動データをもとに、保護者に向けた
温かい振り返りコメントを日本語で書いてください。

ルール:
- 文字数は 200〜300 字。冒頭は児童の名前を呼びかける形で始める
- 具体的な数字を 1〜2 つだけ織り込む（全部は書かない）
- 良かった点を先に、続いて次週へのヒントを一言だけ添える
- 絵文字は 0〜2 個まで。乱用しない
- 「保護者の皆様」などの定型宣伝や形式ばった挨拶は不要
- ですます調、親しみやすく落ち着いたトーン
- アウトプットはコメント本文のみ（前置き・署名は不要）
`.trim();

function buildUserPrompt(childName: string, className: string, agg: Record<string, unknown>): string {
  return [
    `児童: ${childName}（${className}）`,
    '',
    '先週のプレイ活動サマリー（JSON）:',
    '```json',
    JSON.stringify(agg, null, 2),
    '```',
    '',
    '上記を踏まえ、保護者向けの 200〜300 字コメントを書いてください。',
  ].join('\n');
}

// ------------------------------------------------------------------------

const MIN_STUDY_SECONDS = 300;  // 5 分未満は AI 呼び出しをスキップ

interface AggBattle   { total: number; wins: number; losses: number; win_rate: number; duration_seconds: number; by_deck: Array<{deck_key: string; uses: number; wins: number}>; finisher_top: Array<{name: string; count: number}> }
interface AggAltGame  { count: number; total_alt_earned: number; duration_seconds: number; by_type: Array<{game_type: string; count: number; best_score: number; total_alt: number}> }
interface AggQuiz     { total_answered: number; correct: number; accuracy: number; weak_decks: Array<{deck_key: string; accuracy: number; wrong: number}> }
interface AggGacha    { total_pulls: number; ssr_count: number; sr_count: number; highlights: Array<{card_id: string; rarity: string; pulled_at: string}> }
interface AggTourn    { participated: number; matches: number; wins: number; details: unknown[] }
interface AggStudy    { total_duration_seconds: number; daily: Array<{date: string; seconds: number}> }
interface AggEvent    { type: string; text: string; date: string }
interface Aggregation {
  child_id: string;
  week_start: string;
  week_end: string;
  battle: AggBattle;
  alt_game: AggAltGame;
  quiz: AggQuiz;
  gacha: AggGacha;
  tournament: AggTourn;
  study: AggStudy;
  alt_earned_this_week: number;
  notable_events: AggEvent[];
}

interface ReportContent {
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
  agg:        Aggregation;
}

function iconForEvent(type: string): string {
  switch (type) {
    case 'ssr':        return '🎲';
    case 'tournament': return '🏆';
    case 'big_day':    return '🔥';
    default:           return '✨';
  }
}

function buildContent(agg: Aggregation, aiComment: string, light = false): ReportContent {
  return {
    ai_comment: aiComment,
    ...(light ? { light: true } : {}),
    summary: {
      battle: {
        wins:     agg.battle?.wins     ?? 0,
        losses:   agg.battle?.losses   ?? 0,
        win_rate: agg.battle?.win_rate ?? 0,
        top_deck: agg.battle?.by_deck?.[0]?.deck_key,
      },
      alt_game: {
        count:            agg.alt_game?.count            ?? 0,
        total_alt_earned: agg.alt_game?.total_alt_earned ?? 0,
      },
      quiz: {
        accuracy:       agg.quiz?.accuracy       ?? 0,
        total_answered: agg.quiz?.total_answered ?? 0,
      },
      tournament: {
        participated: agg.tournament?.participated ?? 0,
        wins:         agg.tournament?.wins         ?? 0,
      },
    },
    daily:      agg.study?.daily ?? [],
    highlights: (agg.notable_events ?? []).map((e) => ({
      icon: iconForEvent(e.type),
      text: e.text,
      date: e.date,
    })),
    agg,
  };
}

// ------------------------------------------------------------------------
// 生徒マスタ（名前 / クラス名表示用）
// client/src/data/students.ts と 1:1 で合わせる。変更時は両方更新。
// ------------------------------------------------------------------------
const STUDENT_DISPLAY: Record<string, { name: string; className: string }> = {
  'スターター_はるか':     { name: 'はるか',   className: '探究スターター' },
  'スターター_るい':       { name: 'るい',     className: '探究スターター' },
  'スターター_ゆうか':     { name: 'ゆうか',   className: '探究スターター' },
  'ベーシック_にしか':     { name: 'にしか',   className: '探究ベーシック' },
  'ベーシック_のぞみ':     { name: 'のぞみ',   className: '探究ベーシック' },
  'ベーシック_ゆずは':     { name: 'ゆずは',   className: '探究ベーシック' },
  'ベーシック_さえ':       { name: 'さえ',     className: '探究ベーシック' },
  'ベーシック_えりく':     { name: 'えりく',   className: '探究ベーシック' },
  'ベーシック_ゆうと':     { name: 'ゆうと',   className: '探究ベーシック' },
  'アドバンス_りさこ':     { name: 'りさこ',   className: '探究アドバンス' },
  'アドバンス_ゆきひさ':   { name: 'ゆきひさ', className: '探究アドバンス' },
  'アドバンス_こうた':     { name: 'こうた',   className: '探究アドバンス' },
  'リミットレス_ごうき':   { name: 'ごうき',   className: '探究リミットレス' },
  'リミットレス_れお':     { name: 'れお',     className: '探究リミットレス' },
  'リミットレス_げん':     { name: 'げん',     className: '探究リミットレス' },
  'リミットレス_はるあき': { name: 'はるあき', className: '探究リミットレス' },
  'リミットレス_はる':     { name: 'はる',     className: '探究リミットレス' },
  '個別_かずとし':         { name: 'かずとし', className: '探究個別' },
  '個別_ゆうた':           { name: 'ゆうた',   className: '探究個別' },
  '個別_ゆうせい':         { name: 'ゆうせい', className: '探究個別' },
  '個別_さとる':           { name: 'さとる',   className: '探究個別' },
};

// ------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);

  let body: { child_id?: string; week_start?: string } = {};
  try { body = await req.json(); } catch { /* allow empty */ }

  const childId = body.child_id;
  if (!childId) return jsonResponse({ error: 'child_id is required' }, 400);

  const supabase = createServiceClient();
  const model = Deno.env.get('ANTHROPIC_MODEL') ?? 'claude-sonnet-4-6';

  // 1. 先週月曜日を DB 関数で取得（week_start 未指定時）
  let weekStart = body.week_start;
  if (!weekStart) {
    const { data: pm } = await supabase.rpc('_previous_monday');
    weekStart = String(pm);
  }

  // 2. 集計
  const { data: aggRaw, error: aggErr } = await supabase
    .rpc('aggregate_weekly_data', { p_child_id: childId, p_week_start: weekStart });
  if (aggErr) return jsonResponse({ error: `aggregate failed: ${aggErr.message}` }, 500);
  const agg = aggRaw as Aggregation;

  const studySec = agg?.study?.total_duration_seconds ?? 0;
  const disp = STUDENT_DISPLAY[childId] ?? { name: childId, className: '' };

  let aiComment = '';
  let light = false;
  let callMeta: { model?: string; durationMs?: number; costJpy?: number } = {};

  if (studySec < MIN_STUDY_SECONDS) {
    // 3a. 軽量レポート（API コスト節約）
    light = true;
    aiComment = `${disp.name}さん、今週はすこしお休みの週でしたね。来週、元気な顔を待っています。`;
  } else {
    // 3b. Claude API
    try {
      const call = await callClaude({
        model,
        system:   SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(disp.name, disp.className, agg as unknown as Record<string, unknown>) }],
        max_tokens: 600,
        temperature: 0.7,
      });
      aiComment = call.text.trim();
      callMeta = { model: call.model, durationMs: call.durationMs, costJpy: call.estimatedCostJpy };
    } catch (e) {
      return jsonResponse({ error: `claude failed: ${(e as Error).message}` }, 500);
    }
  }

  const content = buildContent(agg, aiComment, light);

  // 4. UPSERT
  const { error: upErr } = await supabase
    .from('weekly_reports')
    .upsert({
      child_id:        childId,
      week_start:      weekStart,
      week_end:        agg.week_end,
      generated_by:    'ondemand',
      battle_wins:     agg.battle?.wins       ?? 0,
      battle_losses:   agg.battle?.losses     ?? 0,
      alt_game_count:  agg.alt_game?.count    ?? 0,
      alt_gained:      agg.alt_earned_this_week ?? 0,
      study_seconds:   studySec,
      content,
      generation_model:       callMeta.model,
      generation_duration_ms: callMeta.durationMs,
      api_cost_jpy:           callMeta.costJpy,
    }, { onConflict: 'child_id,week_start' });
  if (upErr) return jsonResponse({ error: `upsert failed: ${upErr.message}` }, 500);

  // 5. レスポンス
  return jsonResponse({
    source:        'generated',
    child_id:      childId,
    week_start:    weekStart,
    week_end:      agg.week_end,
    generated_at:  new Date().toISOString(),
    generated_by:  'ondemand',
    battle_wins:   agg.battle?.wins         ?? 0,
    battle_losses: agg.battle?.losses       ?? 0,
    alt_game_count: agg.alt_game?.count     ?? 0,
    alt_gained:    agg.alt_earned_this_week ?? 0,
    study_seconds: studySec,
    content,
    generation_model:       callMeta.model      ?? null,
    generation_duration_ms: callMeta.durationMs ?? null,
    api_cost_jpy:           callMeta.costJpy    ?? null,
  });
});
