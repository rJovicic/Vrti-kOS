// plan: what would change. apply: change only `safe` settings of the staging project, re-check afterwards.
import type { ManagementClient } from './clients.ts';
import { evaluate, type Context, type Result } from './evaluate.ts';
import { APPLY_PATHS, type Spec } from './spec.ts';

export interface Plan {
  safe: Array<{ id: string; path: string; field: string; from: unknown; to: unknown }>;
  manual: Array<{ id: string; actual: unknown; expected: unknown; how: string }>;
  blocked: Array<{ id: string; reason: string }>;
}

export function plan(spec: Spec, results: Result[]): Plan {
  const out: Plan = { safe: [], manual: [], blocked: [] };
  for (const r of results) {
    const s = spec.settings.find((x) => x.id === r.id)!;
    if (r.status === 'unknown' || (r.status === 'skipped' && (s.class === 'security' || s.class === 'functional'))) {
      out.blocked.push({ id: r.id, reason: r.note ?? 'not verified' });
      continue;
    }
    if (r.status !== 'drift') continue;
    if (s.apply === 'safe' && s.source.kind === 'field') out.safe.push({ id: s.id, path: s.source.path, field: s.source.field, from: r.actual, to: s.expected });
    else out.manual.push({ id: s.id, actual: r.actual, expected: s.expected, how: s.manual ?? 'no automatic change allowed for this setting' });
  }
  return out;
}

export class GuardError extends Error {}

/** Refuses unless the target is exactly the spec's staging project, confirmed twice and verified live. */
export async function assertStagingTarget(spec: Spec, mgmt: ManagementClient, confirm: string | undefined): Promise<void> {
  if (spec.project.environment !== 'staging') throw new GuardError('apply is only allowed for the staging spec');
  if (mgmt.ref !== spec.project.ref) throw new GuardError(`client targets ${mgmt.ref}, spec is ${spec.project.ref}`);
  if (confirm !== spec.project.ref) throw new GuardError(`apply needs --confirm-project=${spec.project.ref}`);
  const p = (await mgmt.get('')) as { ref?: string; name?: string; region?: string };
  if (p?.ref !== spec.project.ref || p?.name !== spec.project.name || p?.region !== spec.project.region) {
    throw new GuardError(`live project is ${p?.name ?? '?'} (${p?.ref ?? '?'}, ${p?.region ?? '?'}), expected ${spec.project.name} (${spec.project.ref}, ${spec.project.region})`);
  }
}

export interface ApplyOutcome {
  applied: string[];
  failed?: { ids: string[]; error: string };
  after: Result[];
}

/**
 * Applies the plan's safe changes, one PATCH per Management API path. Before every PATCH the live target is verified
 * again. The first failure stops everything (no further PATCH). The state is always re-read afterwards.
 */
export async function apply(ctx: Context & { mgmt: ManagementClient }, p: Plan, confirm: string | undefined): Promise<ApplyOutcome> {
  await assertStagingTarget(ctx.spec, ctx.mgmt, confirm);
  const applied: string[] = [];
  let failed: ApplyOutcome['failed'];
  for (const path of APPLY_PATHS) {
    const changes = p.safe.filter((c) => c.path === path);
    if (!changes.length) continue;
    try {
      await assertStagingTarget(ctx.spec, ctx.mgmt, confirm);
      await ctx.mgmt.patch(path, Object.fromEntries(changes.map((c) => [c.field, c.to])));
      applied.push(...changes.map((c) => c.id));
    } catch (e) {
      failed = { ids: changes.map((c) => c.id), error: (e as Error).message };
      break;
    }
  }
  return { applied, failed, after: await evaluate(ctx) };
}
