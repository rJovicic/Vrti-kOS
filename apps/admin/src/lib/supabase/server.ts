import { createServerClient } from '@supabase/ssr';
import type { Database } from '@vrticos/db-types';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { sessionCookieOptions } from './options';

/** Supabase client acting as the signed-in user (RLS applies). Server Components, Server Actions only. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  });
}

export type ServerClient = Awaited<ReturnType<typeof createClient>>;
