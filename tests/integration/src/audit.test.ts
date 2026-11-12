// R-51: audit log through the real API (SR-AUD-01/02, ST-AUD-01…04). correlation_id propagation through the Edge
// Functions, actor and role recorded by the database, append-only for every API role, reads only for managers of
// the same kindergarten, audit schema not reachable through the Data API. Local stack, synthetic accounts only.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { callFunction, createKindergarten, email, enrolMfa, service, signInWithCode, stack } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let managerId: string;
let managerAal2: string;
let betaManagerAal2: string;

const rest = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`${stack.API_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: stack.PUBLISHABLE_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
const byCorrelation = async (cid: string) =>
  (await service.from('audit_events').select('action, actor_id, actor_role, outcome, correlation_id').eq('correlation_id', cid).order('id')).data ?? [];

beforeAll(async () => {
  alfa = await createKindergarten('aud-a');
  beta = await createKindergarten('aud-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  managerAal2 = await enrolMfa(m.client);
  managerId = (await manager.auth.getUser()).data.user!.id;
  const b = await signInWithCode(beta.managerEmail);
  betaManagerAal2 = await enrolMfa(b.client);
});

describe('R-51: audit records actor, role and correlation id', () => {
  it('invite-member: the correlation id of the request is stored with the actor and role (ST-AUD-01)', async () => {
    const cid = `aud-${randomUUID()}`;
    const r = await callFunction(
      'invite-member',
      managerAal2,
      { organizationId: alfa.orgId, email: email('aud-nova'), role: 'educator', firstName: 'Ana', lastName: 'Audit' },
      { 'x-correlation-id': cid },
    );
    expect(r.status).toBe(201);
    expect(r.json).not.toHaveProperty('error');
    expect(await byCorrelation(cid)).toEqual([
      { action: 'invitations.insert', actor_id: managerId, actor_role: 'org_admin', outcome: 'success', correlation_id: cid },
    ]);
  });

  it('accept-invitations: acceptance is audited with the accepting person, their new role and the correlation id', async () => {
    const to = email('aud-prihvat');
    expect(
      (await callFunction('invite-member', managerAal2, { organizationId: alfa.orgId, email: to, role: 'educator', firstName: 'Iva', lastName: 'Audit' })).status,
    ).toBe(201);
    const invitee = await signInWithCode(to);
    const cid = `acc-${randomUUID()}`;
    expect((await callFunction('accept-invitations', invitee.token, undefined, { 'x-correlation-id': cid })).status).toBe(200);
    const inviteeId = (await invitee.client.auth.getUser()).data.user!.id;
    const rows = await byCorrelation(cid);
    expect(rows.find((x) => x.action === 'invitation.accepted')).toEqual({
      action: 'invitation.accepted',
      actor_id: inviteeId,
      actor_role: 'educator',
      outcome: 'success',
      correlation_id: cid,
    });
  });

  it('a malformed correlation id is replaced, never stored as sent', async () => {
    const r = await callFunction(
      'invite-member',
      managerAal2,
      { organizationId: alfa.orgId, email: email('aud-bad-corr'), role: 'educator', firstName: 'Bo', lastName: 'Audit' },
      { 'x-correlation-id': 'bad id <x>' },
    );
    expect(r.status).toBe(201);
    expect(await byCorrelation('bad id <x>')).toEqual([]);
  });

  it('a denied privileged attempt is audited as denied with the actor (ST-AUD-02)', async () => {
    const cid = `den-${randomUUID()}`;
    const r = await callFunction(
      'invite-member',
      betaManagerAal2,
      { organizationId: alfa.orgId, email: email('aud-cross'), role: 'educator', firstName: 'Ul', lastName: 'Jez' },
      { 'x-correlation-id': cid },
    );
    expect(r.status).toBe(403);
    const rows = await byCorrelation(cid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'invitation.create', actor_role: 'none', outcome: 'denied', correlation_id: cid });
  });
});

describe('R-51: audit is read-only and tenant-isolated through the API (ST-AUD-03/04)', () => {
  it('a manager reads own kindergarten rows (with roles); another kindergarten and an educator read nothing', async () => {
    const { data } = await manager.from('audit_events').select('organization_id, actor_role').eq('organization_id', alfa.orgId);
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((x) => x.organization_id === alfa.orgId && typeof x.actor_role === 'string')).toBe(true);
    expect(await (await rest(`audit_events?organization_id=eq.${alfa.orgId}&select=id`, betaManagerAal2)).json()).toEqual([]);
    const educator = await signInWithCode(alfa.educatorEmail);
    expect((await educator.client.from('audit_events').select('id')).data).toEqual([]);
  });

  it('no API role can change, delete or insert audit rows', async () => {
    for (const token of [managerAal2]) {
      expect((await rest('audit_events?id=gt.0', token, { method: 'PATCH', body: JSON.stringify({ action: 'x' }) })).status).toBeGreaterThanOrEqual(400);
      expect((await rest('audit_events?id=gt.0', token, { method: 'DELETE' })).status).toBeGreaterThanOrEqual(400);
      expect((await rest('audit_events', token, { method: 'POST', body: JSON.stringify({ action: 'x.y', target_table: 'x' }) })).status).toBeGreaterThanOrEqual(400);
    }
    const upd = await service.from('audit_events').update({ action: 'x' }).eq('organization_id', alfa.orgId);
    expect(upd.error).not.toBeNull();
    const del = await service.from('audit_events').delete().eq('organization_id', alfa.orgId);
    expect(del.error).not.toBeNull();
    const ins = await service.from('audit_events').insert({ action: 'x.y', target_table: 'x' });
    expect(ins.error).not.toBeNull();
    const { count } = await service.from('audit_events').select('id', { count: 'exact', head: true }).eq('organization_id', alfa.orgId);
    expect(count).toBeGreaterThan(0);
  });

  it('the audit schema itself is not exposed through the Data API', async () => {
    const r = await rest('audit_events?select=id', managerAal2, { headers: { 'accept-profile': 'audit' } });
    expect(r.status).toBe(406);
  });

  it('clients cannot call the service-only audit RPC', async () => {
    const r = await rest('rpc/record_audit_event', managerAal2, {
      method: 'POST',
      headers: { 'content-profile': 'api' },
      body: JSON.stringify({ p_organization_id: alfa.orgId, p_actor_id: null, p_action: 'x.yyy', p_target_table: 'xxx', p_outcome: 'denied', p_reason: 'FAKE' }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
