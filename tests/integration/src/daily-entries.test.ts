// D4-E through the real API: the educator of a group writes today's overview (draft, publish, same-day edit); guardians
// of that group read it after publishing, a guardian of another group does not; the educator of another group cannot
// write (AC-10-2); publishing notifies without content. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
let educator: Client;
let otherEducator: Client;
let otherGroup = '';
const parents: Record<string, Client> = {};

async function account(key: string, role: 'educator' | 'guardian'): Promise<{ address: string; userId: string; membershipId: string }> {
  const address = email(`day-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: address, email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  const { data: m } = await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role, valid_during: '[2026-01-01,)' }).select('id').single().throwOnError();
  return { address, userId: user.user!.id as string, membershipId: m!.id as string };
}
async function guardianOf(key: string, groupId: string): Promise<void> {
  const a = await account(key, 'guardian');
  const { data: c } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: 'Dijete', last_name: key }).select('id').single().throwOnError();
  await service.from('enrollments').insert({ organization_id: alfa.orgId, child_id: c!.id, group_id: groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  const { data: g } = await manager.from('guardians').insert({ organization_id: alfa.orgId, first_name: 'Skrbnik', last_name: key }).select('id').single().throwOnError();
  await service.from('guardians').update({ profile_id: a.userId }).eq('id', g!.id).throwOnError();
  await service.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: c!.id, guardian_id: g!.id, can_view: true, valid_during: '[2026-09-01,)' }).throwOnError();
  parents[key] = (await signInWithCode(a.address)).client;
}

beforeAll(async () => {
  alfa = await createKindergarten('day-a');
  manager = (await signInWithCode(alfa.managerEmail)).client;
  await enrolMfa(manager);
  const { data: g } = await service.from('groups').select('facility_id, academic_year_id').eq('id', alfa.groupId).single().throwOnError();
  const { data: other } = await manager.from('groups').insert({ organization_id: alfa.orgId, facility_id: g!.facility_id, academic_year_id: g!.academic_year_id, name: 'Školjke' }).select('id').single().throwOnError();
  otherGroup = other!.id as string;
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  const e2 = await account('e2', 'educator');
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: e2.membershipId, group_id: otherGroup, valid_during: '[2026-01-01,)' }).throwOnError();
  await guardianOf('g1', alfa.groupId);
  await guardianOf('g9', otherGroup);
  educator = (await signInWithCode(alfa.educatorEmail)).client;
  otherEducator = (await signInWithCode(e2.address)).client;
});

describe('D4-E: daily overview through the API', () => {
  it('only the group\'s educator writes (AC-10-2); guardians read after publishing (AC-10-1)', async () => {
    const save = (client: Client, body: string, publish = false) =>
      client.schema('api').rpc('save_daily_entry', { p_group_id: alfa.groupId, p_body: body, p_tags: ['outdoor'], p_publish: publish });
    expect((await save(otherEducator, 'X')).error?.code).toBe('42501');
    expect((await save(manager, 'X')).error?.code).toBe('42501');
    expect((await save(educator, 'Jutro u dvorištu.')).error).toBeNull();
    expect((await parents.g1!.from('daily_entries').select('id')).data).toEqual([]);
    expect((await save(educator, 'Jutro u dvorištu.', true)).error).toBeNull();
    const { data } = await parents.g1!.from('daily_entries').select('body, activity_tags, status, edited_at');
    expect(data).toEqual([{ body: 'Jutro u dvorištu.', activity_tags: ['outdoor'], status: 'published', edited_at: null }]);
    expect((await parents.g9!.from('daily_entries').select('id')).data).toEqual([]);
    expect((await parents.g1!.from('notifications').select('type')).data).toEqual([{ type: 'daily_entry.published' }]);
    expect((await parents.g9!.from('notifications').select('id')).data).toEqual([]);
    expect((await save(educator, 'Jutro u dvorištu, poslije priča.')).error).toBeNull();
    const { data: edited } = await parents.g1!.from('daily_entries').select('body, edited_at');
    expect(edited![0]!.body).toBe('Jutro u dvorištu, poslije priča.');
    expect(edited![0]!.edited_at).not.toBeNull();
    expect((await save(educator, 'x'.repeat(1001))).error?.message).toBe('DAILY_ENTRY_CONTENT_INVALID');
  });
});
