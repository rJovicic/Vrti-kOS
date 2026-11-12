import { defineConfig } from 'vitest/config';

// Vitest runs the pure-logic tests; React Native render tests (`*.render.test.tsx`) run in Jest (jest.config.js).
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], exclude: ['**/node_modules/**', '**/*.render.test.tsx'] },
});
