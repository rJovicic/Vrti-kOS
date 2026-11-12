// D2-A through the real REST API: a manager (AAL2) creates a child and enrols it; the educator assigned to that group
// sees exactly that child; another kindergarten and a guardian see nothing. Local stack, synthetic data only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let childId: string;

beforeAll(async () => {
  alfa = await createKindergarten('djeca-a');
  beta = await createKindergarten('djeca-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  await manager
    .from('staff_assignments')
    .insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' })
    .throwOnError();
});

describe('D2-A: children and enrolments through the API', () => {
  it('a manager creates and enrols a child; database-owned fields cannot be sent', async () => {
    const forged = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: 'Mila', last_name: 'Test', status: 'withdrawn' });
    expect(forged.error).not.toBeNull();
    const { data, error } = await manager
      .from('children')
      .insert({ organization_id: alfa.orgId, first_name: 'Mila', last_name: 'Test' })
      .select('id, status, created_by')
      .single();
    expect(error).toBeNull();
    expect(data!.status).toBe('active');
    expect(data!.created_by).toBe((await manager.auth.getUser()).data.user!.id);
    childId = data!.id as string;
    const enrol = await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: '[2026-09-01,)' });
    expect(enrol.error).toBeNull();
    const twice = await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: '[2027-01-01,)' });
    expect(twice.error?.code).toBe('23P01');
  });

  it('the assigned educator sees exactly that child and cannot change it', async () => {
    const { client } = await signInWithCode(alfa.educatorEmail);
    const { data } = await client.from('children').select('id, first_name, last_name');
    expect(data).toEqual([{ id: childId, first_name: 'Mila', last_name: 'Test' }]);
    const upd = await client.from('children').update({ last_name: 'Promjena' }).eq('id', childId).select('id');
    expect(upd.data ?? []).toEqual([]);
    expect((await client.from('children').insert({ organization_id: alfa.orgId, first_name: 'X', last_name: 'Y' })).error).not.toBeNull();
  });

  it('another kindergarten sees nothing, not even by id', async () => {
    const edu = await signInWithCode(beta.educatorEmail);
    expect((await edu.client.from('children').select('id').eq('id', childId)).data).toEqual([]);
    const mgr = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgr.client);
    expect((await mgr.client.from('children').select('id').eq('id', childId)).data).toEqual([]);
    expect((await mgr.client.from('enrollments').select('id').eq('child_id', childId)).data).toEqual([]);
    const cross = await mgr.client.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: '[2028-01-01,)' });
    expect(cross.error).not.toBeNull();
  });

  it('a guardian of the same kindergarten sees no child before a guardian link exists', async () => {
    const address = email('roditelj-djeca');
    const { data: user } = await service.auth.admin.createUser({ email: address, email_confirm: true });
    await service.from('profiles').insert({ id: user.user!.id, first_name: 'Roditelj', last_name: 'Test' }).throwOnError();
    await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
    const g = await signInWithCode(address);
    expect((await g.client.from('children').select('id')).data).toEqual([]);
    expect((await g.client.from('enrollments').select('id')).data).toEqual([]);
  });

  it('ending the assignment removes the educator\'s access on the next request', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const { error } = await manager.from('staff_assignments').update({ valid_during: `[2026-01-01,${yesterday})` }).eq('membership_id', alfa.educatorMembershipId);
    expect(error).toBeNull();
    const { client } = await signInWithCode(alfa.educatorEmail);
    expect((await client.from('children').select('id')).data).toEqual([]);
  });

  it('child changes are audited with actor and role, without names', async () => {
    const { data } = await service.from('audit_events').select('action, actor_role, details').eq('target_table', 'children').eq('target_id', childId);
    expect(data).toEqual([{ action: 'children.insert', actor_role: 'org_admin', details: {} }]);
  });
});
