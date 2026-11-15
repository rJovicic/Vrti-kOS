// D4-E render tests on the real Expo Router with the in-memory client: the educator writes today's overview of a group
// (warning, counter, fixed tags, draft or publish, same-day edit of a published one, business error), the guardian sees
// it in "Danas" on Parent Home and reads it with earlier days, without any author name; an unread announcement of today
// leads to the notification centre. Who may write and read is proven by pgTAP 26 and the integration tests.
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { orgLocalDate } from '@vrticos/domain';
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
const today = orgLocalDate(new Date(), 'Europe/Zagreb');
const rpcCalls = (fn: string) => mockFake.requests.filter((r) => r.table === `rpc:${fn}`);
type Row = Record<string, unknown>;

async function start(s: FakeState, initialUrl: string) {
  mockFake = createFakeSupabase(s);
  return renderRouter(appDir, { initialUrl });
}

function educator(entries: Row[] = []): FakeState {
  return {
    session: session('edu-1'),
    tables: {
      memberships: [membership('edu-1', 'educator', ALFA)],
      groups: [{ id: 'g1', name: 'Galebovi', organization_id: ALFA.id, facility_id: 'f1' }],
      facilities: [{ id: 'f1', name: 'Objekt Maslina' }],
      staff_assignments: [],
      enrollments: [{ child_id: 'c-lea', group_id: 'g1', valid_during: since }],
      children: [{ id: 'c-lea', first_name: 'Lea', last_name: 'Babić' }],
      daily_entries: entries,
    },
    rpc: {
      save_daily_entry: (args, st) => {
        if (String(args.p_body).length > 1000) return { data: null, error: { code: 'P0001', message: 'DAILY_ENTRY_CONTENT_INVALID' } };
        const list = st.tables.daily_entries!;
        const hit = list.find((e) => e.entry_date === today);
        const published = hit?.status === 'published' || args.p_publish === true;
        const row = { id: 'de1', group_id: 'g1', entry_date: today, body: args.p_body, activity_tags: args.p_tags, status: published ? 'published' : 'draft',
          published_at: published ? (hit?.published_at ?? '2026-11-15T13:20:00Z') : null, edited_at: hit?.status === 'published' ? '2026-11-15T14:00:00Z' : null };
        if (hit) Object.assign(hit, row);
        else list.push(row);
        return { data: 'de1', error: null };
      },
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('daily overview — educator (D4-E)', () => {
  it('writes today\'s overview with the warning, counter and fixed tags, and publishes it', async () => {
    await start(educator(), '/today');
    await fireEvent.press(await screen.findByText('Dnevni pregled: Galebovi'));
    expect(await screen.findByText(hr.daily.warning)).toBeTruthy();
    expect(screen.getByText('0 / 1000')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText(hr.daily.bodyLabel), 'Jutro u dvorištu, poslije priča.');
    expect(screen.getByText('32 / 1000')).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.daily.tags.outdoor));
    await fireEvent.press(screen.getByText(hr.daily.tags.story));
    await fireEvent.press(screen.getByText(hr.daily.publish));
    expect(rpcCalls('save_daily_entry')[0]!.values).toEqual({ p_group_id: 'g1', p_body: 'Jutro u dvorištu, poslije priča.', p_tags: ['outdoor', 'story'], p_publish: true });
    expect(await screen.findByText(hr.daily.published)).toBeTruthy();
    expect(screen.getByText(/^Objavljeno u /)).toBeTruthy();
    // After publishing: edit only, no draft.
    expect(screen.getByText(hr.daily.saveEdit)).toBeTruthy();
    expect(screen.queryByText(hr.daily.saveDraft)).toBeNull();
  });

  it('saves a draft; a published overview is edited the same day and marked "uređeno"', async () => {
    await start(educator(), '/today');
    await fireEvent.press(await screen.findByText('Dnevni pregled: Galebovi'));
    await fireEvent.changeText(await screen.findByLabelText(hr.daily.bodyLabel), 'Glazba.');
    await fireEvent.press(screen.getByText(hr.daily.saveDraft));
    expect(rpcCalls('save_daily_entry')[0]!.values).toMatchObject({ p_publish: false });
    expect(await screen.findByText(hr.daily.draft)).toBeTruthy();

    await start(educator([{ id: 'de1', group_id: 'g1', entry_date: today, body: 'Glazba.', activity_tags: ['music'], status: 'published', published_at: '2026-11-15T13:20:00Z', edited_at: null }]), '/today');
    await fireEvent.press(await screen.findByText('Dnevni pregled: Galebovi'));
    expect((await screen.findByLabelText(hr.daily.bodyLabel)).props.value).toBe('Glazba.');
    await fireEvent.changeText(screen.getByLabelText(hr.daily.bodyLabel), 'Glazba i ples.');
    await fireEvent.press(screen.getByText(hr.daily.saveEdit));
    expect(await screen.findByText(/uređeno/)).toBeTruthy();
  });

  it('a refusal shows the catalogued message', async () => {
    const st = educator();
    st.rpc!.save_daily_entry = () => ({ data: null, error: { code: 'P0001', message: 'DAILY_ENTRY_CONTENT_INVALID' } });
    await start(st, '/today');
    await fireEvent.press(await screen.findByText('Dnevni pregled: Galebovi'));
    await fireEvent.changeText(await screen.findByLabelText(hr.daily.bodyLabel), 'x');
    await fireEvent.press(screen.getByText(hr.daily.publish));
    expect(await screen.findByText(hr.errors.DAILY_ENTRY_CONTENT_INVALID)).toBeTruthy();
  });
});

describe('daily overview — guardian (D4-E)', () => {
  const guardian = (): FakeState => ({
    session: session('g-1'),
    tables: {
      memberships: [membership('g-1', 'guardian', ALFA)],
      organizations: [ALFA],
      children: [{ id: 'c-lea', first_name: 'Lea', last_name: 'Babić', organization_id: ALFA.id }],
      enrollments: [{ child_id: 'c-lea', group_id: 'g1', valid_during: since }],
      groups: [{ id: 'g1', name: 'Galebovi', facility_id: 'f1', organization_id: ALFA.id }],
      facilities: [{ id: 'f1', name: 'Objekt Maslina' }],
      child_guardians: [{ child_id: 'c-lea', can_report_absence: false, valid_during: since }],
      daily_entries: [
        { id: 'de1', group_id: 'g1', organization_id: ALFA.id, entry_date: today, body: 'Jutro u dvorištu.', activity_tags: ['outdoor'], status: 'published', published_at: `${today}T13:20:00Z`, edited_at: null },
        { id: 'de0', group_id: 'g1', organization_id: ALFA.id, entry_date: '2026-11-10', body: 'Glazba i priča.', activity_tags: ['music', 'story'], status: 'published', published_at: '2026-11-10T13:00:00Z', edited_at: null },
      ],
      announcements: [{ id: 'a1', organization_id: ALFA.id, title: 'Roditeljski sastanak', status: 'published', published_at: '2026-11-01T08:00:00Z' }],
      notifications: [{ id: 'n1', type: 'announcement.published', resource_id: 'a1', read_at: null, created_at: '2026-11-01T08:00:00Z' }],
    },
  });

  it('"Danas" shows today\'s overview and an unread announcement; the overview opens with earlier days and no author name', async () => {
    await start(guardian(), '/');
    expect(await screen.findByLabelText(/^Dnevni pregled: Galebovi\. Vrtić Alfa \(demo\) · Objavljeno u /)).toBeTruthy();
    expect(screen.getByLabelText('Roditeljski sastanak. Vrtić Alfa (demo). Novo')).toBeTruthy();
    expect(screen.queryByText(hr.guardianHome.noContent)).toBeNull();
    await fireEvent.press(screen.getByLabelText(/^Dnevni pregled: Galebovi\./));
    expect(await screen.findByText('Jutro u dvorištu.')).toBeTruthy();
    expect(screen.getByText(hr.daily.tags.outdoor)).toBeTruthy();
    expect(screen.getByText(/^Objavile odgojiteljice skupine u /)).toBeTruthy();
    expect(screen.getByText(hr.daily.earlier)).toBeTruthy();
    expect(screen.getByText('Glazba i priča.')).toBeTruthy();
    expect(screen.getByText('Glazba, Priča')).toBeTruthy();
    await fireEvent.press(screen.getByText(hr.daily.backHome));
    expect(await screen.findByText('Lea Babić')).toBeTruthy();
  });

  it('an announcement in "Danas" leads to the notification centre', async () => {
    const r = await start(guardian(), '/');
    await fireEvent.press(await screen.findByLabelText('Roditeljski sastanak. Vrtić Alfa (demo). Novo'));
    expect(await screen.findByText(hr.notices.lede)).toBeTruthy();
    expect(r.getPathname()).toBe('/notices');
  });
});
