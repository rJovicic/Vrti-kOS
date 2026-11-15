import { describe, expect, it } from 'vitest';
import { createQueueStore, flushQueue, sanitizeQueue, type QueuedAttendance, type SendResult } from './attendance-queue.ts';
import type { ChunkedStorage } from './session-storage.ts';

const memory = (): ChunkedStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v), removeItem: async (k) => void data.delete(k) };
};
const KEY = 'vrticos.attendance-queue';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = (n: number, over: Partial<QueuedAttendance> = {}): QueuedAttendance => ({
  key: uuid(n),
  childId: uuid(100 + n),
  kind: 'check_in',
  occurredAt: `2026-11-15T07:0${n}:00.000Z`,
  attempts: 0,
  state: 'queued',
  ...over,
});

describe('offline attendance queue (ADR-0012, SR-MOB-02)', () => {
  it('stores only ids, kind, time and sync state — anything else is dropped', () => {
    const dirty = [{ ...item(1), name: 'Lana Babić', note: 'tekst' }, { key: 'not-a-uuid' }, item(2, { errorCode: 'lower case' as never })];
    const clean = sanitizeQueue(dirty);
    expect(clean).toEqual([item(1)]);
    expect(JSON.stringify(clean)).not.toMatch(/Lana|tekst/);
  });

  it('is bound to one account: another account never replays it and the data is removed', async () => {
    const s = memory();
    await createQueueStore(s, KEY, 'user-a').save([item(1)]);
    expect(await createQueueStore(s, KEY, 'user-b').load()).toEqual([]);
    expect(s.data.has(KEY)).toBe(false);
  });

  it('a corrupt entry is discarded, not trusted', async () => {
    const s = memory();
    s.data.set(KEY, '{not json');
    expect(await createQueueStore(s, KEY, 'user-a').load()).toEqual([]);
    expect(s.data.has(KEY)).toBe(false);
  });

  it('sends in tap order; accepted items leave the queue; replays are marked as such', async () => {
    const store = createQueueStore(memory(), KEY, 'u');
    await store.save([item(2, { attempts: 1 }), item(1)]);
    const sent: [string, boolean][] = [];
    const report = await flushQueue(store, async (x, replay) => (sent.push([x.key, replay]), { ok: true, recordId: `r-${x.key}` }));
    expect(sent).toEqual([[uuid(1), false], [uuid(2), true]]);
    expect(report.remaining).toEqual([]);
    expect(await store.load()).toEqual([]);
  });

  it('a network failure stops the flush and keeps that item and the rest', async () => {
    const store = createQueueStore(memory(), KEY, 'u');
    await store.save([item(1), item(2), item(3)]);
    let n = 0;
    const report = await flushQueue(store, async (): Promise<SendResult> => (++n === 2 ? { ok: false, network: true } : { ok: true, recordId: 'r' }));
    expect(n).toBe(2);
    expect(report.remaining.map((x) => [x.key, x.attempts, x.state])).toEqual([[uuid(2), 1, 'queued'], [uuid(3), 0, 'queued']]);
  });

  it('a refusal marks the item failed with its code and keeps it visible; failed items are not retried', async () => {
    const store = createQueueStore(memory(), KEY, 'u');
    await store.save([item(1)]);
    await flushQueue(store, async () => ({ ok: false, network: false, code: 'PERMISSION_DENIED' }));
    expect(await store.load()).toEqual([item(1, { attempts: 1, state: 'failed', errorCode: 'PERMISSION_DENIED' })]);
    let calls = 0;
    await flushQueue(store, async () => (calls++, { ok: true, recordId: 'r' }));
    expect(calls).toBe(0);
  });

  it('clear wipes everything (sign-out)', async () => {
    const s = memory();
    const store = createQueueStore(s, KEY, 'u');
    await store.save([item(1)]);
    await store.clear();
    expect(s.data.size).toBe(0);
  });
});
