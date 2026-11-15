// D4-F render tests on the real Expo Router with the in-memory client: guardian "Poruke" lists only children with the
// messaging right; a conversation says who can see it and how the kindergarten answers; staff messages appear by role;
// sending, withdrawing (own, within 5 minutes), "poruka uklonjena", denied and error states; opening marks the
// conversation's notifications read; educators get "Razgovori". Participants and access are proven by pgTAP 27.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { join } from 'node:path';
import { hr } from '@vrticos/i18n';
import { ALFA, createFakeSupabase, membership, session, type FakeState } from '../../test/fakeSupabase';

let mockFake: ReturnType<typeof createFakeSupabase>;
jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return mockFake.client;
  },
  SESSION_KEY: 'vrticos.session',
  sessionStorage: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}));

const appDir = join(__dirname, '..', '..', 'app');
const since = '[2020-01-01,)';
const rpcCalls = (fn: string) => mockFake.requests.filter((r) => r.table === `rpc:${fn}`);
type Row = Record<string, unknown>;
const recent = new Date(Date.now() - 60_000).toISOString();

function guardian(): FakeState {
  const messages: Row[] = [
    { id: 'm1', body: 'Lana danas ide ranije.', created_at: '2026-11-15T07:00:00Z', withdrawn: false, mine: true, sender_kind: 'guardian', sender_name: 'Ana Babić' },
    { id: 'm2', body: 'Hvala, zabilježeno.', created_at: '2026-11-15T07:05:00Z', withdrawn: false, mine: false, sender_kind: 'staff', sender_name: null },
    { id: 'm3', body: null, created_at: '2026-11-15T07:06:00Z', withdrawn: true, mine: false, sender_kind: 'guardian', sender_name: 'Marko Horvat' },
  ];
  return {
    session: session('g-1'),
    tables: {
      memberships: [membership('g-1', 'guardian', ALFA)],
      organizations: [ALFA],
      children: [
        { id: 'c-lana', first_name: 'Lana', last_name: 'Babić', organization_id: ALFA.id },
        { id: 'c-nika', first_name: 'Nika', last_name: 'Babić', organization_id: ALFA.id },
      ],
      child_guardians: [
        { child_id: 'c-lana', receives_messages: true, valid_during: since },
        { child_id: 'c-nika', receives_messages: false, valid_during: since },
      ],
      conversations: [{ id: 'conv-1', child_id: 'c-lana' }],
      notifications: [{ id: 'n1', type: 'message.received', resource_id: 'conv-1', read_at: null }],
    },
    rpc: {
      open_conversation: () => ({ data: 'conv-1', error: null }),
      conversation_participants: () => ({
        data: [
          { kind: 'guardian', name: 'Ana Babić', is_me: true },
          { kind: 'guardian', name: 'Marko Horvat', is_me: false },
          { kind: 'group', name: 'Galebovi', is_me: false },
        ],
        error: null,
      }),
      conversation_messages: () => ({ data: messages, error: null }),
      send_message: (args) => {
        messages.push({ id: `m${messages.length + 1}`, body: args.p_body, created_at: recent, withdrawn: false, mine: true, sender_kind: 'guardian', sender_name: 'Ana Babić' });
        return { data: 'new', error: null };
      },
      withdraw_message: (args) => {
        Object.assign(messages.find((m) => m.id === args.p_message_id)!, { body: null, withdrawn: true });
        return { data: args.p_message_id, error: null };
      },
      mark_notifications_read: (args, st) => {
        for (const n of st.tables.notifications ?? []) if ((args.p_ids as string[]).includes(n.id as string)) n.read_at = 'x';
        return { data: 1, error: null };
      },
    },
  };
}

async function start(s: FakeState, initialUrl = '/messages') {
  mockFake = createFakeSupabase(s);
  return renderRouter(appDir, { initialUrl });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('conversations (D4-F)', () => {
  it('a guardian sees only children with the messaging right, with unread count', async () => {
    await start(guardian());
    expect(await screen.findByLabelText('Lana Babić. 1 nova poruka')).toBeTruthy();
    expect(screen.queryByText('Nika Babić')).toBeNull();
  });

  it('the conversation says who can see it and how the kindergarten answers; staff by role; withdrawn shown as removed', async () => {
    await start(guardian());
    await fireEvent.press(await screen.findByLabelText(/^Lana Babić/));
    expect(await screen.findByText('Razgovor vide: vi, Marko Horvat, odgojitelji skupine Galebovi.')).toBeTruthy();
    expect(screen.getByText(hr.conversations.responseTime)).toBeTruthy();
    expect(screen.getByLabelText(/^Vi, .*: Lana danas ide ranije\.$/)).toBeTruthy();
    expect(screen.getByLabelText(/^Odgojitelj\/ica skupine, .*: Hvala, zabilježeno\.$/)).toBeTruthy();
    expect(screen.getByLabelText(/^Marko Horvat, .*: Poruka je uklonjena\.$/)).toBeTruthy();
    // An old own message cannot be withdrawn any more.
    expect(screen.queryByText(hr.conversations.withdraw)).toBeNull();
    expect(rpcCalls('mark_notifications_read')[0]!.values).toEqual({ p_ids: ['n1'] });
  });

  it('sends a message and can withdraw it within 5 minutes', async () => {
    await start(guardian());
    await fireEvent.press(await screen.findByLabelText(/^Lana Babić/));
    await fireEvent.changeText(await screen.findByLabelText(hr.conversations.compose), 'Dolazi baka Ana.');
    await fireEvent.press(screen.getByText(hr.conversations.send));
    expect(rpcCalls('send_message')[0]!.values).toEqual({ p_conversation_id: 'conv-1', p_body: 'Dolazi baka Ana.' });
    expect(await screen.findByLabelText(/^Vi, .*: Dolazi baka Ana\.$/)).toBeTruthy();
    expect(screen.getByLabelText(hr.conversations.compose).props.value).toBe('');
    await fireEvent.press(screen.getByText(hr.conversations.withdraw));
    expect(rpcCalls('withdraw_message')[0]!.values).toEqual({ p_message_id: 'm4' });
    expect(await screen.findByLabelText(/^Vi, .*: Poruka je uklonjena\.$/)).toBeTruthy();
  });

  it('a refused conversation says it is not available; a business error is shown', async () => {
    const s = guardian();
    s.rpc!.open_conversation = () => ({ data: null, error: { code: '42501', message: 'PERMISSION_DENIED' } });
    await start(s);
    await fireEvent.press(await screen.findByLabelText(/^Lana Babić/));
    expect(await screen.findByText(hr.conversations.denied)).toBeTruthy();

    const t = guardian();
    t.rpc!.send_message = () => ({ data: null, error: { code: 'P0001', message: 'MESSAGE_CONTENT_INVALID' } });
    await start(t);
    await fireEvent.press(await screen.findByLabelText(/^Lana Babić/));
    await fireEvent.changeText(await screen.findByLabelText(hr.conversations.compose), 'x');
    await fireEvent.press(screen.getByText(hr.conversations.send));
    expect(await screen.findByText(hr.errors.MESSAGE_CONTENT_INVALID)).toBeTruthy();
  });

  it('an educator has "Razgovori" with the children of the groups', async () => {
    await start({
      session: session('e-1'),
      tables: {
        memberships: [membership('e-1', 'educator', ALFA)],
        groups: [],
        facilities: [],
        staff_assignments: [],
        children: [{ id: 'c-lana', first_name: 'Lana', last_name: 'Babić', organization_id: ALFA.id }],
        conversations: [],
        notifications: [],
      },
    });
    expect(await screen.findByRole('header', { name: hr.nav.conversations })).toBeTruthy();
    expect(screen.getByLabelText('Lana Babić')).toBeTruthy();
    expect(screen.getByText(hr.conversations.ledeEducator)).toBeTruthy();
  });
});
