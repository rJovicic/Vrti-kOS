import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@vrticos/db-types';
import { createChunkedStorage } from '@vrticos/domain';
import { deviceStore } from './deviceStore';
import { env } from './env';

/**
 * Session tokens: OS keychain/keystore on iOS and Android (SR-SESS-01, SR-MOB-01), never AsyncStorage; the tab's
 * sessionStorage in the staging web build (deviceStore.web.ts). Values are chunked (a Supabase session exceeds
 * SecureStore's per-value size).
 */
export const sessionStorage = createChunkedStorage(deviceStore);

export const SESSION_KEY = 'vrticos.session';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: { storage: sessionStorage, storageKey: SESSION_KEY, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (Supabase React Native guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
