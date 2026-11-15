// Offline queue for attendance taps (ADR-0012, FR-05-8, SR-MOB-02, SR-API-08, AC-05-5). UI-free and storage-agnostic:
// the mobile app supplies the encrypted backing store (chunked SecureStore, keychain / keystore, device only).
//
// What is stored: per item only the idempotency key, the child id, the kind, the instant of the tap, optionally the id
// of the handover person (D3-H: a guardian link or a pickup authorization — never a name), the attempt count and the
// sync state — no names, no group, no free text. The whole queue is bound to one account; a queue of
// another account is never replayed (it is discarded on load).

import type { ChunkedStorage } from './session-storage.ts';

export interface QueuedAttendance {
  /** Idempotency key (UUID): the server stores each key once, so replays never duplicate (SR-API-08). */
  key: string;
  childId: string;
  kind: 'check_in' | 'check_out';
  /** ISO instant of the tap; replays send it as `occurred_at`, so the record keeps the real time. */
  occurredAt: string;
  attempts: number;
  /** `queued`: not yet accepted by the server. `failed`: refused after a replay — shown, never silently dropped. */
  state: 'queued' | 'failed';
  /** Catalogued code of the refusal (failed items only). */
  errorCode?: string;
  /** D3-H: the person chosen from the list (id only; the server checks it again on every replay). */
  handover?: Handover;
}

export interface Handover {
  kind: 'guardian' | 'pickup';
  /** `child_guardians.id` for a guardian, `pickup_authorizations.id` for a pickup person. */
  id: string;
}

export type SendResult = { ok: true; recordId: string } | { ok: false; network: true } | { ok: false; network: false; code: string };

export interface QueueStore {
  load(): Promise<QueuedAttendance[]>;
  save(items: QueuedAttendance[]): Promise<void>;
  clear(): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CODE = /^[A-Z_]{3,60}$/;

function isHandover(v: unknown): v is Handover {
  const h = v as Record<string, unknown>;
  return typeof h === 'object' && h !== null && (h.kind === 'guardian' || h.kind === 'pickup') && typeof h.id === 'string' && UUID.test(h.id) && Object.keys(h).length === 2;
}

/** Keeps only well-formed items with exactly the allowed fields (anything else in storage is discarded). */
export function sanitizeQueue(value: unknown): QueuedAttendance[] {
  if (!Array.isArray(value)) return [];
  const out: QueuedAttendance[] = [];
  for (const v of value) {
    const x = v as Record<string, unknown>;
    if (
      typeof x !== 'object' || x === null ||
      typeof x.key !== 'string' || !UUID.test(x.key) ||
      typeof x.childId !== 'string' || !UUID.test(x.childId) ||
      (x.kind !== 'check_in' && x.kind !== 'check_out') ||
      typeof x.occurredAt !== 'string' || Number.isNaN(Date.parse(x.occurredAt)) ||
      typeof x.attempts !== 'number' || !Number.isInteger(x.attempts) || x.attempts < 0 ||
      (x.state !== 'queued' && x.state !== 'failed') ||
      (x.errorCode !== undefined && (typeof x.errorCode !== 'string' || !CODE.test(x.errorCode))) ||
      (x.handover !== undefined && !isHandover(x.handover))
    ) {
      continue;
    }
    out.push({
      key: x.key,
      childId: x.childId,
      kind: x.kind,
      occurredAt: x.occurredAt,
      attempts: x.attempts,
      state: x.state,
      ...(x.errorCode ? { errorCode: x.errorCode as string } : {}),
      ...(x.handover ? { handover: { kind: (x.handover as Handover).kind, id: (x.handover as Handover).id } } : {}),
    });
  }
  return out;
}

/** A store bound to one account: items written by another account are discarded, never replayed. */
export function createQueueStore(storage: ChunkedStorage, storageKey: string, userId: string): QueueStore {
  return {
    async load() {
      const raw = await storage.getItem(storageKey);
      if (!raw) return [];
      try {
        const parsed = JSON.parse(raw) as { userId?: unknown; items?: unknown };
        if (parsed.userId !== userId) {
          await storage.removeItem(storageKey);
          return [];
        }
        return sanitizeQueue(parsed.items);
      } catch {
        await storage.removeItem(storageKey);
        return [];
      }
    },
    async save(items) {
      if (items.length === 0) return storage.removeItem(storageKey);
      await storage.setItem(storageKey, JSON.stringify({ userId, items: sanitizeQueue(items) }));
    },
    clear: () => storage.removeItem(storageKey),
  };
}

export interface FlushReport {
  /** Results per idempotency key of the items attempted in this flush. */
  results: Map<string, SendResult>;
  remaining: QueuedAttendance[];
}

/**
 * Sends queued items in tap order. Accepted items leave the queue; a refusal marks the item `failed` with its code (it
 * stays visible); a network failure stops the flush and keeps that item and the rest for later. Failed items are not
 * retried automatically.
 */
export async function flushQueue(store: QueueStore, send: (item: QueuedAttendance, replay: boolean) => Promise<SendResult>): Promise<FlushReport> {
  const items = (await store.load()).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const results = new Map<string, SendResult>();
  let stopped = false;
  const remaining: QueuedAttendance[] = [];
  for (const item of items) {
    if (stopped || item.state === 'failed') {
      remaining.push(item);
      continue;
    }
    const result = await send(item, item.attempts > 0);
    results.set(item.key, result);
    if (result.ok) continue;
    if (result.network) {
      stopped = true;
      remaining.push({ ...item, attempts: item.attempts + 1 });
    } else {
      remaining.push({ ...item, attempts: item.attempts + 1, state: 'failed', errorCode: result.code });
    }
  }
  await store.save(remaining);
  return { results, remaining };
}
