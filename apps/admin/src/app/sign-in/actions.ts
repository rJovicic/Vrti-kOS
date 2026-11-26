'use server';

import { zEmailInput, zOtpInput } from '@vrticos/validation';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { retryMinutes, signInGuard } from '@/lib/sign-in-guard';
import { createClient } from '@/lib/supabase/server';

// The address waits for the code step in an httpOnly cookie scoped to /sign-in — never in the URL (no PII in logs).
const PENDING_EMAIL = 'vrticos_signin_email';

export async function requestCode(formData: FormData) {
  const parsed = zEmailInput.safeParse({ email: formData.get('email') });
  if (!parsed.success) redirect('/sign-in?e=VALIDATION_FAILED');
  // PP-S2: counted in this server before Auth is called; the same answer for known and unknown addresses.
  const limit = signInGuard().check('send', { headers: await headers(), subject: parsed.data.email });
  if (!limit.ok) redirect(`/sign-in?e=RATE_LIMITED&retry=${retryMinutes(limit.retryAfterSec)}`);
  const supabase = await createClient();
  // Known and unknown addresses continue identically (SR-AUTHN-03). That includes Auth's own refusal (429): for an
  // existing address it means "a code was sent less than a minute ago" (max_frequency) — showing it would reveal that
  // the account exists (R-42). The person uses the code already sent (valid 10 min). Auth's per-IP limit is kept out of
  // reach by the guard's global limit above.
  await supabase.auth.signInWithOtp({ email: parsed.data.email, options: { shouldCreateUser: false } });
  (await cookies()).set(PENDING_EMAIL, parsed.data.email, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/sign-in',
    maxAge: 600,
  });
  redirect('/sign-in/code');
}

export async function verifyCode(formData: FormData) {
  const jar = await cookies();
  const parsed = zOtpInput.safeParse({ email: jar.get(PENDING_EMAIL)?.value ?? '', code: formData.get('code') });
  if (!parsed.success) redirect(jar.get(PENDING_EMAIL) ? '/sign-in/code?e=CODE_INVALID' : '/sign-in');
  const limit = signInGuard().check('verify', { headers: await headers(), subject: parsed.data.email });
  if (!limit.ok) redirect(`/sign-in/code?e=RATE_LIMITED&retry=${retryMinutes(limit.retryAfterSec)}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'email' });
  if (error) redirect(error.status === 429 ? '/sign-in/code?e=RATE_LIMITED' : '/sign-in/code?e=CODE_INVALID');
  jar.delete({ name: PENDING_EMAIL, path: '/sign-in' });
  redirect('/');
}
