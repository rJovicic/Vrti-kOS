import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import type { Database } from '@vrticos/db-types';
import { createChunkedStorage } from '@vrticos/domain';
import { env } from './env';

/**
 * Session tokens live only in the OS keychain/keystore (SR-SESS-01, SR-MOB-01), never in AsyncStorage.
 * Values are chunked (a Supabase session exceeds SecureStore's per-value size) and bound to this device:
 * not migrated through backups or to a new phone.
 */
const keychain = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const sessionStorage = createChunkedStorage({
  get: (key) => SecureStore.getItemAsync(key, keychain),
  set: (key, value) => SecureStore.setItemAsync(key, value, keychain),
  delete: (key) => SecureStore.deleteItemAsync(key, keychain),
});

export const SESSION_KEY = 'vrticos.session';

export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: { storage: sessionStorage, storageKey: SESSION_KEY, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh tokens only while the app is in the foreground (Supabase React Native guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
