'use server';

import { zTotpInput } from '@vrticos/validation';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/dal';
import { signInGuard } from '@/lib/sign-in-guard';

export type TotpState = { error: 'MFA_INVALID' | 'RATE_LIMITED' } | null;

/**
 * Verifies a TOTP code for the caller's own factor; on success Auth issues an AAL2 session (cookie refreshed).
 * Errors are returned (not redirected) so a pending enrolment and its QR code stay on screen.
 */
export async function verifyTotp(_prev: TotpState, formData: FormData): Promise<TotpState> {
  const parsed = zTotpInput.safeParse({ factorId: formData.get('factorId'), code: formData.get('code') });
  if (!parsed.success) return { error: 'MFA_INVALID' };
  const { supabase, userId } = await requireUser();
  // PP-S2: TOTP checks also leave from this server's address; counted per client address and account first.
  if (!signInGuard().check('mfa', { headers: await headers(), subject: userId }).ok) return { error: 'RATE_LIMITED' };
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: parsed.data.factorId, code: parsed.data.code });
  if (error) return { error: error.status === 429 ? 'RATE_LIMITED' : 'MFA_INVALID' };
  redirect('/');
}
