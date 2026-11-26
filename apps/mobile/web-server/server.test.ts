import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createWebServer } from './server.mjs';

const API = 'https://hfwlfdgzgulbutnjttnq.supabase.co';
let root: string;
let base: string;
let close: () => void;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'mobile-web-'));
  mkdirSync(join(root, '_expo/static/js/web'), { recursive: true });
  mkdirSync(join(root, 'assets'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<!doctype html><div id="root"></div>');
  writeFileSync(join(root, '_expo/static/js/web/entry-abc.js'), 'console.log(1)');
  writeFileSync(join(root, 'assets/icon.png'), 'png');
  writeFileSync(join(root, 'favicon.ico'), 'ico');
  writeFileSync(join(tmpdir(), 'outside-secret.txt'), 'nope');
  const server = createWebServer({ root, supabaseUrl: API, appEnv: 'staging' });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  close = () => server.close();
});
afterAll(() => close());

const get = (path: string, init?: RequestInit) => fetch(base + path, init);

describe('mobile web staging server', () => {
  it('serves index.html for app routes, so reloads and direct URLs work, never cached', async () => {
    for (const path of ['/', '/sign-in', '/today', '/messages', '/profile', '/deep/nested/route?x=1']) {
      const r = await get(path);
      expect(r.status, path).toBe(200);
      expect(r.headers.get('content-type')).toContain('text/html');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(await r.text()).toContain('id="root"');
    }
  });

  it('caches hashed bundles and assets for a year; other files are revalidated', async () => {
    const js = await get('/_expo/static/js/web/entry-abc.js');
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('text/javascript');
    expect(js.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect((await get('/assets/icon.png')).headers.get('cache-control')).toContain('immutable');
    expect((await get('/favicon.ico')).headers.get('cache-control')).toBe('no-cache');
  });

  it('a missing file with an extension is a 404, not the app', async () => {
    expect((await get('/_expo/static/js/web/missing.js')).status).toBe(404);
  });

  it('health check: 200 JSON, not cached, names only the public project host', async () => {
    const r = await get('/health');
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(await r.json()).toEqual({ status: 'ok', app: 'mobile-web', appEnv: 'staging', supabaseHost: 'hfwlfdgzgulbutnjttnq.supabase.co' });
  });

  it('sends strict security headers on every response', async () => {
    for (const path of ['/', '/health', '/_expo/static/js/web/entry-abc.js', '/nope.js']) {
      const h = (await get(path)).headers;
      const csp = h.get('content-security-policy') ?? '';
      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toMatch(/script-src[^;]*unsafe/);
      expect(csp).toContain(`connect-src 'self' ${API} wss://hfwlfdgzgulbutnjttnq.supabase.co`);
      expect(csp).toContain("frame-ancestors 'none'");
      expect(h.get('x-content-type-options')).toBe('nosniff');
      expect(h.get('referrer-policy')).toBe('no-referrer');
      expect(h.get('x-robots-tag')).toContain('noindex');
    }
    expect(await (await get('/robots.txt')).text()).toContain('Disallow: /');
  });

  it('never serves files outside the export folder', async () => {
    for (const path of ['/../outside-secret.txt', '/%2e%2e/outside-secret.txt', '/..%2Foutside-secret.txt', '/%2e%2e%2f%2e%2e%2fetc%2fpasswd']) {
      const r = await get(path);
      expect(await r.text(), path).not.toContain('nope');
      expect([200, 400, 404]).toContain(r.status);
    }
    expect((await get('/%00')).status).toBe(400);
    expect((await get('/%E0%A4%A')).status).toBe(400);
  });

  it('only GET and HEAD', async () => {
    expect((await get('/', { method: 'POST', body: 'x' })).status).toBe(405);
    const head = await get('/health', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
  });

  it('refuses to start for any environment other than staging, demo or local', () => {
    expect(() => createWebServer({ root, supabaseUrl: API, appEnv: 'production' })).toThrow('WEB_PREVIEW_NOT_ALLOWED');
    expect(() => createWebServer({ root, supabaseUrl: API, appEnv: '' })).toThrow('WEB_PREVIEW_NOT_ALLOWED');
    expect(() => createWebServer({ root, supabaseUrl: '', appEnv: 'staging' })).toThrow('EXPO_PUBLIC_SUPABASE_URL');
    expect(() => createWebServer({ root: join(root, 'nothing'), supabaseUrl: API, appEnv: 'staging' })).toThrow('no web export');
  });
});
