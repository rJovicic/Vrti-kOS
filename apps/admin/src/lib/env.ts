/** Public configuration only. The admin server never holds the service/secret key (ADR-0006, SR-EF-01). */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
  appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? 'demo',
} as const;

export const isDemo = env.appEnv === 'demo' || env.appEnv === 'local';
