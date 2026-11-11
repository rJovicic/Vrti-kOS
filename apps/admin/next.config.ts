import type { NextConfig } from 'next';

const config: NextConfig = {
  // Shared workspace packages ship TypeScript source (no build step).
  transpilePackages: ['@vrticos/tokens', '@vrticos/i18n', '@vrticos/validation', '@vrticos/domain', '@vrticos/db-types'],
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
};

export default config;
