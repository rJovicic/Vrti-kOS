// D-40 through the real API and Edge Function, MOCK adapter only (nothing leaves the machine): a person registers a
// synthetic device token; an event creates a pending notification; push-dispatch (service key only) sends one generic
// payload — ST-PUSH-01 at L3: no name, group, title or text in what would be sent; outcomes are written back, a token the
// provider no longer knows is deleted, sign-out removes the token (AC-08-3), a preference keeps push off (AC-08-1).
import { beforeAll, describe, expect, it } from 'vitest';
import { callFunction, createKindergarten, enrolMfa, service, signInWithCode, stack } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
let educator: Client;
let educatorToken = '';
let childId = '';
const day = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString().slice(0, 10);
const token = (s: string) => `ExponentPushToken[${s}]`;
const dispatch = () => callFunction('push-dispatch', stack.SECRET_KEY);

beforeAll(async () => {
  alfa = await createKindergarten('push-a');
  manager = (await signInWithCode(alfa.managerEmail)).client;
  await enrolMfa(manager);
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  const { data } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Pushić' }).select('id').single().throwOnError();
  childId = data!.id as string;
  await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  const signedIn = await signInWithCode(alfa.educatorEmail);
  educator = signedIn.client;
  educatorToken = signedIn.token;
  // Drain anything other test files left pending, so the counts below are this file's own.
  await dispatch();
});

describe('D-40: push delivery with the mock adapter', () => {
  it('only the service key may run the worker', async () => {
    expect((await callFunction('push-dispatch', educatorToken)).status).toBe(403);
    expect((await callFunction('push-dispatch', null)).status).toBe(403);
  });

  it('a registered device receives one generic payload; nothing personal is in it (ST-PUSH-01)', async () => {
    expect((await educator.schema('api').rpc('register_push_token', { p_token: token('it-device-0001'), p_platform: 'ios' })).error).toBeNull();
    expect((await educator.from('push_tokens').select('token')).error?.code).toBe('42501');
    expect((await manager.schema('api').rpc('record_absence_on_behalf', { p_child_id: childId, p_starts_on: day(36), p_ends_on: day(36) })).error).toBeNull();

    const res = await dispatch();
    expect(res.status).toBe(200);
    expect(res.json).toMatchObject({ adapter: 'mock', sent: 1, errors: 0 });
    const { data: mine } = await educator.from('notifications').select('id, push_status');
    expect(mine).toEqual([{ id: expect.any(String), push_status: 'sent' }]);
    expect(res.json.payloads).toEqual([{ title: 'VrtićOS', body: 'Nova prijava izostanka', data: { notificationId: mine![0]!.id } }]);
    expect(JSON.stringify(res.json)).not.toMatch(/Lea|Pushić|Galebovi|ExponentPushToken|@/);
  });

  it('a token the provider no longer knows is deleted; sign-out removes the token; a preference keeps push off', async () => {
    const { data: me } = await educator.auth.getUser();
    await educator.schema('api').rpc('register_push_token', { p_token: token('unregistered-0001'), p_platform: 'android' });
    expect((await manager.schema('api').rpc('record_absence_on_behalf', { p_child_id: childId, p_starts_on: day(60), p_ends_on: day(60) })).error).toBeNull();
    expect((await dispatch()).json).toMatchObject({ sent: 1, invalidTokens: 1 });
    const { data: left } = await service.from('push_tokens').select('token').eq('profile_id', me.user!.id).order('token');
    expect(left).toEqual([{ token: token('it-device-0001') }]);

    await educator.schema('api').rpc('unregister_push_token', { p_token: token('it-device-0001') });
    expect((await service.from('push_tokens').select('token').eq('profile_id', me.user!.id)).data).toEqual([]);

    await educator.schema('api').rpc('register_push_token', { p_token: token('it-device-0002'), p_platform: 'ios' });
    await educator.from('notification_preferences').upsert({ profile_id: me.user!.id, type: 'absence.reported', push_enabled: false });
    expect((await manager.schema('api').rpc('record_absence_on_behalf', { p_child_id: childId, p_starts_on: day(84), p_ends_on: day(84) })).error).toBeNull();
    expect((await dispatch()).json).toMatchObject({ claimed: 0, sent: 0 });
    const { data: latest } = await educator.from('notifications').select('push_status, read_at').order('created_at', { ascending: false }).limit(1);
    expect(latest).toEqual([{ push_status: 'not_applicable', read_at: null }]);
  });
});
