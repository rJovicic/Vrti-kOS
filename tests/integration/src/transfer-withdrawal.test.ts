// D2-E through the real API (PostgREST `api` schema): transfer and withdrawal are manager-only RPCs; access of the
// educators changes on the next request; withdrawal ends enrolment, guardian links and pickup authorizations with the
// last day (D-35); dates in the past are refused (D-36); refused calls change nothing. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
const ids: Record<string, string> = {};
const accounts: Record<string, string> = {};
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const today = day(0);

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await manager.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

/** A synthetic account with a membership in Alfa (created server-side, as in the other integration tests). */
async function account(key: string, role: 'educator' | 'guardian'): Promise<string> {
  accounts[key] = email(`pr-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: accounts[key], email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  const { data: m } = await service
    .from('memberships')
    .insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role, valid_during: '[2026-01-01,)' })
    .select('id')
    .single()
    .throwOnError();
  ids[`${key}Membership`] = m!.id as string;
  return user.user!.id as string;
}

async function childrenOf(emailAddress: string): Promise<string[]> {
  const { client } = await signInWithCode(emailAddress);
  return ((await client.from('children').select('first_name').order('first_name')).data ?? []).map((c) => c.first_name);
}

const rpc = (fn: 'transfer_child' | 'withdraw_child', args: Record<string, unknown>, client = manager) => client.schema('api').rpc(fn, args);

beforeAll(async () => {
  alfa = await createKindergarten('pw-a');
  beta = await createKindergarten('pw-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  const { data: g } = await service.from('groups').select('facility_id, academic_year_id').eq('id', alfa.groupId).single().throwOnError();
  const { data: s2 } = await service
    .from('groups')
    .insert({ organization_id: alfa.orgId, facility_id: g!.facility_id, academic_year_id: g!.academic_year_id, name: 'Dupini' })
    .select('id')
    .single()
    .throwOnError();
  ids.s2 = s2!.id as string;
  await account('edu2', 'educator');
  const parentId = await account('roditelj', 'guardian');
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: ids.edu2Membership, group_id: ids.s2, valid_during: '[2026-01-01,)' }).throwOnError();
  for (const name of ['Ivo', 'Ola']) {
    ids[name] = await insert('children', { organization_id: alfa.orgId, first_name: name, last_name: 'Premjestaj' });
    await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids[name], group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  }
  ids.guardian = await insert('guardians', { organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Skrbnik' });
  await service.from('guardians').update({ profile_id: parentId }).eq('id', ids.guardian).throwOnError();
  for (const child of ['Ivo', 'Ola']) {
    ids[`link${child}`] = await insert('child_guardians', { organization_id: alfa.orgId, child_id: ids[child], guardian_id: ids.guardian, can_view: true, can_report_absence: false, receives_messages: true, valid_during: '[2026-09-01,)' });
    ids[`pickup${child}`] = await insert('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids[child], first_name: 'Mara', last_name: 'Baka', valid_during: '[2026-09-01,)' });
  }
});

describe('D2-E: transfer and withdrawal through the API', () => {
  it('only a manager of the kindergarten may call the RPCs; refused calls change nothing', async () => {
    const edu = await signInWithCode(alfa.educatorEmail);
    expect((await rpc('transfer_child', { p_child_id: ids.Ivo, p_group_id: ids.s2, p_effective_on: today }, edu.client)).error?.code).toBe('42501');
    const parent = await signInWithCode(accounts.roditelj!);
    expect((await rpc('withdraw_child', { p_child_id: ids.Ivo, p_last_day: today }, parent.client)).error?.code).toBe('42501');
    const mgrB = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgrB.client);
    expect((await rpc('withdraw_child', { p_child_id: ids.Ivo, p_last_day: today }, mgrB.client)).error?.code).toBe('42501');
    expect((await rpc('transfer_child', { p_child_id: ids.Ivo, p_group_id: beta.groupId, p_effective_on: today })).error?.code).toBe('42501');
    const { data } = await manager.from('enrollments').select('group_id').eq('child_id', ids.Ivo);
    expect(data).toEqual([{ group_id: alfa.groupId }]);
  });

  it('business errors carry a code the client can show (D-36: no dates in the past)', async () => {
    const past = await rpc('transfer_child', { p_child_id: ids.Ivo, p_group_id: ids.s2, p_effective_on: day(-1) });
    expect([past.error?.code, past.error?.message]).toEqual(['P0001', 'EFFECTIVE_DATE_IN_PAST']);
    const same = await rpc('transfer_child', { p_child_id: ids.Ivo, p_group_id: alfa.groupId, p_effective_on: today });
    expect(same.error?.message).toBe('TRANSFER_SAME_GROUP');
    expect((await rpc('withdraw_child', { p_child_id: ids.Ola, p_last_day: day(-1) })).error?.message).toBe('EFFECTIVE_DATE_IN_PAST');
  });

  it('a transfer from today moves educator access on the next request and keeps history, links and pickup persons', async () => {
    expect(await childrenOf(alfa.educatorEmail)).toEqual(['Ivo', 'Ola']);
    const { data: newId, error } = await rpc('transfer_child', { p_child_id: ids.Ivo, p_group_id: ids.s2, p_effective_on: today });
    expect(error).toBeNull();
    expect(typeof newId).toBe('string');
    expect(await childrenOf(alfa.educatorEmail)).toEqual(['Ola']);
    expect(await childrenOf(accounts.edu2!)).toEqual(['Ivo']);
    const { data: periods } = await manager.from('enrollments').select('group_id, valid_during').eq('child_id', ids.Ivo).order('valid_during');
    expect(periods).toEqual([
      { group_id: alfa.groupId, valid_during: `[2026-09-01,${today})` },
      { group_id: ids.s2, valid_during: `[${today},)` },
    ]);
    const parent = await signInWithCode(accounts.roditelj!);
    expect((await parent.client.from('child_guardians').select('can_report_absence, receives_messages').eq('child_id', ids.Ivo)).data).toEqual([
      { can_report_absence: false, receives_messages: true },
    ]);
    const edu2 = await signInWithCode(accounts.edu2!);
    expect(((await edu2.client.from('pickup_authorizations').select('first_name')).data ?? []).map((p) => p.first_name)).toEqual(['Mara']);
  });

  it('withdrawal with today as the last day closes enrolment, link and pickup person at today; nothing is deleted', async () => {
    const { error } = await rpc('withdraw_child', { p_child_id: ids.Ola, p_last_day: today });
    expect(error).toBeNull();
    const tomorrow = day(1);
    expect((await manager.from('children').select('status, withdrawn_on').eq('id', ids.Ola).single()).data).toEqual({ status: 'withdrawn', withdrawn_on: today });
    expect((await manager.from('enrollments').select('valid_during').eq('child_id', ids.Ola)).data).toEqual([{ valid_during: `[2026-09-01,${tomorrow})` }]);
    expect((await manager.from('child_guardians').select('valid_during, can_view').eq('id', ids.linkOla!).single()).data).toEqual({ valid_during: `[2026-09-01,${tomorrow})`, can_view: true });
    expect((await manager.from('pickup_authorizations').select('valid_during').eq('id', ids.pickupOla!).single()).data).toEqual({ valid_during: `[2026-09-01,${tomorrow})` });
    // The last day still counts: educator and guardian see Ola today, and lose her tomorrow by date.
    expect(await childrenOf(alfa.educatorEmail)).toEqual(['Ola']);
    expect(await childrenOf(accounts.roditelj!)).toEqual(['Ivo', 'Ola']);
  });

  it('nothing can be reopened after withdrawal', async () => {
    expect((await rpc('withdraw_child', { p_child_id: ids.Ola, p_last_day: today })).error?.message).toBe('CHILD_WITHDRAWN');
    expect((await rpc('transfer_child', { p_child_id: ids.Ola, p_group_id: ids.s2, p_effective_on: today })).error?.message).toBe('CHILD_WITHDRAWN');
    const reopen = await manager.from('child_guardians').update({ valid_during: '[2026-09-01,)' }).eq('id', ids.linkOla!);
    expect([reopen.error?.code, reopen.error?.message]).toEqual(['P0001', 'CHILD_WITHDRAWN']);
    const pickup = await manager.from('pickup_authorizations').insert({ organization_id: alfa.orgId, child_id: ids.Ola, first_name: 'Nova', last_name: 'Osoba', valid_during: `[${today},)` });
    expect(pickup.error?.message).toBe('CHILD_WITHDRAWN');
    const status = await manager.from('children').update({ status: 'active' }).eq('id', ids.Ola);
    expect(status.error).not.toBeNull();
  });

  it('a manual change never rewrites past enrolment days (D-36)', async () => {
    const { data } = await manager.from('enrollments').select('id').eq('child_id', ids.Ivo).eq('group_id', ids.s2).single();
    const r = await manager.from('enrollments').update({ valid_during: `[${day(-5)},)` }).eq('id', data!.id);
    expect(r.error?.message).toBe('HISTORY_IMMUTABLE');
    expect((await manager.from('enrollments').update({ valid_during: `[${today},${day(30)})` }).eq('id', data!.id)).error).toBeNull();
  });

  it('every operation is audited with the actor role and without names', async () => {
    const { data } = await service.from('audit_events').select('action, actor_role, details').eq('organization_id', alfa.orgId).in('action', ['child.transfer', 'child.withdraw']);
    expect(data!.map((r) => r.action).sort()).toEqual(['child.transfer', 'child.withdraw']);
    expect(data!.every((r) => r.actor_role === 'org_admin')).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/Ivo|Ola|Ana|Mara|Galebovi|Dupini/);
  });
});
