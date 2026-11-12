import { type ErrorCode, isErrorCode, type InviteMemberInput } from '@vrticos/validation';
import { redirect } from 'next/navigation';
import type { OrgContext } from '@/lib/dal';
import { env } from '@/lib/env';

/**
 * Calls the invite-member Edge Function as the signed-in manager. Returns null on success, otherwise the catalogued
 * error code to show (unknown answers become INTERNAL with the correlation id as reference).
 */
export async function callInviteMember(ctx: OrgContext, input: InviteMemberInput): Promise<{ code: ErrorCode; ref?: string } | null> {
  const { data: session } = await ctx.supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) redirect('/sign-in');
  const correlationId = crypto.randomUUID();
  let status = 0;
  let code: string | undefined;
  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/invite-member`, {
      method: 'POST',
      headers: {
        apikey: env.supabasePublishableKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    });
    status = res.status;
    code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code;
  } catch {
    // network failure: falls through to INTERNAL with the correlation id
  }
  if (status === 201) return null;
  if (status === 401) redirect('/sign-in');
  // Any catalogued code is shown with its own message (D1-13); unknown answers become INTERNAL with the reference.
  if (isErrorCode(code) && code !== 'INTERNAL') return { code };
  return { code: 'INTERNAL', ref: correlationId };
}
