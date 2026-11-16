// D3-B through the real API: a guardian with can_report_absence reports a date range (no reason field exists at
// all), the educator of the group and the other guardian see it, a guardian without the right or another family is
// refused, cancelling keeps history, a manager records on behalf. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
const ids: Record<string, string> = {};
const accounts: Record<string, string> = {};
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function guardian(key: string, child: string, rights: { report: boolean }): Promise<void> {
  accounts[key] = email(`izo-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: accounts[key], email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
  const { data: g } = await manager.from('guardians').insert({ organization_id: alfa.orgId, first_name: key, last_name: 'Izostanak' }).select('id').single().throwOnError();
  await service.from('guardians').update({ profile_id: user.user!.id }).eq('id', g!.id).throwOnError();
  await service
    .from('child_guardians')
    .insert({ organization_id: alfa.orgId, child_id: child, guardian_id: g!.id, can_view: true, can_report_absence: rights.report, valid_during: '[2026-09-01,)' })
    .throwOnError();
}
const client = async (key: string) => (await signInWithCode(accounts[key]!)).client;

beforeAll(async () => {
  alfa = await createKindergarten('izo-a');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  for (const name of ['Lea', 'Mia']) {
    const { data } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: name, last_name: 'Izostanak' }).select('id').single().throwOnError();
    ids[name] = data!.id as string;
    await service.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids[name], group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  }
  await guardian('ana', ids.Lea!, { report: true });
  await guardian('bruno', ids.Lea!, { report: false });
  await guardian('dora', ids.Mia!, { report: true });
});

describe('D3-B: absences through the API', () => {
  it('a guardian reports a range; the request carries no reason (there is no such parameter)', async () => {
    const ana = await client('ana');
    const { data, error } = await ana.schema('api').rpc('report_absence', { p_child_id: ids.Lea!, p_starts_on: day(1), p_ends_on: day(3) });
    expect(error).toBeNull();
    ids.report = data as string;
    const withReason = await ana.schema('api').rpc('report_absence', { p_child_id: ids.Lea!, p_starts_on: day(5), p_ends_on: day(5), p_reason: 'bolest' } as never);
    expect(withReason.error).not.toBeNull();
  });

  it('the educator of the group and the other guardian see it; another family does not', async () => {
    const edu = (await signInWithCode(alfa.educatorEmail)).client;
    expect((await edu.from('absence_records').select('id').eq('child_id', ids.Lea!)).data).toEqual([{ id: ids.report }]);
    const bruno = await client('bruno');
    expect((await bruno.from('absence_records').select('starts_on, ends_on, status')).data).toEqual([{ starts_on: day(1), ends_on: day(3), status: 'active' }]);
    const dora = await client('dora');
    expect((await dora.from('absence_records').select('id')).data).toEqual([]);
  });

  it('without can_report_absence, or for another family, the report is refused (NEG-04, AC-06-3)', async () => {
    const bruno = await client('bruno');
    expect((await bruno.schema('api').rpc('report_absence', { p_child_id: ids.Lea!, p_starts_on: day(6), p_ends_on: day(6) })).error?.code).toBe('42501');
    const dora = await client('dora');
    expect((await dora.schema('api').rpc('report_absence', { p_child_id: ids.Lea!, p_starts_on: day(6), p_ends_on: day(6) })).error?.code).toBe('42501');
    expect((await dora.from('absence_records').insert({ organization_id: alfa.orgId, child_id: ids.Lea!, starts_on: day(6), ends_on: day(6) } as never)).error).not.toBeNull();
  });

  it('business errors are shown with their code; cancelling keeps history', async () => {
    const ana = await client('ana');
    const overlap = await ana.schema('api').rpc('report_absence', { p_child_id: ids.Lea!, p_starts_on: day(2), p_ends_on: day(2) });
    expect([overlap.error?.code, overlap.error?.message]).toEqual(['P0001', 'ABSENCE_OVERLAP']);
    expect((await ana.schema('api').rpc('cancel_absence', { p_absence_id: ids.report! })).error).toBeNull();
    const { data } = await ana.from('absence_records').select('status, cancelled_at').eq('id', ids.report!).single();
    expect(data!.status).toBe('cancelled');
    expect(data!.cancelled_at).not.toBeNull();
  });

  it('a manager records on behalf of a guardian; the source says so', async () => {
    const { data, error } = await manager.schema('api').rpc('record_absence_on_behalf', { p_child_id: ids.Mia!, p_starts_on: day(0), p_ends_on: day(0) });
    expect(error).toBeNull();
    const { data: row } = await manager.from('absence_records').select('source').eq('id', data as string).single();
    expect(row!.source).toBe('staff_on_behalf');
  });

  it('every report and cancellation is audited without names', async () => {
    const { data } = await service.from('audit_events').select('actor_role, details').eq('organization_id', alfa.orgId).eq('target_table', 'absence_records');
    expect(data!.length).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(data)).not.toMatch(/Lea|Mia|Izostanak/);
  });
});
