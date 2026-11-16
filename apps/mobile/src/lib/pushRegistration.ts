import { sessionStorage, supabase } from './supabase';

// D-40 device registration for push (ADR-0007 option A). The device token is personal data: it is sent only to the own
// account's registration RPC (never readable back, SR-PUSH-02), kept on the device in the encrypted SecureStore only so
// it can be removed at sign-out (AC-08-3), and never logged.
//
// Real devices are NOT registered in this version (owner, 2026-11-16: no account, no credentials, no real devices): the
// default provider returns no token. At activation, a provider based on expo-notifications (permission prompt, Expo
// project id) is set here with setPushTokenProvider — nothing else changes. Tests set a synthetic provider.

export const PUSH_TOKEN_KEY = 'vrticos.push-token';
export interface DeviceToken {
  token: string;
  platform: 'ios' | 'android';
}
export type PushTokenProvider = () => Promise<DeviceToken | null>;

const noDevice: PushTokenProvider = async () => null;
let provider: PushTokenProvider = noDevice;

export function setPushTokenProvider(next: PushTokenProvider | null): void {
  provider = next ?? noDevice;
}

/** Registers this device for the signed-in account. Never throws: push is optional, the app works without it. */
export async function registerDevice(): Promise<'registered' | 'unavailable' | 'failed'> {
  try {
    const device = await provider();
    if (!device) return 'unavailable';
    const { error } = await supabase.schema('api').rpc('register_push_token', { p_token: device.token, p_platform: device.platform });
    if (error) return 'failed';
    await sessionStorage.setItem(PUSH_TOKEN_KEY, device.token);
    return 'registered';
  } catch {
    return 'failed';
  }
}

/** Removes this device's token from the account (before the session ends) and from the device. Best effort. */
export async function unregisterDevice(): Promise<void> {
  try {
    const token = await sessionStorage.getItem(PUSH_TOKEN_KEY);
    if (token) await supabase.schema('api').rpc('unregister_push_token', { p_token: token });
  } catch {
    // The server removes stale tokens itself (provider feedback, 60-day pruning).
  } finally {
    await sessionStorage.removeItem(PUSH_TOKEN_KEY);
  }
}
