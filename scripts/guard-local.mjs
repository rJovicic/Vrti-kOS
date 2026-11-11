// Refuses destructive database scripts (reset/seed) unless the target is the local Supabase stack.
// Rationale: local-development.md §6, R-37. Never weaken this to make a script "just work".
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const problems = [];
if (existsSync(join(root, 'supabase', '.temp', 'project-ref'))) {
  problems.push('supabase/ is linked to a remote project (supabase/.temp/project-ref exists)');
}
for (const arg of process.argv.slice(2)) {
  if (arg === '--linked' || arg.startsWith('--db-url')) problems.push(`remote target flag not allowed: ${arg}`);
}
const env = process.env.APP_ENV ?? 'local';
if (!['local', 'demo', 'test'].includes(env)) problems.push(`APP_ENV=${env} (only local, demo or test allowed)`);
if (problems.length) {
  console.error(`Refusing to touch the database:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
