// D-43: live update hints over Supabase Realtime private Broadcast (docs/architecture/realtime.md).
//
// The database sends each event to the personal private topic `user:<profile id>` of every person who may read the
// row at that moment (migration 20261119150000). An event is only a HINT: it carries ids and a kind, never content.
// Clients react by refetching through the normal API, where RLS decides again — so a duplicated, reordered or missed
// event can never create, duplicate or reveal data. After a reconnect the client refetches everything it shows
// (events sent while disconnected are not replayed by Realtime).
//
// UI-free and platform-free: the Realtime client is passed in (mobile app, admin server route, tests).

export const LIVE_EVENT_KINDS = ['attendance', 'message', 'notification', 'announcement'] as const;
export type LiveEventKind = (typeof LIVE_EVENT_KINDS)[number];

/** Id fields an event may carry; anything else in a payload is ignored. */
const REF_KEYS = ['organization_id', 'child_id', 'record_id', 'conversation_id', 'message_id', 'notification_id', 'resource_id', 'announcement_id'] as const;
export type LiveEventRef = (typeof REF_KEYS)[number];

export interface LiveEvent {
  /** Unique per delivered message; used to drop duplicates. */
  id: string;
  kind: LiveEventKind;
  refs: Partial<Record<LiveEventRef, string>>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const liveTopic = (userId: string): string => `user:${userId}`;

/** Strict parse: returns null for anything that is not a known kind with a uuid id. Never passes other fields on. */
export function parseLiveEvent(payload: unknown): LiveEvent | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.id !== 'string' || !UUID.test(p.id)) return null;
  if (typeof p.kind !== 'string' || !(LIVE_EVENT_KINDS as readonly string[]).includes(p.kind)) return null;
  const refs: LiveEvent['refs'] = {};
  for (const key of REF_KEYS) {
    const v = p[key];
    if (typeof v === 'string' && UUID.test(v)) refs[key] = v;
  }
  return { id: p.id, kind: p.kind as LiveEventKind, refs };
}

/** The part of a Supabase Realtime channel this module uses. */
export interface LiveChannelLike {
  on(type: 'broadcast', filter: { event: string }, callback: (message: { payload?: unknown }) => void): LiveChannelLike;
  subscribe(callback: (status: string, error?: Error) => void): unknown;
}
export interface LiveClientLike {
  channel(topic: string, options: { config: { private: boolean } }): LiveChannelLike;
  removeChannel(channel: LiveChannelLike): unknown;
}

export type LiveStatus = 'connecting' | 'live' | 'offline';

export interface LiveHandlers {
  onEvent: (event: LiveEvent) => void;
  /** Called when the channel is joined again after a drop: refetch everything shown (missed events are not replayed). */
  onResync: () => void;
  onStatus?: (status: LiveStatus) => void;
}

export interface LiveOptions {
  /**
   * One extra resync this long after the first successful join (0 disables). After Supabase Realtime starts for an
   * idle project, its replication of realtime.messages begins only with the first client connection; events written
   * in that window are never delivered (measured in CI #77, 2026-11-25). The settle resync closes that gap.
   */
  settleMs?: number;
}

const SEEN_LIMIT = 500;
export const SETTLE_RESYNC_MS = 5_000;

/**
 * Joins the caller's own private topic and forwards validated, de-duplicated events. Returns the unsubscribe function.
 * Authorization is not decided here: the topic is only readable by its owner (RLS on realtime.messages) and the
 * database only sends events the person may read at that moment.
 */
export function subscribeLiveEvents(client: LiveClientLike, userId: string, handlers: LiveHandlers, options: LiveOptions = {}): () => void {
  const settleMs = options.settleMs ?? SETTLE_RESYNC_MS;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let joinedOnce = false;
  const seen: string[] = [];
  const seenSet = new Set<string>();
  // Resync whenever a join succeeds after anything other than a clean first join (a drop, or a failed first attempt):
  // events in between were not delivered.
  let needsResync = false;
  let closed = false;
  handlers.onStatus?.('connecting');

  const channel = client.channel(liveTopic(userId), { config: { private: true } });
  channel.on('broadcast', { event: '*' }, (message) => {
    if (closed) return;
    const event = parseLiveEvent(message.payload);
    if (!event || seenSet.has(event.id)) return;
    seenSet.add(event.id);
    seen.push(event.id);
    if (seen.length > SEEN_LIMIT) seenSet.delete(seen.shift()!);
    handlers.onEvent(event);
  });
  channel.subscribe((status) => {
    if (closed) return;
    if (status === 'SUBSCRIBED') {
      handlers.onStatus?.('live');
      if (needsResync) handlers.onResync();
      needsResync = false;
      if (!joinedOnce && settleMs > 0) {
        settleTimer = setTimeout(() => {
          settleTimer = null;
          if (!closed) handlers.onResync();
        }, settleMs);
      }
      joinedOnce = true;
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      handlers.onStatus?.('offline');
      needsResync = true;
    }
  });

  return () => {
    closed = true;
    if (settleTimer) clearTimeout(settleTimer);
    void client.removeChannel(channel);
  };
}

/**
 * Coalesces bursts (e.g. a whole group checked in) into one refetch per `waitMs`. Returns the trigger and a cancel.
 */
export function coalesce(run: () => void, waitMs = 300): { trigger: () => void; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    trigger: () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        run();
      }, waitMs);
    },
    cancel: () => {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
