import { defineConfig } from 'vitest/config';

// Integration tests run against the LOCAL Supabase stack only (pnpm db:start). Never point them elsewhere.
export default defineConfig({ test: { testTimeout: 60_000, hookTimeout: 60_000, include: ['src/**/*.test.ts'] } });
