// Test environment for render tests: the app reads only these public variables (src/lib/env.ts).
process.env.EXPO_PUBLIC_APP_ENV = 'demo';
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
