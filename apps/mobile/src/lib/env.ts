/**
 * Public, non-secret configuration only (EXPO_PUBLIC_* is bundled into the app).
 * The service/secret key must never appear here (SR-SUP-04).
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'demo',
} as const;

export const isDemo = env.appEnv === 'demo' || env.appEnv === 'local';
