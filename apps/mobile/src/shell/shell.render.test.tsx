// D1-10 render and navigation tests on the real Expo Router (`src/app`), with an in-memory Supabase client.
// Covers: signed-out and signed-in views, Parent Home, educator tabs, managers, no membership, session expiry,
// blocking the other role's tabs, switching between guardian and educator mode, the privacy notice (FR-01-5) and
// correlation ids on shell requests.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { join } from 'node:path';
import { hr } from '@vrticos/i18n';
import { CORRELATION_HEADER, CORRELATION_ID_PATTERN } from '../lib/correlation';
import { ALFA, BETA_WITH_NOTICE, createFakeSupabase, membership, session, type FakeState } from '../test/fakeSupabase';

let mockFake: ReturnType<typeof createFakeSupabase>;
jest.mock('../lib/supabase', () => ({
  get supabase() {
    return mockFake.client;
  },
  SESSION_KEY: 'vrticos.session',
  sessionStorage: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}));

const appDir = join(__dirname, '..', 'app');
const ME = 'user-1';

function start(state: Partial<FakeState>, initialUrl = '/') {
  mockFake = createFakeSupabase({ session: null, tables: {}, ...state });
  return renderRouter(appDir, { initialUrl });
}
const tables = (rows: Record<string, unknown>[], extra: Record<string, Record<string, unknown>[]> = {}) => ({ memberships: rows, ...extra });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('authentication guard', () => {
  it('signed out: only the sign-in screen exists', async () => {
    const r = await start({});
    expect(await screen.findByText(hr.auth.signInTitle)).toBeTruthy();
    expect(r.getPathname()).toBe('/sign-in');
    expect(screen.queryByText(hr.nav.profile)).toBeNull();
  });

  it('signed out: a deep link into the app ends on sign-in, nothing of the app is rendered', async () => {
    const r = await start({}, '/today');
    expect(await screen.findByText(hr.auth.signInTitle)).toBeTruthy();
    expect(r.getPathname()).toBe('/sign-in');
    expect(screen.queryByText(hr.mobile.myGroups)).toBeNull();
  });

  it('signed in: the sign-in screen is not reachable', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'guardian', ALFA)]) }, '/sign-in');
    expect(await screen.findByText(hr.mobile.myChildren)).toBeTruthy();
    expect(r.getPathname()).toBe('/');
  });
});

describe('roles and tabs', () => {
  it('guardian: lands on Parent Home with its empty state and guardian tabs only', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'guardian', ALFA)]) });
    expect(await screen.findByText(hr.mobile.noData)).toBeTruthy();
    expect(r.getPathname()).toBe('/');
    expect(screen.getAllByText(hr.nav.home).length).toBeGreaterThan(0);
    expect(screen.getAllByText(hr.nav.messages).length).toBeGreaterThan(0);
    expect(screen.queryByText(hr.nav.today)).toBeNull();
    expect(screen.queryByText(hr.nav.attendance)).toBeNull();
  });

  it('educator: lands on "Danas" with today\'s groups and educator tabs only', async () => {
    const r = await start({
      session: session(ME),
      tables: tables([membership(ME, 'educator', ALFA)], {
        groups: [{ id: 'g1', name: 'Galebovi', organization_id: ALFA.id, facility_id: 'f1' }],
        facilities: [{ id: 'f1', name: 'Objekt Maslina' }],
        staff_assignments: [],
      }),
    });
    expect(await screen.findByText('Galebovi')).toBeTruthy();
    expect(r.getPathname()).toBe('/today');
    expect(screen.getAllByText(hr.nav.attendance).length).toBeGreaterThan(0);
    expect(screen.queryByText(hr.nav.messages)).toBeNull();
  });

  it('educator: the attendance tab is a labelled placeholder (D3), without sample data', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'educator', ALFA)], { groups: [], facilities: [], staff_assignments: [] }) }, '/attendance');
    expect(await screen.findByText(hr.shell.comingLater.attendance)).toBeTruthy();
    expect(r.getPathname()).toBe('/attendance');
  });

  it('manager only: sees where the work happens, no guardian or educator tabs', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'org_admin', ALFA)]) });
    expect(await screen.findByText(hr.mobile.managersUseWeb)).toBeTruthy();
    expect(r.getPathname()).toBe('/info');
    expect(screen.queryByText(hr.nav.today)).toBeNull();
    expect(screen.queryByText(hr.nav.messages)).toBeNull();
  });

  it('no active membership: blocked with an explanation and a way to sign out, no tabs', async () => {
    await start({ session: session(ME), tables: tables([]) });
    expect(await screen.findByText(hr.shell.noMembership)).toBeTruthy();
    expect(screen.getByText(hr.auth.signOut)).toBeTruthy();
    expect(screen.queryByText(hr.nav.profile)).toBeNull();
  });

  it("a guardian cannot open an educator destination by deep link; the other role's tab is not rendered", async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'guardian', ALFA)]) }, '/today');
    expect(await screen.findByText(hr.mobile.noData)).toBeTruthy();
    expect(r.getPathname()).not.toBe('/today');
    expect(screen.queryByText(hr.mobile.myGroups)).toBeNull();
  });

  it('an educator cannot open a guardian destination by deep link', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'educator', ALFA)], { groups: [], facilities: [], staff_assignments: [] }) }, '/messages');
    expect(await screen.findByText(hr.mobile.myGroups)).toBeTruthy();
    expect(r.getPathname()).not.toBe('/messages');
    expect(screen.queryByText(hr.shell.comingLater.messages)).toBeNull();
  });

  it('a person with both roles switches between educator and guardian mode in Profil', async () => {
    const r = await start(
      {
        session: session(ME),
        tables: tables([membership(ME, 'educator', ALFA), membership(ME, 'guardian', ALFA)], { groups: [], facilities: [], staff_assignments: [] }),
      },
      '/profile',
    );
    await fireEvent.press(await screen.findByText(hr.shell.modeGuardian));
    await waitFor(() => expect(r.getPathname()).toBe('/'));
    expect(await screen.findByText(hr.mobile.noData)).toBeTruthy();
    expect(screen.queryByText(hr.nav.today)).toBeNull();

    await act(async () => router.navigate('/profile'));
    await waitFor(() => expect(r.getPathname()).toBe('/profile'));
    // the guardian destinations work after the switch, and the educator ones are refused
    await act(async () => router.navigate('/today'));
    await waitFor(() => expect(r.getPathname()).toBe('/'));
    await act(async () => router.navigate('/profile'));
    await fireEvent.press(await screen.findByText(hr.shell.modeEducator));
    await waitFor(() => expect(r.getPathname()).toBe('/today'));
    expect(screen.queryByText(hr.nav.messages)).toBeNull();
  });
});

describe('session expiry', () => {
  it('a refused token while loading signs out and explains why at sign-in', async () => {
    const r = await start({
      session: session(ME),
      tables: tables([membership(ME, 'guardian', ALFA)]),
      failNext: { table: 'memberships', error: { code: 'PGRST303', status: 401, message: 'JWT expired' } },
    });
    expect(await screen.findByText(hr.errors.AUTH_SESSION_EXPIRED)).toBeTruthy();
    expect(r.getPathname()).toBe('/sign-in');
  });

  it('a session ended elsewhere (refresh refused) returns to sign-in with the expiry message; data is gone', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'guardian', ALFA)]) });
    expect(await screen.findByText(hr.mobile.noData)).toBeTruthy();
    await act(async () => mockFake.emit('SIGNED_OUT', null));
    expect(await screen.findByText(hr.errors.AUTH_SESSION_EXPIRED)).toBeTruthy();
    expect(r.getPathname()).toBe('/sign-in');
    expect(screen.queryByText(hr.mobile.noData)).toBeNull();
  });

  it('signing out on purpose does not claim the session expired', async () => {
    await start({ session: session(ME), tables: tables([membership(ME, 'guardian', ALFA)]) }, '/profile');
    await fireEvent.press(await screen.findByText(hr.auth.signOut));
    expect(await screen.findByText(hr.auth.signInTitle)).toBeTruthy();
    expect(screen.queryByText(hr.errors.AUTH_SESSION_EXPIRED)).toBeNull();
  });
});

describe('privacy notice (FR-01-5)', () => {
  const noticeRows = () => [
    { organization_id: BETA_WITH_NOTICE.id, version: 'demo-2026-11', title: 'Obavijest o privatnosti (DEMO)', body: 'Prvi odlomak.\n\nDrugi odlomak.', is_demo: true },
  ];

  it('a published, unacknowledged notice is shown in full before any data, labelled as demo, without tabs', async () => {
    await start({ session: session(ME), tables: tables([membership(ME, 'guardian', BETA_WITH_NOTICE)], { privacy_notices: noticeRows() }) });
    expect(await screen.findByText('Obavijest o privatnosti (DEMO)')).toBeTruthy();
    expect(screen.getByText(hr.shell.noticeDemo)).toBeTruthy();
    expect(screen.getByText('Prvi odlomak.')).toBeTruthy();
    expect(screen.getByText('Drugi odlomak.')).toBeTruthy();
    expect(screen.queryByText(hr.mobile.noData)).toBeNull();
    expect(screen.queryByText(hr.nav.profile)).toBeNull();
  });

  it('acknowledging records the published version and opens the app', async () => {
    const r = await start({ session: session(ME), tables: tables([membership(ME, 'guardian', BETA_WITH_NOTICE)], { privacy_notices: noticeRows() }) });
    await fireEvent.press(await screen.findByText(hr.shell.noticeAcknowledge));
    expect(await screen.findByText(hr.mobile.noData)).toBeTruthy();
    expect(r.getPathname()).toBe('/');
    const ack = mockFake.requests.find((q) => q.table === 'memberships' && q.op === 'update');
    expect(ack?.values).toEqual({ notice_ack_version: 'demo-2026-11' });
  });

  it('an already acknowledged version and an unpublished notice do not block', async () => {
    await start({ session: session(ME), tables: tables([membership(ME, 'guardian', BETA_WITH_NOTICE, 'demo-2026-11'), membership(ME, 'educator', ALFA)], { groups: [], facilities: [], staff_assignments: [] }) });
    expect(await screen.findByText(hr.mobile.myGroups)).toBeTruthy();
    expect(screen.queryByText(hr.shell.noticeAcknowledge)).toBeNull();
    expect(mockFake.requests.some((q) => q.table === 'privacy_notices')).toBe(false);
  });

  it('a published version whose text cannot be read blocks (fail closed)', async () => {
    await start({ session: session(ME), tables: tables([membership(ME, 'guardian', BETA_WITH_NOTICE)], { privacy_notices: [] }) });
    expect(await screen.findByText(hr.shell.loadError)).toBeTruthy();
    expect(screen.queryByText(hr.mobile.noData)).toBeNull();
  });
});

describe('correlation ids', () => {
  it('one load of the shell shares one valid id across its requests; the acknowledgement is a new action', async () => {
    await start({ session: session(ME), tables: tables([membership(ME, 'guardian', BETA_WITH_NOTICE)], { privacy_notices: noticeRows() }) });
    await fireEvent.press(await screen.findByText(hr.shell.noticeAcknowledge));
    await screen.findByText(hr.mobile.noData);
    const [load, notice, ack] = mockFake.requests;
    const ids = [load, notice, ack].map((q) => q?.headers[CORRELATION_HEADER]);
    for (const id of ids) expect(id).toMatch(CORRELATION_ID_PATTERN);
    expect(load?.table).toBe('memberships');
    expect(notice?.table).toBe('privacy_notices');
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[0]);
  });

  function noticeRows() {
    return [{ organization_id: BETA_WITH_NOTICE.id, version: 'demo-2026-11', title: 'Obavijest o privatnosti (DEMO)', body: 'Tekst.', is_demo: true }];
  }
});
