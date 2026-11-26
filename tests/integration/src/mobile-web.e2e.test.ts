// Staging web preview of the mobile app (docs/architecture/mobile-web-staging.md) — browser end-to-end against the
// local stack and the static web server (MOBILE_WEB_URL, default http://localhost:8090; build with
// `pnpm --filter @vrticos/mobile export:web` and start `pnpm --filter @vrticos/mobile serve:web` first).
// Chromium with the iPhone 13 viewport, touch and user agent (WebKit/Safari itself is not installed in CI).
// Synthetic kindergartens per run; seed accounts only for read checks.
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chromium, devices, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, enrolMfa, latestMail, service, signInWithCode } from './helpers.ts';

const WEB = process.env.MOBILE_WEB_URL ?? 'http://localhost:8090';
const DB_URL = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const sql = (text: string) => spawnSync('psql', [DB_URL, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', text], { encoding: 'utf8' }).stdout.trim();

let browser: Browser;
let kg: Awaited<ReturnType<typeof createKindergarten>>;
let other: Awaited<ReturnType<typeof createKindergarten>>;
let childId: string;
const tag = randomUUID().slice(0, 4);
const childFirst = `Webko${tag}`;
const otherChild = `Betko${tag}`;

async function addChild(k: typeof kg, first: string): Promise<string> {
  const { data } = await service.from('children').insert({ organization_id: k.orgId, first_name: first, last_name: 'Testic' }).select('id').single().throwOnError();
  await service.from('enrollments').insert({ organization_id: k.orgId, child_id: data!.id, group_id: k.groupId, valid_during: '[2026-09-01,)' }).throwOnError();
  return data!.id as string;
}

// The iPhone descriptor asks for WebKit; Chromium is used with its viewport, touch and user agent.
const iphone = { ...devices['iPhone 13'], defaultBrowserType: undefined };
async function newPhone(): Promise<{ page: Page; errors: string[] }> {
  const ctx = await browser.newContext({ ...iphone });
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|ERR_ABORTED/.test(m.text()) && errors.push(m.text()));
  return { page, errors };
}
async function signIn(page: Page, address: string): Promise<void> {
  await page.goto(`${WEB}/`);
  await page.getByLabel('E-adresa').waitFor();
  const before = Date.now() - 1000;
  await page.getByLabel('E-adresa').fill(address);
  await page.getByRole('button', { name: 'Pošalji kod' }).click();
  const code = (await latestMail(address, 'Kod za prijavu', before))?.text.match(/\b(\d{6})\b/)?.[1];
  expect(code, 'six-digit code from Mailpit').toMatch(/^\d{6}$/);
  await page.getByLabel('Kod iz e-pošte').fill(code!);
  await page.getByRole('button', { name: 'Potvrdi' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/sign-in'), { timeout: 20_000 });
}
const body = (page: Page) => page.locator('body').innerText();
async function waitForText(page: Page, re: RegExp, timeout = 20_000): Promise<string> {
  const end = Date.now() + timeout;
  let text = '';
  while (Date.now() < end) {
    text = await body(page);
    if (re.test(text)) return text;
    await page.waitForTimeout(300);
  }
  throw new Error(`timed out waiting for ${re}; page shows: ${text.slice(0, 400)}`);
}

beforeAll(async () => {
  kg = await createKindergarten('mweb');
  other = await createKindergarten('mweb-b');
  childId = await addChild(kg, childFirst);
  await addChild(other, otherChild);
  // Group assignments are made by a manager with MFA (as in the admin app); the service role may not.
  for (const k of [kg, other]) {
    const { client: manager } = await signInWithCode(k.managerEmail);
    await enrolMfa(manager);
    await manager.from('staff_assignments').insert({ organization_id: k.orgId, membership_id: k.educatorMembershipId, group_id: k.groupId, valid_during: '[2026-01-01,)' }).throwOnError();
  }
  browser = await chromium.launch();
}, 120_000);
afterAll(async () => {
  await browser?.close();
});

describe('mobile web preview (iPhone viewport)', () => {
  it('server: health check, security headers, direct URLs return the app', async () => {
    const health = await fetch(`${WEB}/health`);
    expect(health.status).toBe(200);
    expect(((await health.json()) as { app: string }).app).toBe('mobile-web');
    for (const path of ['/', '/sign-in', '/today', '/attendance', '/profile']) {
      const r = await fetch(`${WEB}${path}`);
      expect(r.status, path).toBe(200);
      expect(r.headers.get('content-security-policy')).toContain("script-src 'self'");
      expect(r.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('educator: code sign-in, staging banner, own data only, reload and direct URLs keep the session', async () => {
    const { page, errors } = await newPhone();
    await signIn(page, kg.educatorEmail);
    let text = await waitForText(page, new RegExp(childFirst));
    expect(text).toContain('STAGING (web)');
    expect(text).not.toContain(otherChild); // another kindergarten's child is never shown (RLS)
    await page.reload();
    await waitForText(page, new RegExp(childFirst));
    expect(page.url()).not.toContain('/sign-in');
    await page.goto(`${WEB}/profile`);
    text = await waitForText(page, /Prijavljeni ste kao/);
    expect(text).toContain(kg.educatorEmail);
    expect(text).toContain('Odjava sa svih uređaja');
    expect(errors).toEqual([]);
  }, 90_000);

  it('educator: an arrival recorded elsewhere appears live on the attendance screen (no reload)', async () => {
    const { page } = await newPhone();
    await signIn(page, kg.educatorEmail);
    await page.goto(`${WEB}/attendance`);
    const short = `${childFirst} T.`;
    await waitForText(page, new RegExp(`${short}\\s+Očekuje se`));
    await page.waitForTimeout(6_000); // first-join settle resync (5 s) has passed: what follows must come live
    const { client } = await signInWithCode(kg.educatorEmail);
    const { error } = await client.schema('api').rpc('record_attendance', { p_child_id: childId, p_kind: 'check_in', p_idempotency_key: randomUUID() });
    expect(error).toBeNull();
    await waitForText(page, new RegExp(`${short}\\s+U vrtiću`), 20_000);
  }, 120_000);

  it('guardian: sees own children only', async () => {
    const address = 'roditelj.alfa.1@demo.vrtic.test';
    const { client } = await signInWithCode(address);
    const { data: own } = await client.from('children').select('first_name');
    expect(own?.length).toBeGreaterThan(0);
    // Let Auth's per-address code interval pass and keep the code mail just used out of the next sign-in's window:
    // a second request inside the interval is refused by Auth (the app then continues without a new code — R-42).
    await new Promise((r) => setTimeout(r, 2_500));
    const { page, errors } = await newPhone();
    await signIn(page, address);
    const text = await waitForText(page, new RegExp(own![0]!.first_name as string));
    expect(text).not.toContain(childFirst);
    expect(text).not.toContain(otherChild);
    expect(errors).toEqual([]);
  }, 90_000);

  it('manager: the mobile web app sends management to the admin (MFA lives there)', async () => {
    const { page } = await newPhone();
    await signIn(page, 'uprava.alfa@demo.vrtic.test');
    await waitForText(page, /Uprava vrtića radi u web administraciji/);
  }, 90_000);

  it('sign-out ends the tab session: back to sign-in, nothing left in storage, reload stays signed out', async () => {
    const { page } = await newPhone();
    await signIn(page, kg.educatorEmail);
    await page.goto(`${WEB}/profile`);
    await page.getByRole('button', { name: 'Odjava', exact: true }).click();
    await page.getByLabel('E-adresa').waitFor({ timeout: 15_000 });
    const keys = await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('vrticos.')));
    expect(keys).toEqual([]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /vrticos|sb-/.test(k)))).toEqual([]);
    await page.reload();
    await page.getByLabel('E-adresa').waitFor();
  }, 90_000);

  it('session policy applies on the web: a staff session past 30 days is refused at its next refresh → sign-in', async () => {
    const { page } = await newPhone();
    await signIn(page, kg.educatorEmail);
    await waitForText(page, new RegExp(childFirst));
    // Age the session in the database (local stack only) and let the tab's access token expire, then reload:
    // supabase-js must refresh, and the Auth hook refuses (SR-SESS-04: staff 30 days).
    const sid = await page.evaluate(() => {
      const n = Number((sessionStorage.getItem('vrticos.session') ?? '').split(':')[1]);
      const raw = Array.from({ length: n }, (_, i) => sessionStorage.getItem(`vrticos.session.${i}`)).join('');
      const s = JSON.parse(raw) as { access_token: string; expires_at: number };
      s.expires_at = Math.floor(Date.now() / 1000) - 60;
      for (let i = 0; i < n; i++) sessionStorage.removeItem(`vrticos.session.${i}`);
      sessionStorage.setItem('vrticos.session', 'chunks:1');
      sessionStorage.setItem('vrticos.session.0', JSON.stringify(s));
      return JSON.parse(atob(s.access_token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))).session_id as string;
    });
    sql(`update auth.sessions set created_at = now() - interval '31 days' where id = '${sid}'`);
    await page.reload();
    await page.getByLabel('E-adresa').waitFor({ timeout: 20_000 });
    expect(await page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('vrticos.session')))).toEqual([]);
  }, 90_000);
});
