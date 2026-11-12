// Render and router tests (backlog D1-10, D-30): jest-expo runs React Native components with the real Expo Router.
// Pure logic stays in Vitest (`*.test.ts`); Jest only picks up `*.render.test.tsx`.
// pnpm keeps packages under node_modules/.pnpm/<name>@<version>/node_modules/<name>, so the default jest-expo
// transformIgnorePatterns would skip React Native sources; this pattern looks through that extra level.
const transpile = [
  '(?:jest-)?react-native',
  '@react-native(?:-community)?',
  'expo(?:nent)?',
  '@expo(?:nent)?/.*',
  'expo-.*',
  '@react-navigation/.*',
  '@supabase/.*',
  'react-i18next',
  'i18next',
  'standard-navigation',
].join('|');

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  rootDir: __dirname,
  testMatch: ['<rootDir>/src/**/*.render.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [`node_modules/(?!(?:\\.pnpm/[^/]+/node_modules/)?(?:${transpile})(?:/|$))`],
};
