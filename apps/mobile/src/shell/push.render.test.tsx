// D-40 render tests: the app registers the device for push once the person is in — only through the own-account RPC,
// keeping the token only in the device's encrypted storage — and removes it before sign-out (AC-08-3). Without an
// activated token provider (this version: no real devices) nothing is registered at all.
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { join } from 'node:path';
import { hr } from '@vrticos/i18n';
import { PUSH_TOKEN_KEY, setPushTokenProvider } from '../lib/pushRegistration';
import { ALFA, createFakeSupabase, membership, session, type FakeState } from '../test/fakeSupabase';

let mockFake: ReturnType<typeof createFakeSupabase>;
const mockStorage = new Map<string, string>();
jest.mock('../lib/supabase', () => ({
  get supabase() {
    return mockFake.client;
  },
  SESSION_KEY: 'vrticos.session',
  sessionStorage: {
    getItem: async (k: string) => mockStorage.get(k) ?? null,
    setItem: async (k: string, v: string) => void mockStorage.set(k, v),
    removeItem: async (k: string) => void mockStorage.delete(k),
  },
}));

const appDir = join(__dirname, '..', 'app');
const SYNTHETIC = 'ExponentPushToken[synthetic-render-01]';
const rpcCalls = (fn: string) => mockFake.requests.filter((r) => r.table === `rpc:${fn}`);
const state = (): FakeState => ({
  session: session('g-1'),
  tables: { memberships: [membership('g-1', 'guardian', ALFA)], organizations: [ALFA], children: [] },
  rpc: { register_push_token: () => ({ data: null, error: null }), unregister_push_token: () => ({ data: null, error: null }) },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockStorage.clear();
});
afterEach(() => setPushTokenProvider(null));

describe('push device registration (D-40)', () => {
  it('without an activated provider nothing is registered (no real devices in this version)', async () => {
    mockFake = createFakeSupabase(state());
    await renderRouter(appDir, { initialUrl: '/' });
    await screen.findByText(hr.nav.notices);
    expect(rpcCalls('register_push_token')).toHaveLength(0);
    expect(mockStorage.has(PUSH_TOKEN_KEY)).toBe(false);
  });

  it('with a synthetic provider the device is registered for the own account and removed before sign-out', async () => {
    setPushTokenProvider(async () => ({ token: SYNTHETIC, platform: 'ios' }));
    mockFake = createFakeSupabase(state());
    await renderRouter(appDir, { initialUrl: '/profile' });
    await screen.findByText(hr.auth.signOut);
    expect(rpcCalls('register_push_token')[0]!.values).toEqual({ p_token: SYNTHETIC, p_platform: 'ios' });
    expect(mockStorage.get(PUSH_TOKEN_KEY)).toBe(SYNTHETIC);
    await fireEvent.press(screen.getByText(hr.auth.signOut));
    await screen.findByText(hr.auth.signInTitle);
    expect(rpcCalls('unregister_push_token')[0]!.values).toEqual({ p_token: SYNTHETIC });
    expect(mockStorage.has(PUSH_TOKEN_KEY)).toBe(false);
  });
});
