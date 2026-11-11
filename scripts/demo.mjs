// `pnpm demo` — starts the whole local demo (local-development.md §4–5, ADR-0009).
// 1. refuses non-local targets  2. starts Supabase + Mailpit  3. resets to the synthetic seed (skip with --keep)
// 4. writes .env.local for both apps (public local keys only)  5. runs admin (Next.js) and mobile (Expo) dev servers.
import { spawn, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const keep = process.argv.includes('--keep');
const noApps = process.argv.includes('--no-apps');
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', ...opts });
const fail = (msg) => {
  console.error(`\n✖ ${msg}`);
  process.exit(1);
};

if (run('node', ['scripts/guard-local.mjs']).status !== 0) fail('guard refused the target');
if (spawnSync('docker', ['info'], { stdio: 'ignore' }).status !== 0) {
  fail('Docker is not running. Start Docker Desktop / OrbStack / Colima (or `dockerd` in a container) and retry.');
}

const status = spawnSync('node', ['scripts/supabase.mjs', 'status', '-o', 'json'], { cwd: root, encoding: 'utf8' });
if (status.status !== 0) {
  console.log('▶ starting local Supabase (Postgres, Auth, Storage, Edge Runtime, Mailpit)…');
  if (run('node', ['scripts/supabase.mjs', 'start']).status !== 0) {
    fail('supabase start failed. Behind a registry block, retry with VRTICOS_DOCKERHUB=1 pnpm demo.');
  }
}
if (!keep) {
  console.log('▶ resetting database to migrations + synthetic seed…');
  if (run('node', ['scripts/supabase.mjs', 'db', 'reset']).status !== 0) fail('db reset failed');
}

const info = JSON.parse(
  spawnSync('node', ['scripts/supabase.mjs', 'status', '-o', 'json'], { cwd: root, encoding: 'utf8' }).stdout.replace(/^[^{]*/, ''),
);
const lanIp =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal)?.address ?? '127.0.0.1';
const publishable = info.PUBLISHABLE_KEY ?? info.ANON_KEY;
if (!publishable) fail('could not read the local publishable key from `supabase status`');

writeFileSync(
  join(root, 'apps', 'admin', '.env.local'),
  `# written by pnpm demo — local public values only\nNEXT_PUBLIC_SUPABASE_URL=${info.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}\nNEXT_PUBLIC_APP_ENV=demo\n`,
);
writeFileSync(
  join(root, 'apps', 'mobile', '.env.local'),
  `# written by pnpm demo — local public values only; phones reach the laptop via its LAN IP\nEXPO_PUBLIC_SUPABASE_URL=http://${lanIp}:54321\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publishable}\nEXPO_PUBLIC_APP_ENV=demo\n`,
);

console.log(`
VrtićOS demo (synthetic data only)
  Admin      http://localhost:3000
  Mobile     Expo Go → scan the QR code below (phone on the same Wi-Fi, API at http://${lanIp}:54321)
  Mailpit    ${info.MAILPIT_URL ?? 'http://127.0.0.1:54324'}   (all e-mail stays local)
  Studio     ${info.STUDIO_URL ?? 'http://127.0.0.1:54323'}
  Accounts   docs/architecture/demo-accounts.md
`);
if (noApps) process.exit(0);

const children = [
  spawn('pnpm', ['--filter', '@vrticos/admin', 'dev'], { cwd: root, stdio: 'inherit', env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } }),
  spawn('pnpm', ['--filter', '@vrticos/mobile', 'start'], { cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_NO_TELEMETRY: '1' } }),
];
const stop = () => children.forEach((c) => c.kill('SIGINT'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
