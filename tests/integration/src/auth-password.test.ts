// R-49 regression tests: passwords are disabled for every user (migration 20261111170000_disable_passwords.sql,
// [auth.hook.custom_access_token] in supabase/config.toml). Local stack, synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { claims, createKindergarten, email, enrolMfa, latestMail, service, signInWithCode, stack } from './helpers.ts';

const PASSWORD = 'Synthetic-Pass-2026!x';

async function auth(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(`${stack.API_URL}/auth/v1${path}`, {
    method,
    headers: {
      apikey: stack.PUBLISHABLE_KEY,
      'content-type': 'application/json',
      ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, json: (await res.json().catch(() => null)) as Record<string, unknown> | null };
}
const setPassword = (token: string, password = PASSWORD) => auth('PUT', '/user', { token, body: { password } });
const passwordSignIn = (address: string, password = PASSWORD) =>
  auth('POST', '/token?grant_type=password', { body: { email: address, password } });

let kg: Awaited<ReturnType<typeof createKindergarten>>;
let guardianEmail: string;
let manager: Awaited<ReturnType<typeof signInWithCode>>;
let managerAal2: string;

beforeAll(async () => {
  kg = await createKindergarten('pw');
  guardianEmail = email('roditelj-pw');
  const { data, error } = await service.auth.admin.createUser({ email: guardianEmail, email_confirm: true });
  if (error) throw error;
  await service.from('profiles').insert({ id: data.user.id, first_name: 'Roditelj', last_name: 'Test pw' }).throwOnError();
  await service.from('memberships').insert({ organization_id: kg.orgId, profile_id: data.user.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
  // Manager: e-mail code + TOTP (AAL2), then assigns the educator through the API (product path).
  manager = await signInWithCode(kg.managerEmail);
  managerAal2 = await enrolMfa(manager.client);
  const { error: aErr } = await manager.client
    .from('staff_assignments')
    .insert({ organization_id: kg.orgId, membership_id: kg.educatorMembershipId, group_id: kg.groupId, valid_during: '[2026-01-01,)' });
  if (aErr) throw aErr;
});

describe('R-49: passwords are disabled for every user', () => {
  it('T3: a guardian cannot set a password with an e-mail-code session, and other sessions survive', async () => {
    const other = await signInWithCode(guardianEmail);
    const { token } = await signInWithCode(guardianEmail);
    const r = await setPassword(token);
    expect(r.status).toBeGreaterThanOrEqual(400);
    // the refused change must not log the user out elsewhere (no denial of service through the attempt)
    expect((await auth('GET', '/user', { token: other.token })).status).toBe(200);
  });

  it('T4: password sign-in yields no session', async () => {
    const r = await passwordSignIn(guardianEmail);
    expect(r.status).toBe(400);
    expect(r.json?.access_token).toBeUndefined();
  });

  it('T6: weak and strong passwords are both refused', async () => {
    const { token } = await signInWithCode(guardianEmail);
    for (const pw of ['abc', 'abc123', PASSWORD]) {
      expect((await setPassword(token, pw)).status).toBeGreaterThanOrEqual(400);
    }
    expect((await passwordSignIn(guardianEmail, 'abc123')).status).toBe(400);
  });

  it('T7: an educator cannot set or use a password; the e-mail-code session keeps working', async () => {
    const educator = await signInWithCode(kg.educatorEmail);
    expect((await setPassword(educator.token)).status).toBeGreaterThanOrEqual(400);
    expect((await passwordSignIn(kg.educatorEmail)).status).toBe(400);
    const { data } = await educator.client.from('groups').select('id');
    expect(data).toEqual([{ id: kg.groupId }]);
  });

  it('managers keep code + TOTP (AAL2) and cannot set a password even at AAL2', async () => {
    expect(claims(managerAal2).aal).toBe('aal2');
    expect((await setPassword(managerAal2)).status).toBeGreaterThanOrEqual(400);
    expect((await passwordSignIn(kg.managerEmail)).status).toBe(400);
    const { data } = await manager.client.from('memberships').select('id').eq('organization_id', kg.orgId);
    expect(data?.length).toBeGreaterThan(0);
  });

  it('refresh of an e-mail-code session still works (the hook only refuses password sessions)', async () => {
    const s = await signInWithCode(guardianEmail);
    const session = (await s.client.auth.getSession()).data.session!;
    const r = await auth('POST', '/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } });
    expect(r.status).toBe(200);
    const c = claims(String(r.json?.access_token));
    expect((c.amr as { method: string }[]).map((a) => a.method)).toContain('otp');
  });

  it('the recovery flow cannot be used to set a password either', async () => {
    const before = Date.now() - 1000;
    // GoTrue throttles e-mails per address (auth.email.max_frequency); back off like signInWithCode does.
    let recover = await auth('POST', '/recover', { body: { email: guardianEmail } });
    for (let i = 0; i < 5 && recover.status === 429; i++) {
      await new Promise((r) => setTimeout(r, 1100));
      recover = await auth('POST', '/recover', { body: { email: guardianEmail } });
    }
    expect(recover.status).toBe(200);
    const mail = await latestMail(guardianEmail, '', before);
    const tokenHash = mail?.text.match(/[?&]token=([^&\s\]]+)/)?.[1];
    expect(tokenHash).toBeDefined();
    const v = await auth('POST', '/verify', { body: { type: 'recovery', token_hash: tokenHash } });
    expect(v.status).toBe(200);
    expect((await setPassword(String(v.json?.access_token))).status).toBeGreaterThanOrEqual(400);
  });
});
