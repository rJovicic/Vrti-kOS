import { afterEach, describe, expect, it, vi } from 'vitest';
import { coalesce, liveTopic, parseLiveEvent, subscribeLiveEvents, type LiveChannelLike, type LiveClientLike } from './live-events.ts';

const ID = '7b0c3a8f-631d-4212-aac6-427bdb61cc57';
const ID2 = 'b7e9fdd6-acd5-40f6-8149-e1f907e96ccf';
const ORG = '9eaa0538-add6-4613-9fce-74acec86c07f';

function fakeClient() {
  let onBroadcast: ((m: { payload?: unknown }) => void) | null = null;
  let onStatus: ((s: string) => void) | null = null;
  const calls: { topic?: string; private?: boolean; removed: number } = { removed: 0 };
  const channel: LiveChannelLike = {
    on: (_t, _f, cb) => {
      onBroadcast = cb;
      return channel;
    },
    subscribe: (cb) => {
      onStatus = cb;
      return channel;
    },
  };
  const client: LiveClientLike = {
    channel: (topic, opts) => {
      calls.topic = topic;
      calls.private = opts.config.private;
      return channel;
    },
    removeChannel: () => {
      calls.removed++;
    },
  };
  return { client, calls, emit: (payload: unknown) => onBroadcast!({ payload }), status: (s: string) => onStatus!(s) };
}

describe('live events (D-43)', () => {
  afterEach(() => vi.useRealTimers());

  it('joins only the private personal topic', () => {
    const f = fakeClient();
    subscribeLiveEvents(f.client, 'u1', { onEvent: () => undefined, onResync: () => undefined });
    expect(f.calls).toMatchObject({ topic: 'user:u1', private: true });
    expect(liveTopic('x')).toBe('user:x');
  });

  it('parses ids and kind only and rejects unknown kinds, bad ids and extra content', () => {
    expect(parseLiveEvent({ id: ID, kind: 'message', conversation_id: ID2, body: 'tajna', name: 'Ana' })).toEqual({
      id: ID,
      kind: 'message',
      refs: { conversation_id: ID2 },
    });
    expect(parseLiveEvent({ id: ID, kind: 'presence' })).toBeNull();
    expect(parseLiveEvent({ id: 'x', kind: 'message' })).toBeNull();
    expect(parseLiveEvent({ id: ID, kind: 'attendance', child_id: 'not-a-uuid' })).toEqual({ id: ID, kind: 'attendance', refs: {} });
    expect(parseLiveEvent(null)).toBeNull();
  });

  it('drops a duplicated event (same message id) so it triggers one refetch', () => {
    const f = fakeClient();
    const events: string[] = [];
    subscribeLiveEvents(f.client, 'u1', { onEvent: (e) => events.push(e.id), onResync: () => undefined });
    f.emit({ id: ID, kind: 'attendance', organization_id: ORG });
    f.emit({ id: ID, kind: 'attendance', organization_id: ORG });
    f.emit({ id: ID2, kind: 'attendance', organization_id: ORG });
    expect(events).toEqual([ID, ID2]);
  });

  it('asks for a full refetch when the channel is joined after a drop or a failed first attempt, not on a clean first join', () => {
    const f = fakeClient();
    const statuses: string[] = [];
    let resyncs = 0;
    subscribeLiveEvents(f.client, 'u1', { onEvent: () => undefined, onResync: () => resyncs++, onStatus: (s) => statuses.push(s) });
    f.status('SUBSCRIBED');
    expect(resyncs).toBe(0);
    f.status('CHANNEL_ERROR');
    f.status('SUBSCRIBED');
    expect(resyncs).toBe(1);
    expect(statuses).toEqual(['connecting', 'live', 'offline', 'live']);
    f.status('SUBSCRIBED'); // a repeated SUBSCRIBED without a drop does not refetch again
    expect(resyncs).toBe(1);
    const g = fakeClient();
    let resyncs2 = 0;
    subscribeLiveEvents(g.client, 'u1', { onEvent: () => undefined, onResync: () => resyncs2++ });
    g.status('CHANNEL_ERROR');
    g.status('SUBSCRIBED');
    expect(resyncs2).toBe(1);
  });

  it('stops forwarding and removes the channel on unsubscribe', () => {
    const f = fakeClient();
    const events: string[] = [];
    const stop = subscribeLiveEvents(f.client, 'u1', { onEvent: (e) => events.push(e.id), onResync: () => undefined });
    stop();
    f.emit({ id: ID, kind: 'message' });
    expect(events).toEqual([]);
    expect(f.calls.removed).toBe(1);
  });

  it('coalesces a burst into one run', () => {
    vi.useFakeTimers();
    let runs = 0;
    const c = coalesce(() => runs++, 300);
    c.trigger();
    c.trigger();
    c.trigger();
    vi.advanceTimersByTime(300);
    expect(runs).toBe(1);
    c.trigger();
    c.cancel();
    vi.advanceTimersByTime(300);
    expect(runs).toBe(1);
  });
});
