import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

interface Status {
  API_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
  MAILPIT_URL: string;
}

/** Reads the public, well-known keys of the LOCAL stack and refuses anything that is not localhost. */
export function localStack(): Status {
  const root = join(import.meta.dirname, '..', '..', '..');
  const out = execFileSync('node', ['scripts/supabase.mjs', 'status', '-o', 'json'], { cwd: root, encoding: 'utf8' });
  const s = JSON.parse(out.slice(out.indexOf('{'))) as Status;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(s.API_URL)) throw new Error('integration tests run against the local stack only');
  return s;
}
