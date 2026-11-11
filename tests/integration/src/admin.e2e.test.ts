// Browser end-to-end smoke of the admin app (admin-app.md §6) against the local stack and a running admin
// (ADMIN_URL, default http://localhost:3000). Fresh synthetic kindergarten per run; seed data only for negatives.
import { chromium, type Browser, type Page } from 'playwright';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createKindergarten, email, latestMail } from './helpers.ts';
import { totp } from './totp.ts';

const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:3000';
let browser: Browser;
let kg: Awaited<ReturnType<typeof createKindergarten>>;
let slug: string;

beforeAll(async () => {
  kg = await createKindergarten('e2e');
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
});

async function signIn(page: Page, address: string): Promise<void> {
  await page.goto(`${ADMIN}/sign-in`);
  const before = Date.now() - 1000;
  await page.getByLabel('E-adresa').fill(address);
  await page.getByRole('button', { name: 'Pošalji kod' }).click();
  await page.waitForURL(/\/sign-in\/code$/);
  const mail = await latestMail(address, 'Kod za prijavu', before);
  const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
  expect(code).toBeDefined();
  await page.getByLabel('Kod iz e-pošte').fill(code!);
  await page.getByRole('button', { name: 'Potvrdi' }).click();
}

/** Clicks a form button and waits until the Server Action redirect with its result (?ok= / ?e=) has landed. */
async function submit(page: Page, button: ReturnType<Page['getByRole']>): Promise<void> {
  const before = page.url();
  await button.click();
  await page.waitForURL((u) => u.href !== before && /[?&](ok|e)=/.test(u.search));
}

describe('admin app (browser)', () => {
  let page: Page;

  it('sends anonymous visitors to sign-in and sets security headers', async () => {
    page = await browser.newPage();
    const res = await page.goto(`${ADMIN}/`);
    expect(page.url()).toBe(`${ADMIN}/sign-in`);
    const headers = res!.headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['cache-control']).toBe('no-store');
  });

  it('a manager must enrol TOTP before any kindergarten page (AAL2)', async () => {
    await signIn(page, kg.managerEmail);
    await page.waitForURL(/\/mfa$/);
    await expect(page.getByRole('heading', { name: 'Postavite dvofaktorsku autentifikaciju' }).isVisible()).resolves.toBe(true);
    // Session cookies are httpOnly: page scripts cannot read the tokens.
    const session = (await page.context().cookies()).filter((c) => c.name.startsWith('sb-'));
    expect(session.length).toBeGreaterThan(0);
    expect(session.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true);
    const { data: org } = await (await import('./helpers.ts')).service.from('organizations').select('slug').eq('id', kg.orgId).single();
    slug = org!.slug as string;
    await page.goto(`${ADMIN}/${slug}`);
    expect(page.url()).toBe(`${ADMIN}/mfa`);

    await page.getByLabel('Kod iz aplikacije').fill('000000');
    await page.getByRole('button', { name: 'Potvrdi' }).click();
    await expect(page.locator('.flash.error').textContent()).resolves.toContain('Kod nije ispravan');

    const secret = (await page.locator('.secret code').textContent())!.trim();
    await page.getByLabel('Kod iz aplikacije').fill(totp(secret));
    await page.getByRole('button', { name: 'Potvrdi' }).click();
    await page.waitForURL(`${ADMIN}/${slug}`);
    await expect(page.getByRole('heading', { name: 'Pregled vrtića' }).isVisible()).resolves.toBe(true);
  });

  it('creates kindergarten structure: facility, academic year, group', async () => {
    await page.goto(`${ADMIN}/${slug}/facilities`);
    await page.getByLabel('Naziv objekta').fill('Objekt Smokva');
    await submit(page, page.getByRole('button', { name: 'Dodaj objekt' }));
    await expect(page.locator('.flash.ok').textContent()).resolves.toBe('Spremljeno.');
    await expect(page.getByRole('cell', { name: 'Objekt Smokva' }).isVisible()).resolves.toBe(true);

    await page.goto(`${ADMIN}/${slug}/academic-years`);
    await page.getByLabel('Naziv (npr. 2026./2027.)').fill('2027./2028.');
    await page.getByLabel('Početak').fill('2027-09-01');
    await page.getByLabel('Završetak').fill('2028-08-31');
    await submit(page, page.getByRole('button', { name: 'Dodaj pedagošku godinu' }));
    await expect(page.locator('.flash.ok').textContent()).resolves.toBe('Spremljeno.');
    // A second active year is refused by the database (one active year per kindergarten).
    await submit(page, page.getByRole('row', { name: /2027\.\/2028\./ }).getByRole('button', { name: 'Aktiviraj' }));
    await expect(page.locator('.flash.error').textContent()).resolves.toContain('već postoji');

    await page.goto(`${ADMIN}/${slug}/groups`);
    await page.getByLabel('Naziv skupine').fill('Dupini');
    await page.locator('select[name=facilityId]').selectOption({ label: 'Objekt Smokva' });
    await submit(page, page.getByRole('button', { name: 'Dodaj skupinu' }));
    await expect(page.getByRole('cell', { name: /Dupini/ }).isVisible()).resolves.toBe(true);
  });

  it('assigns the educator, rejects an open-ended substitute, shows today’s educators', async () => {
    await page.goto(`${ADMIN}/${slug}/staff`);
    await page.locator('select[name=groupId]').selectOption({ label: 'Dupini' });
    await page.getByLabel('Zamjena').check();
    await submit(page, page.getByRole('button', { name: 'Spremi raspored' }));
    await expect(page.locator('.flash.error').textContent()).resolves.toBe('Provjerite označena polja.');

    await page.locator('select[name=groupId]').selectOption({ label: 'Dupini' });
    await submit(page, page.getByRole('button', { name: 'Spremi raspored' }));
    await expect(page.locator('.flash.ok').textContent()).resolves.toBe('Spremljeno.');
    await page.goto(`${ADMIN}/${slug}/groups`);
    await expect(page.getByRole('row', { name: /Dupini/ }).textContent()).resolves.toContain('Odgojitelj');
  });

  it('invites a person (notice via Mailpit, no link) and revokes the invitation', async () => {
    const to = email('e2e-pozvana');
    const before = Date.now() - 1000;
    await page.goto(`${ADMIN}/${slug}/invitations`);
    await page.locator('input[name=firstName]').fill('Petra');
    await page.locator('input[name=lastName]').fill('Test');
    await page.getByLabel('E-adresa').fill(to);
    await page.locator('select[name=role]').selectOption('educator');
    await submit(page, page.getByRole('button', { name: 'Pošalji pozivnicu' }));
    await expect(page.locator('.flash.ok').textContent()).resolves.toBe('Pozivnica je poslana.');
    const notice = await latestMail(to, 'pozivnica', before);
    expect(notice?.text).not.toMatch(/https?:\/\//);

    await submit(page, page.getByRole('row', { name: new RegExp(to.replace('.', '\\.')) }).getByRole('button', { name: 'Opozovi' }));
    await expect(page.locator('.flash.ok').textContent()).resolves.toBe('Pozivnica je opozvana.');
  });

  it('another kindergarten’s URL is not found (NEG-01, no existence leak)', async () => {
    const res = await page.goto(`${ADMIN}/alfa-demo/staff`);
    expect(res!.status()).toBe(404);
  });

  it('an educator has no admin access', async () => {
    const p = await browser.newPage();
    await signIn(p, kg.educatorEmail);
    await p.waitForURL(`${ADMIN}/`);
    await expect(p.getByRole('heading', { name: 'Ovaj račun nema pristup administraciji.' }).isVisible()).resolves.toBe(true);
    const res = await p.goto(`${ADMIN}/${slug}/staff`);
    expect(res!.status()).toBe(404);
    await p.close();
  });

  it('sign-out ends the session', async () => {
    await page.goto(`${ADMIN}/${slug}`);
    await page.getByRole('button', { name: 'Odjava' }).click();
    await page.waitForURL(`${ADMIN}/sign-in`);
    await page.goto(`${ADMIN}/${slug}`);
    expect(page.url()).toBe(`${ADMIN}/sign-in`);
  });
});
