// Reads the actual hosted state and compares it with the spec. Never changes anything.
import { readdirSync } from 'node:fs';
import { ApiError, type ManagementClient, type PublicClient } from './clients.ts';
import { SECRET_FIELD, type Setting, type Spec } from './spec.ts';

/**
 * ok        actual equals expected
 * drift     actual differs from expected
 * unknown   could not be read (API error, missing field, unexpected shape) — never a pass
 * skipped   needs management access that was not given (--public-only) — never a pass
 * decision  no decided value yet; actual value reported
 * info      informational; actual value reported
 * manual    cannot be read or applied through any API; documented procedure
 */
export type Status = 'ok' | 'drift' | 'unknown' | 'skipped' | 'decision' | 'info' | 'manual';

export interface Result {
  id: string;
  class: Setting['class'];
  status: Status;
  expected: unknown;
  actual?: unknown;
  note?: string;
}

export interface Context {
  spec: Spec;
  mgmt: ManagementClient | null;
  pub: PublicClient | null;
  migrationsDir?: string;
}

const MISSING = Symbol('missing');

function at(obj: unknown, dotted: string): unknown {
  let cur: unknown = obj;
  for (const k of dotted.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(k in (cur as object))) return MISSING;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

export function equal(a: unknown, b: unknown): boolean {
  return JSON.stringify(canon(a)) === JSON.stringify(canon(b));
}
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, canon(x)]));
  return v;
}

/** Reads one setting's actual value. Throws ApiError/Error when it cannot be read. */
async function read(s: Setting, ctx: Context, cache: Map<string, unknown>): Promise<unknown> {
  const m = ctx.mgmt!;
  const cached = async (key: string, load: () => Promise<unknown>) => {
    if (!cache.has(key)) cache.set(key, await load());
    return cache.get(key);
  };
  const src = s.source;
  switch (src.kind) {
    case 'field': {
      if (SECRET_FIELD.test(src.field)) throw new Error('secret field');
      const body = await cached(`GET ${src.path}`, () => m.get(src.path));
      const v = at(body, src.field);
      if (v === MISSING) throw new ApiError(`${src.path}: field ${src.field} missing in the response`, 200);
      return v;
    }
    case 'legacy-keys': {
      const v = at(await m.get('/api-keys/legacy'), 'enabled');
      if (typeof v !== 'boolean') throw new ApiError('/api-keys/legacy: enabled missing', 200);
      return v;
    }
    case 'signing-keys': {
      const body = (await m.get('/config/auth/signing-keys')) as { keys?: Array<{ algorithm?: string; status?: string }> };
      if (!Array.isArray(body?.keys)) throw new ApiError('/config/auth/signing-keys: keys missing', 200);
      const trusted = body.keys.filter((k) => k.status === 'in_use' || k.status === 'previously_used' || k.status === 'standby');
      return trusted.length === 1 && trusted[0]!.algorithm === 'ES256' ? 'ES256 only' : trusted.map((k) => `${k.algorithm}:${k.status}`).join(', ') || 'none trusted';
    }
    case 'functions': {
      const list = (await m.get('/functions')) as Array<{ slug?: string; verify_jwt?: boolean }>;
      if (!Array.isArray(list)) throw new ApiError('/functions: not a list', 200);
      return Object.fromEntries(list.filter((f) => typeof f.slug === 'string').map((f) => [f.slug, f.verify_jwt]));
    }
    case 'secrets-absent': {
      const list = (await m.get('/secrets')) as Array<{ name?: string }>;
      if (!Array.isArray(list)) throw new ApiError('/secrets: not a list', 200);
      const names = list.map((x) => x.name); // values are never read
      return src.names.every((n) => !names.includes(n));
    }
    case 'sql': {
      if (src.query === 'migrations') {
        const applied = (await m.query('migrations')) as string[];
        if (!Array.isArray(applied)) throw new ApiError('migrations: unexpected shape', 200);
        const files = readdirSync(ctx.migrationsDir!).filter((f) => f.endsWith('.sql')).map((f) => f.split('_')[0]!).sort();
        const missing = files.filter((v) => !applied.includes(v));
        const extra = applied.filter((v) => !files.includes(v));
        return missing.length === 0 && extra.length === 0 ? 'all files in supabase/migrations' : `missing ${missing.join(',') || '-'}; unknown ${extra.join(',') || '-'}`;
      }
      return m.query(src.query);
    }
    case 'pooler': {
      const list = (await m.get('/config/database/pooler')) as Array<{ database_type?: string; pool_mode?: string }>;
      const primary = Array.isArray(list) ? list.find((x) => x.database_type === 'PRIMARY') : undefined;
      if (!primary?.pool_mode) throw new ApiError('/config/database/pooler: pool_mode missing', 200);
      return primary.pool_mode;
    }
    default:
      throw new Error(`no reader for ${src.kind}`);
  }
}

async function probe(s: Setting & { source: { kind: 'public'; probe: string } }, ctx: Context): Promise<unknown> {
  const p = ctx.pub!;
  switch (s.source.probe) {
    case 'auth-settings-signup': {
      const { status, body } = await p.json(`${p.apiUrl}/auth/v1/settings`);
      const v = at(body, 'disable_signup');
      if (status !== 200 || typeof v !== 'boolean') throw new ApiError(`/auth/v1/settings: HTTP ${status}`, status);
      return v;
    }
    case 'auth-settings-providers': {
      const { status, body } = await p.json(`${p.apiUrl}/auth/v1/settings`);
      const ext = at(body, 'external');
      if (status !== 200 || !ext || typeof ext !== 'object') throw new ApiError(`/auth/v1/settings: HTTP ${status}`, status);
      return Object.entries(ext as Record<string, unknown>).filter(([, on]) => on === true).map(([k]) => k).sort();
    }
    case 'schema-exposure': {
      const out: Record<string, boolean> = {};
      for (const schema of Object.keys(s.expected as Record<string, boolean>)) {
        const { status, body } = await p.json(`${p.apiUrl}/rest/v1/organizations?select=id&limit=1`, { 'Accept-Profile': schema });
        if (status === 0) throw new ApiError('PostgREST unreachable', 0);
        // PGRST106 = schema not exposed; anything else means PostgREST accepted the profile.
        out[schema] = !(status === 406 && at(body, 'code') === 'PGRST106');
      }
      return out;
    }
    case 'jwks': {
      const { status, body } = await p.json(`${p.apiUrl}/auth/v1/.well-known/jwks.json`);
      const keys = at(body, 'keys');
      if (status !== 200 || !Array.isArray(keys)) throw new ApiError(`jwks: HTTP ${status}`, status);
      return (keys as Array<{ alg?: string }>).map((k) => k.alg).sort();
    }
    case 'admin-health': {
      const { status, body } = await p.json(`${p.adminUrl}/api/health`);
      if (status !== 200 || !body || typeof body !== 'object') throw new ApiError(`admin /api/health: HTTP ${status}`, status);
      return body;
    }
    default:
      throw new Error(`unknown probe ${s.source.probe}`);
  }
}

export async function evaluate(ctx: Context): Promise<Result[]> {
  const cache = new Map<string, unknown>();
  const results: Result[] = [];
  for (const s of ctx.spec.settings) {
    const base = { id: s.id, class: s.class, expected: s.expected };
    if (s.class === 'unsupported' || s.source.kind === 'none') {
      results.push({ ...base, status: 'manual', note: s.manual });
      continue;
    }
    const isPublic = s.source.kind === 'public';
    if ((isPublic && !ctx.pub) || (!isPublic && !ctx.mgmt)) {
      results.push({ ...base, status: 'skipped', note: isPublic ? 'no publishable key given' : 'no management access given' });
      continue;
    }
    let actual: unknown;
    try {
      actual = isPublic ? await probe(s as Setting & { source: { kind: 'public'; probe: string } }, ctx) : await read(s, ctx, cache);
    } catch (e) {
      results.push({ ...base, status: 'unknown', note: (e as Error).message });
      continue;
    }
    if (s.class === 'decision') results.push({ ...base, status: 'decision', actual, note: s.decision });
    else if (s.class === 'informational') results.push({ ...base, status: 'info', actual });
    else results.push({ ...base, status: equal(actual, s.expected) ? 'ok' : 'drift', actual, note: s.apply === 'manual' ? s.manual : undefined });
  }
  return results;
}

/** 0 = every security and functional setting verified ok; 1 = drift; 2 = something required could not be verified. */
export function exitCode(results: Result[], opts: { publicOnly?: boolean } = {}): number {
  const required = results.filter((r) => r.class === 'security' || r.class === 'functional');
  if (required.some((r) => r.status === 'drift')) return 1;
  if (required.some((r) => r.status === 'unknown' || (r.status === 'skipped' && !opts.publicOnly))) return 2;
  return 0;
}
