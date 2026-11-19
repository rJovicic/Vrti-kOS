// Staging target guard (Railway staging + Supabase project `vrticos-staging`). Synthetic data only.
//
// These scripts are the ONLY code in the repository that talks to a hosted Supabase project. They refuse to run unless
// the URL is exactly the staging project below, so a copied command can never reach a production project. The secret
// key is read from the environment of the operator's shell for that one command; it is never written to disk, logged,
// committed or given to an app (SR-SUP-04, ADR-0006).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** The staging project ref. Not a secret: it is also the public API host in the staging app bundles. */
export const STAGING_REF = 'hfwlfdgzgulbutnjttnq';
export const STAGING_URL = `https://${STAGING_REF}.supabase.co`;
export const STAGING_ADMIN_URL = 'https://admin-staging-7d208881.up.railway.app';
/** Only seeded synthetic accounts may be signed in by the operator scripts. */
export const SYNTHETIC_DOMAIN = '@demo.vrtic.test';

const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export function stagingTarget(): { url: string; publishableKey: string } {
  const url = process.env.STAGING_SUPABASE_URL ?? STAGING_URL;
  if (url !== STAGING_URL) throw new Error(`refusing to run: ${url} is not the staging project ${STAGING_URL}`);
  const publishableKey = required('STAGING_PUBLISHABLE_KEY');
  if (!publishableKey.startsWith('sb_publishable_')) throw new Error('STAGING_PUBLISHABLE_KEY must be a publishable key');
  return { url, publishableKey };
}

export const anon = (): SupabaseClient => {
  const t = stagingTarget();
  return createClient(t.url, t.publishableKey, opts);
};

/** Operator-only admin client, used solely to mint a sign-in code for a synthetic account (no data access). */
function operator(): SupabaseClient {
  const t = stagingTarget();
  const secret = required('STAGING_SECRET_KEY');
  if (!secret.startsWith('sb_secret_')) throw new Error('STAGING_SECRET_KEY must be a staging secret key (sb_secret_…)');
  return createClient(t.url, secret, opts);
}

export function assertSynthetic(email: string): void {
  if (!email.endsWith(SYNTHETIC_DOMAIN)) throw new Error(`refusing: ${email} is not a synthetic ${SYNTHETIC_DOMAIN} account`);
}

/**
 * Mints a one-time 6-digit e-mail code for a synthetic account without sending mail (the `.test` domain cannot receive
 * mail and staging has no SMTP provider — ADR-0010 open). The code is the same kind the app asks for; it expires after
 * 10 minutes (otp_expiry) and works once.
 */
export async function mintCode(email: string): Promise<string> {
  assertSynthetic(email);
  const { data, error } = await operator().auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.email_otp) throw new Error(`generateLink failed: ${error?.message ?? 'no code'}`);
  return data.properties.email_otp;
}

/** Signs a synthetic account in through the public API with a minted code, exactly as the apps verify a code. */
export async function signIn(email: string): Promise<SupabaseClient> {
  const code = await mintCode(email);
  const client = anon();
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error || !data.session) throw new Error(`verifyOtp failed for ${email}: ${error?.message}`);
  return client;
}
