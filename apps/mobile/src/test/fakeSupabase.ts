// In-memory stand-in for the Supabase client in render tests. It answers only what the app shell asks for and
// records every PostgREST request (table, operation, headers) so tests can assert correlation ids. It does NOT model
// RLS: authorization is proven by pgTAP and the integration tests; these tests prove what the app shows.
type Row = Record<string, unknown>;

export interface FakeSession {
  access_token: string;
  user: { id: string; email: string };
}

export interface FakeRequest {
  table: string;
  op: 'select' | 'update';
  headers: Record<string, string>;
  values?: Row;
}

export interface FakeState {
  session: FakeSession | null;
  tables: Record<string, Row[]>;
  /** Next request to this table answers with this error (e.g. an expired token). */
  failNext?: { table: string; error: { code?: string; status?: number; message: string } };
}

type AuthListener = (event: string, session: FakeSession | null) => void;

export function createFakeSupabase(state: FakeState) {
  const requests: FakeRequest[] = [];
  const listeners = new Set<AuthListener>();
  const emit = (event: string, session: FakeSession | null) => {
    state.session = session;
    for (const l of listeners) l(event, session);
  };

  function builder(table: string) {
    const filters: ((r: Row) => boolean)[] = [];
    const request: FakeRequest = { table, op: 'select', headers: {} };
    const api = {
      select: () => api,
      order: () => api,
      eq: (col: string, value: unknown) => (filters.push((r) => r[col] === undefined || r[col] === value), api),
      in: (col: string, values: unknown[]) => (filters.push((r) => r[col] === undefined || values.includes(r[col])), api),
      update: (values: Row) => ((request.op = 'update'), (request.values = values), api),
      setHeader: (name: string, value: string) => ((request.headers[name] = value), api),
      then: (resolve: (r: { data: Row[] | null; error: unknown }) => unknown, reject?: (e: unknown) => unknown) => {
        requests.push(request);
        if (state.failNext?.table === table) {
          const error = state.failNext.error;
          state.failNext = undefined;
          return Promise.resolve({ data: null, error }).then(resolve, reject);
        }
        const rows = (state.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        if (request.op === 'update') for (const r of rows) Object.assign(r, request.values);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return api;
  }

  const client = {
    from: (table: string) => builder(table),
    auth: {
      getSession: async () => ({ data: { session: state.session } }),
      onAuthStateChange: (listener: AuthListener) => {
        listeners.add(listener);
        return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
      },
      signOut: async () => {
        emit('SIGNED_OUT', null);
        return { error: null };
      },
      signInWithOtp: async () => ({ error: null }),
      verifyOtp: async () => ({ data: { session: null }, error: { status: 400 } }),
      startAutoRefresh: async () => undefined,
      stopAutoRefresh: async () => undefined,
    },
  };
  return { client, requests, emit };
}

export const session = (id: string): FakeSession => ({ access_token: 'test-token', user: { id, email: `${id}@demo.vrtic.test` } });

const kindergarten = (id: string, name: string, privacy_notice_version: string | null = null) => ({ id, name, privacy_notice_version, timezone: 'Europe/Zagreb' });
export const ALFA = kindergarten('org-alfa', 'Vrtić Alfa (demo)');
export const BETA_WITH_NOTICE = kindergarten('org-beta', 'Vrtić Beta (demo)', 'demo-2026-11');

export const membership = (profileId: string, role: string, organization: Row, notice_ack_version: string | null = null): Row => ({
  profile_id: profileId,
  status: 'active',
  role,
  notice_ack_version,
  organization,
  organization_id: organization.id,
});
