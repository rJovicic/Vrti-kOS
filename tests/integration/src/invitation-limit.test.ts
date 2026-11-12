// R-50: per-kindergarten invitation limit through the product path, including parallel requests and the direct
// REST path. Migration 20261112085000_invitation_quota.sql. Local stack, synthetic accounts only.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { callFunction, createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

const LIMIT = 4;
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let managerAal2: string;
let betaManagerAal2: string;

const invite = (org: string, to: string) => ({ organizationId: org, email: to, role: 'educator', firstName: 'Lea', lastName: 'Limit' });
const createdInAlfa = async () =>
  (await service.from('invitations').select('id', { count: 'exact', head: true }).eq('organization_id', alfa.orgId)).count ?? -1;
const limitRows = async () =>
  (await service.from('audit_events').select('actor_role, outcome, correlation_id, details').eq('organization_id', alfa.orgId).eq('action', 'invitation.limit_reached'))
    .data ?? [];

beforeAll(async () => {
  alfa = await createKindergarten('lim-a');
  beta = await createKindergarten('lim-b');
  await service.from('organizations').update({ invitation_limit_per_hour: LIMIT }).eq('id', alfa.orgId).throwOnError();
  await service.from('organizations').update({ invitation_limit_per_hour: LIMIT }).eq('id', beta.orgId).throwOnError();
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  managerAal2 = await enrolMfa(m.client);
  const b = await signInWithCode(beta.managerEmail);
  betaManagerAal2 = await enrolMfa(b.client);
});

describe('R-50: invitation limit per kindergarten', () => {
  it('parallel requests cannot overshoot the limit; the excess gets 429 INVITATION_LIMIT_REACHED', async () => {
    const ids = Array.from({ length: LIMIT + 3 }, () => `lim-${randomUUID()}`);
    const results = await Promise.all(
      ids.map((cid, i) => callFunction('invite-member', managerAal2, invite(alfa.orgId, email(`limit-${i}`)), { 'x-correlation-id': cid })),
    );
    const statuses = results.map((r) => r.status).sort();
    expect(statuses.filter((s) => s === 201)).toHaveLength(LIMIT);
    expect(statuses.filter((s) => s === 429)).toHaveLength(3);
    for (const r of results.filter((x) => x.status === 429)) {
      expect(r.json.error.code).toBe('INVITATION_LIMIT_REACHED');
      expect(r.json.error.message).toBe('errors.INVITATION_LIMIT_REACHED');
    }
    expect(await createdInAlfa()).toBe(LIMIT);
    const rows = await limitRows();
    expect(rows).toHaveLength(3);
    const refusedIds = results.map((r, i) => (r.status === 429 ? ids[i] : null)).filter(Boolean).sort();
    expect(rows.map((r) => r.correlation_id).sort()).toEqual(refusedIds);
    expect(rows.every((r) => r.actor_role === 'org_admin' && r.outcome === 'denied')).toBe(true);
    expect(JSON.stringify(rows)).not.toContain('@');
  });

  it('the direct REST path is limited and audited as well', async () => {
    const { data, error } = await manager
      .from('invitations')
      .insert({ organization_id: alfa.orgId, email: email('limit-rest'), role: 'educator', first_name: 'Re', last_name: 'St' })
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await createdInAlfa()).toBe(LIMIT);
    expect(await limitRows()).toHaveLength(4);
  });

  it('another kindergarten keeps its own quota', async () => {
    expect((await callFunction('invite-member', betaManagerAal2, invite(beta.orgId, email('limit-beta')))).status).toBe(201);
  });

  it('a foreign manager gets 403 PERMISSION_DENIED (no limit state revealed); the attempt is audited', async () => {
    const cid = `deny-${randomUUID()}`;
    const r = await callFunction('invite-member', betaManagerAal2, invite(alfa.orgId, email('limit-cross')), { 'x-correlation-id': cid });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('PERMISSION_DENIED');
    const { data } = await service.from('audit_events').select('organization_id, actor_role, outcome, details').eq('correlation_id', cid);
    expect(data).toEqual([
      { organization_id: alfa.orgId, actor_role: 'none', outcome: 'denied', details: { reason: 'PERMISSION_DENIED', via: 'service' } },
    ]);
  });
});
