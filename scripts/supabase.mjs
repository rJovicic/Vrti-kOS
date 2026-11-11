// Runs the pinned Supabase CLI (devDependency) for the local stack only.
// Set VRTICOS_DOCKERHUB=1 where the default image registry (AWS ECR) is unreachable (local-development.md §1).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
// No CLI telemetry (privacy rule: no data to third parties without assessment).
const env = { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1', DO_NOT_TRACK: '1' };
if (process.env.VRTICOS_DOCKERHUB === '1') env.SUPABASE_INTERNAL_IMAGE_REGISTRY = 'docker.io';
const args = process.argv.slice(2);
if (args.includes('--linked') || args.some((a) => a.startsWith('--db-url'))) {
  console.error('Remote targets are not allowed from project scripts (ADR-0009).');
  process.exit(1);
}
const bin = join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'supabase.cmd' : 'supabase');
const res = spawnSync(bin, args, { cwd: root, env, stdio: 'inherit' });
process.exit(res.status ?? 1);
