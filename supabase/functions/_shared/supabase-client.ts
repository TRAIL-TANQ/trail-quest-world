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

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
