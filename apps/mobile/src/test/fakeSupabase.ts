// In-memory stand-in for the Supabase client in render tests. It answers only what the app shell asks for and
// records every PostgREST request (table, operation, headers) so tests can assert correlation ids. It does NOT model
// RLS: authorization is proven by pgTAP and the integration tests; these tests prove what the app shows.
type Row = Record<string, unknown>;

export interface FakeSession {
  access_token: string;
  user: { id: string; email: string };
}

export interface FakeRequest {
  /** Table name, or `rpc:<function>` for an RPC in the api schema. */
  table: string;
  op: 'select' | 'update' | 'upsert' | 'rpc';
  headers: Record<string, string>;
  values?: Row;
  conflict?: string;
}

export interface FakeState {
  session: FakeSession | null;
  tables: Record<string, Row[]>;
  /** Next request to this table answers with this error (e.g. an expired token). */
  failNext?: { table: string; error: { code?: string; status?: number; message: string } };
  /** RPC handlers by function name (api schema); they may change `tables` to model the server's effect. */
  rpc?: Record<string, (args: Row, state: FakeState) => { data: unknown; error: unknown }>;
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
      gte: (col: string, value: string) => (filters.push((r) => r[col] === undefined || String(r[col]) >= value), api),
      update: (values: Row) => ((request.op = 'update'), (request.values = values), api),
      /** Upsert keyed by `onConflict` columns (comma-separated), like PostgREST. */
      upsert: (values: Row, opts?: { onConflict?: string }) => ((request.op = 'upsert'), (request.values = values), (request.conflict = opts?.onConflict), api),
      setHeader: (name: string, value: string) => ((request.headers[name] = value), api),
      then: (resolve: (r: { data: Row[] | null; error: unknown }) => unknown, reject?: (e: unknown) => unknown) => {
        requests.push(request);
        if (state.failNext?.table === table) {
          const error = state.failNext.error;
          state.failNext = undefined;
          return Promise.resolve({ data: null, error }).then(resolve, reject);
        }
        if (request.op === 'upsert') {
          const keys = (request.conflict ?? 'id').split(',');
          const list = (state.tables[table] ??= []);
          const hit = list.find((r) => keys.every((k) => r[k] === request.values![k]));
          if (hit) Object.assign(hit, request.values);
          else list.push({ ...request.values });
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        }
        const rows = (state.tables[table] ?? []).filter((r) => filters.every((f) => f(r)));
        if (request.op === 'update') for (const r of rows) Object.assign(r, request.values);
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      },
    };
    return api;
  }

  function rpcCall(fn: string, args: Row) {
    const request: FakeRequest = { table: `rpc:${fn}`, op: 'rpc', headers: {}, values: args };
    const api = {
      setHeader: (name: string, value: string) => ((request.headers[name] = value), api),
      then: (resolve: (r: { data: unknown; error: unknown }) => unknown, reject?: (e: unknown) => unknown) => {
        requests.push(request);
        if (state.failNext?.table === request.table) {
          const error = state.failNext.error;
          state.failNext = undefined;
          return Promise.resolve({ data: null, error }).then(resolve, reject);
        }
        const handler = state.rpc?.[fn];
        // Without a handler an RPC answers like a read with the rows in `tables['rpc:<name>']` (none by default).
        const result = handler ? handler(args, state) : { data: state.tables[`rpc:${fn}`] ?? [], error: null };
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return api;
  }

  // Realtime (D-43): records joined topics; `broadcast` delivers a payload to every channel of that topic.
  const channels: Array<{ topic: string; private: boolean; deliver: (payload: unknown) => void }> = [];
  const broadcast = (topic: string, payload: unknown) => channels.filter((c) => c.topic === topic).forEach((c) => c.deliver(payload));
  const client = {
    channel: (topic: string, opts: { config: { private: boolean } }) => {
      const entry = { topic, private: opts.config.private, deliver: (_p: unknown) => undefined as void };
      channels.push(entry);
      const ch = {
        on: (_type: string, _filter: unknown, cb: (m: { payload?: unknown }) => void) => {
          entry.deliver = (payload) => cb({ payload });
          return ch;
        },
        subscribe: (cb?: (status: string) => void) => {
          cb?.('SUBSCRIBED');
          return ch;
        },
      };
      return ch;
    },
    realtime: { setAuth: async (_token?: string) => undefined },
    removeChannel: async (ch: unknown) => {
      void ch;
      return 'ok';
    },
    from: (table: string) => builder(table),
    schema: (_name: string) => ({ rpc: (fn: string, args: Row = {}) => rpcCall(fn, args) }),
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
  return { client, requests, emit, channels, broadcast };
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
