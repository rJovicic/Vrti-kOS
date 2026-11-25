// SR-SESS-02/03/04 evidence (docs/security/pre-pilot-decisions.md §1): what signing out does to refresh tokens and to
// access tokens that were already issued, measured on the local stack with two "devices" of one synthetic educator.
// Characterization: the last test documents today's window (no SR-SESS-04 check). If SR-SESS-04 is adopted, that
// expectation flips and this file is where it is proven.
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import { anonClient, claims, createKindergarten, signInWithCode, stack } from './helpers.ts';

let educator: string;

interface Device {
  client: SupabaseClient;
  access: string;
  refresh: string;
}

async function device(): Promise<Device> {
  const { client } = await signInWithCode(educator);
  const { data } = await client.auth.getSession();
  return { client, access: data.session!.access_token, refresh: data.session!.refresh_token };
}
const refreshWorks = async (refreshToken: string) => !(await anonClient().auth.refreshSession({ refresh_token: refreshToken })).error;
/** A REST read with only this access token (no refresh), like a request from a lost phone. */
const readWith = async (access: string) =>
  (await fetch(`${stack.API_URL}/rest/v1/groups?select=id`, { headers: { apikey: stack.PUBLISHABLE_KEY, authorization: `Bearer ${access}` } })).status;

beforeAll(async () => {
  educator = (await createKindergarten('sess')).educatorEmail;
}, 120_000);

describe('sessions: sign-out and revocation (SR-SESS-02/03/04)', () => {
  it('every sign-in is its own session; access tokens carry the session id SR-SESS-04 would check', async () => {
    const a = await device();
    const b = await device();
    expect(claims(a.access).session_id).toBeTruthy();
    expect(claims(a.access).session_id).not.toBe(claims(b.access).session_id);
  }, 60_000);

  it('rotation: a replaced refresh token is refused once its successor was used — but the session is NOT revoked (finding PP-S1)', async () => {
    const a = await device();
    const r1 = await anonClient().auth.refreshSession({ refresh_token: a.refresh });
    expect(r1.error).toBeNull();
    await new Promise((r) => setTimeout(r, 11_000)); // past refresh_token_reuse_interval (10 s)
    // While the successor is unused, the old token still returns that same successor (GoTrue v2.197 concurrency rule).
    const again = await anonClient().auth.refreshSession({ refresh_token: a.refresh });
    expect(again.data.session?.refresh_token).toBe(r1.data.session!.refresh_token);
    const r2 = await anonClient().auth.refreshSession({ refresh_token: r1.data.session!.refresh_token });
    expect(r2.error).toBeNull();
    await new Promise((r) => setTimeout(r, 11_000));
    expect(await refreshWorks(a.refresh)).toBe(false); // replay of a used token is refused...
    // ...but the newest token of the same session keeps working: reuse does not end the session family. A thief who
    // refreshed first keeps the session; only sign-out everywhere, suspension or SR-SESS-04 ends it.
    expect(await refreshWorks(r2.data.session!.refresh_token)).toBe(true);
  }, 60_000);

  it('signing out on one device (local scope) ends only that device; the other keeps working', async () => {
    const a = await device();
    const b = await device();
    await a.client.auth.signOut({ scope: 'local' });
    expect(await refreshWorks(a.refresh)).toBe(false);
    expect(await refreshWorks(b.refresh)).toBe(true);
  }, 60_000);

  it('"sign out everywhere" (global scope) ends every session of the person (SR-SESS-03)', async () => {
    const a = await device();
    const b = await device();
    await b.client.auth.signOut({ scope: 'global' });
    expect(await refreshWorks(a.refresh)).toBe(false);
    expect(await refreshWorks(b.refresh)).toBe(false);
  }, 60_000);

  it('TODAY: an access token issued before sign-out is still accepted until it expires (SR-SESS-04 not adopted)', async () => {
    const a = await device();
    expect(await readWith(a.access)).toBe(200);
    await a.client.auth.signOut({ scope: 'global' });
    // Window = remaining JWT lifetime (jwt_expiry 900 s locally and on staging). Authorization itself still comes from
    // database state (a suspended membership loses data at once, ST-REV-01); this is only the session window.
    expect(await readWith(a.access)).toBe(200);
    const remaining = Number(claims(a.access).exp) - Math.floor(Date.now() / 1000);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(900);
  }, 60_000);
});
