'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/** Ends this browser's session (local scope); the refresh token is revoked server-side by Auth. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/sign-in');
}

/**
 * SR-SESS-03: ends every session of the signed-in person (all browsers and phones, e.g. after a lost device). Auth
 * revokes all refresh tokens; access tokens already issued stay valid until they expire (at most jwt_expiry, 15 min)
 * unless SR-SESS-04 is adopted (docs/security/pre-pilot-decisions.md §1).
 */
export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/sign-in');
}
