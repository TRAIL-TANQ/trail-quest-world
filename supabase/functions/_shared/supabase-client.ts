// ======================================================================
// _shared/supabase-client.ts
// Edge Function 内で service_role クライアントを生成するヘルパー。
// service_role は RLS を bypass するため、Edge Function 内からのみ利用可。
// ======================================================================
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ----------------------------------------------------------------------
// CORS
// 開発優先で '*' 許可。本番向けに特定ドメインへ絞る TODO は
// プロジェクトルートの todo.md 参照。
// ----------------------------------------------------------------------
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** 204 相当の preflight 応答。OPTIONS リクエスト受信時に返す。 */
export function corsPreflightResponse(): Response {
  return new Response('ok', { headers: corsHeaders });
}

/** JSON レスポンス。corsHeaders を自動付与。 */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  });
}
