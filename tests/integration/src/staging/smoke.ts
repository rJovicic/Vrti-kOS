// Staging smoke: health, Auth, RLS and Realtime against Railway staging + Supabase `vrticos-staging` (synthetic data).
//
//   cd tests/integration
//   STAGING_PUBLISHABLE_KEY=sb_publishable_… STAGING_SECRET_KEY=sb_secret_… \
//     node --experimental-strip-types src/staging/smoke.ts
//
// Every check is printed as PASS/FAIL/INFO with the observed value; the process exits 1 on any FAIL. INFO lines record
// facts that are not pass/fail (e.g. what Realtime currently allows) so the result can be quoted in the readiness docs.
// The secret key is used only to mint sign-in codes and for one temporary synthetic account (created and deleted here).
import { randomUUID } from 'node:crypto';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { totp } from '../totp.ts';
import { STAGING_ADMIN_URL, STAGING_REF, anon, signIn, stagingTarget } from './target.ts';

let failures = 0;
const pass = (name: string, detail = '') => console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name: string, detail = '') => {
  failures++;
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
};
const info = (name: string, detail: string) => console.log(`INFO  ${name} — ${detail}`);
const check = (name: string, ok: boolean, detail = '') => (ok ? pass(name, detail) : fail(name, detail));
const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1]!, 'base64url').toString('utf8')) as Record<string, unknown>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function section<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    fail(name, (e as Error).message);
    return undefined;
  }
}

// ── 0. Preflight: a network failure must never pass as an expected refusal ──────────────────────────────────────────
{
  const target = stagingTarget();
  try {
    const res = await fetch(`${target.url}/auth/v1/health`, { headers: { apikey: target.publishableKey } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (e) {
    console.log(`FAIL  preflight: staging API unreachable — ${(e as Error).message} (behind a proxy run node with NODE_USE_ENV_PROXY=1)`);
    process.exit(1);
  }
}

// ── 1. Railway health ─────────────────────────────────────────────────────────────────────────────────────────────
await section('health', async () => {
  const res = await fetch(`${STAGING_ADMIN_URL}/api/health`);
  const body = (await res.json()) as { status?: string; appEnv?: string; supabaseHost?: string };
  check('health: admin answers 200', res.status === 200, `HTTP ${res.status}`);
  check('health: appEnv is staging', body.appEnv === 'staging', String(body.appEnv));
  check('health: admin points at the staging Supabase project', body.supabaseHost === `${STAGING_REF}.supabase.co`, String(body.supabaseHost));
  const page = await (await fetch(`${STAGING_ADMIN_URL}/sign-in`)).text();
  check('health: sign-in page shows the synthetic-data marker (R-37)', page.includes('DEMO: izmišljeni podaci'));
});

// ── 2. Auth ───────────────────────────────────────────────────────────────────────────────────────────────────────
const t = stagingTarget();
await section('auth', async () => {
  const { error: signUpErr } = await anon().auth.signUp({ email: `smoke.${randomUUID().slice(0, 8)}@demo.vrtic.test`, password: `Aa1!${randomUUID()}` });
  check('auth: self sign-up is refused (ADR-0008)', !!signUpErr && signUpErr.status !== undefined && !/fetch failed/.test(signUpErr.message), signUpErr?.message ?? 'sign-up succeeded');

  const { error: otpErr } = await anon().auth.signInWithOtp({ email: `nobody.${randomUUID().slice(0, 8)}@demo.vrtic.test`, options: { shouldCreateUser: false } });
  check('auth: a code request for an unknown address creates no account', !!otpErr && !/fetch failed/.test(otpErr.message), otpErr?.message ?? 'no error');

  const parent = await signIn('roditelj.alfa.1@demo.vrtic.test');
  const { data: s } = await parent.auth.getSession();
  const c = claims(s.session!.access_token);
  const ttl = Number(c.exp) - Number(c.iat);
  check('auth: e-mail code sign-in works for a synthetic guardian', !!s.session);
  check('auth: access token lives 15 minutes (SR-SESS-02)', ttl === 900, `${ttl} s`);
  check('auth: session is AAL1 after the code', c.aal === 'aal1', String(c.aal));
  await parent.auth.signOut();

  // R-49: a password session must never get an access token. Temporary synthetic account, deleted at the end.
  const admin = createClient(t.url, process.env.STAGING_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const tmpEmail = `smoke.lozinka.${randomUUID().slice(0, 8)}@demo.vrtic.test`;
  const password = `Aa1!${randomUUID()}`;
  const { data: tmp, error: tmpErr } = await admin.auth.admin.createUser({ email: tmpEmail, email_confirm: true, password });
  if (tmpErr || !tmp.user) throw new Error(`temporary account: ${tmpErr?.message}`);
  try {
    const { data: pw, error: pwErr } = await anon().auth.signInWithPassword({ email: tmpEmail, password });
    check('auth: password sign-in gets no session (R-49 hook)', !pw.session && !!pwErr, pwErr?.message ?? 'session issued');
  } finally {
    await admin.auth.admin.deleteUser(tmp.user.id);
  }
});

// ── 3. RLS and tenant isolation ───────────────────────────────────────────────────────────────────────────────────
const ids = await section('rls', async () => {
  const { data: anonChildren, error: anonErr } = await anon().from('children').select('id');
  check('rls: anonymous sees no children', !anonErr ? (anonChildren ?? []).length === 0 : !/fetch failed/.test(anonErr.message), anonErr?.message ?? `${anonChildren?.length} rows`);

  const parent = await signIn('roditelj.alfa.1@demo.vrtic.test');
  const both = await signIn('roditelj.oba@demo.vrtic.test');
  const eduAlfa = await signIn('odgojitelj.alfa.1@demo.vrtic.test');
  const eduBeta = await signIn('odgojitelj.beta.1@demo.vrtic.test');

  const { data: orgs } = await eduAlfa.from('organizations').select('id, name');
  const alfa = orgs?.find((o) => String(o.name).includes('Alfa'));
  check('rls: educator of Alfa sees only Alfa', orgs?.length === 1 && !!alfa, JSON.stringify(orgs?.map((o) => o.name)));
  const { data: betaOrgs } = await eduBeta.from('organizations').select('id, name');
  const beta = betaOrgs?.find((o) => String(o.name).includes('Beta'));
  check('rls: educator of Beta sees only Beta', betaOrgs?.length === 1 && !!beta, JSON.stringify(betaOrgs?.map((o) => o.name)));

  const { data: pc } = await parent.from('children').select('id, organization_id');
  check('rls: guardian sees only own children (2: child 1 and the child without a group)', pc?.length === 2 && pc.every((x) => x.organization_id === alfa?.id), `${pc?.length} rows`);
  const { data: bc } = await both.from('children').select('id, organization_id');
  const orgsOfBoth = new Set(bc?.map((x) => x.organization_id));
  check('rls: guardian in both kindergartens sees exactly one child in each', bc?.length === 2 && orgsOfBoth.size === 2, `${bc?.length} rows, ${orgsOfBoth.size} orgs`);

  const { data: betaChildren } = await eduBeta.from('children').select('id').limit(50);
  const { data: ea } = await eduAlfa.from('children').select('id').in('id', (betaChildren ?? []).map((x) => x.id));
  check('rls: educator of Alfa cannot read Beta children by id', (ea ?? []).length === 0, `${ea?.length} rows`);

  const { data: groups } = await eduAlfa.schema('api').rpc('child_day_status', {});
  const ownRows = (groups ?? []) as Array<{ child_id: string; group_id: string }>;
  check('rls: educator day status lists only own children', ownRows.length > 0, `${ownRows.length} rows`);
  const { data: betaStatus, error: betaStatusErr } = await eduAlfa.schema('api').rpc('child_day_status', { p_group_id: (await eduBeta.from('groups').select('id').limit(1)).data?.[0]?.id });
  check('rls: educator of Alfa gets nothing for a Beta group', betaStatusErr ? !/Invalid schema|fetch failed/.test(betaStatusErr.message) : ((betaStatus as unknown[]) ?? []).length === 0, betaStatusErr?.message ?? `${(betaStatus as unknown[])?.length} rows`);

  if (ownRows.length === 0) throw new Error('no own children in day status; cannot continue the write checks');
  const ownChild = ownRows[0]!.child_id;
  const betaChild = betaChildren![0]!.id as string;
  const write = async (client: SupabaseClient, child: string) => {
    let r = await client.schema('api').rpc('record_attendance', { p_child_id: child, p_kind: 'check_in', p_idempotency_key: randomUUID() });
    if (r.error) r = await client.schema('api').rpc('record_attendance', { p_child_id: child, p_kind: 'check_out', p_idempotency_key: randomUUID() });
    return r;
  };
  const okWrite = await write(eduAlfa, ownChild);
  check('rls: educator records attendance for a child of own group', !okWrite.error, okWrite.error?.message ?? 'ok');
  const badWrite = await write(eduAlfa, betaChild);
  check('rls: educator of Alfa cannot record attendance for a Beta child', !!badWrite.error && !/Invalid schema|fetch failed/.test(badWrite.error.message), badWrite.error?.message ?? 'write accepted');

  // AAL2: a manager enrols TOTP like the admin app does, then removes the factor so the operator can enrol their own.
  const manager = await signIn('uprava.alfa@demo.vrtic.test');
  const { data: enrol, error: enrolErr } = await manager.auth.mfa.enroll({ factorType: 'totp', friendlyName: `smoke-${randomUUID().slice(0, 6)}` });
  if (enrolErr || !enrol) throw new Error(`mfa enroll: ${enrolErr?.message}`);
  try {
    const { data: ch } = await manager.auth.mfa.challenge({ factorId: enrol.id });
    const { error: vErr } = await manager.auth.mfa.verify({ factorId: enrol.id, challengeId: ch!.id, code: totp(enrol.totp.secret) });
    const { data: ms } = await manager.auth.getSession();
    check('auth: TOTP raises a manager session to AAL2 (SR-AUTHN-07)', !vErr && claims(ms.session!.access_token).aal === 'aal2', vErr?.message ?? String(claims(ms.session!.access_token).aal));
    const { data: mOrgs } = await manager.from('organizations').select('id');
    check('rls: manager of Alfa sees only Alfa', mOrgs?.length === 1 && mOrgs[0]!.id === alfa?.id);
  } finally {
    await manager.auth.mfa.unenroll({ factorId: enrol.id });
  }

  return { alfaId: alfa!.id as string, betaId: beta!.id as string, ownChild, eduAlfa, parent };
});

// ── 4. Realtime: what the hosted project actually allows (the apps have no Realtime subscriptions) ─────────────────
type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
const join = (channel: RealtimeChannel, ms = 8000) =>
  new Promise<Status>((resolve) => {
    const timer = setTimeout(() => resolve('TIMED_OUT'), ms);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        clearTimeout(timer);
        resolve(status as Status);
      }
    });
  });

if (ids) {
  await section('realtime', async () => {
    const director = await signIn('ravnateljica.alfa@demo.vrtic.test');
    const outsider = await signIn('roditelj.beta.1@demo.vrtic.test');
    for (const c of [director, outsider]) {
      const { data } = await c.auth.getSession();
      c.realtime.setAuth(data.session!.access_token);
    }

    // Public broadcast: with the project default any signed-in client could relay messages to any other through a shared
    // topic (measured on 2026-11-19: relayed=1 between Alfa and Beta). Staging sets Realtime `private_only`.
    const topic = `smoke-public-${randomUUID().slice(0, 8)}`;
    const a = director.channel(topic, { config: { broadcast: { self: false } } });
    const b = outsider.channel(topic);
    let relayed = 0;
    b.on('broadcast', { event: 'probe' }, () => relayed++);
    const [sa, sb] = await Promise.all([join(a), join(b)]);
    if (sa === 'SUBSCRIBED' && sb === 'SUBSCRIBED') {
      await a.send({ type: 'broadcast', event: 'probe', payload: { n: 1 } });
      await sleep(1500);
    }
    check('realtime: public channels are refused (private_only, SR-API-05)', sa !== 'SUBSCRIBED' && sb !== 'SUBSCRIBED' && relayed === 0, `join=${sa}/${sb}, relayed=${relayed}`);
    await director.removeAllChannels();
    await outsider.removeAllChannels();

    // Private channel of another kindergarten: must never be joinable (scenario 6 at protocol level).
    const priv = outsider.channel(`org:${ids.alfaId}`, { config: { private: true } });
    const sp = await join(priv);
    check('realtime: a Beta guardian cannot join a private Alfa channel', sp !== 'SUBSCRIBED', sp);
    const own = director.channel(`org:${ids.alfaId}`, { config: { private: true } });
    const so = await join(own);
    info('realtime: Alfa director joining a private Alfa channel', `${so} (no realtime.messages policies exist, so this is expected to be refused)`);
    await director.removeAllChannels();
    await outsider.removeAllChannels();

    // Postgres changes: the publication is empty, so an attendance write produces no event for anyone.
    let changes = 0;
    const pg = director
      .channel(`smoke-pg-${randomUUID().slice(0, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_records' }, () => changes++);
    const spg = await join(pg);
    let w = await ids.eduAlfa.schema('api').rpc('record_attendance', { p_child_id: ids.ownChild, p_kind: 'check_in', p_idempotency_key: randomUUID() });
    if (w.error) w = await ids.eduAlfa.schema('api').rpc('record_attendance', { p_child_id: ids.ownChild, p_kind: 'check_out', p_idempotency_key: randomUUID() });
    await sleep(4000);
    info('realtime: postgres_changes on attendance_records', `join=${spg}, write=${w.error ? w.error.message : 'ok'}, events=${changes}`);
    check('realtime: no row change is broadcast (publication supabase_realtime is empty)', changes === 0, `${changes} events`);
    await director.removeAllChannels();
  });
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
