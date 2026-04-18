// ======================================================================
// _shared/anthropic.ts
// Claude API 呼び出しヘルパー。Messages API を fetch で直接叩く。
// （Deno では Anthropic SDK を使わず純 REST で実装することで、
//   Edge Function のコールドスタートを抑える）
// ======================================================================

export interface ClaudeMessagesRequest {
  model:      string;
  system?:    string;
  messages:   Array<{ role: 'user' | 'assistant'; content: string }>;
  max_tokens: number;
  temperature?: number;
}

export interface ClaudeMessagesResponse {
  content: Array<{ type: 'text'; text: string }>;
  usage:   { input_tokens: number; output_tokens: number };
  model:   string;
}

export interface ClaudeCallResult {
  text:           string;
  model:          string;
  inputTokens:    number;
  outputTokens:   number;
  durationMs:     number;
  estimatedCostJpy: number;
}

/**
 * Claude Messages API 呼び出し。所要時間と概算コスト（円）を同時返却。
 *
 * 概算コスト（2026-01 時点の参考単価、USD/1M tokens、1 USD ≈ 150 JPY）:
 *   claude-sonnet-4-6:  $3 in  / $15 out
 *   claude-opus-4-7:    $15 in / $75 out
 *   claude-haiku-4-5:   $0.80 in / $4 out
 */
export async function callClaude(req: ClaudeMessagesRequest): Promise<ClaudeCallResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const t0 = performance.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'content-type':     'application/json',
      'x-api-key':        apiKey,
      'anthropic-version':'2023-06-01',
    },
    body: JSON.stringify(req),
  });
  const durationMs = Math.round(performance.now() - t0);

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json() as ClaudeMessagesResponse;
  const text = data.content?.[0]?.text ?? '';
  const estimatedCostJpy = estimateCostJpy(data.model, data.usage.input_tokens, data.usage.output_tokens);

  return {
    text,
    model:            data.model,
    inputTokens:      data.usage.input_tokens,
    outputTokens:     data.usage.output_tokens,
    durationMs,
    estimatedCostJpy,
  };
}

function estimateCostJpy(model: string, inTok: number, outTok: number): number {
  // USD per 1M tokens (参考値, 2026-01)
  const prices: Record<string, { in: number; out: number }> = {
    'claude-sonnet-4-6':          { in: 3,    out: 15 },
    'claude-opus-4-7':             { in: 15,   out: 75 },
    'claude-haiku-4-5-20251001':   { in: 0.80, out: 4  },
  };
  const p = prices[model] ?? prices['claude-sonnet-4-6'];
  const usd = (inTok / 1_000_000) * p.in + (outTok / 1_000_000) * p.out;
  const jpy = usd * 150;
  return Math.round(jpy * 10000) / 10000;  // 小数 4 桁
}
