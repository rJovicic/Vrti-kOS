// D4-D render tests on the real Expo Router with the in-memory client: the "Obavijesti" destination for guardians and
// educators — announcements with "Novo" and "uređeno", opening one marks its notifications read, mark-all, empty and
// error states, the educator's absence reports (with a report that is no longer readable), and push preferences per
// type in the profile. What each person may read is proven by pgTAP 24/25 and the integration tests.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { join } from 'node:path';
import { hr } from '@vrticos/i18n';
import { CORRELATION_HEADER, CORRELATION_ID_PATTERN } from '../../lib/correlation';
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
type Row = Record<string, unknown>;
const rpcCalls = (fn: string) => mockFake.requests.filter((r) => r.table === `rpc:${fn}`);

function state(role: 'guardian' | 'educator', tables: Record<string, Row[]> = {}): FakeState {
  const me = `${role}-1`;
  const s: FakeState = {
    session: session(me),
    tables: {
      memberships: [membership(me, role, ALFA)],
      organizations: [ALFA],
      announcements: [
        { id: 'a1', organization_id: ALFA.id, title: 'Roditeljski sastanak u četvrtak', body: 'Sastanak je u 17 sati u dvorani.', status: 'published', published_at: '2026-11-15T08:10:00Z', edited_at: null },
        { id: 'a2', organization_id: ALFA.id, title: 'Promjena radnog vremena', body: 'Za blagdane radimo do 15 sati.', status: 'published', published_at: '2026-11-09T07:00:00Z', edited_at: '2026-11-10T07:00:00Z' },
      ],
      notifications: [
        { id: 'n1', type: 'announcement.published', resource_id: 'a1', created_at: '2026-11-15T08:10:00Z', read_at: null },
        { id: 'n2', type: 'announcement.published', resource_id: 'a2', created_at: '2026-11-09T07:00:00Z', read_at: '2026-11-09T09:00:00Z' },
      ],
      ...tables,
    },
    rpc: {
      mark_notifications_read: (args, st) => {
        const ids = args.p_ids as string[] | undefined;
        let n = 0;
        for (const r of st.tables.notifications ?? []) {
          if (r.read_at === null && (!ids || ids.includes(r.id as string))) {
            r.read_at = '2026-11-15T09:00:00Z';
            n++;
          }
        }
        return { data: n, error: null };
      },
    },
  };
  return s;
}

async function start(s: FakeState, initialUrl = '/notices') {
  mockFake = createFakeSupabase(s);
  return renderRouter(appDir, { initialUrl });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('notification centre and announcements (D4-D)', () => {
  it('a guardian sees the announcements with "Novo" and "uređeno"; reads carry one correlation id', async () => {
    await start(state('guardian'));
    expect(await screen.findByText('Roditeljski sastanak u četvrtak')).toBeTruthy();
    expect(screen.getByLabelText(/^Roditeljski sastanak u četvrtak\. Vrtić Alfa \(demo\)\. .*\. Novo$/)).toBeTruthy();
    expect(screen.getByLabelText(/^Promjena radnog vremena\. Vrtić Alfa \(demo\)\. .*\. uređeno$/)).toBeTruthy();
    expect(screen.getAllByText(hr.notices.new)).toHaveLength(1);
    const reads = mockFake.requests.filter((r) => r.table === 'notifications' || r.table === 'announcements');
    expect(new Set(reads.map((r) => r.headers[CORRELATION_HEADER])).size).toBe(1);
    expect(reads[0]!.headers[CORRELATION_HEADER]).toMatch(CORRELATION_ID_PATTERN);
    // A guardian has no absence-report section.
    expect(screen.queryByText(hr.notices.absences)).toBeNull();
  });

  it('opening an announcement shows it and marks its notification read; back returns to the list', async () => {
    await start(state('guardian'));
    await fireEvent.press(await screen.findByLabelText(/^Roditeljski sastanak u četvrtak\./));
    expect(await screen.findByText('Sastanak je u 17 sati u dvorani.')).toBeTruthy();
    expect(rpcCalls('mark_notifications_read')[0]!.values).toEqual({ p_ids: ['n1'] });
    await fireEvent.press(screen.getByText(hr.notices.back));
    expect(await screen.findByLabelText(/^Roditeljski sastanak u četvrtak\. Vrtić Alfa \(demo\)\. [^N]*$/)).toBeTruthy();
    expect(screen.queryByText(hr.notices.new)).toBeNull();
  });

  it('"mark all" sends no ids and clears every "Novo"', async () => {
    await start(state('guardian'));
    await fireEvent.press(await screen.findByText('Označi 1 obavijest pročitanom'));
    expect(rpcCalls('mark_notifications_read')[0]!.values).toEqual({});
    await screen.findByText('Promjena radnog vremena');
    expect(screen.queryByText(hr.notices.new)).toBeNull();
  });

  it('D-43: a live hint on the own private topic refetches the list without any tap', async () => {
    const s = state('guardian');
    await start(s);
    expect(await screen.findByText('Roditeljski sastanak u četvrtak')).toBeTruthy();
    expect(mockFake.channels.map((c) => [c.topic, c.private])).toContainEqual(['user:guardian-1', true]);
    s.tables.announcements!.push({ id: 'a3', organization_id: ALFA.id, title: 'Novi izlet', body: 'Petak.', status: 'published', published_at: '2026-11-16T08:00:00Z', edited_at: null });
    s.tables.notifications!.push({ id: 'n3', type: 'announcement.published', resource_id: 'a3', created_at: '2026-11-16T08:00:00Z', read_at: null });
    const reads = () => mockFake.requests.filter((r) => r.table === 'announcements').length;
    const before = reads();
    // The router test harness runs on fake timers: let the 400 ms coalescing window pass explicitly.
    await act(async () => {
      mockFake.broadcast('user:guardian-1', { id: '7b0c3a8f-631d-4212-aac6-427bdb61cc57', kind: 'notification', notification_id: '7b0c3a8f-631d-4212-aac6-427bdb61cc58' });
      jest.advanceTimersByTime(500);
    });
    expect(await screen.findByText('Novi izlet')).toBeTruthy();
    expect(reads()).toBe(before + 1);
    // An event of an unrelated kind, a duplicate or an invalid id triggers nothing.
    await act(async () => {
      mockFake.broadcast('user:guardian-1', { id: 'not-a-uuid', kind: 'notification' });
      mockFake.broadcast('user:guardian-1', { id: 'b7e9fdd6-acd5-40f6-8149-e1f907e96ccf', kind: 'attendance' });
      mockFake.broadcast('user:guardian-1', { id: '7b0c3a8f-631d-4212-aac6-427bdb61cc57', kind: 'notification' });
      jest.advanceTimersByTime(500);
    });
    expect(reads()).toBe(before + 1);
  });

  it('empty and error states', async () => {
    await start(state('guardian', { announcements: [], notifications: [] }));
    expect(await screen.findByText(hr.notices.empty)).toBeTruthy();
    const s = state('guardian');
    s.failNext = { table: 'announcements', error: { code: 'XX000', message: 'boom' } };
    await start(s);
    expect(await screen.findByText(hr.notices.loadError)).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.common.retry));
    expect(await screen.findByText('Roditeljski sastanak u četvrtak')).toBeTruthy();
  });

  it('an educator also sees absence reports of the group; a report no longer readable says so', async () => {
    await start(
      state('educator', {
        notifications: [
          { id: 'n3', type: 'absence.reported', resource_id: 'ab1', created_at: '2026-11-15T06:58:00Z', read_at: null },
          { id: 'n4', type: 'absence.reported', resource_id: 'ab-gone', created_at: '2026-11-14T06:58:00Z', read_at: '2026-11-14T08:00:00Z' },
        ],
        absence_records: [{ id: 'ab1', child_id: 'c-lea', starts_on: '2026-11-16', ends_on: '2026-11-17' }],
        children: [{ id: 'c-lea', first_name: 'Lea', last_name: 'Babić' }],
      }),
    );
    expect(await screen.findByText(hr.notices.absences)).toBeTruthy();
    expect(screen.getByLabelText(/^Lea Babić: izostanak .* – .*\. Novo$/)).toBeTruthy();
    expect(screen.getByLabelText(hr.notices.unavailable)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(/^Lea Babić: izostanak/));
    expect(rpcCalls('mark_notifications_read')[0]!.values).toEqual({ p_ids: ['n3'] });
  });

  it('push preferences per type in the profile: own row upserted, honest note that sending is not enabled yet', async () => {
    await start(state('guardian', { notification_preferences: [] }), '/profile');
    expect(await screen.findByText(hr.notices.pushTitle)).toBeTruthy();
    expect(screen.getByText(hr.notices.pushNote)).toBeTruthy();
    const toggle = screen.getByLabelText(hr.notices.pushType['announcement.published']);
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    const write = mockFake.requests.find((r) => r.table === 'notification_preferences' && r.op === 'upsert')!;
    expect(write.values).toEqual({ profile_id: 'guardian-1', type: 'announcement.published', push_enabled: false });
    expect(screen.queryByLabelText(hr.notices.pushType['absence.reported'])).toBeNull();
  });
});
