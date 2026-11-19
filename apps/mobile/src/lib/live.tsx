import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { coalesce, subscribeLiveEvents, type LiveEventKind } from '@vrticos/domain';
import { useSession } from './session';
import { supabase } from './supabase';

/**
 * D-43: live update hints (docs/architecture/realtime.md). One private Realtime channel per signed-in person, on
 * their own topic `user:<id>`; the database decides who gets which event at the moment it happens. An event carries
 * no content, so screens only refetch through the normal API (RLS decides again). After a reconnect every screen
 * refetches, because Realtime does not replay events sent while the phone was offline.
 */
interface Listener {
  kinds: readonly LiveEventKind[];
  run: () => void;
}
interface Registry {
  add: (l: Listener) => () => void;
}
const LiveContext = createContext<Registry>({ add: () => () => undefined });

export function LiveEventsProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const listeners = useRef(new Set<Listener>());
  const registry = useMemo<Registry>(
    () => ({
      add: (l) => {
        listeners.current.add(l);
        return () => listeners.current.delete(l);
      },
    }),
    [],
  );
  useEffect(() => {
    if (!userId) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    // Send the session token before joining: a private channel joined with only the API key is refused.
    void Promise.resolve(supabase.realtime.setAuth()).finally(() => {
      if (cancelled) return;
      stop = subscribeLiveEvents(supabase, userId, {
        onEvent: (e) => listeners.current.forEach((l) => (l.kinds.includes(e.kind) ? l.run() : undefined)),
        onResync: () => listeners.current.forEach((l) => l.run()),
      });
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId]);
  return <LiveContext.Provider value={registry}>{children}</LiveContext.Provider>;
}

/** Calls `refetch` (coalesced) when an event of one of `kinds` arrives or after a reconnect. */
export function useLiveRefresh(kinds: readonly LiveEventKind[], refetch: () => void): void {
  const registry = useContext(LiveContext);
  const latest = useRef(refetch);
  latest.current = refetch;
  const key = kinds.join(',');
  useEffect(() => {
    const burst = coalesce(() => latest.current(), 400);
    const remove = registry.add({ kinds: key.split(',') as LiveEventKind[], run: burst.trigger });
    return () => {
      remove();
      burst.cancel();
    };
  }, [registry, key]);
}
