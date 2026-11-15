import { createQueueStore, flushQueue, type FlushReport, type QueuedAttendance, type QueueStore, type SendResult } from '@vrticos/domain';

import { recordAttendance } from './attendance';
import { ATTENDANCE_QUEUE_KEY, classify } from './attendanceKeys';
import { newCorrelationId } from './correlation';
import { sessionStorage } from './supabase';

export { classify };

// D3-E: the offline queue of the educator's attendance taps (ADR-0012). Backed by the chunked SecureStore storage
// (keychain / keystore, this device only) — encrypted at rest without a new dependency. Holds ids only (SR-MOB-02).

export const queueFor = (userId: string): QueueStore => createQueueStore(sessionStorage, ATTENDANCE_QUEUE_KEY, userId);

async function send(item: QueuedAttendance, replay: boolean): Promise<SendResult> {
  try {
    const r = await recordAttendance(item.childId, item.kind, item.key, newCorrelationId(), item.occurredAt, replay ? 'offline_sync' : 'app');
    return { ok: true, recordId: r.recordId };
  } catch (e) {
    return classify(e);
  }
}

let running: Promise<FlushReport> | null = null;

/** One flush at a time per app (taps during a flush wait for it, so the order stays the tap order). */
export function flushAttendance(userId: string): Promise<FlushReport> {
  if (!running) {
    running = flushQueue(queueFor(userId), send).finally(() => {
      running = null;
    });
  }
  return running;
}

export async function enqueue(userId: string, item: QueuedAttendance): Promise<void> {
  if (running) await running;
  const store = queueFor(userId);
  await store.save([...(await store.load()), item]);
}

export async function removeFromQueue(userId: string, key: string): Promise<QueuedAttendance[]> {
  if (running) await running;
  const store = queueFor(userId);
  const next = (await store.load()).filter((x) => x.key !== key);
  await store.save(next);
  return next;
}
