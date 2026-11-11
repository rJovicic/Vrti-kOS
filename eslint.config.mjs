// Flat ESLint config for the whole monorepo. Boundary rules: technical-architecture.md §2.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const noUiInShared = {
  paths: [
    { name: 'react', message: 'Shared packages must stay UI-free (technical-architecture §2).' },
    { name: 'react-native', message: 'Shared packages must stay UI-free.' },
    { name: 'react-dom', message: 'Shared packages must stay UI-free.' },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**', '**/dist/**', '**/.next/**', '**/.expo/**', 'apps/mobile/expo-env.d.ts',
      'apps/admin/next-env.d.ts', 'packages/db-types/src/database.ts', '.claude/**', '.impeccable/**',
      'design/**', 'supabase/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.node, ...globals.browser } } },
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts', 'scripts/**/*.mjs'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        { selector: "Literal[value=/SUPABASE_SERVICE_ROLE|sb_secret_|service_role/]", message: 'Service/secret keys never belong in app code (SR-SUP-04).' },
      ],
    },
  },
  { files: ['packages/**/*.ts'], rules: { 'no-restricted-imports': ['error', noUiInShared] } },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [{ name: 'react-dom', message: 'No React DOM in the native app.' }, { name: 'next', message: 'No Next.js in the native app.' }], patterns: ['next/*'] }],
    },
  },
  {
    files: ['apps/admin/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { paths: [{ name: 'react-native', message: 'No React Native in the web admin.' }] }] },
  },
);
