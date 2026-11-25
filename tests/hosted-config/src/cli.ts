// Hosted Supabase configuration as code (staging only).
//
//   pnpm --filter @vrticos/hosted-config cli check     --project <ref> [--public-only]
//   pnpm --filter @vrticos/hosted-config cli plan      --project <ref>
//   pnpm --filter @vrticos/hosted-config cli apply     --project <ref> --confirm-project=<ref>
//   pnpm --filter @vrticos/hosted-config cli retention --project <ref>
//
// Environment (never printed): SUPABASE_MANAGEMENT_TOKEN — the operator's Supabase access token, only for
// check/plan/apply/retention against the Management API; HOSTED_PUBLISHABLE_KEY — the project's publishable key
// (public by design) for the checks that need no token. Exit codes: 0 ok, 1 drift, 2 not verifiable, 3 refused.
import { join } from 'node:path';
import { ManagementClient, PublicClient } from './clients.ts';
import { apply, GuardError, plan } from './apply.ts';
import { evaluate, exitCode, type Result } from './evaluate.ts';
import { loadSpec, type Spec } from './spec.ts';

const ROOT = join(import.meta.dirname, '..', '..', '..');

export interface CliIO {
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  fetch?: typeof fetch;
  specPath?: string;
}

function show(v: unknown): string {
  const s = v === undefined ? '—' : JSON.stringify(v);
  return s.length > 110 ? `${s.slice(0, 107)}...` : s;
}

export function printResults(results: Result[], out: (l: string) => void): void {
  for (const r of results) {
    const tail = r.status === 'ok' ? show(r.actual) : `actual ${show(r.actual)} · expected ${show(r.expected)}`;
    out(`${r.status.toUpperCase().padEnd(8)} ${r.class.padEnd(13)} ${r.id.padEnd(46)} ${tail}${r.note && r.status !== 'ok' ? ` — ${r.note}` : ''}`);
  }
  const count = (s: string) => results.filter((r) => r.status === s).length;
  out(`summary: ${count('ok')} ok, ${count('drift')} drift, ${count('unknown')} unknown, ${count('skipped')} skipped, ${count('decision')} decision, ${count('manual')} manual, ${count('info')} info`);
}

export async function run(argv: string[], io: CliIO): Promise<number> {
  const [command, ...rest] = argv;
  const flag = (name: string) => rest.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  const value = (name: string) => {
    const i = rest.indexOf(`--${name}`);
    if (i >= 0) return rest[i + 1];
    return flag(name)?.split('=')[1];
  };
  if (!['check', 'plan', 'apply', 'retention'].includes(command ?? '')) {
    io.out('usage: cli <check|plan|apply|retention> --project <ref> [--public-only] [--confirm-project=<ref>]');
    return 3;
  }
  let spec: Spec;
  try {
    spec = loadSpec(io.specPath ?? join(ROOT, 'supabase', 'hosted', 'staging.json'));
  } catch (e) {
    io.out(`REFUSED  ${(e as Error).message}`);
    return 3;
  }
  const ref = value('project');
  if (ref !== spec.project.ref) {
    io.out(`REFUSED  --project must name the staging project ${spec.project.ref} (got ${ref ?? 'nothing'}); no other project is managed`);
    return 3;
  }
  const publicOnly = Boolean(flag('public-only'));
  if (publicOnly && command !== 'check') {
    io.out(`REFUSED  ${command} needs management access; --public-only is for check`);
    return 3;
  }
  const token = io.env.SUPABASE_MANAGEMENT_TOKEN;
  if (!publicOnly && !token) {
    io.out('REFUSED  SUPABASE_MANAGEMENT_TOKEN is not set (use --public-only for the checks that need no token)');
    return 3;
  }
  const mgmt = publicOnly ? null : new ManagementClient({ ref, token: token!, fetch: io.fetch });
  const key = io.env.HOSTED_PUBLISHABLE_KEY;
  let pub: PublicClient | null;
  try {
    pub = key ? new PublicClient({ apiUrl: spec.project.apiUrl, adminUrl: spec.project.adminUrl, publishableKey: key, fetch: io.fetch }) : null;
  } catch (e) {
    io.out(`REFUSED  ${(e as Error).message}`);
    return 3;
  }
  const ctx = { spec, mgmt, pub, migrationsDir: join(ROOT, 'supabase', 'migrations') };

  if (command === 'retention') {
    // Read-only evidence for R-53 (docs/security/data-retention.md): partition names and row span, no payloads.
    const parts = (await mgmt!.query('realtime_partitions')) as Array<{ name: string }>;
    io.out(`partitions: ${parts.map((x) => x.name.replace('messages_', '')).join(' ')}`);
    io.out(`messages:   ${JSON.stringify(await mgmt!.query('realtime_message_span'))}`);
    return 0;
  }

  const results = await evaluate(ctx);
  if (command === 'check') {
    printResults(results, io.out);
    if (publicOnly) io.out('note: management checks were skipped (no token); they are NOT verified by this run');
    return exitCode(results, { publicOnly });
  }

  const p = plan(spec, results);
  io.out(`plan: ${p.safe.length} safe change(s), ${p.manual.length} manual, ${p.blocked.length} blocked (not verifiable)`);
  for (const c of p.safe) io.out(`SAFE     ${c.id}: ${show(c.from)} → ${show(c.to)} (PATCH ${c.path})`);
  for (const c of p.manual) io.out(`MANUAL   ${c.id}: ${show(c.actual)} → ${show(c.expected)} — ${c.how}`);
  for (const c of p.blocked) io.out(`BLOCKED  ${c.id}: ${c.reason}`);
  if (command === 'plan') return p.blocked.length ? 2 : p.safe.length || p.manual.length ? 1 : 0;

  // apply
  if (p.blocked.length) {
    io.out('REFUSED  apply needs a fully verified state; fix the blocked readings first');
    return 2;
  }
  if (!p.safe.length) {
    io.out(p.manual.length ? 'nothing safe to apply; manual changes are listed above' : 'nothing to apply');
    return p.manual.length ? 1 : 0;
  }
  try {
    const outcome = await apply({ ...ctx, mgmt: mgmt! }, p, value('confirm-project'));
    io.out(`applied: ${outcome.applied.join(', ') || 'nothing'}`);
    if (outcome.failed) io.out(`FAILED   ${outcome.failed.ids.join(', ')}: ${outcome.failed.error} — stopped; nothing after it was attempted`);
    io.out('state after apply:');
    printResults(outcome.after, io.out);
    return outcome.failed ? 1 : exitCode(outcome.after);
  } catch (e) {
    if (e instanceof GuardError) {
      io.out(`REFUSED  ${e.message}`);
      return 3;
    }
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2), { env: process.env, out: (l) => console.log(l) }).then(
    (code) => process.exit(code),
    (e: Error) => {
      console.log(`ERROR    ${e.message}`);
      process.exit(2);
    },
  );
}
