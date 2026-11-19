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
import { readFileSync } from 'node:fs';
import { createServerClient } from '@supabase/ssr';
import { STAGING_ADMIN_URL, STAGING_REF, anon, mintCode, signIn, stagingTarget } from './target.ts';

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

  const parentChild = (pc ?? []).find((c) => ownRows.some((r) => r.child_id === c.id))?.id as string;
  return { alfaId: alfa!.id as string, betaId: beta!.id as string, ownChild, eduAlfa, parent, parentChild };
});

// ── 4. Hosted configuration drift (R-60, R-61) ───────────────────────────────────────────────────────────────────
// With a Supabase access token (operator; behind the cloud proxy it is injected) the smoke compares the security-relevant
// hosted settings with expected-config.json. Without one the section is skipped and says so (never silently passes).
await section('config', async () => {
  const token = process.env.STAGING_MANAGEMENT_TOKEN;
  if (!token) {
    info('config: hosted settings', 'SKIPPED — set STAGING_MANAGEMENT_TOKEN to compare with expected-config.json');
    return;
  }
  const expected = JSON.parse(readFileSync(new URL('./expected-config.json', import.meta.url), 'utf8')) as {
    postgrest: Record<string, unknown>; auth: Record<string, unknown>; realtime: Record<string, unknown>;
    functions: Record<string, boolean>; function_secrets_absent: string[];
  };
  const mgmt = async (path: string) => {
    const r = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`management API ${path}: HTTP ${r.status}`);
    return r.json() as Promise<unknown>;
  };
  const compare = (area: string, actual: Record<string, unknown>, want: Record<string, unknown>) => {
    const diff = Object.entries(want).filter(([k, v]) => actual[k] !== v).map(([k, v]) => `${k}: ${JSON.stringify(actual[k])} ≠ ${JSON.stringify(v)}`);
    check(`config: ${area} matches expected-config.json`, diff.length === 0, diff.join('; ') || `${Object.keys(want).length} settings`);
  };
  compare('API (exposed schemas, max rows)', (await mgmt('/postgrest')) as Record<string, unknown>, expected.postgrest);
  compare('Auth (sign-up, code, token, hook, MFA, redirects)', (await mgmt('/config/auth')) as Record<string, unknown>, expected.auth);
  compare('Realtime (private only, no presence)', (await mgmt('/config/realtime')) as Record<string, unknown>, expected.realtime);
  const legacy = (await mgmt('/api-keys/legacy')) as { enabled?: boolean };
  check('config: legacy anon/service_role keys disabled (R-59)', legacy.enabled === false, JSON.stringify(legacy));
  const sk = (await mgmt('/config/auth/signing-keys')) as { keys?: Array<{ algorithm: string; status: string }> };
  const keys = sk.keys ?? [];
  const trusted = keys.filter((k) => k.status === 'in_use' || k.status === 'previously_used' || k.status === 'standby');
  check('config: only the ES256 signing key is trusted (legacy JWT secret revoked, R-59)', trusted.length === 1 && trusted[0]!.algorithm === 'ES256',
    keys.map((k) => `${k.algorithm}:${k.status}`).join(', '));
  const fns = (await mgmt('/functions')) as Array<{ slug: string; verify_jwt: boolean }>;
  const fnState = Object.fromEntries(fns.map((f) => [f.slug, f.verify_jwt]));
  compare('Edge Functions (verify_jwt)', fnState, expected.functions);
  const secrets = ((await mgmt('/secrets')) as Array<{ name: string }>).map((x) => x.name);
  check('config: push activation secrets are absent (D-40, no Expo Push)', expected.function_secrets_absent.every((n) => !secrets.includes(n)), secrets.filter((n) => !n.startsWith('SUPABASE_')).join(', '));
});

// Behaviour that shows the same settings without any token.
await section('config-behaviour', async () => {
  const target = stagingTarget();
  const res = await fetch(`${target.url}/rest/v1/organizations?select=id`, { headers: { apikey: target.publishableKey, 'Accept-Profile': 'graphql_public' } });
  const body = (await res.json().catch(() => ({}))) as { code?: string };
  check('config: graphql_public is not exposed (only public, api)', body.code === 'PGRST106', `HTTP ${res.status} ${body.code ?? ''}`);
  const code = await mintCode('roditelj.beta.5@demo.vrtic.test');
  check('config: sign-in codes have 6 digits (SR-AUTHN-02)', /^\d{6}$/.test(code), `${code.length} characters`);
});

// ── 5. Realtime D-43: real events on the hosted project ─────────────────────────────────────────────────────────────
type Status = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
const join = (channel: RealtimeChannel, ms = 10_000) =>
  new Promise<Status>((resolve) => {
    const timer = setTimeout(() => resolve('TIMED_OUT'), ms);
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        clearTimeout(timer);
        resolve(status as Status);
      }
    });
  });
interface Ear { events: Array<Record<string, unknown>>; status: Status; client: SupabaseClient }
async function ear(client: SupabaseClient, topicOwner?: string, isPrivate = true): Promise<Ear> {
  const { data } = await client.auth.getSession();
  client.realtime.setAuth(data.session!.access_token);
  const owner = topicOwner ?? data.session!.user.id;
  const events: Ear['events'] = [];
  const ch = client.channel(`user:${owner}`, { config: { private: isPrivate } });
  ch.on('broadcast', { event: '*' }, (m) => events.push(m.payload as Record<string, unknown>));
  return { events, status: await join(ch), client };
}
const waitUntil = async (pred: () => boolean, ms = 10_000) => {
  for (let t0 = Date.now(); Date.now() - t0 < ms; await sleep(200)) if (pred()) return true;
  return pred();
};
const ofKind = (e: Ear, k: string) => e.events.filter((x) => x.kind === k);

if (ids) {
  await section('realtime', async () => {
    const director = await signIn('ravnateljica.alfa@demo.vrtic.test');
    const betaManager = await signIn('uprava.beta@demo.vrtic.test');
    const secondGuardian = await signIn('roditelj.alfa.2@demo.vrtic.test');
    const outsider = await signIn('roditelj.beta.1@demo.vrtic.test');
    const dirEar = await ear(director);
    const directorId = (await director.auth.getUser()).data.user!.id;
    const betaEar = await ear(betaManager);
    check('realtime: a user joins her own private topic', dirEar.status === 'SUBSCRIBED', dirEar.status);

    // Public channels are refused (private_only), and another user's private topic is refused (RLS).
    const pub = await ear(outsider, directorId, false);
    check('realtime: public channels are refused (private_only, SR-API-05)', pub.status !== 'SUBSCRIBED', pub.status);
    const intruder = await ear(outsider, directorId);
    check('realtime: a Beta guardian cannot join an Alfa user\'s topic', intruder.status !== 'SUBSCRIBED', intruder.status);

    // 1. Attendance by the educator reaches the director live; Beta gets nothing; a replay sends nothing.
    const key = randomUUID();
    let w = await ids.eduAlfa.schema('api').rpc('record_attendance', { p_child_id: ids.ownChild, p_kind: 'check_in', p_idempotency_key: key });
    if (w.error) w = await ids.eduAlfa.schema('api').rpc('record_attendance', { p_child_id: ids.ownChild, p_kind: 'check_out', p_idempotency_key: key });
    const got = await waitUntil(() => ofKind(dirEar, 'attendance').length === 1);
    check('realtime: an arrival reaches the director live', got && !w.error, w.error?.message ?? `${ofKind(dirEar, 'attendance').length} event(s)`);
    const keysOf = Object.keys(ofKind(dirEar, 'attendance')[0] ?? {}).sort().join(',');
    check('realtime: the event carries ids and kind only', keysOf === 'child_id,id,kind,local_date,organization_id,record_id', keysOf);
    await ids.eduAlfa.schema('api').rpc('record_attendance', { p_child_id: ids.ownChild, p_kind: w.data?.[0]?.kind ?? 'check_in', p_idempotency_key: key });
    await sleep(3000);
    check('realtime: an idempotent replay sends no duplicate event', ofKind(dirEar, 'attendance').length === 1, `${ofKind(dirEar, 'attendance').length} event(s)`);
    check('realtime: kindergarten Beta receives nothing from Alfa', betaEar.events.length === 0, `${betaEar.events.length} event(s)`);

    // 2. A message reaches the conversation's participants only (not the child's second guardian).
    const eduEar = await ear(ids.eduAlfa);
    const g2Ear = await ear(secondGuardian);
    const { data: conv } = await ids.parent.schema('api').rpc('open_conversation', { p_child_id: ids.parentChild });
    const sent = await ids.parent.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'Smoke: poruka bez sadržaja u događaju.' });
    const msgOk = await waitUntil(() => ofKind(eduEar, 'message').length >= 1);
    check('realtime: a guardian\'s message reaches the educator live', msgOk && !sent.error, sent.error?.message ?? `${ofKind(eduEar, 'message').length} event(s)`);
    await sleep(2500);
    check('realtime: the second guardian of the same child receives nothing', g2Ear.events.length === 0, `${g2Ear.events.length} event(s)`);
    check('realtime: no message text in any event', !JSON.stringify(eduEar.events).includes('Smoke'));
    check('realtime: nothing reached the intruder or the public channel', pub.events.length === 0 && intruder.events.length === 0);
    for (const c of [director, betaManager, secondGuardian, outsider, ids.eduAlfa]) await c.removeAllChannels();
  });

  // ── 6. Admin on Railway: /api/live streams hints from the server-side subscription (token never in the browser) ───
  await section('admin-live', async () => {
    const manager = await signIn('uprava.alfa@demo.vrtic.test');
    const { data: enrol, error: enrolErr } = await manager.auth.mfa.enroll({ factorType: 'totp', friendlyName: `smoke-live-${randomUUID().slice(0, 6)}` });
    if (enrolErr || !enrol) throw new Error(`mfa enroll: ${enrolErr?.message}`);
    const abort = new AbortController();
    try {
      const { data: ch } = await manager.auth.mfa.challenge({ factorId: enrol.id });
      await manager.auth.mfa.verify({ factorId: enrol.id, challengeId: ch!.id, code: totp(enrol.totp.secret) });
      const { data: s } = await manager.auth.getSession();
      // Build the same httpOnly session cookies the admin sets after sign-in (@supabase/ssr format).
      let jar: Array<{ name: string; value: string }> = [];
      const ssr = createServerClient(t.url, t.publishableKey, { cookies: { getAll: () => jar, setAll: (c) => { jar = c.map(({ name, value }) => ({ name, value })); } } });
      await ssr.auth.setSession({ access_token: s.session!.access_token, refresh_token: s.session!.refresh_token });
      const cookie = jar.map((c) => `${c.name}=${c.value}`).join('; ');
      const unauth = await fetch(`${STAGING_ADMIN_URL}/api/live`);
      check('admin-live: /api/live refuses a request without a session', unauth.status === 401, `HTTP ${unauth.status}`);
      const res = await fetch(`${STAGING_ADMIN_URL}/api/live`, { headers: { cookie }, signal: abort.signal });
      check('admin-live: /api/live opens an event stream for an MFA manager', res.status === 200 && (res.headers.get('content-type') ?? '').startsWith('text/event-stream'), `HTTP ${res.status}`);
      let text = '';
      const reader = res.body!.getReader();
      void (async () => {
        for (;;) {
          const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
          if (done) break;
          text += new TextDecoder().decode(value);
        }
      })();
      await waitUntil(() => text.includes('"status":"live"'), 10_000);
      const edu = await signIn('odgojitelj.alfa.1@demo.vrtic.test');
      const { data: day } = await edu.schema('api').rpc('child_day_status', {});
      const child = (day as Array<{ child_id: string }>)[0]!.child_id;
      let w = await edu.schema('api').rpc('record_attendance', { p_child_id: child, p_kind: 'check_in', p_idempotency_key: randomUUID() });
      if (w.error) w = await edu.schema('api').rpc('record_attendance', { p_child_id: child, p_kind: 'check_out', p_idempotency_key: randomUUID() });
      const hinted = await waitUntil(() => /event: hint\ndata: \{"kind":"attendance"/.test(text), 12_000);
      check('admin-live: an educator\'s arrival reaches the admin server stream live (Railway ↔ Supabase)', hinted && !w.error, w.error?.message ?? text.split('\n').filter((l) => l.startsWith('event:')).join(' '));
      check('admin-live: the stream carries no token and no names', !/eyJ|access_token|first_name|Vrtić/.test(text));
    } finally {
      abort.abort();
      await manager.auth.mfa.unenroll({ factorId: enrol.id }).catch(() => undefined);
    }
  });
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
