// D2-F through the real Edge Functions (d2-plan §7): the manager creates child + guardian + link, invites the guardian
// with the record id (invite-member), the guardian signs in with an e-mail code and accepts (accept-invitations), and
// then sees exactly that child; after a restriction, nothing. An attached or foreign record cannot be invited; the
// R-50 limit still applies to guardian invitations. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { callFunction, createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let managerToken: string;
const ids: Record<string, string> = {};
const parent = email('roditelj-poziv');
const today = new Date().toISOString().slice(0, 10);

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await manager.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data!.id as string;
}
const invite = (guardianId: string | undefined, to = parent, org = alfa.orgId, token = managerToken) =>
  callFunction('invite-member', token, { organizationId: org, email: to, role: 'guardian', firstName: 'Ana', lastName: 'Skrbnik', ...(guardianId ? { guardianId } : {}) });

beforeAll(async () => {
  alfa = await createKindergarten('gi-a');
  beta = await createKindergarten('gi-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  managerToken = await enrolMfa(m.client);
  ids.lea = await insert('children', { organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Pozivnica' });
  ids.mia = await insert('children', { organization_id: alfa.orgId, first_name: 'Mia', last_name: 'Druga' });
  await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids.lea, group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  ids.ana = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Skrbnik' });
  ids.link = await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.lea, guardian_id: ids.ana, can_view: true, can_report_absence: true, receives_messages: true, valid_during: '[2026-09-01,)' });
  const b = await signInWithCode(beta.managerEmail);
  await enrolMfa(b.client);
  const { data: bg } = await b.client.from('guardians').insert({ organization_id: beta.orgId, first_name: 'Beta', last_name: 'Skrbnik' }).select('id').single().throwOnError();
  ids.betaGuardian = bg!.id as string;
});

describe('D2-F: guardian invitation and acceptance', () => {
  it('a guardian record of another kindergarten cannot be named (same answer as no rights)', async () => {
    const r = await invite(ids.betaGuardian, email('strani'));
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe('PERMISSION_DENIED');
  });

  it('a guardian record id with another role is a validation error', async () => {
    const r = await callFunction('invite-member', managerToken, { organizationId: alfa.orgId, email: email('krivo'), role: 'educator', firstName: 'X', lastName: 'Y', guardianId: ids.ana });
    expect(r.status).toBe(400);
  });

  it('the manager invites Ana with her record; the notice holds no child data or link', async () => {
    const r = await invite(ids.ana);
    expect(r.status).toBe(201);
    const { data } = await manager.from('invitations').select('guardian_id, role').eq('id', r.json.invitationId).single();
    expect(data).toEqual({ guardian_id: ids.ana, role: 'guardian' });
  });

  it('after signing in and accepting, Ana sees exactly Lea', async () => {
    const { client, token } = await signInWithCode(parent);
    expect(((await client.from('children').select('id')).data ?? []).length).toBe(0);
    const acc = await callFunction('accept-invitations', token, {});
    expect(acc.status).toBe(200);
    expect(acc.json.accepted).toEqual([{ organizationId: alfa.orgId, role: 'guardian' }]);
    const { data: kids } = await client.from('children').select('first_name');
    expect(kids).toEqual([{ first_name: 'Lea' }]);
    expect((await client.from('guardians').select('id')).data).toEqual([{ id: ids.ana }]);
    const { data: links } = await client.from('child_guardians').select('child_id, can_report_absence');
    expect(links).toEqual([{ child_id: ids.lea, can_report_absence: true }]);
  });

  it('the attached record cannot be invited again', async () => {
    const r = await invite(ids.ana, email('drugi-roditelj'));
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe('GUARDIAN_ALREADY_LINKED');
  });

  it('after an access restriction Ana sees nothing (NEG-05)', async () => {
    await insert('access_restrictions', { organization_id: alfa.orgId, child_guardian_id: ids.link, valid_during: `[${today},)` });
    const { client } = await signInWithCode(parent);
    expect((await client.from('children').select('id')).data).toEqual([]);
  });

  it('attachment and invitation are audited without names', async () => {
    const { data } = await service.from('audit_events').select('action, outcome, details').eq('organization_id', alfa.orgId).in('action', ['guardian.account_linked', 'invitation.accepted']);
    expect(data!.map((r) => r.action).sort()).toEqual(['guardian.account_linked', 'invitation.accepted']);
    expect(JSON.stringify(data)).not.toMatch(/Ana|Lea|Skrbnik/);
  });

  it('the R-50 limit still applies to guardian invitations', async () => {
    await service.from('organizations').update({ invitation_limit_per_hour: 1 }).eq('id', alfa.orgId).throwOnError();
    const g = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Bruno', last_name: 'Skrbnik' });
    const r = await invite(g, email('preko-limita'));
    expect(r.status).toBe(429);
    expect(r.json.error.code).toBe('INVITATION_LIMIT_REACHED');
  });
});
