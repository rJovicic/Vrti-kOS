// D-37 through the real API: a manager with MFA cancels a record that has not taken effect; records in effect are
// refused; no other role and no direct DELETE can do it; the cancellation is audited with id, type, actor and reason
// code only. Realistic case: a planned transfer is undone and the child can then be withdrawn. Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
const ids: Record<string, string> = {};
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

async function insert(table: string, row: Record<string, unknown>): Promise<string> {
  const { data, error } = await manager.from(table).insert(row).select('id').single();
  if (error) throw error;
  return data!.id as string;
}
const cancel = (p_kind: string, p_record_id: string, p_reason = 'plan_changed', client = manager) =>
  client.schema('api').rpc('cancel_future_record', { p_kind, p_record_id, p_reason });

beforeAll(async () => {
  alfa = await createKindergarten('cf-a');
  beta = await createKindergarten('cf-b');
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
  ids.ivo = await insert('children', { organization_id: alfa.orgId, first_name: 'Ivo', last_name: 'Ponistenje' });
  ids.current = await insert('enrollments', { organization_id: alfa.orgId, child_id: ids.ivo, group_id: alfa.groupId, valid_during: '[2026-09-01,)' });
  ids.pickupNow = await insert('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.ivo, first_name: 'Mara', last_name: 'Baka', valid_during: '[2026-09-01,)' });
  ids.pickupLater = await insert('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.ivo, first_name: 'Iva', last_name: 'Teta', valid_during: `[${day(3)},)` });
});

describe('D-37: cancelling records that have not taken effect', () => {
  it('a planned transfer blocks an earlier withdrawal until the planned enrolment is cancelled', async () => {
    const { data: planned } = await manager.schema('api').rpc('transfer_child', { p_child_id: ids.ivo, p_group_id: ids.s2, p_effective_on: day(10) });
    ids.planned = planned as string;
    expect((await manager.schema('api').rpc('withdraw_child', { p_child_id: ids.ivo, p_last_day: day(5) })).error?.message).toBe('WITHDRAWAL_HAS_FUTURE_RECORDS');
  });

  it('nobody but a manager with MFA can cancel, and DELETE is not available at all', async () => {
    const edu = await signInWithCode(alfa.educatorEmail);
    expect((await cancel('enrollment', ids.planned!, 'plan_changed', edu.client)).error?.code).toBe('42501');
    const mgrB = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgrB.client);
    expect((await cancel('enrollment', ids.planned!, 'plan_changed', mgrB.client)).error?.code).toBe('42501');
    const del = await manager.from('enrollments').delete().eq('id', ids.planned!);
    expect(del.error?.code).toBe('42501');
    expect((await cancel('enrollment', ids.planned!, 'Ivo se seli u Pulu')).error).not.toBeNull();
    expect((await manager.from('enrollments').select('id').eq('id', ids.planned!)).data).toHaveLength(1);
  });

  it('records in effect are refused', async () => {
    expect((await cancel('enrollment', ids.current!)).error?.message).toBe('RECORD_ALREADY_EFFECTIVE');
    expect((await cancel('pickup_authorization', ids.pickupNow!)).error?.message).toBe('RECORD_ALREADY_EFFECTIVE');
  });

  it('the manager cancels the planned enrolment, reopens the current one for future days and withdraws', async () => {
    expect((await cancel('enrollment', ids.planned!)).error).toBeNull();
    expect((await cancel('pickup_authorization', ids.pickupLater!, 'withdrawal_planned')).error).toBeNull();
    await manager.from('enrollments').update({ valid_during: '[2026-09-01,)' }).eq('id', ids.current!).throwOnError();
    expect((await manager.schema('api').rpc('withdraw_child', { p_child_id: ids.ivo, p_last_day: day(5) })).error).toBeNull();
    const { data } = await manager.from('enrollments').select('id, valid_during').eq('child_id', ids.ivo);
    expect(data).toEqual([{ id: ids.current, valid_during: `[2026-09-01,${day(6)})` }]);
    expect((await manager.from('pickup_authorizations').select('first_name').eq('child_id', ids.ivo)).data).toEqual([{ first_name: 'Mara' }]);
  });

  it('cancellations are audited with id, type, actor role and reason code, without names', async () => {
    const { data } = await service.from('audit_events').select('target_id, target_table, actor_role, details, occurred_at').eq('organization_id', alfa.orgId).eq('action', 'record.cancel');
    expect(data!.map((r) => [r.target_id, r.target_table, r.details.reason]).sort()).toEqual(
      [
        [ids.planned, 'enrollments', 'plan_changed'],
        [ids.pickupLater, 'pickup_authorizations', 'withdrawal_planned'],
      ].sort(),
    );
    expect(data!.every((r) => r.actor_role === 'org_admin' && r.occurred_at)).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/Ivo|Mara|Iva|Teta|Dupini/);
  });
});
