// Runs the Phase 3 RLS spike (docs/architecture/spikes/rls-spike.sql) in a throwaway database on the
// local stack, so it never collides with real migrations. Exits non-zero on any FAIL/ERROR.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const base = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const spikeDb = base.replace(/\/postgres$/, '/vrticos_spike');
const psql = (url, args) => spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', ...args], { encoding: 'utf8' });

psql(base, ['-c', 'drop database if exists vrticos_spike']);
let r = psql(base, ['-c', 'create database vrticos_spike']);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
// Minimal stand-in for Supabase's auth.uid()/auth.jwt() (same GUC as PostgREST).
r = psql(spikeDb, ['-c', `create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid $$;
  grant usage on schema auth to authenticated, anon; grant execute on function auth.uid() to authenticated, anon;
  grant usage on schema public to authenticated, anon;`]);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
r = psql(spikeDb, ['-f', join(import.meta.dirname, '..', 'docs', 'architecture', 'spikes', 'rls-spike.sql')]);
psql(base, ['-c', 'drop database if exists vrticos_spike']);
const lines = `${r.stdout}\n${r.stderr}`.split('\n').filter((l) => /PASS|FAIL|ERROR/.test(l));
lines.forEach((l) => console.log(l.replace(/^psql:[^ ]+ /, '')));
const passed = lines.filter((l) => l.includes('PASS')).length;
const failed = r.status !== 0 || lines.some((l) => /FAIL|ERROR/.test(l));
console.log(`RLS spike: ${passed} passed${failed ? ', FAILED' : ''}`);
process.exit(failed ? 1 : 0);
