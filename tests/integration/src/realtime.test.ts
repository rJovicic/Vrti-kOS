// D-43: live updates through Supabase Realtime private Broadcast, against the real local Realtime server
// (migration 20261119150000_realtime_broadcast.sql; docs/architecture/realtime.md). Every check subscribes exactly as
// the apps do (private personal topic) and observes what the server actually delivers. Revocation is tested with the
// subscription kept OPEN. Synthetic accounts only.
import { randomUUID } from 'node:crypto';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { subscribeLiveEvents } from '@vrticos/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode, stack } from './helpers.ts';

type Client = SupabaseClient;
interface Listener {
  userId: string;
  events: Array<Record<string, unknown>>;
  channel: RealtimeChannel;
  status: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(pred: () => boolean, ms = 8000): Promise<boolean> {
  for (let t = 0; t < ms; t += 100) {
    if (pred()) return true;
    await sleep(100);
  }
  return pred();
}
/** Quiet period: long enough for a delivered event to arrive (local delivery takes well under a second). */
const QUIET_MS = 2500;

function join(channel: RealtimeChannel, ms = 10_000): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('TIMED_OUT'), ms);
    channel.subscribe((status) => {
      if (status !== 'SUBSCRIBED' && status !== 'CHANNEL_ERROR' && status !== 'CLOSED') return;
      clearTimeout(timer);
      resolve(status);
    });
  });
}

async function userIdOf(client: Client): Promise<string> {
  const { data } = await client.auth.getUser();
  return data.user!.id;
}

/** Subscribes `client` to `user:<topicOwner>` (default: its own topic) as a private channel. */
async function listen(client: Client, topicOwner?: string, isPrivate = true): Promise<Listener> {
  await client.realtime.setAuth();
  const userId = topicOwner ?? (await userIdOf(client));
  const events: Listener['events'] = [];
  const channel = client.channel(`user:${userId}`, { config: { private: isPrivate } });
  channel.on('broadcast', { event: '*' }, (m) => events.push(m.payload as Record<string, unknown>));
  const status = await join(channel);
  return { userId, events, channel, status };
}

const kinds = (l: Listener, kind: string) => l.events.filter((e) => e.kind === kind);

let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let beta: Awaited<ReturnType<typeof createKindergarten>>;
let managerA: Client;
let managerB: Client;
let edu1: Client;
let edu2: Client;
let eduB: Client;
let g1: Client;
let g2: Client;
let outsider: Client;
let group2: string;
let child1: string;
let child2: string;
let childB: string;
let link1: string;
let edu1Assignment: string;
const clients: Client[] = [];

async function account(orgId: string, key: string, role: 'educator' | 'guardian'): Promise<{ userId: string; membershipId: string; address: string }> {
  const address = email(`rt-${key}`);
  const { data } = await service.auth.admin.createUser({ email: address, email_confirm: true });
  await service.from('profiles').insert({ id: data.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  const { data: m } = await service.from('memberships').insert({ organization_id: orgId, profile_id: data.user!.id, role, valid_during: '[2026-01-01,)' }).select('id').single().throwOnError();
  return { userId: data.user!.id, membershipId: m!.id as string, address };
}
async function child(orgId: string, groupId: string, name: string): Promise<string> {
  const { data } = await service.from('children').insert({ organization_id: orgId, first_name: name, last_name: 'Uzivo' }).select('id').single().throwOnError();
  await service.from('enrollments').insert({ organization_id: orgId, child_id: data!.id, group_id: groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  return data!.id as string;
}
async function guardianLink(orgId: string, childId: string, profileId: string, name: string): Promise<{ guardianId: string; linkId: string }> {
  const { data: g } = await service.from('guardians').insert({ organization_id: orgId, profile_id: profileId, first_name: name, last_name: 'Uzivo' }).select('id').single().throwOnError();
  const { data: l } = await service
    .from('child_guardians')
    .insert({ organization_id: orgId, child_id: childId, guardian_id: g!.id, can_view: true, receives_messages: true, valid_during: '[2026-09-01,)' })
    .select('id')
    .single()
    .throwOnError();
  return { guardianId: g!.id as string, linkId: l!.id as string };
}
const signed = async (address: string) => {
  const c = (await signInWithCode(address)).client;
  clients.push(c);
  return c;
};
const arrive = (c: Client, childId: string, kind: 'check_in' | 'check_out' = 'check_in', key = randomUUID()) =>
  c.schema('api').rpc('record_attendance', { p_child_id: childId, p_kind: kind, p_idempotency_key: key });

beforeAll(async () => {
  alfa = await createKindergarten('rt-a');
  beta = await createKindergarten('rt-b');
  const { data: g } = await service.from('groups').select('facility_id, academic_year_id').eq('id', alfa.groupId).single().throwOnError();
  const { data: grp2 } = await service.from('groups').insert({ organization_id: alfa.orgId, facility_id: g!.facility_id, academic_year_id: g!.academic_year_id, name: 'Školjke' }).select('id').single().throwOnError();
  group2 = grp2!.id as string;
  const e2 = await account(alfa.orgId, 'edu2', 'educator');
  managerA = await signed(alfa.managerEmail);
  await enrolMfa(managerA);
  managerB = await signed(beta.managerEmail);
  await enrolMfa(managerB);
  const { data: a1 } = await managerA.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).select('id').single().throwOnError();
  edu1Assignment = a1!.id as string;
  await managerA.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: e2.membershipId, group_id: group2, valid_during: '[2026-01-01,)' }).throwOnError();
  await managerB.from('staff_assignments').insert({ organization_id: beta.orgId, membership_id: beta.educatorMembershipId, group_id: beta.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  child1 = await child(alfa.orgId, alfa.groupId, 'Lea');
  child2 = await child(alfa.orgId, alfa.groupId, 'Ivo');
  childB = await child(beta.orgId, beta.groupId, 'Mia');
  const p1 = await account(alfa.orgId, 'g1', 'guardian');
  const p2 = await account(alfa.orgId, 'g2', 'guardian');
  const px = await account(beta.orgId, 'gx', 'guardian');
  link1 = (await guardianLink(alfa.orgId, child1, p1.userId, 'Ana')).linkId;
  await guardianLink(alfa.orgId, child1, p2.userId, 'Marko');
  await guardianLink(beta.orgId, childB, px.userId, 'Vanjski');

  edu1 = await signed(alfa.educatorEmail);
  edu2 = await signed(e2.address);
  eduB = await signed(beta.educatorEmail);
  g1 = await signed(p1.address);
  g2 = await signed(p2.address);
  outsider = await signed(px.address);
}, 120_000);

afterAll(async () => {
  for (const c of clients) await c.removeAllChannels();
});

describe('D-43: Realtime private Broadcast (local Realtime server)', () => {
  it('an arrival recorded by the educator reaches the manager live, and the refetch shows it', async () => {
    const m = await listen(managerA);
    const b = await listen(managerB);
    expect(m.status).toBe('SUBSCRIBED');
    const { data, error } = await arrive(edu1, child1);
    expect(error).toBeNull();
    const recordId = (data as Array<{ record_id: string }>)[0]!.record_id;
    expect(await waitFor(() => kinds(m, 'attendance').some((e) => e.record_id === recordId))).toBe(true);
    const event = kinds(m, 'attendance')[0]!;
    expect(Object.keys(event).sort()).toEqual(['child_id', 'id', 'kind', 'local_date', 'organization_id', 'record_id']);
    // The hint triggers a refetch through the normal API (RLS + MFA decide again).
    const { data: rows } = await managerA.from('attendance_records').select('id').eq('id', recordId);
    expect(rows).toEqual([{ id: recordId }]);
    await sleep(QUIET_MS);
    expect(b.events).toEqual([]);
    await managerA.removeAllChannels();
    await managerB.removeAllChannels();
  });

  it('a message reaches only the participants of that conversation; the second guardian gets nothing', async () => {
    const l1 = await listen(g1);
    const l2 = await listen(g2);
    const le = await listen(edu1);
    const { data: conv } = await g1.schema('api').rpc('open_conversation', { p_child_id: child1 });
    expect((await g1.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'Lea danas ide ranije.' })).error).toBeNull();
    expect(await waitFor(() => kinds(le, 'message').length === 1 && kinds(le, 'notification').length === 1)).toBe(true);
    expect(await waitFor(() => kinds(l1, 'message').length === 1)).toBe(true);
    await sleep(QUIET_MS);
    expect(l2.events).toEqual([]);
    expect(JSON.stringify([...l1.events, ...le.events])).not.toContain('ranije');
    for (const c of [g1, g2, edu1]) await c.removeAllChannels();
  });

  it('a published announcement reaches its audience and the managers, not another group or kindergarten', async () => {
    const lm = await listen(managerA);
    const l2 = await listen(edu2);
    const l1 = await listen(edu1);
    const lb = await listen(eduB);
    const draft = await managerA.schema('api').rpc('save_announcement_draft', {
      p_organization_id: alfa.orgId, p_title: 'Izlet', p_body: 'Polazak u 9.', p_audience_scope: 'group', p_audience_ids: [group2], p_audience_roles: ['staff'],
    });
    expect(draft.error).toBeNull();
    expect((await managerA.schema('api').rpc('publish_announcement', { p_id: draft.data })).error).toBeNull();
    expect(await waitFor(() => kinds(l2, 'announcement').length >= 1 && kinds(l2, 'notification').length >= 1)).toBe(true);
    expect(await waitFor(() => kinds(lm, 'announcement').length >= 2)).toBe(true); // draft saved + published
    await sleep(QUIET_MS);
    expect(kinds(l1, 'announcement')).toEqual([]);
    expect(lb.events).toEqual([]);
    for (const c of [managerA, edu2, edu1, eduB]) await c.removeAllChannels();
  });

  it('an idempotent replay sends no second event; a duplicated hint never duplicates data', async () => {
    const lm = await listen(managerA);
    const key = randomUUID();
    expect((await arrive(edu1, child2, 'check_in', key)).error).toBeNull();
    expect(await waitFor(() => kinds(lm, 'attendance').length === 1)).toBe(true);
    expect((await arrive(edu1, child2, 'check_in', key)).error).toBeNull();
    await sleep(QUIET_MS);
    expect(kinds(lm, 'attendance')).toHaveLength(1);
    // Refetching twice for the same hint returns the same single row.
    const fetch = () => managerA.from('attendance_records').select('id').eq('child_id', child2).eq('idempotency_key', key);
    expect((await fetch()).data).toHaveLength(1);
    expect((await fetch()).data).toHaveLength(1);
    await managerA.removeAllChannels();
  });

  it('a user without rights cannot join, send to or read another user\'s topic through the Realtime API', async () => {
    const victimId = await userIdOf(managerA);
    const victim = await listen(managerA);
    const intruder = await listen(outsider, victimId);
    expect(intruder.status).toBe('CHANNEL_ERROR');
    // Public channel with the same name: database events are private, so it never receives them.
    const publicCopy = await listen(outsider, victimId, false);
    // Direct REST broadcast with the intruder's token to the victim's private topic.
    const { data: session } = await outsider.auth.getSession();
    const res = await fetch(`${stack.API_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: stack.PUBLISHABLE_KEY, authorization: `Bearer ${session.session!.access_token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: `user:${victimId}`, event: 'attendance', payload: { kind: 'attendance', id: randomUUID() }, private: true }] }),
    });
    expect((await arrive(edu1, child1, 'check_out')).error).toBeNull();
    expect(await waitFor(() => kinds(victim, 'attendance').length === 1)).toBe(true);
    await sleep(QUIET_MS);
    expect(intruder.events).toEqual([]);
    expect(publicCopy.events).toEqual([]);
    // Whatever the REST endpoint answered, nothing forged reached the victim.
    expect(victim.events.filter((e) => e.kind === 'attendance' && !e.record_id)).toEqual([]);
    expect(victim.events).toHaveLength(1);
    expect(res.status).toBeGreaterThanOrEqual(200);
    await managerA.removeAllChannels();
    await outsider.removeAllChannels();
  });

  it('a former educator with an OPEN subscription receives no further events (assignment ended today)', async () => {
    const le = await listen(edu1);
    expect((await arrive(managerA, child1, 'check_in')).error).toBeNull();
    expect(await waitFor(() => kinds(le, 'attendance').length === 1)).toBe(true);
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zagreb' });
    await managerA.from('staff_assignments').update({ valid_during: `[2026-01-01,${today})` }).eq('id', edu1Assignment).throwOnError();
    expect((await arrive(managerA, child1, 'check_out')).error).toBeNull();
    await sleep(QUIET_MS);
    expect(kinds(le, 'attendance')).toHaveLength(1);
    expect(le.channel.state).toBe('joined'); // still subscribed — the database simply no longer sends to this person
    await edu1.removeAllChannels();
    await managerA.from('staff_assignments').update({ valid_during: '[2026-01-01,)' }).eq('id', edu1Assignment).throwOnError();
  });

  it('a group change moves the events to the educator of the new group', async () => {
    const l1 = await listen(edu1);
    const l2 = await listen(edu2);
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zagreb' });
    expect((await managerA.schema('api').rpc('transfer_child', { p_child_id: child2, p_group_id: group2, p_effective_on: today })).error).toBeNull();
    expect((await arrive(managerA, child2, 'check_out')).error).toBeNull();
    expect(await waitFor(() => kinds(l2, 'attendance').length === 1)).toBe(true);
    await sleep(QUIET_MS);
    expect(kinds(l1, 'attendance')).toEqual([]);
    await edu1.removeAllChannels();
    await edu2.removeAllChannels();
  });

  it('a guardian restricted while subscribed stops receiving events of her conversation', async () => {
    const l1 = await listen(g1);
    const { data: conv } = await edu1.schema('api').rpc('open_conversation', { p_child_id: child1, p_guardian_id: (await service.from('child_guardians').select('guardian_id').eq('id', link1).single()).data!.guardian_id });
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Zagreb' });
    await managerA.from('access_restrictions').insert({ organization_id: alfa.orgId, child_guardian_id: link1, valid_during: `[${today},)` }).throwOnError();
    expect((await edu1.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'Odgovor.' })).error).toBeNull();
    await sleep(QUIET_MS);
    expect(l1.events).toEqual([]);
    expect(l1.channel.state).toBe('joined');
    await g1.removeAllChannels();
  });

  it('after a dropped connection the channel rejoins, the client resyncs, and new events arrive', async () => {
    const managerId = await userIdOf(managerA);
    const events: string[] = [];
    let resyncs = 0;
    await managerA.realtime.setAuth();
    const stop = subscribeLiveEvents(managerA, managerId, { onEvent: (e) => events.push(e.kind), onResync: () => resyncs++ });
    expect(await waitFor(() => managerA.getChannels().some((c) => c.state === 'joined'))).toBe(true);
    managerA.realtime.disconnect();
    await sleep(500);
    expect((await arrive(edu1, child1, 'check_in')).error).toBeNull(); // missed while offline
    managerA.realtime.connect();
    expect(await waitFor(() => resyncs === 1, 15_000)).toBe(true); // the app refetches everything on resync
    expect((await arrive(edu1, child1, 'check_out')).error).toBeNull();
    expect(await waitFor(() => events.includes('attendance'), 10_000)).toBe(true);
    stop();
  });
});
