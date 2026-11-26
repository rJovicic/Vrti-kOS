// PP-S2: the admin server calls Supabase Auth for every sign-in step, so Auth sees the admin server's address and all
// managers share one Auth rate limit. This guard limits attempts in the admin server BEFORE Auth is called, separately
// per client address, per e-mail address, per address + e-mail and for all traffic, with every global limit below
// Auth's own per-IP limit (docs/architecture/admin-rate-limit.md).
//
// Client address: only `X-Real-IP`, and only when running on Railway, whose edge sets it to the connecting client
// (docs.railway.com, Networking › Specs & Limits). X-Forwarded-For is never read. Anywhere else (local, CI) the client
// address is unknown and every request shares the "unknown" address bucket — stricter, never spoofable.
// Privacy: e-mail addresses and IPs are kept only as keyed hashes in memory; nothing personal is logged.
import { createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { FixedWindowLimiter, type Rule, type Verdict } from './rate-limit';

export type SignInStep = 'send' | 'verify' | 'mfa';

const MIN = 60_000;
/**
 * Limits per step. Global limits stay under Auth's per-IP limits for the admin server (sign_in_sign_ups and
 * token_verifications: 30 per 5 minutes on hosted Supabase), so one attacker cannot exhaust Auth for everyone.
 */
export const SIGN_IN_RULES: Readonly<Record<SignInStep, readonly Rule[]>> = {
  send: [
    { name: 'ip', limit: 10, windowMs: 15 * MIN },
    { name: 'email', limit: 5, windowMs: 15 * MIN },
    { name: 'ip_email', limit: 3, windowMs: 15 * MIN },
    { name: 'global', limit: 20, windowMs: 5 * MIN },
  ],
  verify: [
    { name: 'ip', limit: 20, windowMs: 15 * MIN },
    { name: 'email', limit: 10, windowMs: 15 * MIN },
    { name: 'ip_email', limit: 8, windowMs: 15 * MIN },
    { name: 'global', limit: 25, windowMs: 5 * MIN },
  ],
  // TOTP check of a signed-in (AAL1) manager; the subject is the account id instead of an e-mail address.
  mfa: [
    { name: 'ip', limit: 20, windowMs: 15 * MIN },
    { name: 'email', limit: 10, windowMs: 15 * MIN },
    { name: 'ip_email', limit: 8, windowMs: 15 * MIN },
    { name: 'global', limit: 25, windowMs: 5 * MIN },
  ],
};

export type RuntimeEnv = Readonly<Record<string, string | undefined>>;

/** Railway sets these in every deployment's runtime environment. */
export const onRailway = (env: RuntimeEnv): boolean => Boolean(env.RAILWAY_ENVIRONMENT_ID && env.RAILWAY_SERVICE_ID);

/** IPv6 addresses are grouped by /64 (one customer network); IPv4-mapped IPv6 counts as IPv4. */
export function normalizeIp(raw: string): string | null {
  const ip = raw.trim();
  const v = isIP(ip);
  if (v === 4) return ip;
  if (v !== 6) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped && isIP(mapped[1]!) === 4) return mapped[1]!;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  if (t.some((p) => p.includes('.')) || h.some((p) => p.includes('.'))) return null; // embedded IPv4 forms: not grouped
  const full = ip.includes('::') ? [...h, ...Array(8 - h.length - t.length).fill('0'), ...t] : h;
  if (full.length !== 8) return null;
  return `${full
    .slice(0, 4)
    .map((p) => p.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}

/** The client's address as a rate-limit subject, or 'unknown' when it cannot be trusted. */
export function clientAddress(headers: Pick<Headers, 'get'>, env: RuntimeEnv): string {
  if (!onRailway(env)) return 'unknown';
  const value = headers.get('x-real-ip');
  return (value && normalizeIp(value)) || 'unknown';
}

export const normalizeEmail = (email: string): string => email.normalize('NFC').trim().toLowerCase();

export interface SignInGuard {
  check(step: SignInStep, input: { headers: Pick<Headers, 'get'>; subject: string }): Verdict;
}

export function createSignInGuard(options: { env?: RuntimeEnv; now?: () => number; limiters?: Partial<Record<SignInStep, FixedWindowLimiter>>; log?: (line: string) => void } = {}): SignInGuard {
  const env = options.env ?? process.env;
  const log = options.log ?? ((line: string) => console.warn(line));
  const pepper = randomBytes(32);
  const hash = (value: string) => createHmac('sha256', pepper).update(value).digest('base64url').slice(0, 22);
  const limiters: Record<SignInStep, FixedWindowLimiter> = {
    send: options.limiters?.send ?? new FixedWindowLimiter(SIGN_IN_RULES.send, { now: options.now }),
    verify: options.limiters?.verify ?? new FixedWindowLimiter(SIGN_IN_RULES.verify, { now: options.now }),
    mfa: options.limiters?.mfa ?? new FixedWindowLimiter(SIGN_IN_RULES.mfa, { now: options.now }),
  };
  return {
    check(step, { headers, subject }) {
      let verdict: Verdict;
      try {
        const ip = hash(clientAddress(headers, env));
        const who = hash(normalizeEmail(subject));
        verdict = limiters[step].consume({ ip, email: who, ip_email: `${ip}.${who}`, global: 'all' });
      } catch {
        // Fail closed: if counting is impossible, nobody is let through to Auth for a minute.
        verdict = { ok: false, rule: 'error', retryAfterSec: 60 };
      }
      if (!verdict.ok) log(JSON.stringify({ event: 'auth_rate_limited', step, rule: verdict.rule, retryAfterSec: verdict.retryAfterSec }));
      return verdict;
    },
  };
}

/** Whole minutes for the person (at least 1). */
export const retryMinutes = (retryAfterSec: number): number => Math.max(1, Math.ceil(retryAfterSec / 60));

// One guard per server process (see rate-limit.ts: not shared between instances, reset on restart).
let shared: SignInGuard | null = null;
export const signInGuard = (): SignInGuard => (shared ??= createSignInGuard());
