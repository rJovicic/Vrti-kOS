// D4-A through the real API: an absence recorded for a child notifies the educator assigned to the child's group
// (FR-06-5) with a content-free notification; the educator reads and marks only own notifications; preferences are
// personal; an unassigned educator and the actor get nothing. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
let educator: Client;
let unassigned: Client;
let childId = '';
const tomorrow = new Date(Date.now() + 36 * 3600 * 1000).toISOString().slice(0, 10);

beforeAll(async () => {
  alfa = await createKindergarten('ntf-a');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(manager);
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  const address = email('ntf-edu2');
  const { data: user } = await service.auth.admin.createUser({ email: address, email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: 'edu2' }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'educator', valid_during: '[2026-01-01,)' }).throwOnError();
  const { data } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Obavijest' }).select('id').single().throwOnError();
  childId = data!.id as string;
  await service.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  educator = (await signInWithCode(alfa.educatorEmail)).client;
  unassigned = (await signInWithCode(address)).client;
});

describe('D4-A: notifications through the API', () => {
  it('an absence notifies the educator of the group with a content-free row; nobody else', async () => {
    const { error } = await manager.schema('api').rpc('record_absence_on_behalf', { p_child_id: childId, p_starts_on: tomorrow, p_ends_on: tomorrow });
    expect(error).toBeNull();
    const { data: mine } = await educator.from('notifications').select('*');
    expect(mine).toHaveLength(1);
    expect(mine![0]).toMatchObject({ type: 'absence.reported', resource_type: 'absence_record', read_at: null, push_status: 'pending' });
    expect(Object.keys(mine![0]!).sort()).toEqual(['created_at', 'id', 'organization_id', 'push_attempts', 'push_next_attempt_at', 'push_status', 'read_at', 'recipient_id', 'resource_id', 'resource_type', 'type']);
    expect(JSON.stringify(mine)).not.toMatch(/Lea|Obavijest|Galebovi/);
    // The resource itself is read under the absence RLS.
    const { data: absence } = await educator.from('absence_records').select('id, child_id').eq('id', mine![0]!.resource_id as string);
    expect(absence).toEqual([{ id: mine![0]!.resource_id, child_id: childId }]);
    expect((await unassigned.from('notifications').select('id')).data).toEqual([]);
    expect((await manager.from('notifications').select('id')).data).toEqual([]);
  });

  it('marking read touches only own rows; direct writes are refused', async () => {
    expect((await unassigned.schema('api').rpc('mark_notifications_read', {})).data).toBe(0);
    expect((await educator.schema('api').rpc('mark_notifications_read', {})).data).toBe(1);
    const { data } = await educator.from('notifications').select('read_at');
    expect(data![0]!.read_at).not.toBeNull();
    expect((await educator.from('notifications').update({ read_at: null }).not('id', 'is', null)).error?.code).toBe('42501');
  });

  it('a preference is personal and turns push off for the next event of that type (AC-08-1)', async () => {
    const { data: me } = await educator.auth.getUser();
    expect((await educator.from('notification_preferences').upsert({ profile_id: me.user!.id, type: 'absence.reported', push_enabled: false })).error).toBeNull();
    const { data: other } = await unassigned.auth.getUser();
    expect((await educator.from('notification_preferences').insert({ profile_id: other.user!.id, type: 'absence.reported', push_enabled: false })).error?.code).toBe('42501');
    const later = new Date(Date.now() + 60 * 3600 * 1000).toISOString().slice(0, 10);
    expect((await manager.schema('api').rpc('record_absence_on_behalf', { p_child_id: childId, p_starts_on: later, p_ends_on: later })).error).toBeNull();
    const { data } = await educator.from('notifications').select('push_status, read_at').order('created_at');
    expect(data).toHaveLength(2);
    expect(data![1]).toMatchObject({ push_status: 'not_applicable', read_at: null });
  });
});
