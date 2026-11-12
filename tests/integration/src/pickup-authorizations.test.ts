// D2-D through the real API: managers maintain the persons authorized to pick up a child (FR-04-7, FR-04-8);
// guardians who may view the child and the educator of the child's group today read the current list; nobody else
// does; an access restriction hides the list from the restricted guardian only. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
const ids: Record<string, string> = {};
const parents: Record<string, string> = {};
const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await manager.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

async function guardianAccount(key: string, guardianId: string): Promise<void> {
  parents[key] = email(`roditelj-pr-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: parents[key], email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Roditelj', last_name: key }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
  await service.from('guardians').update({ profile_id: user.user!.id }).eq('id', guardianId).throwOnError();
}

async function names(client: typeof manager): Promise<string[]> {
  const { data, error } = await client.from('pickup_authorizations').select('first_name').order('first_name');
  if (error) throw error;
  return data!.map((r) => r.first_name);
}

beforeAll(async () => {
  alfa = await createKindergarten('pr-a');
  beta = await createKindergarten('pr-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  ids.lea = await insert('children', { organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Preuzimanje' });
  ids.mia = await insert('children', { organization_id: alfa.orgId, first_name: 'Mia', last_name: 'Bezskupine' });
  await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids.lea, group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  await manager
    .from('staff_assignments')
    .insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' })
    .throwOnError();
  ids.ana = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Skrbnik' });
  ids.bruno = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Bruno', last_name: 'Skrbnik' });
  ids.anaLea = await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.lea, guardian_id: ids.ana, can_view: true, can_report_absence: true, receives_messages: true, valid_during: '[2026-09-01,)' });
  await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.lea, guardian_id: ids.bruno, can_view: true, can_report_absence: false, receives_messages: false, valid_during: '[2026-09-01,)' });
  await guardianAccount('ana', ids.ana);
  await guardianAccount('bruno', ids.bruno);
});

describe('D2-D: pickup authorizations through the API', () => {
  it('a manager adds persons per child; the creator is set by the database and not readable', async () => {
    ids.mara = await insert('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.lea, first_name: 'Mara', last_name: 'Baka', valid_during: `[${today},)` });
    await insert('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.lea, first_name: 'Buduci', last_name: 'Ovlasteni', valid_during: `[${tomorrow},)` });
    await insert('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.mia, first_name: 'Lovro', last_name: 'Djed', valid_during: `[${today},)` });
    expect(await names(manager)).toEqual(['Buduci', 'Lovro', 'Mara']);
    expect((await manager.from('pickup_authorizations').select('created_by')).error).not.toBeNull();
    const { data } = await service.from('pickup_authorizations').select('created_by').eq('id', ids.mara).single();
    expect(data!.created_by).not.toBeNull();
  });

  it('guardians read the current list of their children (incl. a child without a group), read only', async () => {
    const ana = (await signInWithCode(parents.ana!)).client;
    expect(await names(ana)).toEqual(['Mara']);
    expect((await ana.from('pickup_authorizations').insert({ organization_id: alfa.orgId, child_id: ids.lea, first_name: 'X', last_name: 'Y', valid_during: `[${today},)` })).error).not.toBeNull();
    expect((await ana.from('pickup_authorizations').update({ last_name: 'Promjena' }).eq('id', ids.mara).select('id')).data).toEqual([]);
    await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids.mia, guardian_id: ids.ana, can_view: true, can_report_absence: false, receives_messages: false, valid_during: '[2026-09-01,)' });
    expect(await names(ana)).toEqual(['Lovro', 'Mara']);
  });

  it('the educator of the group reads the current list for handover; no write path', async () => {
    const edu = (await signInWithCode(alfa.educatorEmail)).client;
    expect(await names(edu)).toEqual(['Mara']);
    expect((await edu.from('pickup_authorizations').update({ valid_during: `[${today},${tomorrow})` }).eq('id', ids.mara).select('id')).data).toEqual([]);
    expect((await edu.from('pickup_authorizations').insert({ organization_id: alfa.orgId, child_id: ids.lea, first_name: 'X', last_name: 'Y', valid_during: `[${today},)` })).error).not.toBeNull();
  });

  it('an access restriction hides the list from the restricted guardian only; the list itself is unchanged', async () => {
    await insert('access_restrictions', { organization_id: alfa.orgId, child_guardian_id: ids.anaLea, valid_during: `[${today},)` });
    expect(await names((await signInWithCode(parents.ana!)).client)).toEqual(['Lovro']);
    expect(await names((await signInWithCode(parents.bruno!)).client)).toEqual(['Mara']);
    expect(await names((await signInWithCode(alfa.educatorEmail)).client)).toEqual(['Mara']);
    expect(await names(manager)).toEqual(['Buduci', 'Lovro', 'Mara']);
  });

  it('another kindergarten reads and writes nothing; no deletes', async () => {
    const mgrB = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgrB.client);
    expect(await names(mgrB.client)).toEqual([]);
    expect((await mgrB.client.from('pickup_authorizations').insert({ organization_id: alfa.orgId, child_id: ids.lea, first_name: 'X', last_name: 'Y', valid_during: `[${today},)` })).error).not.toBeNull();
    expect((await manager.from('pickup_authorizations').delete().eq('id', ids.mara)).error).not.toBeNull();
  });

  it('authorizations are audited with the actor role and without names', async () => {
    const { data } = await service.from('audit_events').select('actor_role, details').eq('target_table', 'pickup_authorizations').eq('organization_id', alfa.orgId);
    expect(data!.length).toBe(3);
    expect(data!.every((r) => r.actor_role === 'org_admin')).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/Mara|Lovro|Buduci|Baka/);
  });
});
