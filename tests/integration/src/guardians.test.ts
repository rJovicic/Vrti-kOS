// D2-B through the real API: guardian records and guardian–child links. An accepted invitation alone gives no child;
// a link gives exactly the linked children (also one without a group, D-32), rights per link; educators see names and
// rights of guardians of their groups only (D-31); other kindergartens see nothing. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { callFunction, createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let managerAal2: string;
let otherGroupId: string;
const ids: Record<string, string> = {};

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await manager.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

beforeAll(async () => {
  alfa = await createKindergarten('skrb-a');
  beta = await createKindergarten('skrb-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  managerAal2 = await enrolMfa(m.client);
  await manager
    .from('staff_assignments')
    .insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' })
    .throwOnError();
  const { data: g } = await service.from('groups').select('facility_id, academic_year_id').eq('id', alfa.groupId).single().throwOnError();
  otherGroupId = await insert('groups', { organization_id: alfa.orgId, facility_id: g!.facility_id, academic_year_id: g!.academic_year_id, name: 'Druga' });
  ids.d1 = await insert('children', { organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Prva' });
  ids.d2 = await insert('children', { organization_id: alfa.orgId, first_name: 'Ivo', last_name: 'Drugi' });
  ids.d3 = await insert('children', { organization_id: alfa.orgId, first_name: 'Mia', last_name: 'Bezskupine' });
  ids.d4 = await insert('children', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Tudja' });
  await manager.from('enrollments').insert([
    { organization_id: alfa.orgId, child_id: ids.d1, group_id: alfa.groupId, valid_during: '[2026-09-01,)' },
    { organization_id: alfa.orgId, child_id: ids.d2, group_id: alfa.groupId, valid_during: '[2026-09-01,)' },
    { organization_id: alfa.orgId, child_id: ids.d4, group_id: otherGroupId, valid_during: '[2026-09-01,)' },
  ]).throwOnError();
});

describe('D2-B: guardians and links', () => {
  let parentEmail: string;
  let parentId: string;

  it('an accepted guardian invitation alone gives access to no child', async () => {
    parentEmail = email('roditelj-veza');
    const r = await callFunction('invite-member', managerAal2, { organizationId: alfa.orgId, email: parentEmail, role: 'guardian', firstName: 'Petra', lastName: 'Roditelj' });
    expect(r.status).toBe(201);
    const p = await signInWithCode(parentEmail);
    expect((await callFunction('accept-invitations', p.token)).json.accepted).toEqual([{ organizationId: alfa.orgId, role: 'guardian' }]);
    parentId = (await p.client.auth.getUser()).data.user!.id;
    for (const table of ['children', 'enrollments', 'groups', 'guardians', 'child_guardians']) {
      expect((await p.client.from(table).select('id')).data, table).toEqual([]);
    }
  });

  it('a manager creates guardian records and links with rights per link; the account link is never exposed', async () => {
    ids.petra = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Petra', last_name: 'Roditelj' });
    ids.marko = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Marko', last_name: 'Roditelj' });
    ids.ana = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Drugagrupa' });
    expect((await manager.from('guardians').select('profile_id')).error?.code).toBe('42501');
    const forged = await manager.from('guardians').insert({ organization_id: alfa.orgId, first_name: 'X', last_name: 'Y', profile_id: parentId });
    expect(forged.error).not.toBeNull();
    await manager.from('child_guardians').insert([
      // Petra: two children (one without a group), different rights per child.
      { organization_id: alfa.orgId, child_id: ids.d1, guardian_id: ids.petra, can_view: true, can_report_absence: true, receives_messages: true, valid_during: '[2026-09-01,)' },
      { organization_id: alfa.orgId, child_id: ids.d3, guardian_id: ids.petra, can_view: true, can_report_absence: false, receives_messages: false, valid_during: '[2026-09-01,)' },
      // Marko: a second guardian of D1.
      { organization_id: alfa.orgId, child_id: ids.d1, guardian_id: ids.marko, can_view: true, can_report_absence: false, receives_messages: true, valid_during: '[2026-09-01,)' },
      // Ana: guardian of a child in another group.
      { organization_id: alfa.orgId, child_id: ids.d4, guardian_id: ids.ana, can_view: true, valid_during: '[2026-09-01,)' },
    ], { defaultToNull: false }).throwOnError();
    const bad = await manager.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: ids.d2, guardian_id: ids.marko, can_view: false, receives_messages: true, valid_during: '[2026-09-01,)' });
    expect(bad.error?.code).toBe('23514');
  });

  it('once the record is attached to the account, the guardian sees exactly the linked children, incl. one without a group (D-32)', async () => {
    // Attaching the account is the server-side acceptance step (D2-F); here the service role stands in for it.
    await service.from('guardians').update({ profile_id: parentId }).eq('id', ids.petra).throwOnError();
    const p = await signInWithCode(parentEmail);
    const { data: kids } = await p.client.from('children').select('id, first_name').order('first_name');
    expect(kids).toEqual([{ id: ids.d1, first_name: 'Lea' }, { id: ids.d3, first_name: 'Mia' }]);
    expect((await p.client.from('groups').select('id')).data).toEqual([{ id: alfa.groupId }]);
    expect((await p.client.from('enrollments').select('child_id')).data).toEqual([{ child_id: ids.d1 }]);
    const { data: links } = await p.client.from('child_guardians').select('child_id, can_report_absence').order('can_report_absence');
    expect(links).toEqual([{ child_id: ids.d3, can_report_absence: false }, { child_id: ids.d1, can_report_absence: true }]);
    expect((await p.client.from('guardians').select('first_name')).data).toEqual([{ first_name: 'Petra' }]);
    expect((await p.client.from('children').select('id').eq('id', ids.d2)).data).toEqual([]);
    const self = await p.client.from('child_guardians').update({ can_report_absence: true }).eq('child_id', ids.d3).select('id');
    expect(self.data ?? []).toEqual([]);
  });

  it('the educator of the group sees names and rights of guardians of their children only (D-31)', async () => {
    const { client } = await signInWithCode(alfa.educatorEmail);
    const { data: names } = await client.from('guardians').select('first_name, last_name').order('first_name');
    expect(names).toEqual([{ first_name: 'Marko', last_name: 'Roditelj' }, { first_name: 'Petra', last_name: 'Roditelj' }]);
    const { data: links } = await client.from('child_guardians').select('child_id, guardian_id, can_view, can_report_absence, receives_messages');
    expect(links!.every((l) => l.child_id === ids.d1)).toBe(true);
    expect(links).toHaveLength(2);
    expect((await client.from('guardians').select('profile_id')).error?.code).toBe('42501');
    expect((await client.from('guardians').select('id').eq('id', ids.ana)).data).toEqual([]);
  });

  it('ending a link removes the guardian\'s access to that child on the next request (NEG-06)', async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    await manager.from('child_guardians').update({ valid_during: `[2026-09-01,${yesterday})` }).eq('guardian_id', ids.petra).eq('child_id', ids.d3).throwOnError();
    const p = await signInWithCode(parentEmail);
    expect((await p.client.from('children').select('id')).data).toEqual([{ id: ids.d1 }]);
  });

  it('another kindergarten sees no guardian and no link', async () => {
    const mgr = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgr.client);
    expect((await mgr.client.from('guardians').select('id').eq('organization_id', alfa.orgId)).data).toEqual([]);
    expect((await mgr.client.from('child_guardians').select('id').eq('organization_id', alfa.orgId)).data).toEqual([]);
    const cross = await mgr.client.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: ids.d1, guardian_id: ids.marko, valid_during: '[2027-01-01,)' });
    expect(cross.error).not.toBeNull();
  });

  it('guardian records and links are audited with the actor role and without names', async () => {
    const { data } = await service.from('audit_events').select('action, actor_role, details').in('target_table', ['guardians', 'child_guardians']).eq('organization_id', alfa.orgId);
    expect(data!.length).toBeGreaterThanOrEqual(7);
    expect(data!.filter((r) => r.actor_role === 'org_admin').length).toBeGreaterThanOrEqual(7);
    expect(JSON.stringify(data)).not.toMatch(/Petra|Marko|Roditelj/);
  });
});
