import * as SecureStore from 'expo-secure-store';
import type { KeyValueBackend } from '@vrticos/domain';

/**
 * iOS / Android: the OS keychain / keystore (SR-SESS-01, SR-MOB-01), never AsyncStorage. Values are bound to this
 * device: not migrated through backups or to a new phone. The web build uses deviceStore.web.ts instead.
 */
const keychain = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
export const deviceStore: KeyValueBackend = {
  get: (key) => SecureStore.getItemAsync(key, keychain),
  set: (key, value) => SecureStore.setItemAsync(key, value, keychain),
  delete: (key) => SecureStore.deleteItemAsync(key, keychain),
};

/** True only in the web build (staging web preview). */
export const isWebBuild = false;
