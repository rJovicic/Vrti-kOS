// HTTP clients. The access token is read from the environment by the CLI and only ever sent in the Authorization
// header to api.supabase.com; it is never logged or returned. Every SQL statement is a fixed read-only SELECT.

export type Fetch = typeof fetch;

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Fixed, read-only catalog queries (no user input reaches SQL). */
export const QUERIES: Record<string, string> = {
  migrations: 'select coalesce(json_agg(version order by version), \'[]\') as v from supabase_migrations.schema_migrations',
  tables_without_rls:
    "select count(*)::int as v from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname in ('public','audit') and c.relkind in ('r','p') and not c.relrowsecurity",
  anon_table_grants: "select count(*)::int as v from information_schema.role_table_grants where grantee = 'anon' and table_schema in ('public','api','private','audit')",
  publication_tables: "select count(*)::int as v from pg_publication_tables where pubname = 'supabase_realtime'",
  realtime_write_policies: "select count(*)::int as v from pg_policies where schemaname = 'realtime' and tablename = 'messages' and cmd <> 'SELECT'",
  realtime_receive_policy: "select count(*)::int as v from pg_policies where schemaname = 'realtime' and tablename = 'messages' and policyname = 'vrticos_receive_own_topic' and cmd = 'SELECT'",
  public_buckets: 'select count(*)::int as v from storage.buckets where public',
  buckets: 'select count(*)::int as v from storage.buckets',
  realtime_partitions:
    "select coalesce(json_agg(json_build_object('name', c.relname, 'bound', pg_get_expr(c.relpartbound, c.oid)) order by c.relname), '[]') as v from pg_inherits i join pg_class c on c.oid = i.inhrelid where i.inhparent = 'realtime.messages'::regclass",
  realtime_message_span:
    "select json_build_object('rows', count(*), 'oldest', min(inserted_at), 'newest', max(inserted_at), 'now', now()) as v from realtime.messages",
};

export function isReadOnly(sql: string): boolean {
  const s = sql.trim().toLowerCase();
  return s.startsWith('select ') && !s.includes(';') && !/\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|call|do|copy|set)\b/.test(s.replace(/'[^']*'/g, "''"));
}

export class ManagementClient {
  readonly ref: string;
  private readonly token: string;
  private readonly f: Fetch;
  private readonly base: string;
  constructor(opts: { ref: string; token: string; fetch?: Fetch; base?: string }) {
    if (!opts.token) throw new Error('management token missing');
    this.ref = opts.ref;
    this.token = opts.token;
    this.f = opts.fetch ?? fetch;
    this.base = opts.base ?? 'https://api.supabase.com/v1';
  }
  private async call(method: string, path: string, body?: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await this.f(`${this.base}/projects/${this.ref}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      throw new ApiError(`${method} ${path}: network error (${(e as Error).message})`, 0);
    }
    if (!res.ok) throw new ApiError(`${method} ${path}: HTTP ${res.status}`, res.status);
    const text = await res.text();
    try {
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      throw new ApiError(`${method} ${path}: response is not JSON`, res.status);
    }
  }
  get(path: string): Promise<unknown> {
    return this.call('GET', path);
  }
  patch(path: string, body: Record<string, unknown>): Promise<unknown> {
    return this.call('PATCH', path, body);
  }
  async query(name: string): Promise<unknown> {
    const sql = QUERIES[name];
    if (!sql) throw new Error(`unknown query ${name}`);
    if (!isReadOnly(sql)) throw new Error(`query ${name} is not read-only`);
    const rows = await this.call('POST', '/database/query', { query: sql, read_only: true });
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0] || !('v' in (rows[0] as object))) throw new ApiError(`query ${name}: unexpected response shape`, 200);
    return (rows[0] as { v: unknown }).v;
  }
}

export class PublicClient {
  private readonly f: Fetch;
  readonly apiUrl: string;
  readonly adminUrl: string;
  private readonly key: string;
  constructor(opts: { apiUrl: string; adminUrl: string; publishableKey: string; fetch?: Fetch }) {
    if (!opts.publishableKey.startsWith('sb_publishable_')) throw new Error('a publishable key (sb_publishable_…) is required for public checks');
    this.apiUrl = opts.apiUrl;
    this.adminUrl = opts.adminUrl;
    this.key = opts.publishableKey;
    this.f = opts.fetch ?? fetch;
  }
  async json(url: string, headers: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
    let res: Response;
    try {
      res = await this.f(url, { headers: { apikey: this.key, ...headers } });
    } catch (e) {
      throw new ApiError(`GET ${url}: network error (${(e as Error).message})`, 0);
    }
    const text = await res.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
    return { status: res.status, body };
  }
}
