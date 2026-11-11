import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { localStack } from './env.ts';
import { totp } from './totp.ts';

export const stack = localStack();
const opts = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Service client for TEST FIXTURES ONLY (local stack). Product code never uses it outside Edge Functions. */
export const service: SupabaseClient = createClient(stack.API_URL, stack.SECRET_KEY, opts);
export const anonClient = (): SupabaseClient => createClient(stack.API_URL, stack.PUBLISHABLE_KEY, opts);

export const runId = randomUUID().slice(0, 8);
export const email = (local: string): string => `${local}.${runId}@it.demo.vrtic.test`;

interface MailpitMessage {
  ID: string;
  Subject: string;
  Created: string;
}

export async function latestMail(to: string, subjectIncludes: string, after = 0): Promise<{ subject: string; text: string } | null> {
  for (let i = 0; i < 20; i++) {
    const r = (await (await fetch(`${stack.MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`)).json()) as {
      messages: MailpitMessage[];
    };
    const m = r.messages.find((x) => x.Subject.includes(subjectIncludes) && Date.parse(x.Created) >= after);
    if (m) {
      const full = (await (await fetch(`${stack.MAILPIT_URL}/api/v1/message/${m.ID}`)).json()) as { Text: string };
      return { subject: m.Subject, text: full.Text };
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  return null;
}

/** Real e-mail OTP sign-in: request code, read it from Mailpit, verify. Returns a signed-in client + code. */
export async function signInWithCode(address: string): Promise<{ client: SupabaseClient; code: string; token: string }> {
  const client = anonClient();
  const before = Date.now() - 1000;
  // GoTrue throttles code requests per address (auth.email.max_frequency); back off like a real client would.
  for (let attempt = 0; ; attempt++) {
    const { error } = await client.auth.signInWithOtp({ email: address, options: { shouldCreateUser: false } });
    if (!error) break;
    if (error.status !== 429 || attempt >= 5) throw new Error(`signInWithOtp failed: ${error.message}`);
    await new Promise((res) => setTimeout(res, 1100));
  }
  const mail = await latestMail(address, 'Kod za prijavu', before);
  const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error('no login code e-mail');
  const { data, error: vErr } = await client.auth.verifyOtp({ email: address, token: code, type: 'email' });
  if (vErr || !data.session) throw new Error(`verifyOtp failed: ${vErr?.message}`);
  return { client, code, token: data.session.access_token };
}

/** Enrols TOTP and upgrades the session to AAL2 exactly like the admin app does. Returns the new token. */
export async function enrolMfa(client: SupabaseClient): Promise<string> {
  const { data: enrol, error } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: `it-${runId}` });
  if (error || !enrol) throw new Error(`enroll failed: ${error?.message}`);
  const { data: ch, error: chErr } = await client.auth.mfa.challenge({ factorId: enrol.id });
  if (chErr || !ch) throw new Error(`challenge failed: ${chErr?.message}`);
  const { error: vErr } = await client.auth.mfa.verify({ factorId: enrol.id, challengeId: ch.id, code: totp(enrol.totp.secret) });
  if (vErr) throw new Error(`mfa verify failed: ${vErr.message}`);
  const { data } = await client.auth.getSession();
  return data.session!.access_token;
}

export const claims = (jwt: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test assertions inspect arbitrary response JSON
type AnyJson = any;

export async function callFunction(name: string, token: string | null, body?: unknown): Promise<{ status: number; json: AnyJson }> {
  const res = await fetch(`${stack.API_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: stack.PUBLISHABLE_KEY,
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

/** Synthetic kindergarten with a manager and an educator, created through the service role (fixtures only). */
export async function createKindergarten(key: string): Promise<{ orgId: string; groupId: string; managerEmail: string; educatorEmail: string; educatorMembershipId: string }> {
  const managerEmail = email(`uprava-${key}`);
  const educatorEmail = email(`odgojitelj-${key}`);
  const mk = async (addr: string, first: string) => {
    const { data, error } = await service.auth.admin.createUser({ email: addr, email_confirm: true });
    if (error) throw error;
    await service.from('profiles').insert({ id: data.user.id, first_name: first, last_name: `Test ${key}` }).throwOnError();
    return data.user.id;
  };
  const managerId = await mk(managerEmail, 'Uprava');
  const educatorId = await mk(educatorEmail, 'Odgojitelj');
  const { data: org } = await service.from('organizations').insert({ name: `IT ${key} ${runId}`, slug: `it-${key}-${runId}` }).select('id').single().throwOnError();
  const orgId = org!.id as string;
  const { data: fac } = await service.from('facilities').insert({ organization_id: orgId, name: 'Objekt IT' }).select('id').single().throwOnError();
  const { data: year } = await service
    .from('academic_years')
    .insert({ organization_id: orgId, name: '2026./2027.', starts_on: '2026-09-01', ends_on: '2027-08-31', status: 'active' })
    .select('id')
    .single()
    .throwOnError();
  const { data: grp } = await service
    .from('groups')
    .insert({ organization_id: orgId, facility_id: fac!.id, academic_year_id: year!.id, name: 'Galebovi' })
    .select('id')
    .single()
    .throwOnError();
  await service.from('memberships').insert({ organization_id: orgId, profile_id: managerId, role: 'org_admin', valid_during: '[2026-01-01,)' }).throwOnError();
  const { data: em } = await service
    .from('memberships')
    .insert({ organization_id: orgId, profile_id: educatorId, role: 'educator', valid_during: '[2026-01-01,)' })
    .select('id')
    .single()
    .throwOnError();
  return { orgId, groupId: grp!.id as string, managerEmail, educatorEmail, educatorMembershipId: em!.id as string };
}
