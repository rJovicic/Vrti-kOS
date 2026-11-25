import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply, plan } from '../src/apply.ts';
import { run } from '../src/cli.ts';
import { isReadOnly, ManagementClient, QUERIES } from '../src/clients.ts';
import { evaluate, exitCode } from '../src/evaluate.ts';
import { loadSpec, validateSpec, type Spec } from '../src/spec.ts';

const REF = 'hfwlfdgzgulbutnjttnq';
const REAL_SPEC = join(import.meta.dirname, '..', '..', '..', 'supabase', 'hosted', 'staging.json');

interface Call {
  method: string;
  url: string;
  body?: unknown;
}
type Route = { status?: number; body?: unknown; throws?: boolean };

/** Fake fetch: routes keyed by "METHOD path-suffix"; records every call. */
function fakeFetch(routes: Record<string, Route | ((c: Call) => Route)>) {
  const calls: Call[] = [];
  const f = (async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const key = Object.keys(routes).find((k) => {
      const [m, suffix] = k.split(' ');
      return m === method && url.endsWith(suffix!);
    });
    if (!key) return new Response('{"message":"not found"}', { status: 404 });
    const r = typeof routes[key] === 'function' ? (routes[key] as (c: Call) => Route)({ method, url, body }) : (routes[key] as Route);
    if (r.throws) throw new Error('connect ECONNREFUSED');
    return new Response(r.body === undefined ? '' : JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { f, calls };
}

function miniSpec(extra: Partial<Spec['settings'][number]>[] = []): Spec {
  return validateSpec({
    project: { ref: REF, name: 'vrticos-staging', environment: 'staging', region: 'eu-central-1', apiUrl: `https://${REF}.supabase.co`, adminUrl: 'https://admin.example' },
    settings: [
      { id: 'auth.disable_signup', class: 'security', source: { kind: 'field', path: '/config/auth', field: 'disable_signup' }, expected: true, apply: 'safe', decision: 'ADR-0008' },
      { id: 'postgrest.max_rows', class: 'security', source: { kind: 'field', path: '/postgrest', field: 'max_rows' }, expected: 100, apply: 'safe', decision: 'SR-API-06' },
      { id: 'realtime.private_only', class: 'security', source: { kind: 'field', path: '/config/realtime', field: 'private_only' }, expected: true, apply: 'safe', decision: 'R-61' },
      { id: 'keys.legacy', class: 'security', source: { kind: 'legacy-keys' }, expected: false, apply: 'manual', decision: 'R-59', manual: 'dashboard' },
      { id: 'auth.sessions_timebox', class: 'decision', source: { kind: 'field', path: '/config/auth', field: 'sessions_timebox' }, expected: null, apply: 'none', decision: 'open' },
      ...extra,
    ],
  });
}

const PROJECT = { ref: REF, name: 'vrticos-staging', region: 'eu-central-1' };
const healthy = (): Record<string, Route | ((c: Call) => Route)> => ({
  [`GET /projects/${REF}`]: { body: PROJECT },
  'GET /config/auth': { body: { disable_signup: true, sessions_timebox: 0 } },
  'GET /postgrest': { body: { max_rows: 100, jwt_secret: 'SUPERSECRET-should-never-appear' } },
  'GET /config/realtime': { body: { private_only: true } },
  'GET /api-keys/legacy': { body: { enabled: false } },
});
const ctxFor = (spec: Spec, f: typeof fetch) => ({ spec, mgmt: new ManagementClient({ ref: REF, token: 't', fetch: f }), pub: null });

describe('spec validation', () => {
  it('accepts the real staging spec', () => {
    const spec = loadSpec(REAL_SPEC);
    expect(spec.project.ref).toBe(REF);
    expect(spec.settings.length).toBeGreaterThan(40);
  });
  it('refuses a non-staging spec, secret fields, unsafe auto-apply and settings without a decision', () => {
    const base = miniSpec();
    expect(() => validateSpec({ ...base, project: { ...base.project, environment: 'production' } })).toThrow(/only staging/);
    expect(() => validateSpec({ ...base, project: { ...base.project, apiUrl: 'https://otherprojectrefxxxxx.supabase.co' } })).toThrow(/apiUrl/);
    const bad = (s: object) => validateSpec({ ...base, settings: [s] });
    expect(() => bad({ id: 'x', class: 'security', source: { kind: 'field', path: '/postgrest', field: 'jwt_secret' }, expected: 1, apply: 'none', decision: 'd' })).toThrow(/secret/);
    expect(() => bad({ id: 'x', class: 'security', source: { kind: 'legacy-keys' }, expected: false, apply: 'safe', decision: 'd' })).toThrow(/only top-level fields/);
    expect(() => bad({ id: 'x', class: 'decision', source: { kind: 'field', path: '/config/auth', field: 'a' }, expected: null, apply: 'safe', decision: 'd' })).toThrow(/only decided/);
    expect(() => bad({ id: 'x', class: 'security', source: { kind: 'field', path: '/config/auth', field: 'a' }, expected: 1, apply: 'none', decision: '' })).toThrow(/decision source/);
  });
  it('allows only fixed read-only SQL', () => {
    for (const q of Object.values(QUERIES)) expect(isReadOnly(q)).toBe(true);
    expect(isReadOnly('select 1; drop table children')).toBe(false);
    expect(isReadOnly('delete from children')).toBe(false);
    expect(isReadOnly("select * from x where y = 'drop'")).toBe(true);
    expect(isReadOnly('select set_config(1)')).toBe(true);
    expect(isReadOnly('select 1 from x for update')).toBe(false);
  });
});

describe('check', () => {
  it('passes only when every required setting is read and equal', async () => {
    const { f } = fakeFetch(healthy());
    const r = await evaluate(ctxFor(miniSpec(), f));
    expect(r.map((x) => x.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'decision']);
    expect(exitCode(r)).toBe(0);
  });
  it('a drifted security setting fails the check (exit 1)', async () => {
    const routes = healthy();
    routes['GET /postgrest'] = { body: { max_rows: 1000 } };
    const r = await evaluate(ctxFor(miniSpec(), fakeFetch(routes).f));
    expect(r.find((x) => x.id === 'postgrest.max_rows')).toMatchObject({ status: 'drift', actual: 1000 });
    expect(exitCode(r)).toBe(1);
  });
  it('a missing field (partial response) is unknown, never ok (exit 2)', async () => {
    const routes = healthy();
    routes['GET /config/realtime'] = { body: { suspend: false } };
    const r = await evaluate(ctxFor(miniSpec(), fakeFetch(routes).f));
    expect(r.find((x) => x.id === 'realtime.private_only')?.status).toBe('unknown');
    expect(exitCode(r)).toBe(2);
  });
  it('an unavailable API (HTTP 500 or network error) is unknown (exit 2)', async () => {
    const routes = healthy();
    routes['GET /config/auth'] = { status: 500, body: { message: 'boom' } };
    routes['GET /api-keys/legacy'] = { throws: true };
    const r = await evaluate(ctxFor(miniSpec(), fakeFetch(routes).f));
    expect(r.find((x) => x.id === 'auth.disable_signup')).toMatchObject({ status: 'unknown' });
    expect(r.find((x) => x.id === 'keys.legacy')?.note).toMatch(/network error/);
    expect(exitCode(r)).toBe(2);
  });
  it('without management access the management checks are skipped and the run is not a pass', async () => {
    const r = await evaluate({ spec: miniSpec(), mgmt: null, pub: null });
    expect(new Set(r.map((x) => x.status))).toEqual(new Set(['skipped']));
    expect(exitCode(r)).toBe(2);
    expect(exitCode(r, { publicOnly: true })).toBe(0);
  });
  it('an unknown value of an open decision does not pass as ok', async () => {
    const r = await evaluate(ctxFor(miniSpec(), fakeFetch(healthy()).f));
    expect(r.find((x) => x.id === 'auth.sessions_timebox')).toMatchObject({ status: 'decision', actual: 0 });
  });
});

describe('plan and apply', () => {
  const drifted = () => {
    const routes = healthy();
    routes['GET /postgrest'] = { body: { max_rows: 1000 } };
    routes['GET /api-keys/legacy'] = { body: { enabled: true } };
    return routes;
  };
  it('separates safe, manual and blocked changes', async () => {
    const spec = miniSpec();
    const r = await evaluate(ctxFor(spec, fakeFetch(drifted()).f));
    const p = plan(spec, r);
    expect(p.safe).toEqual([{ id: 'postgrest.max_rows', path: '/postgrest', field: 'max_rows', from: 1000, to: 100 }]);
    expect(p.manual.map((x) => x.id)).toEqual(['keys.legacy']);
    expect(p.blocked).toEqual([]);
  });
  it('refuses without the confirmation flag and sends no PATCH', async () => {
    const spec = miniSpec();
    const { f, calls } = fakeFetch(drifted());
    const ctx = ctxFor(spec, f);
    const p = plan(spec, await evaluate(ctx));
    await expect(apply(ctx, p, undefined)).rejects.toThrow(/confirm-project/);
    await expect(apply(ctx, p, 'otherprojectrefxxxxx')).rejects.toThrow(/confirm-project/);
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
  });
  it('refuses when the live project is not the staging project', async () => {
    const spec = miniSpec();
    const routes = drifted();
    routes[`GET /projects/${REF}`] = { body: { ref: REF, name: 'production-app', region: 'eu-central-1' } };
    const { f, calls } = fakeFetch(routes);
    const ctx = ctxFor(spec, f);
    await expect(apply(ctx, plan(spec, await evaluate(ctx)), REF)).rejects.toThrow(/live project is production-app/);
    expect(calls.filter((c) => c.method === 'PATCH')).toEqual([]);
  });
  it('applies only safe fields, verifies the target before each PATCH and re-checks afterwards', async () => {
    const spec = miniSpec();
    let maxRows = 1000;
    const routes = drifted();
    routes['GET /postgrest'] = () => ({ body: { max_rows: maxRows } });
    routes['PATCH /postgrest'] = (c) => {
      maxRows = (c.body as { max_rows: number }).max_rows;
      return { body: {} };
    };
    const { f, calls } = fakeFetch(routes);
    const ctx = ctxFor(spec, f);
    const out = await apply(ctx, plan(spec, await evaluate(ctx)), REF);
    const patches = calls.filter((c) => c.method === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0]!.body).toEqual({ max_rows: 100 }); // nothing else, never the manual legacy-key change
    expect(calls.filter((c) => c.url.endsWith(`/projects/${REF}`)).length).toBeGreaterThanOrEqual(2);
    expect(out.applied).toEqual(['postgrest.max_rows']);
    expect(out.after.find((x) => x.id === 'postgrest.max_rows')?.status).toBe('ok');
    expect(out.after.find((x) => x.id === 'keys.legacy')?.status).toBe('drift'); // still reported, not touched
  });
  it('stops at the first failed PATCH and attempts nothing after it', async () => {
    const spec = miniSpec();
    const routes = healthy();
    routes['GET /config/auth'] = { body: { disable_signup: false, sessions_timebox: 0 } };
    routes['GET /config/realtime'] = { body: { private_only: false } };
    routes['PATCH /config/auth'] = { status: 500, body: {} };
    routes['PATCH /config/realtime'] = { body: {} };
    const { f, calls } = fakeFetch(routes);
    const ctx = ctxFor(spec, f);
    const out = await apply(ctx, plan(spec, await evaluate(ctx)), REF);
    expect(out.failed?.ids).toEqual(['auth.disable_signup']);
    expect(calls.filter((c) => c.method === 'PATCH').map((c) => c.url.split(REF)[1])).toEqual(['/config/auth']);
  });
});

describe('CLI guards', () => {
  const io = (env: Record<string, string>, specPath = REAL_SPEC) => {
    const lines: string[] = [];
    const { f, calls } = fakeFetch(healthy());
    return { io: { env, out: (l: string) => lines.push(l), fetch: f, specPath }, lines, calls };
  };
  it('refuses any project ref other than the staging spec, before any request', async () => {
    for (const args of [['check', '--project', 'abcdefghijklmnopqrst'], ['apply', '--project', 'abcdefghijklmnopqrst', '--confirm-project=abcdefghijklmnopqrst'], ['check']]) {
      const t = io({ SUPABASE_MANAGEMENT_TOKEN: 't' });
      expect(await run(args, t.io)).toBe(3);
      expect(t.calls).toEqual([]);
      expect(t.lines.join('\n')).toMatch(/REFUSED/);
    }
  });
  it('refuses without a management token (and --public-only cannot plan or apply)', async () => {
    const t = io({});
    expect(await run(['plan', '--project', REF], t.io)).toBe(3);
    expect(await run(['apply', '--project', REF, '--public-only'], t.io)).toBe(3);
    expect(t.calls).toEqual([]);
  });
  it('a production-like spec file is refused outright', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-'));
    const raw = JSON.parse(JSON.stringify(miniSpec())) as Spec;
    raw.project.environment = 'production';
    writeFileSync(join(dir, 'prod.json'), JSON.stringify(raw));
    const t = io({ SUPABASE_MANAGEMENT_TOKEN: 't' }, join(dir, 'prod.json'));
    expect(await run(['apply', '--project', REF, `--confirm-project=${REF}`], t.io)).toBe(3);
    expect(t.calls).toEqual([]);
  });
  it('never prints secret values returned by the API', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hc-'));
    writeFileSync(join(dir, 's.json'), JSON.stringify(miniSpec()));
    const t = io({ SUPABASE_MANAGEMENT_TOKEN: 'TOKEN-VALUE' }, join(dir, 's.json'));
    expect(await run(['check', '--project', REF], t.io)).toBe(0);
    const text = t.lines.join('\n');
    expect(text).not.toContain('SUPERSECRET');
    expect(text).not.toContain('TOKEN-VALUE');
  });
});
