import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = Deno.env.get('SUPABASE_URL')!;
const publishable = Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!;
const secret = Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Acts AS THE CALLER: every query is subject to RLS (SR-EF-01). Use for all authorization decisions.
 * The correlation id travels to the database, where the audit trigger stores it (SR-AUD-01, R-51).
 */
export function userClient(jwt: string, correlationId: string): SupabaseClient {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}`, 'x-correlation-id': correlationId } },
  });
}

/**
 * Service client: only for Auth admin calls, the service-only RPCs (acceptance, denied-attempt audit) and
 * compensation. Never returned to callers. `actorId` attributes audit rows written through it to the person the
 * function acts for (honoured by the database only for the service role).
 */
export function serviceClient(ctx: { correlationId: string; actorId?: string }): SupabaseClient {
  const headers: Record<string, string> = { 'x-correlation-id': ctx.correlationId };
  if (ctx.actorId) headers['x-actor-id'] = ctx.actorId;
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers } });
}
