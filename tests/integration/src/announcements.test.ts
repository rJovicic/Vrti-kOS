// D4-B through the real API: a manager with MFA writes, publishes, edits and archives; guardians of the target group
// read it (content loaded under RLS), the guardian of another group and the educator (guardians-only audience) do not;
// educators cannot write (SR-AUTHZ-10); publishing notifies the audience without content. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
let educator: Client;
const parents: Record<string, Client> = {};

async function guardianOf(key: string, groupId: string): Promise<void> {
  const address = email(`ann-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: address, email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
  const { data: c } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: 'Dijete', last_name: key }).select('id').single().throwOnError();
  await service.from('enrollments').insert({ organization_id: alfa.orgId, child_id: c!.id, group_id: groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  const { data: g } = await manager.from('guardians').insert({ organization_id: alfa.orgId, first_name: 'Skrbnik', last_name: key }).select('id').single().throwOnError();
  await service.from('guardians').update({ profile_id: user.user!.id }).eq('id', g!.id).throwOnError();
  await service.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: c!.id, guardian_id: g!.id, can_view: true, valid_during: '[2026-09-01,)' }).throwOnError();
  parents[key] = (await signInWithCode(address)).client;
}

beforeAll(async () => {
  alfa = await createKindergarten('ann-a');
  manager = (await signInWithCode(alfa.managerEmail)).client;
  await enrolMfa(manager);
  const { data: g } = await service.from('groups').select('facility_id, academic_year_id').eq('id', alfa.groupId).single().throwOnError();
  const { data: other } = await manager.from('groups').insert({ organization_id: alfa.orgId, facility_id: g!.facility_id, academic_year_id: g!.academic_year_id, name: 'Školjke' }).select('id').single().throwOnError();
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  await guardianOf('g1', alfa.groupId);
  await guardianOf('g9', other!.id as string);
  educator = (await signInWithCode(alfa.educatorEmail)).client;
});

describe('D4-B: announcements through the API', () => {
  it('an educator cannot write an announcement (SR-AUTHZ-10)', async () => {
    const { error } = await educator.schema('api').rpc('save_announcement_draft', {
      p_organization_id: alfa.orgId, p_title: 'X', p_body: 'Y', p_audience_scope: 'group', p_audience_ids: [alfa.groupId], p_audience_roles: ['guardians'],
    });
    expect(error?.code).toBe('42501');
  });

  it('draft → publish reaches exactly the guardians of the group; edit keeps a revision; archive hides it', async () => {
    const draft = await manager.schema('api').rpc('save_announcement_draft', {
      p_organization_id: alfa.orgId, p_title: 'Izlet u petak', p_body: 'Polazak u 9 sati.', p_audience_scope: 'group', p_audience_ids: [alfa.groupId], p_audience_roles: ['guardians'],
    });
    expect(draft.error).toBeNull();
    const id = draft.data as string;
    expect((await parents.g1!.from('announcements').select('id')).data).toEqual([]);
    expect((await manager.schema('api').rpc('publish_announcement', { p_id: id })).error).toBeNull();

    expect((await parents.g1!.from('announcements').select('title, body, edited_at')).data).toEqual([{ title: 'Izlet u petak', body: 'Polazak u 9 sati.', edited_at: null }]);
    expect((await parents.g9!.from('announcements').select('id')).data).toEqual([]);
    expect((await educator.from('announcements').select('id')).data).toEqual([]);
    const { data: n } = await parents.g1!.from('notifications').select('type, resource_id');
    expect(n).toEqual([{ type: 'announcement.published', resource_id: id }]);
    expect((await parents.g9!.from('notifications').select('id')).data).toEqual([]);

    expect((await manager.schema('api').rpc('edit_announcement', { p_id: id, p_title: 'Izlet u petak', p_body: 'Polazak u 10 sati.' })).error).toBeNull();
    const { data: edited } = await parents.g1!.from('announcements').select('body, edited_at');
    expect(edited![0]!.body).toBe('Polazak u 10 sati.');
    expect(edited![0]!.edited_at).not.toBeNull();
    expect((await manager.from('announcement_revisions').select('body').eq('announcement_id', id)).data).toEqual([{ body: 'Polazak u 9 sati.' }]);
    expect((await parents.g1!.from('announcement_revisions').select('id')).data).toEqual([]);

    expect((await manager.schema('api').rpc('archive_announcement', { p_id: id })).error).toBeNull();
    expect((await parents.g1!.from('announcements').select('id')).data).toEqual([]);
  });

  it('business errors carry a code: content limits, foreign audience, wrong state', async () => {
    const base = { p_organization_id: alfa.orgId, p_audience_scope: 'organization', p_audience_ids: [], p_audience_roles: ['staff'] };
    expect((await manager.schema('api').rpc('save_announcement_draft', { ...base, p_title: 'x'.repeat(121), p_body: 'Y' })).error?.message).toBe('ANNOUNCEMENT_CONTENT_INVALID');
    expect((await manager.schema('api').rpc('save_announcement_draft', { ...base, p_title: 'X', p_body: 'Y', p_audience_scope: 'group', p_audience_ids: [crypto.randomUUID()] })).error?.message).toBe(
      'ANNOUNCEMENT_AUDIENCE_INVALID',
    );
    const { data: id } = await manager.schema('api').rpc('save_announcement_draft', { ...base, p_title: 'Nacrt', p_body: 'Tekst' });
    expect((await manager.schema('api').rpc('archive_announcement', { p_id: id })).error?.message).toBe('ANNOUNCEMENT_STATE_INVALID');
  });
});
