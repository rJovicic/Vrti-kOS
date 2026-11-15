// D2-H render tests on the real Expo Router with an in-memory Supabase client: Parent Home with the authorized
// children (group, facility, child without a group), empty and error states, retry, session expiry, child detail with
// read-only pickup persons, an inaccessible child, and the educator's children per group. The fake does not model RLS:
// what each role may read is proven by pgTAP and the integration tests; these tests prove what the app shows.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { orgLocalDate } from '@vrticos/domain';
import { join } from 'node:path';
import { hr } from '@vrticos/i18n';
import { CORRELATION_HEADER, CORRELATION_ID_PATTERN } from '../../lib/correlation';
import { ALFA, createFakeSupabase, membership, session, type FakeState } from '../../test/fakeSupabase';
import { addDays, dayLabel } from './AbsenceReportView';

let mockFake: ReturnType<typeof createFakeSupabase>;
jest.mock('../../lib/supabase', () => ({
  get supabase() {
    return mockFake.client;
  },
  SESSION_KEY: 'vrticos.session',
  sessionStorage: { getItem: async () => null, setItem: async () => undefined, removeItem: async () => undefined },
}));

const appDir = join(__dirname, '..', '..', 'app');
const ME = 'guardian-1';
const since = '[2020-01-01,)';

function start(state: Partial<FakeState>, initialUrl = '/') {
  mockFake = createFakeSupabase({ session: null, tables: {}, ...state });
  return renderRouter(appDir, { initialUrl });
}

/** What RLS returns to a guardian of Lea (group Galebovi) and Nika (linked, no group yet, D-32). */
const guardianTables = () => ({
  memberships: [membership(ME, 'guardian', ALFA)],
  organizations: [ALFA],
  children: [
    { id: 'c-lea', first_name: 'Lea', last_name: 'Babić', organization_id: ALFA.id },
    { id: 'c-nika', first_name: 'Nika', last_name: 'Zgrablić', organization_id: ALFA.id },
  ],
  enrollments: [{ child_id: 'c-lea', group_id: 'g1', valid_during: since }],
  groups: [{ id: 'g1', name: 'Galebovi', facility_id: 'f1', organization_id: ALFA.id }],
  facilities: [{ id: 'f1', name: 'Objekt Maslina' }],
  child_guardians: [
    { child_id: 'c-lea', can_report_absence: true, valid_during: since },
    { child_id: 'c-nika', can_report_absence: false, valid_during: since },
  ],
  pickup_authorizations: [
    { id: 'p1', child_id: 'c-lea', first_name: 'Marija', last_name: 'Kos' },
    { id: 'p2', child_id: 'c-lea', first_name: 'Ivan', last_name: 'Kos' },
  ],
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Parent Home with authorized children (D2-H)', () => {
  it('shows each child with kindergarten, facility and group; a child without a group says so', async () => {
    await start({ session: session(ME), tables: guardianTables() });
    expect(await screen.findByText('Lea Babić')).toBeTruthy();
    expect(screen.getByText('Nika Zgrablić')).toBeTruthy();
    expect(screen.getByText('Vrtić Alfa (demo) · Objekt Maslina')).toBeTruthy();
    expect(screen.getByText('Skupina Galebovi')).toBeTruthy();
    expect(screen.getByText(hr.guardianHome.noGroup)).toBeTruthy();
    // Attendance arrives with D3: the status is "unavailable", never an invented state.
    expect(screen.getAllByText(hr.guardianHome.statusUnavailable).length).toBe(2);
    expect(screen.getByText(hr.guardianHome.noContent)).toBeTruthy();
  });

  it('shows exactly the children the server returned, nothing else', async () => {
    const tables = guardianTables();
    tables.children = tables.children.slice(0, 1);
    await start({ session: session(ME), tables });
    expect(await screen.findByText('Lea Babić')).toBeTruthy();
    expect(screen.queryByText('Nika Zgrablić')).toBeNull();
  });

  it('every request of the load carries one correlation id', async () => {
    await start({ session: session(ME), tables: guardianTables() });
    await screen.findByText('Lea Babić');
    const ids = new Set(
      mockFake.requests.filter((r) => ['children', 'enrollments', 'child_guardians', 'groups', 'facilities'].includes(r.table)).map((r) => r.headers[CORRELATION_HEADER]),
    );
    expect(ids.size).toBe(1);
    expect([...ids][0]).toMatch(CORRELATION_ID_PATTERN);
  });

  it('without an authorized child: the specified empty state', async () => {
    await start({ session: session(ME), tables: { ...guardianTables(), children: [] } });
    expect(await screen.findByText(hr.mobile.noData)).toBeTruthy();
  });

  it('a failed load shows the error with retry, and retry loads the children', async () => {
    await start({ session: session(ME), tables: guardianTables(), failNext: { table: 'children', error: { code: '500', message: 'boom' } } });
    expect(await screen.findByText(hr.mobile.loadError)).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.common.retry));
    expect(await screen.findByText('Lea Babić')).toBeTruthy();
  });

  it('an expired session during the load returns to sign-in', async () => {
    const r = await start({
      session: session(ME),
      tables: guardianTables(),
      failNext: { table: 'children', error: { code: 'PGRST303', status: 401, message: 'JWT expired' } },
    });
    await waitFor(() => expect(r.getPathname()).toBe('/sign-in'));
  });
});

describe('child detail (read-only)', () => {
  it('opens from Parent Home, lists the pickup persons without any edit action, and Back returns to the list', async () => {
    await start({ session: session(ME), tables: guardianTables() });
    await fireEvent.press(await screen.findByLabelText(/^Lea Babić\./));
    expect(await screen.findByText(hr.childDetail.pickups)).toBeTruthy();
    expect(screen.getByText('Ivan Kos')).toBeTruthy();
    expect(screen.getByText('Marija Kos')).toBeTruthy();
    expect(screen.getByText(hr.childDetail.pickupsNote)).toBeTruthy();
    expect(screen.getByLabelText(`${hr.childDetail.group}: Galebovi`)).toBeTruthy();
    expect(screen.getByLabelText(`${hr.childDetail.facility}: Objekt Maslina`)).toBeTruthy();
    expect(screen.queryByText(/Dodaj|Uredi|Obriši/)).toBeNull();
    // The pickup list is requested for this child only, with a correlation id.
    const pickupRequest = mockFake.requests.find((r) => r.table === 'pickup_authorizations');
    expect(pickupRequest?.headers[CORRELATION_HEADER]).toMatch(CORRELATION_ID_PATTERN);
    await fireEvent.press(screen.getByText(`‹ ${hr.childDetail.back}`));
    expect(await screen.findByText(hr.mobile.myChildren)).toBeTruthy();
  });

  it('a child without a group shows the not-placed text, no facility and no pickup persons', async () => {
    await start({ session: session(ME), tables: guardianTables() });
    await fireEvent.press(await screen.findByLabelText(/^Nika Zgrablić\./));
    expect(await screen.findByLabelText(`${hr.childDetail.group}: ${hr.childDetail.noGroup}`)).toBeTruthy();
    expect(screen.queryByText(hr.childDetail.facility)).toBeNull();
    expect(screen.getByText(hr.childDetail.pickupsEmpty)).toBeTruthy();
  });

  it('when access ends between list and detail (e.g. a new restriction), the detail shows nothing of the child', async () => {
    const tables = guardianTables();
    await start({ session: session(ME), tables });
    const card = await screen.findByLabelText(/^Lea Babić\./);
    tables.children.splice(0, 1);
    tables.pickup_authorizations.splice(0);
    await fireEvent.press(card);
    expect(await screen.findByText(hr.childDetail.notFound)).toBeTruthy();
    expect(screen.queryByText('Marija Kos')).toBeNull();
  });
});

describe('educator: children per group today (D2-H)', () => {
  it('lists the names of the children enrolled today, and an empty group says so', async () => {
    await start({
      session: session('edu-1'),
      tables: {
        memberships: [membership('edu-1', 'educator', ALFA)],
        groups: [
          { id: 'g1', name: 'Galebovi', organization_id: ALFA.id, facility_id: 'f1' },
          { id: 'g2', name: 'Školjke', organization_id: ALFA.id, facility_id: 'f1' },
        ],
        facilities: [{ id: 'f1', name: 'Objekt Maslina' }],
        staff_assignments: [],
        enrollments: [
          { child_id: 'c-lea', group_id: 'g1', valid_during: since },
          { child_id: 'c-ivo', group_id: 'g1', valid_during: since },
          { child_id: 'c-old', group_id: 'g1', valid_during: '[2020-01-01,2020-06-30)' },
        ],
        children: [
          { id: 'c-lea', first_name: 'Lea', last_name: 'Babić' },
          { id: 'c-ivo', first_name: 'Ivo', last_name: 'Antić' },
          { id: 'c-old', first_name: 'Stari', last_name: 'Upis' },
        ],
      },
    });
    expect(await screen.findByText('Ivo Antić')).toBeTruthy();
    expect(screen.getByText('Lea Babić')).toBeTruthy();
    expect(screen.queryByText('Stari Upis')).toBeNull();
    expect(screen.getByText(`${hr.mobile.groupChildren} · 2`)).toBeTruthy();
    expect(screen.getByText(hr.mobile.groupEmpty)).toBeTruthy();
  });
});

describe('D3-F: status and absences for guardians', () => {
  const today = orgLocalDate(new Date());
  const withStatus = (rows: Record<string, unknown>[], extra: Record<string, Record<string, unknown>[]> = {}) => ({
    ...guardianTables(),
    'rpc:child_day_status': rows,
    ...extra,
  });

  it('Parent Home shows the real status of the day without staff data (FR-05-9)', async () => {
    await start({
      session: session(ME),
      tables: withStatus([
        { child_id: 'c-lea', status: 'present', arrived_at: '2026-11-15T06:42:00Z', departed_at: null, absence_reported: false, last_record_id: null },
        { child_id: 'c-nika', status: 'not_enrolled', arrived_at: null, departed_at: null, absence_reported: false, last_record_id: null },
      ]),
    });
    expect(await screen.findByText('U vrtiću od 07:42')).toBeTruthy();
    expect(screen.getByText(hr.guardianHome.statusUnavailable)).toBeTruthy();
  });

  it('a reported absence shows its range and leads to the review', async () => {
    await start({
      session: session(ME),
      tables: withStatus([{ child_id: 'c-lea', status: 'absent', arrived_at: null, departed_at: null, absence_reported: true, last_record_id: null }], {
        absence_records: [{ id: 'abs-1', child_id: 'c-lea', starts_on: today, ends_on: addDays(today, 2), reported_by: ME, is_late: false, status: 'active' }],
      }),
    });
    await fireEvent.press(await screen.findByText(hr.guardianHome.reviewAbsence));
    expect(await screen.findByText(hr.childDetail.absences)).toBeTruthy();
    expect(screen.getByText(hr.childDetail.cancelAbsence)).toBeTruthy();
  });

  it('report: choose the range, check the summary, send — no reason is asked or sent; the home confirms receipt only', async () => {
    const state: FakeState = { session: session(ME), tables: withStatus([]), rpc: { report_absence: () => ({ data: 'abs-new', error: null }) } };
    mockFake = createFakeSupabase(state);
    await renderRouter(appDir, { initialUrl: '/' });
    await fireEvent.press(await screen.findByText(hr.guardianHome.reportAbsence));
    expect(await screen.findByText(hr.absence.title)).toBeTruthy();
    expect(screen.getByText(hr.absence.noReasonNote)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(`${hr.absence.to} ${dayLabel(addDays(today, 2))}`));
    await fireEvent.press(screen.getByText(hr.absence.continue));
    expect(screen.getByText('3 dana')).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.absence.send));
    const call = mockFake.requests.find((r) => r.table === 'rpc:report_absence')!;
    expect(call.values).toEqual({ p_child_id: 'c-lea', p_starts_on: today, p_ends_on: addDays(today, 2) });
    expect(call.headers[CORRELATION_HEADER]).toMatch(CORRELATION_ID_PATTERN);
    expect(await screen.findByText(hr.absence.sent)).toBeTruthy();
    expect(screen.queryByText(/odobren/i)).toBeNull();
  });

  it('without a connection nothing is confirmed (no offline queue for absences)', async () => {
    mockFake = createFakeSupabase({
      session: session(ME),
      tables: withStatus([]),
      rpc: { report_absence: () => ({ data: null, error: { code: '', message: 'TypeError: Network request failed' } }) },
    });
    await renderRouter(appDir, { initialUrl: '/' });
    await fireEvent.press(await screen.findByText(hr.guardianHome.reportAbsence));
    await fireEvent.press(await screen.findByText(hr.absence.continue));
    await fireEvent.press(screen.getByText(hr.absence.send));
    expect(await screen.findByText(hr.absence.needsConnection)).toBeTruthy();
    expect(screen.queryByText(hr.absence.sent)).toBeNull();
  });

  it('a refusal is shown with its catalogued message', async () => {
    mockFake = createFakeSupabase({
      session: session(ME),
      tables: withStatus([]),
      rpc: { report_absence: () => ({ data: null, error: { code: 'P0001', message: 'ABSENCE_OVERLAP' } }) },
    });
    await renderRouter(appDir, { initialUrl: '/' });
    await fireEvent.press(await screen.findByText(hr.guardianHome.reportAbsence));
    await fireEvent.press(await screen.findByText(hr.absence.continue));
    await fireEvent.press(screen.getByText(hr.absence.send));
    expect(await screen.findByText(hr.errors.ABSENCE_OVERLAP)).toBeTruthy();
  });

  it("only the reporter cancels, after confirming; the other guardian's report has no cancel action", async () => {
    mockFake = createFakeSupabase({
      session: session(ME),
      tables: withStatus([], {
        absence_records: [
          { id: 'abs-mine', child_id: 'c-lea', starts_on: addDays(today, 1), ends_on: addDays(today, 1), reported_by: ME, is_late: false, status: 'active' },
          { id: 'abs-other', child_id: 'c-lea', starts_on: addDays(today, 5), ends_on: addDays(today, 6), reported_by: 'guardian-2', is_late: false, status: 'active' },
        ],
      }),
      rpc: { cancel_absence: () => ({ data: 'abs-mine', error: null }) },
    });
    await renderRouter(appDir, { initialUrl: '/' });
    await fireEvent.press(await screen.findByLabelText(/^Lea Babić\./));
    expect(await screen.findByText(hr.childDetail.absences)).toBeTruthy();
    expect(screen.getAllByText(hr.childDetail.cancelAbsence)).toHaveLength(1);
    await fireEvent.press(screen.getByText(hr.childDetail.cancelAbsence));
    expect(screen.getByText(hr.childDetail.cancelAbsenceConfirm)).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.childDetail.cancelAbsenceYes));
    expect(mockFake.requests.find((r) => r.table === 'rpc:cancel_absence')!.values).toEqual({ p_absence_id: 'abs-mine' });
    expect(await screen.findByText(hr.childDetail.absenceCancelled)).toBeTruthy();
  });

  it('without can_report_absence the report action is not offered (spec §4)', async () => {
    const tables = withStatus([]);
    tables.child_guardians = tables.child_guardians.map((l) => ({ ...l, can_report_absence: false }));
    await start({ session: session(ME), tables });
    await screen.findByText('Lea Babić');
    expect(screen.queryByText(hr.guardianHome.reportAbsence)).toBeNull();
  });
});
