// D4-F through the real API: a guardian with receives_messages and the educator of the group talk about a child; the
// other guardian without the right and the manager (Q-T16) get nothing; withdrawal removes the text; each message notifies
// the other side without content. D-42: a second guardian of the same child with the right to messages has a separate
// conversation and learns nothing of the first one (no messages, participants, notifications or contacts).
// Synthetic accounts only.
import { beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, enrolMfa, service, signInWithCode } from './helpers.ts';

type Client = Awaited<ReturnType<typeof signInWithCode>>['client'];
let alfa: Awaited<ReturnType<typeof createKindergarten>>;
let manager: Client;
let educator: Client;
let childId = '';
const parents: Record<string, Client> = {};
const guardianIds: Record<string, string> = {};

async function guardian(key: string, receivesMessages: boolean): Promise<void> {
  const address = email(`msg-${key}`);
  const { data: user } = await service.auth.admin.createUser({ email: address, email_confirm: true });
  await service.from('profiles').insert({ id: user.user!.id, first_name: 'Racun', last_name: key }).throwOnError();
  await service.from('memberships').insert({ organization_id: alfa.orgId, profile_id: user.user!.id, role: 'guardian', valid_during: '[2026-01-01,)' }).throwOnError();
  const { data: g } = await manager.from('guardians').insert({ organization_id: alfa.orgId, first_name: { g1: 'Ana', g2: 'Marko', g3: 'Ivan' }[key]!, last_name: 'Razgovor' }).select('id').single().throwOnError();
  guardianIds[key] = g!.id as string;
  await service.from('guardians').update({ profile_id: user.user!.id }).eq('id', g!.id).throwOnError();
  await service.from('child_guardians').insert({ organization_id: alfa.orgId, child_id: childId, guardian_id: g!.id, can_view: true, receives_messages: receivesMessages, valid_during: '[2026-09-01,)' }).throwOnError();
  parents[key] = (await signInWithCode(address)).client;
}

beforeAll(async () => {
  alfa = await createKindergarten('msg-a');
  manager = (await signInWithCode(alfa.managerEmail)).client;
  await enrolMfa(manager);
  await manager.from('staff_assignments').insert({ organization_id: alfa.orgId, membership_id: alfa.educatorMembershipId, group_id: alfa.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  const { data } = await manager.from('children').insert({ organization_id: alfa.orgId, first_name: 'Lana', last_name: 'Razgovor' }).select('id').single().throwOnError();
  childId = data!.id as string;
  await service.from('enrollments').insert({ organization_id: alfa.orgId, child_id: childId, group_id: alfa.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  await guardian('g1', true);
  await guardian('g2', false);
  await guardian('g3', true);
  educator = (await signInWithCode(alfa.educatorEmail)).client;
});

describe('D4-F: conversations through the API', () => {
  it('guardian and educator talk; the other guardian without the right and the manager see nothing (AC-11-1, AC-11-3)', async () => {
    const { data: conv, error } = await parents.g1!.schema('api').rpc('open_conversation', { p_child_id: childId });
    expect(error).toBeNull();
    expect((await educator.schema('api').rpc('open_conversation', { p_child_id: childId, p_guardian_id: guardianIds.g1 })).data).toBe(conv);
    expect((await parents.g1!.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'Lana danas ide ranije.' })).error).toBeNull();
    expect((await educator.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'Hvala, zabilježeno.' })).error).toBeNull();

    const { data: seen } = await educator.schema('api').rpc('conversation_messages', { p_conversation_id: conv });
    expect((seen as { body: string; sender_kind: string; sender_name: string | null; mine: boolean }[]).map((m) => [m.body, m.sender_kind, m.sender_name, m.mine])).toEqual([
      ['Lana danas ide ranije.', 'guardian', 'Ana Razgovor', false],
      ['Hvala, zabilježeno.', 'staff', null, true],
    ]);
    const { data: who } = await parents.g1!.schema('api').rpc('conversation_participants', { p_conversation_id: conv });
    expect(who).toEqual([
      { kind: 'guardian', name: 'Ana Razgovor', is_me: true },
      { kind: 'group', name: 'Galebovi', is_me: false },
    ]);

    expect((await parents.g2!.schema('api').rpc('open_conversation', { p_child_id: childId })).error?.code).toBe('42501');
    expect((await parents.g2!.from('messages').select('id')).data).toEqual([]);
    expect((await manager.schema('api').rpc('open_conversation', { p_child_id: childId })).error?.code).toBe('42501');
    expect((await manager.from('messages').select('id')).data).toEqual([]);
    expect((await manager.schema('api').rpc('conversation_messages', { p_conversation_id: conv })).error?.code).toBe('42501');

    expect((await parents.g1!.from('notifications').select('type, resource_id')).data).toEqual([{ type: 'message.received', resource_id: conv }]);
    expect((await educator.from('notifications').select('type, resource_id')).data).toEqual([{ type: 'message.received', resource_id: conv }]);
  });

  it('D-42: the second guardian with messages has a separate conversation and learns nothing of the first', async () => {
    const { data: conv1 } = await parents.g1!.schema('api').rpc('open_conversation', { p_child_id: childId });
    const { data: conv3, error } = await parents.g3!.schema('api').rpc('open_conversation', { p_child_id: childId });
    expect(error).toBeNull();
    expect(conv3).not.toBe(conv1);
    expect((await parents.g3!.schema('api').rpc('send_message', { p_conversation_id: conv3, p_body: 'Ivan pita za izlet.' })).error).toBeNull();
    // Nothing of Ana's conversation: not by RLS, not by id, not by naming her record, not in notifications or contacts.
    expect((await parents.g3!.from('conversations').select('id')).data).toEqual([{ id: conv3 }]);
    expect((await parents.g3!.from('messages').select('body')).data).toEqual([{ body: 'Ivan pita za izlet.' }]);
    for (const fn of ['conversation_messages', 'conversation_participants']) {
      const r = await parents.g3!.schema('api').rpc(fn, { p_conversation_id: conv1 });
      expect([r.error?.code, r.error?.message]).toEqual(['42501', 'PERMISSION_DENIED']);
    }
    expect((await parents.g3!.schema('api').rpc('send_message', { p_conversation_id: conv1, p_body: 'upad' })).error?.code).toBe('42501');
    expect((await parents.g3!.schema('api').rpc('open_conversation', { p_child_id: childId, p_guardian_id: guardianIds.g1 })).error?.code).toBe('42501');
    expect((await parents.g3!.from('notifications').select('resource_id')).data).toEqual([]);
    expect((await parents.g3!.schema('api').rpc('message_contacts')).data).toEqual([
      { child_id: childId, guardian_id: guardianIds.g3, guardian_name: 'Ivan Razgovor', is_me: true, conversation_id: conv3 },
    ]);
    // Ana does not see Ivan's conversation either; the educator sees both and was notified of Ivan's message.
    expect((await parents.g1!.from('conversations').select('id')).data).toEqual([{ id: conv1 }]);
    expect(((await parents.g1!.from('notifications').select('resource_id')).data ?? []).every((n) => n.resource_id === conv1)).toBe(true);
    const { data: contacts } = await educator.schema('api').rpc('message_contacts');
    expect((contacts as { guardian_name: string }[]).map((c) => c.guardian_name).sort()).toEqual(['Ana Razgovor', 'Ivan Razgovor']);
    expect(((await educator.from('notifications').select('resource_id')).data ?? []).some((n) => n.resource_id === conv3)).toBe(true);
    expect((await manager.schema('api').rpc('message_contacts')).data).toEqual([]);
  });

  it('the sender withdraws within 5 minutes; the text is gone for everyone', async () => {
    const { data: conv } = await parents.g1!.schema('api').rpc('open_conversation', { p_child_id: childId });
    const { data: id } = await parents.g1!.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'Krivo poslano.' });
    expect((await educator.schema('api').rpc('withdraw_message', { p_message_id: id })).error?.code).toBe('42501');
    expect((await parents.g1!.schema('api').rpc('withdraw_message', { p_message_id: id })).error).toBeNull();
    const { data } = await educator.from('messages').select('body, withdrawn_at').eq('id', id as string);
    expect(data![0]!.body).toBeNull();
    expect(data![0]!.withdrawn_at).not.toBeNull();
    expect((await parents.g1!.schema('api').rpc('send_message', { p_conversation_id: conv, p_body: 'x'.repeat(2001) })).error?.message).toBe('MESSAGE_CONTENT_INVALID');
  });
});
