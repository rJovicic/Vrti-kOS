// SR-SESS-04 option B through the real Auth server (GoTrue) and the custom_access_token hook
// (migration 20261126100000_session_limits.sql). Exact one-second boundaries are proven in pgTAP 36; here every kind of
// expiry is proven end to end with a 60-second margin, by moving a session's timestamps back with the database owner's
// connection (local stack only — never staging). Synthetic accounts.
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { anonClient, claims, createKindergarten, email, enrolMfa, service, signInWithCode, stack } from './helpers.ts';

const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
function sql(text: string): string {
  const r = spawnSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', text], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`psql failed: ${r.stderr}`);
  return r.stdout.trim();
}

interface Tokens {
  access: string;
  refresh: string;
}
const sid = (t: Tokens) => String(claims(t.access).session_id);
async function signIn(address: string): Promise<Tokens> {
  const { client } = await signInWithCode(address);
  const { data } = await client.auth.getSession();
  return { access: data.session!.access_token, refresh: data.session!.refresh_token };
}
/** Refresh with the newest refresh token: the new pair, or the refusal. */
async function refresh(t: Tokens): Promise<{ next?: Tokens; error?: { status?: number; message: string } }> {
  const { data, error } = await anonClient().auth.refreshSession({ refresh_token: t.refresh });
  if (error || !data.session) return { error: { status: error?.status, message: error?.message ?? 'no session' } };
  return { next: { access: data.session.access_token, refresh: data.session.refresh_token } };
}
/** Session created `age` ago and last refreshed `idle` ago (PostgreSQL intervals; idle null = never refreshed). */
function setTimes(t: Tokens, age: string, idle: string | null) {
  sql(`update auth.sessions set created_at = now() - interval '${age}',
         refreshed_at = ${idle === null ? 'null' : `(now() - interval '${idle}') at time zone 'UTC'`} where id = '${sid(t)}'`);
}
const frozen = (t: Tokens) => sql(`select role_class || ' ' || max_age || ' ' || idle_timeout from auth_hooks.session_limits where session_id = '${sid(t)}'`);
const restStatus = async (access: string) =>
  (await fetch(`${stack.API_URL}/rest/v1/groups?select=id`, { headers: { apikey: stack.PUBLISHABLE_KEY, authorization: `Bearer ${access}` } })).status;

let kg: Awaited<ReturnType<typeof createKindergarten>>;
let guardianEmail: string;
let guardianId: string;

beforeAll(async () => {
  kg = await createKindergarten('slim');
  guardianEmail = email('skrbnik-slim');
  const { data, error } = await service.auth.admin.createUser({ email: guardianEmail, email_confirm: true });
  if (error) throw error;
  guardianId = data.user.id;
  await service.from('profiles').insert({ id: guardianId, first_name: 'Skrbnik', last_name: 'Slim' }).throwOnError();
  await service.from('memberships').insert({ organization_id: kg.orgId, profile_id: guardianId, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
}, 120_000);

describe('session limits per role (SR-SESS-04 option B, real Auth)', () => {
  it('a new session of every role gets tokens, refreshes, and freezes its role limits', async () => {
    const m = await signIn(kg.managerEmail);
    const e = await signIn(kg.educatorEmail);
    const g = await signIn(guardianEmail);
    for (const t of [m, e, g]) expect((await refresh(t)).error).toBeUndefined();
    expect(frozen(m)).toBe('manager 7 days 08:00:00');
    expect(frozen(e)).toBe('staff 30 days 30 days');
    expect(frozen(g)).toBe('guardian 30 days 14 days');
  }, 90_000);

  it('maximum age: a token is issued a minute before the limit and refused a minute after it, for every role', async () => {
    for (const [address, limit] of [
      [kg.managerEmail, 7],
      [kg.educatorEmail, 30],
      [guardianEmail, 30],
    ] as const) {
      let t = await signIn(address);
      setTimes(t, `${limit} days - 60 seconds`, '1 minute');
      const before = await refresh(t);
      expect(before.error, `${limit} days − 1 min`).toBeUndefined();
      t = before.next!;
      setTimes(t, `${limit} days 60 seconds`, '1 minute');
      const after = await refresh(t);
      expect(after.error?.status, `${limit} days + 1 min`).toBe(401);
      expect(after.error?.message).toBe('Session expired. Sign in again.');
    }
  }, 120_000);

  it('inactivity: counted from the last refresh, refused a minute after the limit', async () => {
    for (const [address, idle] of [
      [kg.managerEmail, '8 hours'],
      [kg.educatorEmail, '30 days'],
      [guardianEmail, '14 days'],
    ] as const) {
      let t = await signIn(address);
      setTimes(t, '1 day', `${idle} - 60 seconds`);
      const before = await refresh(t);
      expect(before.error, `idle ${idle} − 1 min`).toBeUndefined();
      t = before.next!;
      setTimes(t, '1 day', `${idle} 60 seconds`);
      expect((await refresh(t)).error?.status, `idle ${idle} + 1 min`).toBe(401);
    }
    // Never refreshed: inactivity counts from creation.
    const fresh = await signIn(kg.managerEmail);
    setTimes(fresh, '8 hours 60 seconds', null);
    expect((await refresh(fresh)).error?.status).toBe(401);
  }, 120_000);

  it('an active session that refreshes regularly stays valid (each refresh moves its last activity) until its maximum age', async () => {
    let t = await signIn(kg.managerEmail);
    setTimes(t, '6 days 23 hours', '7 hours 59 minutes');
    const r = await refresh(t);
    expect(r.error).toBeUndefined();
    t = r.next!;
    // Auth recorded this refresh as the new last activity.
    expect(Number(sql(`select extract(epoch from (now() at time zone 'UTC') - refreshed_at)::int from auth.sessions where id = '${sid(t)}'`))).toBeLessThan(30);
    const second = await refresh(t);
    expect(second.error).toBeUndefined();
    t = second.next!;
    // Still refreshing every few minutes, but past 7 days: refused.
    sql(`update auth.sessions set created_at = now() - interval '7 days 60 seconds' where id = '${sid(t)}'`);
    expect((await refresh(t)).error?.status).toBe(401);

    // A guardian who opens the app at least every 14 days keeps the session until 30 days, not longer.
    let g = await signIn(guardianEmail);
    setTimes(g, '29 days 23 hours', '13 days 23 hours');
    const g1 = await refresh(g);
    expect(g1.error).toBeUndefined();
    g = g1.next!;
    sql(`update auth.sessions set created_at = now() - interval '30 days 60 seconds' where id = '${sid(g)}'`);
    expect((await refresh(g)).error?.status).toBe(401);
  }, 90_000);

  it('MFA: an AAL2 manager session keeps AAL2 on refresh and is limited like any manager session', async () => {
    const { client } = await signInWithCode(kg.managerEmail);
    await enrolMfa(client);
    const { data } = await client.auth.getSession();
    let t: Tokens = { access: data.session!.access_token, refresh: data.session!.refresh_token };
    expect(claims(t.access).aal).toBe('aal2');
    const r = await refresh(t);
    expect(r.error).toBeUndefined();
    t = r.next!;
    expect(claims(t.access).aal).toBe('aal2');
    setTimes(t, '1 day', '8 hours 60 seconds');
    expect((await refresh(t)).error?.status).toBe(401);
    const { data: factors } = await client.auth.mfa.listFactors();
    for (const f of factors?.all ?? []) await service.auth.admin.mfa.deleteFactor({ id: f.id, userId: String(claims(t.access).sub) });
  }, 90_000);

  it('several roles: the strictest applies (manager who is also a guardian elsewhere)', async () => {
    const other = await createKindergarten('slim-b');
    const managerId = sql(`select id from auth.users where email = '${kg.managerEmail}'`);
    await service.from('memberships').insert({ organization_id: other.orgId, profile_id: managerId, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
    const t = await signIn(kg.managerEmail);
    expect(frozen(t)).toBe('manager 7 days 08:00:00');
    setTimes(t, '8 days', '1 minute');
    expect((await refresh(t)).error?.status).toBe(401);
  }, 120_000);

  it('several roles: educator who is also a guardian gets the guardian\'s 14-day inactivity limit', async () => {
    const k = await createKindergarten('slim-eg');
    const educatorId = sql(`select id from auth.users where email = '${k.educatorEmail}'`);
    await service.from('memberships').insert({ organization_id: kg.orgId, profile_id: educatorId, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
    let t = await signIn(k.educatorEmail);
    expect(frozen(t)).toBe('staff 30 days 14 days');
    setTimes(t, '20 days', '13 days 23 hours');
    const ok = await refresh(t);
    expect(ok.error).toBeUndefined();
    t = ok.next!;
    setTimes(t, '20 days', '14 days 60 seconds');
    expect((await refresh(t)).error?.status).toBe(401);
  }, 120_000);

  it('role change during a session: promotion shortens it at the next token, demotion never lengthens it', async () => {
    // Promotion: an educator session of 10 days is fine as staff, refused once the person becomes a director.
    const k = await createKindergarten('slim-role');
    let e = await signIn(k.educatorEmail);
    setTimes(e, '10 days', '1 minute');
    const ok = await refresh(e);
    expect(ok.error).toBeUndefined();
    e = ok.next!;
    sql(`update public.memberships set role = 'director' where id = '${k.educatorMembershipId}'`);
    setTimes(e, '10 days', '1 minute');
    expect((await refresh(e)).error?.status).toBe(401);

    // Demotion: a manager session stays on manager limits after the manager role ends and a guardian role begins.
    let m = await signIn(k.managerEmail);
    const managerId = String(claims(m.access).sub);
    sql(`update public.memberships set role = 'guardian' where profile_id = '${managerId}' and organization_id = '${k.orgId}'`);
    setTimes(m, '8 days', '1 minute');
    expect((await refresh(m)).error?.status).toBe(401);
    expect(frozen(m)).toBe('manager 7 days 08:00:00');
    // A new session of the now-guardian gets guardian limits.
    m = await signIn(k.managerEmail);
    expect(frozen(m)).toBe('guardian 30 days 14 days');

    // Educator → guardian: the inactivity limit tightens from 30 to 14 days for the running session.
    const k2 = await createKindergarten('slim-role2');
    let s2 = await signIn(k2.educatorEmail);
    expect(frozen(s2)).toBe('staff 30 days 30 days');
    sql(`update public.memberships set role = 'guardian' where id = '${k2.educatorMembershipId}'`);
    setTimes(s2, '2 days', '15 days');
    expect((await refresh(s2)).error?.status).toBe(401);
    // Guardian → educator: a guardian session is never relaxed to staff limits.
    s2 = await signIn(k2.educatorEmail);
    expect(frozen(s2)).toBe('guardian 30 days 14 days');
    sql(`update public.memberships set role = 'educator' where id = '${k2.educatorMembershipId}'`);
    setTimes(s2, '2 days', '20 days');
    expect((await refresh(s2)).error?.status).toBe(401);
    expect(frozen(m)).toBe('guardian 30 days 14 days');
  }, 120_000);

  it('suspended membership: the role no longer counts (strictest limits apply), and data access ends at once', async () => {
    const k = await createKindergarten('slim-susp');
    let e = await signIn(k.educatorEmail);
    sql(`update public.memberships set status = 'suspended' where id = '${k.educatorMembershipId}'`);
    setTimes(e, '2 days', '9 hours');
    expect((await refresh(e)).error?.status).toBe(401);
    // Reactivated: staff limits again for a new session (nothing was frozen while the person had no role).
    sql(`update public.memberships set status = 'active' where id = '${k.educatorMembershipId}'`);
    e = await signIn(k.educatorEmail);
    setTimes(e, '2 days', '9 hours');
    expect((await refresh(e)).error).toBeUndefined();
    // A suspended guardian membership: the guardian's limits no longer apply either (strictest limits).
    const g = await signIn(guardianEmail);
    sql(`update public.memberships set status = 'suspended' where profile_id = '${guardianId}'`);
    setTimes(g, '2 days', '9 hours');
    try {
      expect((await refresh(g)).error?.status).toBe(401);
    } finally {
      sql(`update public.memberships set status = 'active' where profile_id = '${guardianId}'`);
    }
  }, 120_000);

  it('after "sign out everywhere": refresh refused and the frozen limits are gone with the sessions', async () => {
    const { client } = await signInWithCode(guardianEmail);
    const { data } = await client.auth.getSession();
    const t: Tokens = { access: data.session!.access_token, refresh: data.session!.refresh_token };
    expect(frozen(t)).not.toBe('');
    await client.auth.signOut({ scope: 'global' });
    expect((await refresh(t)).error).toBeDefined();
    expect(sql(`select count(*) from auth_hooks.session_limits where user_id = '${guardianId}'`)).toBe('0');
    // The access token issued before sign-out stays valid until it expires — never longer than 15 minutes:
    // every token lives exactly jwt_expiry (900 s), and after revocation no new one can be obtained.
    expect(await restStatus(t.access)).toBe(200);
    const c = claims(t.access);
    expect(Number(c.exp) - Number(c.iat)).toBe(900);
    expect(Number(c.exp) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(900);
  }, 90_000);

  it('an access token is refused by the API once it has expired: 15 minutes plus PostgREST\'s 30-second clock tolerance', async () => {
    const t = await signIn(kg.educatorEmail);
    const header = JSON.parse(Buffer.from(t.access.split('.')[0]!, 'base64url').toString()) as { alg: string };
    const c = claims(t.access);
    expect(Number(c.exp) - Number(c.iat)).toBe(900);
    // Same claims, signed with the local stack's JWT secret: valid now → accepted (control); expired → refused.
    const mint = (exp: number) => {
      const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
      const body = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc({ ...c, iat: exp - 900, exp })}`;
      return `${body}.${createHmac('sha256', stack.JWT_SECRET).update(body).digest('base64url')}`;
    };
    const now = Math.floor(Date.now() / 1000);
    expect(await restStatus(mint(now + 600)), `control (local signing alg ${header.alg})`).toBe(200);
    // PostgREST tolerates 30 s of clock skew past `exp` (measured: 29 s → 200, 31 s → 401). The real ceiling after a
    // revocation is therefore jwt_expiry + 30 s = 15 min 30 s on the REST API.
    expect(await restStatus(mint(now - 20))).toBe(200);
    expect(await restStatus(mint(now - 40))).toBe(401);
  }, 60_000);

  it('after a refused refresh, the last access token still works until it expires (at most 15 minutes)', async () => {
    const t = await signIn(kg.educatorEmail);
    setTimes(t, '31 days', '1 minute');
    expect((await refresh(t)).error?.status).toBe(401);
    expect(await restStatus(t.access)).toBe(200);
    expect(Number(claims(t.access).exp) - Math.floor(Date.now() / 1000)).toBeLessThanOrEqual(900);
  }, 90_000);

  it('hook error: no token is issued; the same refresh token works again once the hook works', async () => {
    let t = await signIn(kg.educatorEmail);
    // Make the hook fail (local stack only): the table it reads is temporarily missing.
    sql('alter table auth_hooks.session_limits rename to session_limits_offline');
    let failed: Awaited<ReturnType<typeof refresh>>;
    try {
      failed = await refresh(t);
    } finally {
      sql('alter table auth_hooks.session_limits_offline rename to session_limits');
    }
    expect(failed.next).toBeUndefined();
    expect(failed.error).toBeDefined();
    // The failed attempt rolled back with the hook, so the refresh token was not used up.
    const recovered = await refresh(t);
    expect(recovered.error).toBeUndefined();
    t = recovered.next!;
    expect(claims(t.access).session_id).toBeTruthy();
  }, 90_000);

  it('database not answering: Auth waits for the hook and never issues a token without the check', async () => {
    const t = await signIn(kg.educatorEmail);
    setTimes(t, '31 days', '1 minute'); // the check must refuse this session
    const locker = spawn('psql', [DB_URL, '-qAt', '-c', 'begin; lock table auth_hooks.session_limits in access exclusive mode; select pg_sleep(3); commit;']);
    const lockReleased = new Promise((res) => locker.on('exit', res));
    const held = () =>
      sql(`select count(*) from pg_locks where relation = 'auth_hooks.session_limits'::regclass and mode = 'AccessExclusiveLock' and granted`) === '1';
    for (let i = 0; i < 40 && !held(); i++) await new Promise((r) => setTimeout(r, 50));
    expect(held()).toBe(true);
    const started = Date.now();
    const r = await refresh(t);
    const waited = Date.now() - started;
    await lockReleased;
    expect(r.next).toBeUndefined();
    expect(r.error).toBeDefined();
    expect(waited).toBeGreaterThan(1_500); // answered only after the database answered (or the hook timed out)
  }, 90_000);
});
