// Fixed-window request counters held in this process's memory (PP-S2, docs/architecture/admin-rate-limit.md).
//
// NOT a distributed rate limiter: counters live in one Node.js process. They reset when the process restarts and are
// not shared between instances — the staging/pilot admin service runs exactly one Railway replica, and adding a
// second one requires a shared store first (owner decision; no new service without approval).
// Atomicity: `consume` runs synchronously (no await between check and increment), so concurrent requests handled by
// the same process can never both take the last slot.

export interface Rule {
  /** Stable rule name; also the key prefix. */
  name: string;
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

interface Window {
  count: number;
  resetAt: number;
}

/** The part of a Map the limiter uses — replaceable in tests (e.g. a store that fails). */
export interface CounterStore {
  get(key: string): Window | undefined;
  set(key: string, value: Window): unknown;
  delete(key: string): unknown;
  readonly size: number;
  keys(): IterableIterator<string>;
}

export type Verdict = { ok: true } | { ok: false; rule: string; retryAfterSec: number };

export interface LimiterOptions {
  now?: () => number;
  store?: CounterStore;
  /** Above this many live counters the limiter sweeps expired ones; if still full it refuses (fail closed). */
  maxKeys?: number;
}

export class FixedWindowLimiter {
  private readonly now: () => number;
  private readonly store: CounterStore;
  private readonly maxKeys: number;

  constructor(
    private readonly rules: readonly Rule[],
    options: LimiterOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.store = options.store ?? new Map<string, Window>();
    this.maxKeys = options.maxKeys ?? 100_000;
  }

  /**
   * Counts one request against every rule (`subjects[rule.name]` is the subject of that rule, e.g. an IP address).
   * All rules are checked first; the request is counted only when every rule allows it, so a refused request does
   * not use up anyone's allowance. Throws only if the store throws — callers must treat that as a refusal.
   */
  consume(subjects: Readonly<Record<string, string>>): Verdict {
    const now = this.now();
    let refused: { rule: string; retryAfterSec: number } | null = null;
    const keys: { key: string; rule: Rule; current: Window | undefined }[] = [];
    for (const rule of this.rules) {
      const subject = subjects[rule.name];
      if (subject === undefined) throw new Error(`RATE_LIMIT_SUBJECT_MISSING:${rule.name}`);
      const key = `${rule.name}:${subject}`;
      let current = this.store.get(key);
      if (current && current.resetAt <= now) current = undefined;
      keys.push({ key, rule, current });
      if (current && current.count >= rule.limit) {
        const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
        if (!refused || retryAfterSec > refused.retryAfterSec) refused = { rule: rule.name, retryAfterSec };
      }
    }
    if (refused) return { ok: false, ...refused };

    if (this.store.size + keys.length > this.maxKeys) this.sweep(now);
    if (this.store.size + keys.length > this.maxKeys) {
      const longest = Math.max(...this.rules.map((r) => r.windowMs));
      return { ok: false, rule: 'capacity', retryAfterSec: Math.ceil(longest / 1000) };
    }
    for (const { key, rule, current } of keys) {
      this.store.set(key, current ? { count: current.count + 1, resetAt: current.resetAt } : { count: 1, resetAt: now + rule.windowMs });
    }
    return { ok: true };
  }

  /** Removes expired counters. */
  sweep(now = this.now()): void {
    for (const key of [...this.store.keys()]) {
      const w = this.store.get(key);
      if (w && w.resetAt <= now) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}
