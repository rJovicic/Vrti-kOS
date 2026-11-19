// Q-T22 through the real API (PostgREST), regression for the 2026-11-19 correction: an absence depends on a record
// starting today through the days it covers, not only through the day it was reported. A manager with MFA cancels via
// api.cancel_same_day_record. Absences "reported on an earlier day" are fixtures written with the service key (their
// created_at lies in the past). Synthetic only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
let managerId = '';
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

async function child(name: string): Promise<string> {
  const { data } = await service.from('children').insert({ organization_id: alfa.orgId, first_name: name, last_name: 'Danas' }).select('id').single().throwOnError();
  return data!.id as string;
}
/** An enrolment starting today, entered by the manager through the API (a regular operation). */
async function enrolToday(childId: string): Promise<string> {
  const { data } = await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: `[${day(0)},)` }).select('id').single().throwOnError();
  return data!.id as string;
}
async function absence(childId: string, from: number, to: number, reportedBy: string, createdDaysAgo: number) {
  await service.from('absence_records').insert({
    organization_id: alfa.orgId, child_id: childId, starts_on: day(from), ends_on: day(to), reported_by: reportedBy,
    source: reportedBy === managerId ? 'staff_on_behalf' : 'guardian', created_at: ago(createdDaysAgo),
  }).throwOnError();
}
/** A guardian with an account and a link to the child starting today (entered by the manager). */
async function guardianLinkedToday(childId: string, key: string): Promise<{ linkId: string; profileId: string }> {
  const { data: user } = await service.auth.admin.createUser({ email: email(`sd-${key}`), email_confirm: true });
  const profileId = user.user!.id;
  await service.from('profiles').insert({ id: profileId, first_name: 'Racun', last_name: key }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: profileId, role: 'guardian', valid_during: `[${day(-30)},)` }).throwOnError();
  const { data: g } = await service.from('guardians').insert({ organization_id: alfa.orgId, profile_id: profileId, first_name: 'Skrbnik', last_name: key }).select('id').single().throwOnError();
  const { data: link } = await manager.from('child_guardians')
    .insert({ organization_id: alfa.orgId, child_id: childId, guardian_id: g!.id, can_view: true, can_report_absence: true, valid_during: `[${day(0)},)` })
    .select('id').single().throwOnError();
  return { linkId: link!.id as string, profileId };
}
const cancel = (kind: string, id: string) => manager.schema('api').rpc('cancel_same_day_record', { p_kind: kind, p_record_id: id, p_reason: 'entered_in_error' });

beforeAll(async () => {
  alfa = await createKindergarten('sd-a');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  managerId = (await manager.auth.getUser()).data.user!.id;
});

describe('Q-T22: absences as dependencies, through the API', () => {
  it('enrolment: an absence reported yesterday that covers today blocks the cancellation', async () => {
    const c = await child('Ana');
    const enrolment = await enrolToday(c);
    await absence(c, 0, 1, managerId, 1);
    expect((await cancel('enrollment', enrolment)).error?.message).toBe('RECORD_HAS_DEPENDENTS');
  });

  it('enrolment: an earlier absence that ended before today does not block it', async () => {
    const c = await child('Bea');
    const enrolment = await enrolToday(c);
    await absence(c, -6, -2, managerId, 10);
    expect((await cancel('enrollment', enrolment)).error).toBeNull();
    const { data } = await service.from('enrollments').select('cancelled_at, cancelled_period').eq('id', enrolment).single().throwOnError();
    expect(data!.cancelled_at).not.toBeNull();
    expect(data!.cancelled_period).toBe(`[${day(0)},)`);
  });

  it('enrolment: an earlier absence for future days only blocks it', async () => {
    const c = await child('Cvita');
    const enrolment = await enrolToday(c);
    await absence(c, 3, 4, managerId, 1);
    expect((await cancel('enrollment', enrolment)).error?.message).toBe('RECORD_HAS_DEPENDENTS');
  });

  it('link: the same guardian reported earlier an absence covering today — blocked; an ended one — not', async () => {
    const c = await child('Dora');
    await enrolToday(c);
    const blocked = await guardianLinkedToday(c, 'g1');
    await absence(c, 0, 0, blocked.profileId, 2);
    expect((await cancel('child_guardian', blocked.linkId)).error?.message).toBe('RECORD_HAS_DEPENDENTS');
    const free = await guardianLinkedToday(c, 'g2');
    await absence(c, -9, -8, free.profileId, 12);
    expect((await cancel('child_guardian', free.linkId)).error).toBeNull();
  });

  it('no absence record was changed by any of these attempts', async () => {
    const { data } = await service.from('absence_records').select('status').eq('organization_id', alfa.orgId);
    expect(data!.map((r) => r.status).sort()).toEqual(['active', 'active', 'active', 'active', 'active']);
  });
});
