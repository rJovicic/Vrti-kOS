import type { KeyValueBackend } from '@vrticos/domain';
import { env } from './env';

/**
 * Web build (staging web preview only — docs/architecture/mobile-web-staging.md). Browsers have no keychain
 * (expo-secure-store has no web implementation), so the session lives in the tab's sessionStorage: it survives a page
 * reload and direct URLs, is never written to persistent localStorage, and ends when the tab is closed. It is readable
 * by scripts on this origin, which the server's strict CSP (scripts from 'self' only) protects; this is accepted only
 * for synthetic data (SR-SESS-01 "where feasible"). Any other environment refuses to start.
 */
if (!['staging', 'demo', 'local'].includes(env.appEnv)) {
  throw new Error('WEB_BUILD_NOT_ALLOWED: the web build is for synthetic staging/demo data only');
}

const store = (): Storage => globalThis.sessionStorage;
export const deviceStore: KeyValueBackend = {
  get: async (key) => store().getItem(key),
  set: async (key, value) => store().setItem(key, value),
  delete: async (key) => store().removeItem(key),
};

export const isWebBuild = true;
