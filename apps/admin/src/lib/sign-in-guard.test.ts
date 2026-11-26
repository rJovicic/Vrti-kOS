import { describe, expect, it } from 'vitest';
import { FixedWindowLimiter, type CounterStore } from './rate-limit';
import { clientAddress, createSignInGuard, normalizeEmail, normalizeIp, onRailway, retryMinutes, SIGN_IN_RULES } from './sign-in-guard';

const RAILWAY = { RAILWAY_ENVIRONMENT_ID: 'env', RAILWAY_SERVICE_ID: 'svc' };
const headers = (h: Record<string, string> = {}) => new Headers(h);
const from = (ip: string, extra: Record<string, string> = {}) => headers({ 'x-real-ip': ip, ...extra });

function guard(now = { t: 0 }, env: Record<string, string> = RAILWAY) {
  const logs: string[] = [];
  const g = createSignInGuard({ env, now: () => now.t, log: (l) => logs.push(l) });
  return { g, logs, now };
}
const send = (g: ReturnType<typeof guard>['g'], ip: string, email: string) => g.check('send', { headers: from(ip), subject: email });

describe('fixed-window limiter', () => {
  it('allows up to the limit, refuses with the remaining time, and allows again after the window', () => {
    const now = { t: 1_000 };
    const l = new FixedWindowLimiter([{ name: 'ip', limit: 2, windowMs: 60_000 }], { now: () => now.t });
    expect(l.consume({ ip: 'a' }).ok).toBe(true);
    expect(l.consume({ ip: 'a' }).ok).toBe(true);
    now.t += 15_000;
    expect(l.consume({ ip: 'a' })).toEqual({ ok: false, rule: 'ip', retryAfterSec: 45 });
    now.t = 1_000 + 59_999;
    expect(l.consume({ ip: 'a' }).ok).toBe(false);
    now.t = 1_000 + 60_000;
    expect(l.consume({ ip: 'a' }).ok).toBe(true);
  });

  it('a refused request uses up no allowance of the other rules', () => {
    const l = new FixedWindowLimiter(
      [
        { name: 'ip', limit: 1, windowMs: 60_000 },
        { name: 'email', limit: 2, windowMs: 60_000 },
      ],
      { now: () => 0 },
    );
    expect(l.consume({ ip: 'a', email: 'x' }).ok).toBe(true);
    expect(l.consume({ ip: 'a', email: 'x' }).ok).toBe(false); // refused by ip
    expect(l.consume({ ip: 'b', email: 'x' }).ok).toBe(true); // email still had one left
  });

  it('concurrent requests never exceed the limit (check and count are one synchronous step)', async () => {
    const l = new FixedWindowLimiter([{ name: 'global', limit: 20, windowMs: 60_000 }], { now: () => 0 });
    const results = await Promise.all(Array.from({ length: 200 }, () => Promise.resolve().then(() => l.consume({ global: 'all' }).ok)));
    expect(results.filter(Boolean)).toHaveLength(20);
  });

  it('refuses (fail closed) when it cannot hold more counters, after sweeping expired ones', () => {
    const now = { t: 0 };
    const l = new FixedWindowLimiter([{ name: 'ip', limit: 5, windowMs: 1_000 }], { now: () => now.t, maxKeys: 3 });
    for (const ip of ['a', 'b', 'c']) expect(l.consume({ ip }).ok).toBe(true);
    expect(l.consume({ ip: 'd' })).toEqual({ ok: false, rule: 'capacity', retryAfterSec: 1 });
    now.t = 1_000; // all expired → swept
    expect(l.consume({ ip: 'd' }).ok).toBe(true);
    expect(l.size).toBe(1);
  });

  it('throws on a missing subject instead of silently skipping a rule', () => {
    const l = new FixedWindowLimiter([{ name: 'ip', limit: 1, windowMs: 1 }]);
    expect(() => l.consume({})).toThrow('RATE_LIMIT_SUBJECT_MISSING:ip');
  });
});

describe('client address (only X-Real-IP set by the Railway edge)', () => {
  it('uses X-Real-IP only on Railway; never X-Forwarded-For', () => {
    expect(onRailway(RAILWAY)).toBe(true);
    expect(onRailway({})).toBe(false);
    expect(clientAddress(from('203.0.113.7'), RAILWAY)).toBe('203.0.113.7');
    expect(clientAddress(headers({ 'x-forwarded-for': '203.0.113.7' }), RAILWAY)).toBe('unknown');
    expect(clientAddress(from('203.0.113.7', { 'x-forwarded-for': '198.51.100.1' }), RAILWAY)).toBe('203.0.113.7');
  });

  it('off Railway a client-sent X-Real-IP is ignored (everyone shares the unknown bucket)', () => {
    expect(clientAddress(from('203.0.113.7'), {})).toBe('unknown');
  });

  it('rejects malformed values and groups IPv6 by /64', () => {
    expect(clientAddress(from('not-an-ip'), RAILWAY)).toBe('unknown');
    expect(clientAddress(from('203.0.113.7, 198.51.100.1'), RAILWAY)).toBe('unknown');
    expect(normalizeIp('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64');
    expect(normalizeIp('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64');
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });
});

describe('sign-in guard (PP-S2)', () => {
  it('limits repeated code requests from one address (10 per 15 min), across different e-mail addresses', () => {
    const { g } = guard();
    for (let i = 0; i < 10; i++) expect(send(g, '203.0.113.1', `a${i}@t.test`).ok).toBe(true);
    const r = send(g, '203.0.113.1', 'a10@t.test');
    expect(r).toMatchObject({ ok: false, rule: 'ip' });
    expect(send(g, '203.0.113.2', 'a10@t.test').ok).toBe(true); // another client is not affected
  });

  it('limits one address + e-mail pair (3 per 15 min)', () => {
    const { g } = guard();
    for (let i = 0; i < 3; i++) expect(send(g, '203.0.113.1', 'ravnatelj@t.test').ok).toBe(true);
    expect(send(g, '203.0.113.1', 'ravnatelj@t.test')).toMatchObject({ ok: false, rule: 'ip_email' });
  });

  it('limits one e-mail address requested from many addresses (5 per 15 min), normalised', () => {
    const { g } = guard();
    for (let i = 0; i < 5; i++) expect(send(g, `203.0.113.${i + 1}`, i % 2 ? ' Ravnatelj@T.test ' : 'ravnatelj@t.test').ok).toBe(true);
    expect(send(g, '203.0.113.99', 'RAVNATELJ@t.test')).toMatchObject({ ok: false, rule: 'email' });
    expect(normalizeEmail(' A@B.Test ')).toBe('a@b.test');
  });

  it('caps all traffic (20 per 5 min) against distributed attempts, below Auth’s own limit of 30', () => {
    const { g, now } = guard();
    for (let i = 0; i < 20; i++) expect(send(g, `198.51.100.${i}`, `x${i}@t.test`).ok).toBe(true);
    const r = send(g, '198.51.100.200', 'new@t.test');
    expect(r).toMatchObject({ ok: false, rule: 'global' });
    expect(Math.max(...SIGN_IN_RULES.send.filter((x) => x.name === 'global').map((x) => x.limit))).toBeLessThan(30);
    expect(SIGN_IN_RULES.verify.find((x) => x.name === 'global')!.limit).toBeLessThan(30);
    now.t += 5 * 60_000;
    expect(send(g, '198.51.100.200', 'new@t.test').ok).toBe(true);
  });

  it('a forged proxy header does not escape the limit (X-Forwarded-For is ignored; off Railway X-Real-IP too)', () => {
    const { g } = guard();
    for (let i = 0; i < 10; i++) g.check('send', { headers: from('203.0.113.1', { 'x-forwarded-for': `10.0.0.${i}` }), subject: `f${i}@t.test` });
    expect(g.check('send', { headers: from('203.0.113.1', { 'x-forwarded-for': '10.9.9.9' }), subject: 'z@t.test' })).toMatchObject({ ok: false, rule: 'ip' });
    const local = guard({ t: 0 }, {});
    for (let i = 0; i < 3; i++) expect(local.g.check('send', { headers: from(`203.0.113.${i}`), subject: 'same@t.test' }).ok).toBe(true);
    expect(local.g.check('send', { headers: from('203.0.113.200'), subject: 'same@t.test' })).toMatchObject({ ok: false, rule: 'ip_email' });
  });

  it('reports when to try again, and allows again once the window has passed', () => {
    const { g, now } = guard();
    for (let i = 0; i < 3; i++) send(g, '203.0.113.1', 'w@t.test');
    now.t += 5 * 60_000;
    const r = send(g, '203.0.113.1', 'w@t.test');
    expect(r).toEqual({ ok: false, rule: 'ip_email', retryAfterSec: 600 });
    expect(retryMinutes(600)).toBe(10);
    expect(retryMinutes(1)).toBe(1);
    now.t += 10 * 60_000;
    expect(send(g, '203.0.113.1', 'w@t.test').ok).toBe(true);
  });

  it('send, verify and MFA steps have separate allowances', () => {
    const { g } = guard();
    for (let i = 0; i < 3; i++) send(g, '203.0.113.1', 'v@t.test');
    expect(send(g, '203.0.113.1', 'v@t.test').ok).toBe(false);
    expect(g.check('verify', { headers: from('203.0.113.1'), subject: 'v@t.test' }).ok).toBe(true);
    for (let i = 0; i < 7; i++) g.check('verify', { headers: from('203.0.113.1'), subject: 'v@t.test' });
    expect(g.check('verify', { headers: from('203.0.113.1'), subject: 'v@t.test' })).toMatchObject({ ok: false, rule: 'ip_email' });
    expect(g.check('mfa', { headers: from('203.0.113.1'), subject: 'user-id' }).ok).toBe(true);
  });

  it('fails closed when the counters cannot be used, and logs no personal data', () => {
    const broken: CounterStore = {
      get: () => {
        throw new Error('store down');
      },
      set: () => undefined,
      delete: () => undefined,
      size: 0,
      keys: () => [][Symbol.iterator](),
    };
    const logs: string[] = [];
    const g = createSignInGuard({ env: RAILWAY, log: (l) => logs.push(l), limiters: { send: new FixedWindowLimiter(SIGN_IN_RULES.send, { store: broken }) } });
    expect(g.check('send', { headers: from('203.0.113.1'), subject: 'tajno@t.test' })).toEqual({ ok: false, rule: 'error', retryAfterSec: 60 });
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toMatch(/tajno|203\.0\.113|@/);
    expect(JSON.parse(logs[0]!)).toEqual({ event: 'auth_rate_limited', step: 'send', rule: 'error', retryAfterSec: 60 });
  });

  it('cannot reveal whether an account exists: the decision uses only the request, never Auth', () => {
    // The guard has no access to Auth or the database; known and unknown addresses are counted identically.
    const a = guard();
    const b = guard();
    const seq = (g: ReturnType<typeof guard>['g'], addr: string) => Array.from({ length: 6 }, () => send(g, '203.0.113.1', addr));
    expect(seq(a.g, 'uprava.alfa@demo.vrtic.test')).toEqual(seq(b.g, 'nepostoji@demo.vrtic.test'));
  });

  it('keeps no plain e-mail address or IP in its counters', () => {
    const store = new Map<string, { count: number; resetAt: number }>();
    const g = createSignInGuard({ env: RAILWAY, log: () => undefined, limiters: { send: new FixedWindowLimiter(SIGN_IN_RULES.send, { store }) } });
    g.check('send', { headers: from('203.0.113.1'), subject: 'osoba@t.test' });
    expect([...store.keys()].join(' ')).not.toMatch(/osoba|203\.0\.113/);
    expect(store.size).toBe(4);
  });
});
