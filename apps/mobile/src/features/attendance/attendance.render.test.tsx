// D3-D render tests on the real Expo Router with an in-memory client whose RPC handlers model the server's effect:
// tiles and filter counts, one tap per child with an idempotency key and correlation id, undo within 10 s, the undo
// action disappearing after 10 s, confirmation for a reported absence, conflict → message and current state,
// departed tiles inert, no "all present" action, load error with reference and retry, group switching. What an educator
// may read or write is proven by pgTAP 19/21 and the integration tests; these prove what the screen does.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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
const ME = 'edu-1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Row = Record<string, unknown>;

/** Server model: status rows per group; record/undo change them like the database would. */
function server(overrides: Partial<FakeState> = {}) {
  const status: Row[] = [
    { child_id: 'c-lea', group_id: 'g1', status: 'expected', arrived_at: null, departed_at: null, absence_reported: false, last_record_id: null },
    { child_id: 'c-ivo', group_id: 'g1', status: 'present', arrived_at: '2026-11-15T06:42:00Z', departed_at: null, absence_reported: false, last_record_id: 'r-ivo' },
    { child_id: 'c-mia', group_id: 'g1', status: 'absent', arrived_at: null, departed_at: null, absence_reported: true, last_record_id: null },
    { child_id: 'c-jan', group_id: 'g1', status: 'departed', arrived_at: '2026-11-15T06:30:00Z', departed_at: '2026-11-15T07:05:00Z', absence_reported: false, last_record_id: 'r-jan' },
    { child_id: 'c-tea', group_id: 'g2', status: 'expected', arrived_at: null, departed_at: null, absence_reported: false, last_record_id: null },
  ];
  let n = 0;
  const state: FakeState = {
    session: session(ME),
    tables: {
      memberships: [membership(ME, 'educator', ALFA)],
      groups: [
        { id: 'g1', name: 'Galebovi', organization_id: ALFA.id, facility_id: 'f1' },
        { id: 'g2', name: 'Školjke', organization_id: ALFA.id, facility_id: 'f1' },
      ],
      facilities: [{ id: 'f1', name: 'Objekt Maslina' }],
      staff_assignments: [],
      enrollments: [],
      children: [
        { id: 'c-lea', first_name: 'Lea', last_name: 'Babić' },
        { id: 'c-ivo', first_name: 'Ivo', last_name: 'Antić' },
        { id: 'c-mia', first_name: 'Mia', last_name: 'Đurić' },
        { id: 'c-jan', first_name: 'Jan', last_name: 'Horvat' },
        { id: 'c-tea', first_name: 'Tea', last_name: 'Žic' },
      ],
    },
    rpc: {
      child_day_status: (args) => ({ data: status.filter((r) => r.group_id === args.p_group_id), error: null }),
      record_attendance: (args) => {
        const row = status.find((r) => r.child_id === args.p_child_id)!;
        const id = `r-${++n}`;
        Object.assign(row, args.p_kind === 'check_in'
          ? { status: 'present', arrived_at: '2026-11-15T07:15:00Z', last_record_id: id }
          : { status: 'departed', departed_at: '2026-11-15T07:20:00Z', last_record_id: id });
        return { data: [{ record_id: id, kind: args.p_kind, occurred_at: '2026-11-15T07:15:00Z', replayed: false }], error: null };
      },
      undo_attendance: (args) => {
        const row = status.find((r) => r.last_record_id === args.p_record_id)!;
        Object.assign(row, { status: 'expected', arrived_at: null, last_record_id: null });
        return { data: 'void-1', error: null };
      },
    },
    ...overrides,
  };
  return { state, status };
}

async function start(state: FakeState) {
  mockFake = createFakeSupabase(state);
  return renderRouter(appDir, { initialUrl: '/attendance' });
}
const rpcCalls = (fn: string) => mockFake.requests.filter((r) => r.table === `rpc:${fn}`);

beforeEach(() => {
  jest.clearAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('educator attendance (D3-D)', () => {
  it('shows the group with tiles, statuses and filter counts; reads carry one correlation id', async () => {
    await start(server().state);
    expect(await screen.findByLabelText('Lea Babić. Očekuje se')).toBeTruthy();
    expect(screen.getByText('Lea B.')).toBeTruthy();
    expect(screen.getByLabelText(/^Ivo Antić\. U vrtiću od /)).toBeTruthy();
    expect(screen.getByLabelText('Mia Đurić. Javljen izostanak')).toBeTruthy();
    expect(screen.getByLabelText(/^Jan Horvat\. Otišlo u /)).toBeTruthy();
    expect(screen.getByLabelText(`${hr.attendance.filterAll}: 4`)).toBeTruthy();
    expect(screen.getByLabelText(`${hr.attendance.present}: 1`)).toBeTruthy();
    const read = rpcCalls('child_day_status')[0]!;
    expect(read.values).toEqual({ p_group_id: 'g1' });
    expect(read.headers[CORRELATION_HEADER]).toMatch(CORRELATION_ID_PATTERN);
    expect(screen.queryByText(/svi prisutni/i)).toBeNull(); // FR-05-6
  });

  it('one tap records the arrival with an idempotency key; the tile and the undo snackbar follow', async () => {
    await start(server().state);
    await fireEvent.press(await screen.findByLabelText('Lea Babić. Očekuje se'));
    const call = rpcCalls('record_attendance')[0]!;
    expect(call.values).toMatchObject({ p_child_id: 'c-lea', p_kind: 'check_in' });
    expect(String(call.values!.p_idempotency_key)).toMatch(UUID);
    expect(call.headers[CORRELATION_HEADER]).toMatch(CORRELATION_ID_PATTERN);
    expect(await screen.findByLabelText(/^Lea Babić\. U vrtiću od /)).toBeTruthy();
    expect(screen.getByText(/^Lea B\. — dolazak u /)).toBeTruthy();
    expect(screen.getByText(hr.attendance.undo)).toBeTruthy();
  });

  it('undo within 10 s voids the event and the child is expected again', async () => {
    await start(server().state);
    await fireEvent.press(await screen.findByLabelText('Lea Babić. Očekuje se'));
    await fireEvent.press(await screen.findByText(hr.attendance.undo));
    expect(rpcCalls('undo_attendance')[0]!.values).toMatchObject({ p_record_id: 'r-1' });
    expect(await screen.findByText('Dolazak je poništen: Lea B.')).toBeTruthy();
    expect(await screen.findByLabelText('Lea Babić. Očekuje se')).toBeTruthy();
  });

  it('after 10 s the undo action disappears (the server refuses it too)', async () => {
    await start(server().state);
    const tile = await screen.findByLabelText('Lea Babić. Očekuje se');
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    await fireEvent.press(tile);
    expect(await screen.findByText(hr.attendance.undo)).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(10_001);
    });
    expect(screen.queryByText(hr.attendance.undo)).toBeNull();
    expect(screen.getByText(hr.attendance.close)).toBeTruthy();
  });

  it('a child with a reported absence asks for confirmation; cancel records nothing, confirm records (FR-05-7)', async () => {
    await start(server().state);
    await fireEvent.press(await screen.findByLabelText('Mia Đurić. Javljen izostanak'));
    expect(screen.getByText('Za Mia Đurić je javljen izostanak.')).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.attendance.cancel));
    expect(rpcCalls('record_attendance')).toHaveLength(0);
    await fireEvent.press(screen.getByLabelText('Mia Đurić. Javljen izostanak'));
    await fireEvent.press(screen.getByText(hr.attendance.confirmCheckIn));
    expect(rpcCalls('record_attendance')[0]!.values).toMatchObject({ p_child_id: 'c-mia', p_kind: 'check_in' });
    expect(await screen.findByLabelText(/^Mia Đurić\. U vrtiću od /)).toBeTruthy();
  });

  it('a second tap on a present child records the departure', async () => {
    await start(server().state);
    await fireEvent.press(await screen.findByLabelText(/^Ivo Antić\. U vrtiću od /));
    expect(rpcCalls('record_attendance')[0]!.values).toMatchObject({ p_child_id: 'c-ivo', p_kind: 'check_out' });
    expect(await screen.findByText(/^Ivo A\. — odlazak u /)).toBeTruthy();
  });

  it('a conflict (another educator was faster) shows the message and the current state (FR-05-8)', async () => {
    const { state, status } = server();
    state.rpc!.record_attendance = () => {
      Object.assign(status[0]!, { status: 'present', arrived_at: '2026-11-15T07:10:00Z', last_record_id: 'r-other' });
      return { data: null, error: { code: 'P0001', message: 'ATTENDANCE_STATE_CONFLICT' } };
    };
    await start(state);
    await fireEvent.press(await screen.findByLabelText('Lea Babić. Očekuje se'));
    expect(await screen.findByText(hr.errors.ATTENDANCE_STATE_CONFLICT)).toBeTruthy();
    expect(await screen.findByLabelText(/^Lea Babić\. U vrtiću od /)).toBeTruthy();
    expect(screen.queryByText(hr.attendance.undo)).toBeNull();
  });

  it('a departed child cannot be changed by a tap', async () => {
    await start(server().state);
    await fireEvent.press(await screen.findByLabelText(/^Jan Horvat\. Otišlo u /));
    expect(rpcCalls('record_attendance')).toHaveLength(0);
  });

  it('a load error shows a reference without personal data and retry loads the group', async () => {
    await start(server({ failNext: { table: 'rpc:child_day_status', error: { code: '500', message: 'boom' } } }).state);
    expect(await screen.findByText(hr.attendance.loadError)).toBeTruthy();
    expect(screen.getByText(/^Oznaka: mob-/)).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.common.retry));
    expect(await screen.findByLabelText('Lea Babić. Očekuje se')).toBeTruthy();
  });

  it('with two groups today the educator switches between them', async () => {
    await start(server().state);
    await screen.findByLabelText('Lea Babić. Očekuje se');
    await fireEvent.press(screen.getByText('Školjke'));
    expect(await screen.findByLabelText('Tea Žic. Očekuje se')).toBeTruthy();
    expect(screen.queryByText('Lea B.')).toBeNull();
    expect(rpcCalls('child_day_status').at(-1)!.values).toEqual({ p_group_id: 'g2' });
  });
});
