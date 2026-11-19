// D-41b through the real API (PostgREST): an org_admin with MFA corrects the past of a pickup authorization with a
// reason code and a note; the evidence row is readable by managers with MFA only; the audit event carries no note and no
// name; an educator, a manager without MFA and a manager of another kindergarten are refused; a person recorded at a
// handover keeps the recorded name; direct writes to the evidence are refused. Fixtures "entered on an earlier day" use
// the service key (D-41a). Synthetic only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, enrolMfa, service, signInWithCode } from './helpers.ts';

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Awaited<ReturnType<typeof signInWithCode>>['client'];
const ids: Record<string, string> = {};
const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const NOTE = 'Ovlaštenje je prema zapisniku počelo ranije.';

async function fixture(table: string, row: Record<string, unknown>): Promise<string> {
  const { data } = await service.from(table).insert(row).select('id').single().throwOnError();
  return data!.id as string;
}
const correct = (client: typeof manager, recordId: string, range: string, extra: Record<string, unknown> = {}) =>
  client.schema('api').rpc('correct_relationship_history', {
    p_record_type: 'pickup_authorization',
    p_record_id: recordId,
    p_new_valid_during: range,
    p_reason_code: 'wrong_date_recorded',
    p_note: NOTE,
    ...extra,
  });

beforeAll(async () => {
  alfa = await createKindergarten('hc-a');
  beta = await createKindergarten('hc-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  ids.child = await fixture('children', { organization_id: alfa.orgId, first_name: 'Ivo', last_name: 'Ispravak' });
  await fixture('enrollments', { organization_id: alfa.orgId, child_id: ids.child, group_id: alfa.groupId, valid_during: `[${day(-30)},)` });
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: `[${day(-30)},)` }).throwOnError();
  ids.unused = await fixture('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.child, first_name: 'Ivna', last_name: 'Teta', valid_during: `[${day(-20)},)` });
  ids.used = await fixture('pickup_authorizations', { organization_id: alfa.orgId, child_id: ids.child, first_name: 'Mara', last_name: 'Baka', valid_during: `[${day(-20)},)` });
  await service.from('attendance_records').insert({
    organization_id: alfa.orgId, child_id: ids.child, kind: 'check_in', occurred_at: `${day(-5)}T07:30:00Z`, local_date: day(-5),
    recorded_by: (await service.from('memberships').select('profile_id').eq('id', alfa.educatorMembershipId).single()).data!.profile_id,
    source: 'app', idempotency_key: crypto.randomUUID(), handover_pickup_id: ids.used,
  }).throwOnError();
});

describe('D-41b: historical correction through the API', () => {
  it('only a manager of the kindergarten with MFA may correct', async () => {
    const edu = await signInWithCode(alfa.educatorEmail);
    expect((await correct(edu.client, ids.unused!, `[${day(-40)},)`)).error?.code).toBe('42501');
    const noMfa = await signInWithCode(alfa.managerEmail);
    expect((await correct(noMfa.client, ids.unused!, `[${day(-40)},)`)).error?.code).toBe('42501');
    const mgrB = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgrB.client);
    expect((await correct(mgrB.client, ids.unused!, `[${day(-40)},)`)).error?.code).toBe('42501');
  });

  it('a correction with reason and note is applied, recorded and audited without the note', async () => {
    const { data: correctionId, error } = await correct(manager, ids.unused!, `[${day(-40)},)`, { p_new_first_name: 'Iva', p_new_last_name: 'Teta' });
    expect(error).toBeNull();
    const { data: row } = await service.from('pickup_authorizations').select('first_name, valid_during').eq('id', ids.unused!).single().throwOnError();
    expect(row).toEqual({ first_name: 'Iva', valid_during: `[${day(-40)},)` });
    const { data: evidence } = await manager.from('history_corrections').select('id, reason_code, note, corrected_role, aal').eq('id', correctionId as string);
    expect(evidence).toEqual([{ id: correctionId, reason_code: 'wrong_date_recorded', note: NOTE, corrected_role: 'org_admin', aal: 'aal2' }]);
    const { data: audit } = await service.from('audit_events').select('details').eq('action', 'history.corrected').eq('organization_id', alfa.orgId);
    expect(audit).toHaveLength(1);
    expect(JSON.stringify(audit)).not.toMatch(/zapisniku|Iva|Ivna|Teta/);
  });

  it('a person recorded at a handover keeps the name; the evidence cannot be changed', async () => {
    const r = await correct(manager, ids.used!, `[${day(-20)},)`, { p_new_first_name: 'Marija', p_new_last_name: 'Baka' });
    expect(r.error?.message).toBe('CORRECTION_NAME_IN_USE');
    expect((await correct(manager, ids.used!, `[${day(-3)},)`)).error?.message).toBe('CORRECTION_CONFLICTS');
    expect((await manager.from('history_corrections').update({ note: 'promijenjeno bez traga' }).eq('organization_id', alfa.orgId)).error).not.toBeNull();
    expect((await manager.from('history_corrections').delete().eq('organization_id', alfa.orgId)).error).not.toBeNull();
    const noMfa = await signInWithCode(alfa.managerEmail);
    expect((await noMfa.client.from('history_corrections').select('id')).data).toEqual([]);
  });
});
