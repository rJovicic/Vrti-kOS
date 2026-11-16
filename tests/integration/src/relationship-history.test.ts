// D-41a through the real API (PostgREST): a manager with MFA cannot rewrite the past of enrolments, guardian links,
// access restrictions or pickup authorizations with direct requests — not the start, not the end, not by a bare
// PATCH that bypasses the admin forms; renaming a pickup person who was authorised before today is refused. Changes
// from today on still work. Fixtures "entered on an earlier day" are written with the service key. Synthetic only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
const ids: Record<string, string> = {};
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function fixture(table: string, row: Record<string, unknown>): Promise<string> {
  const { data } = await service.from(table).insert(row).select('id').single().throwOnError();
  return data!.id as string;
}

beforeAll(async () => {
  alfa = await createKindergarten('rh-a');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  ids.child = await fixture('children', { organization_id: alfa.orgId, first_name: 'Ivo', last_name: 'Povijest' });
  ids.other = await fixture('children', { organization_id: alfa.orgId, first_name: 'Lea', last_name: 'Povijest' });
  ids.guardian = await fixture('guardians', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Povijest' });
  ids.enrolment = await fixture('enrollments', { organization_id: alfa.orgId, child_id: ids.child, group_id: alfa.groupId, valid_during: `[${day(-30)},)` });
  ids.link = await fixture('child_guardians', { organization_id: alfa.orgId, child_id: ids.child, guardian_id: ids.guardian, can_view: true, valid_during: `[${day(-30)},)` });
  ids.restriction = await fixture('access_restrictions', { organization_id: alfa.orgId, child_guardian_id: ids.link, valid_during: `[${day(-5)},)` });
  ids.pickup = await fixture('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.child, first_name: 'Mara', last_name: 'Baka', valid_during: `[${day(-10)},)` });
});

const refused = (r: { error: { message: string } | null }) => expect(r.error?.message).toBe('HISTORY_IMMUTABLE');

describe('D-41a: the past of a child\'s relationships cannot be rewritten through the API', () => {
  it('inserts that start in the past are refused on all four tables', async () => {
    refused(await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids.other, group_id: alfa.groupId, valid_during: `[${day(-1)},)` }));
    refused(await manager.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: ids.other, guardian_id: ids.guardian, can_view: true, valid_during: `[${day(-1)},)` }));
    refused(await manager.from('access_restrictions').insert({ organization_id: alfa.orgId, child_guardian_id: ids.link, valid_during: `[${day(-1)},)` }));
    refused(await manager.from('pickup_authorizations').insert({ organization_id: alfa.orgId, child_id: ids.child, first_name: 'Nova', last_name: 'Osoba', valid_during: `[${day(-1)},)` }));
  });

  it('a bare PATCH cannot move a start or set an end in the past', async () => {
    refused(await manager.from('enrollments').update({ valid_during: `[${day(-60)},)` }).eq('id', ids.enrolment));
    refused(await manager.from('child_guardians').update({ valid_during: `[${day(-20)},)` }).eq('id', ids.link));
    refused(await manager.from('child_guardians').update({ valid_during: `[${day(-30)},${day(-2)})` }).eq('id', ids.link));
    refused(await manager.from('access_restrictions').update({ valid_during: `[${day(-5)},${day(-2)})` }).eq('id', ids.restriction));
    refused(await manager.from('pickup_authorizations').update({ valid_during: `[${day(-40)},)` }).eq('id', ids.pickup));
    refused(await manager.from('pickup_authorizations').update({ first_name: 'Marija' }).eq('id', ids.pickup));
    const { data } = await service.from('child_guardians').select('valid_during').eq('id', ids.link).single().throwOnError();
    expect(data!.valid_during).toBe(`[${day(-30)},)`);
  });

  it('changes from today on still work', async () => {
    expect((await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids.other, group_id: alfa.groupId, valid_during: `[${day(0)},)` })).error).toBeNull();
    expect((await manager.from('child_guardians').update({ valid_during: `[${day(-30)},${day(5)})` }).eq('id', ids.link)).error).toBeNull();
    expect((await manager.from('access_restrictions').update({ valid_during: `[${day(-5)},${day(0)})` }).eq('id', ids.restriction)).error).toBeNull();
    expect((await manager.from('pickup_authorizations').update({ valid_during: `[${day(-10)},${day(3)})` }).eq('id', ids.pickup)).error).toBeNull();
  });
});
