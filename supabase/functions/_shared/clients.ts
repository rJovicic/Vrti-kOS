import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = Deno.env.get('SUPABASE_URL')!;
const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Acts AS THE CALLER: every query is subject to RLS (SR-EF-01). Use for all authorization decisions. */
export function userClient(jwt: string): SupabaseClient {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

/** Service client: only for Auth admin calls and the service-only acceptance RPC. Never returned to callers. */
export function serviceClient(): SupabaseClient {
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
