// D2-C through the real API (NEG-05): an active restriction removes a guardian's access to that child on the next
// request; a future or ended one does not; the other guardian is unaffected; only managers read restrictions.
// Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
const ids: Record<string, string> = {};
const parents: Record<string, string> = {};
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await manager.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

/** A guardian account with a guardian membership; the record is attached server-side (the D2-F acceptance step). */
async function guardianAccount(key: string, guardianId: string): Promise<void> {
  parents[key] = email(`roditelj-ogr-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: parents[key], email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Roditelj', last_name: key }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
  await service.from('guardians').update({ profile_id: user.user!.id }).eq('id', guardianId).throwOnError();
}

async function reach(key: string) {
  const { client } = await signInWithCode(parents[key]!);
  const rows = async (table: string) => ((await client.from(table).select('id')).data ?? []).length;
  return {
    children: (await client.from('children').select('first_name').order('first_name')).data?.map((c) => c.first_name),
    links: await rows('child_guardians'),
    enrollments: await rows('enrollments'),
    groups: await rows('groups'),
    restrictions: await rows('access_restrictions'),
    client,
  };
}

beforeAll(async () => {
  alfa = await createKindergarten('ogr-a');
  beta = await createKindergarten('ogr-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  ids.lea = await insert('children', { organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Ogranicena' });
  ids.mia = await insert('children', { organization_id: alfa.orgId, first_name: 'Mia', last_name: 'Bezskupine' });
  await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids.lea, group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  ids.ana = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Skrbnik' });
  ids.bruno = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Bruno', last_name: 'Skrbnik' });
  ids.anaLea = await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.lea, guardian_id: ids.ana, can_view: true, can_report_absence: true, receives_messages: true, valid_during: '[2026-09-01,)' });
  ids.anaMia = await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.mia, guardian_id: ids.ana, can_view: true, can_report_absence: false, receives_messages: false, valid_during: '[2026-09-01,)' });
  ids.brunoLea = await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.lea, guardian_id: ids.bruno, can_view: true, can_report_absence: true, receives_messages: true, valid_during: '[2026-09-01,)' });
  await guardianAccount('ana', ids.ana);
  await guardianAccount('bruno', ids.bruno);
});

describe('D2-C: access restrictions through the API', () => {
  it('without a restriction Ana sees both children (Mia without a group, D-32)', async () => {
    const r = await reach('ana');
    expect(r.children).toEqual(['Lea', 'Mia']);
    expect([r.links, r.enrollments, r.groups, r.restrictions]).toEqual([2, 1, 1, 0]);
  });

  it('a future restriction changes nothing yet', async () => {
    ids.future = await insert('access_restrictions', { organization_id: alfa.orgId, child_guardian_id: ids.anaLea, valid_during: `[${tomorrow},)`, reference: 'INT-BUDUCE' });
    expect((await reach('ana')).children).toEqual(['Lea', 'Mia']);
  });

  it('an active restriction removes Lea for Ana on the next request; Mia and Bruno are unaffected (NEG-05)', async () => {
    ids.active = await insert('access_restrictions', { organization_id: alfa.orgId, child_guardian_id: ids.anaLea, valid_during: `[${today},)`, reference: 'INT-AKTIVNO' });
    const ana = await reach('ana');
    expect(ana.children).toEqual(['Mia']);
    expect([ana.links, ana.enrollments, ana.groups, ana.restrictions]).toEqual([1, 0, 0, 0]);
    expect((await ana.client.from('children').select('id').eq('id', ids.lea)).data).toEqual([]);
    expect((await ana.client.from('child_guardians').select('id').eq('id', ids.anaLea)).data).toEqual([]);
    const bruno = await reach('bruno');
    expect(bruno.children).toEqual(['Lea']);
    expect([bruno.links, bruno.enrollments, bruno.groups, bruno.restrictions]).toEqual([1, 1, 1, 0]);
  });

  it('D-33: the educator of the group sees the link marked restricted, without reference, author or a write path', async () => {
    await manager
      .from('staff_assignments')
      .insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' })
      .throwOnError();
    const edu = await signInWithCode(alfa.educatorEmail);
    const { data } = await edu.client.from('child_guardian_overview').select('*').order('is_restricted');
    expect(data!.map((r) => [r.guardian_id, r.is_restricted])).toEqual([
      [ids.bruno, false],
      [ids.ana, true],
    ]);
    expect(Object.keys(data![0]!).sort()).toEqual(
      ['can_report_absence', 'can_view', 'child_id', 'guardian_id', 'id', 'is_restricted', 'organization_id', 'receives_messages', 'valid_during'].sort(),
    );
    expect(JSON.stringify(data)).not.toMatch(/INT-/);
    expect((await edu.client.from('access_restrictions').select('id')).data).toEqual([]);
    expect((await edu.client.from('child_guardian_overview').update({ can_view: false }).eq('id', ids.anaLea)).error).not.toBeNull();
    // the restricted guardian and the other guardian learn nothing about the restriction
    expect((await (await reach('ana')).client.from('child_guardian_overview').select('id, is_restricted')).data).toEqual([{ id: ids.anaMia, is_restricted: false }]);
    expect((await (await reach('bruno')).client.from('child_guardian_overview').select('id, is_restricted')).data).toEqual([{ id: ids.brunoLea, is_restricted: false }]);
  });

  it('only managers read or write restrictions', async () => {
    const ana = await reach('ana');
    expect((await ana.client.from('access_restrictions').insert({ organization_id: alfa.orgId, child_guardian_id: ids.brunoLea, valid_during: `[${today},)` })).error).not.toBeNull();
    const edu = await signInWithCode(alfa.educatorEmail);
    expect((await edu.client.from('access_restrictions').select('id')).data).toEqual([]);
    const mgrB = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgrB.client);
    expect((await mgrB.client.from('access_restrictions').select('id').eq('organization_id', alfa.orgId)).data).toEqual([]);
    expect((await mgrB.client.from('access_restrictions').insert({ organization_id: alfa.orgId, child_guardian_id: ids.brunoLea, valid_during: `[${today},)` })).error).not.toBeNull();
    expect((await manager.from('access_restrictions').select('id').eq('organization_id', alfa.orgId)).data).toHaveLength(2);
    expect((await manager.from('access_restrictions').delete().eq('id', ids.active)).error).not.toBeNull();
  });

  it('ending the restriction restores access on the next request, rights unchanged', async () => {
    await manager.from('access_restrictions').update({ valid_during: `[${yesterday},${today})` }).eq('id', ids.active).throwOnError();
    const ana = await reach('ana');
    expect(ana.children).toEqual(['Lea', 'Mia']);
    const { data } = await ana.client.from('child_guardians').select('child_id, can_report_absence, receives_messages').eq('child_id', ids.lea);
    expect(data).toEqual([{ child_id: ids.lea, can_report_absence: true, receives_messages: true }]);
  });

  it('a restriction on the link to a child without a group (D-32) works the same', async () => {
    await insert('access_restrictions', { organization_id: alfa.orgId, child_guardian_id: ids.anaMia, valid_during: `[${today},)` });
    expect((await reach('ana')).children).toEqual(['Lea']);
  });

  it('restrictions are audited with the actor role and without the reference text', async () => {
    const { data } = await service.from('audit_events').select('action, actor_role, details').eq('target_table', 'access_restrictions').eq('organization_id', alfa.orgId);
    expect(data!.length).toBe(4);
    expect(data!.every((r) => r.actor_role === 'org_admin')).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/INT-/);
  });
});
