// D3-A through the real API: educators record arrival and departure with one call each; a replayed key returns the
// stored event (offline queue, SR-API-08); two educators recording the same child at the same moment produce exactly
// one arrival (the other gets ATTENDANCE_STATE_CONFLICT); undo within 10 s; corrections need a reason; guardians and
// other kindergartens cannot record. Synthetic accounts only.
import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
let edu1: Client;
let edu2: Client;
const ids: Record<string, string> = {};
const accounts: Record<string, string> = {};

async function account(key: string, role: 'educator' | 'guardian'): Promise<{ userId: string; membershipId: string }> {
  accounts[key] = email(`dol-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: accounts[key], email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  const { data: m } = await service
    .from('memberships')
    .insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role, valid_during: '[2026-01-01,)' })
    .select('id')
    .single()
    .throwOnError();
  return { userId: user.user!.id as string, membershipId: m!.id as string };
}
const record = (client: Client, child: string, kind: 'check_in' | 'check_out', key = randomUUID()) =>
  client.schema('api').rpc('record_attendance', { p_child_id: child, p_kind: kind, p_idempotency_key: key });

beforeAll(async () => {
  alfa = await createKindergarten('dol-a');
  beta = await createKindergarten('dol-b');
  const m = await signInWithCode(alfa.managerEmail);
  manager = m.client;
  await enrolMfa(m.client);
  const second = await account('edu2', 'educator');
  const parent = await account('roditelj', 'guardian');
  for (const membership of [alfa.educatorMembershipId, second.membershipId]) {
    await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: membership, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  }
  for (const name of ['Lea', 'Ivo']) {
    const { data } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: name, last_name: 'Dolazak' }).select('id').single().throwOnError();
    ids[name] = data!.id as string;
    await manager.from('enrollments').insert({ organization_id: alfa.orgId, child_id: ids[name], group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  }
  const { data: g } = await manager.from('guardians').insert({ organization_id: alfa.orgId, first_name: 'Ana', last_name: 'Dolazak' }).select('id').single().throwOnError();
  await service.from('guardians').update({ profile_id: parent.userId }).eq('id', g!.id).throwOnError();
  await manager.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: ids.Lea, guardian_id: g!.id, can_view: true, valid_during: '[2026-09-01,)' }).throwOnError();
  edu1 = (await signInWithCode(alfa.educatorEmail)).client;
  edu2 = (await signInWithCode(accounts.edu2!)).client;
});

describe('D3-A: attendance through the API', () => {
  it('one call records an arrival; the same key again returns the stored event (AC-05-2)', async () => {
    const key = randomUUID();
    const first = await record(edu1, ids.Lea!, 'check_in', key);
    expect(first.error).toBeNull();
    expect(first.data![0]!.replayed).toBe(false);
    const again = await record(edu1, ids.Lea!, 'check_in', key);
    expect(again.data![0]).toMatchObject({ record_id: first.data![0]!.record_id, replayed: true });
    const { data } = await manager.from('attendance_records').select('id').eq('child_id', ids.Lea!);
    expect(data).toHaveLength(1);
  });

  it('two educators recording the same arrival at once: exactly one succeeds, the other gets a conflict (FR-05-8)', async () => {
    const [a, b] = await Promise.all([record(edu1, ids.Ivo!, 'check_in'), record(edu2, ids.Ivo!, 'check_in')]);
    const outcomes = [a, b].map((r) => (r.error ? r.error.message : 'ok')).sort();
    expect(outcomes).toEqual(['ATTENDANCE_STATE_CONFLICT', 'ok']);
    const { data } = await manager.from('attendance_records').select('id').eq('child_id', ids.Ivo!);
    expect(data).toHaveLength(1);
  });

  it('the recorder undoes within 10 s without a reason; nobody else can', async () => {
    const out = await record(edu1, ids.Lea!, 'check_out');
    const recordId = out.data![0]!.record_id;
    expect((await edu2.schema('api').rpc('undo_attendance', { p_record_id: recordId, p_idempotency_key: randomUUID() })).error?.code).toBe('42501');
    expect((await edu1.schema('api').rpc('undo_attendance', { p_record_id: recordId, p_idempotency_key: randomUUID() })).error).toBeNull();
    const { data } = await manager.from('attendance_records').select('kind').eq('corrects_id', recordId);
    expect(data).toEqual([{ kind: 'void' }]);
  });

  it('a later correction needs a reason and keeps the original event', async () => {
    const { data: rows } = await manager.from('attendance_records').select('id').eq('child_id', ids.Ivo!).eq('kind', 'check_in');
    const original = rows![0]!.id;
    const noReason = await edu1.schema('api').rpc('correct_attendance', { p_record_id: original, p_reason: null as never, p_idempotency_key: randomUUID() });
    expect(noReason.error?.code).toBe('22023');
    const ok = await edu1.schema('api').rpc('correct_attendance', { p_record_id: original, p_reason: 'entry_error', p_idempotency_key: randomUUID() });
    expect(ok.error).toBeNull();
    const { data } = await manager.from('attendance_records').select('kind, correction_reason').eq('child_id', ids.Ivo!).order('recorded_at');
    expect(data).toEqual([
      { kind: 'check_in', correction_reason: null },
      { kind: 'void', correction_reason: 'entry_error' },
    ]);
  });

  it('guardians and other kindergartens cannot record; guardians read no event row', async () => {
    const parent = (await signInWithCode(accounts.roditelj!)).client;
    expect((await record(parent, ids.Lea!, 'check_out')).error?.code).toBe('42501');
    expect((await parent.from('attendance_records').select('id')).data).toEqual([]);
    const mgrB = await signInWithCode(beta.managerEmail);
    await enrolMfa(mgrB.client);
    expect((await record(mgrB.client, ids.Lea!, 'check_out')).error?.code).toBe('42501');
    expect((await mgrB.client.from('attendance_records').select('id').eq('organization_id', alfa.orgId)).data).toEqual([]);
  });

  it('D3-C: the guardian sees today\'s status and time without any staff data; staff see the last event', async () => {
    const parent = (await signInWithCode(accounts.roditelj!)).client;
    const { data, error } = await parent.schema('api').rpc('child_day_status', {});
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({ child_id: ids.Lea, status: 'present', last_record_id: null, last_record_kind: null });
    expect(data![0]!.arrived_at).not.toBeNull();
    expect(JSON.stringify(data)).not.toMatch(/recorded_by/);
    const staff = await edu1.schema('api').rpc('child_day_status', { p_group_id: alfa.groupId });
    const rows = (staff.data ?? []) as { child_id: string; status: string; last_record_kind: string | null }[];
    expect(rows.map((r) => r.status).sort()).toEqual(['expected', 'present']);
    expect(rows.find((r) => r.child_id === ids.Lea)!.last_record_kind).toBe('check_in');
  });

  it('nobody can change or delete an event through the API', async () => {
    const upd = await manager.from('attendance_records').update({ occurred_at: new Date().toISOString() }).eq('child_id', ids.Lea!);
    expect(upd.error).not.toBeNull();
    const del = await manager.from('attendance_records').delete().eq('child_id', ids.Lea!);
    expect(del.error).not.toBeNull();
  });
});
