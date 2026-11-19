'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { coalesce, type LiveEventKind } from '@vrticos/domain';

/** Kinds that change what the admin pages show (attendance views, announcement list). */
const ADMIN_KINDS: readonly LiveEventKind[] = ['attendance', 'announcement'];

/**
 * D-43: refreshes the current page's server data when a live hint arrives (via /api/live, Server-Sent Events).
 * The hint carries no content; router.refresh() re-runs the Server Components, so RLS and MFA decide again. On every
 * reconnect the page refreshes too, because events sent while disconnected are not replayed.
 */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    if (typeof EventSource === 'undefined') return;
    const refresh = coalesce(() => router.refresh(), 400);
    const source = new EventSource('/api/live');
    let opened = false;
    source.addEventListener('open', () => {
      if (opened) refresh.trigger();
      opened = true;
    });
    source.addEventListener('resync', () => refresh.trigger());
    source.addEventListener('hint', (e) => {
      try {
        const { kind } = JSON.parse((e as MessageEvent<string>).data) as { kind?: string };
        if (kind && (ADMIN_KINDS as readonly string[]).includes(kind)) refresh.trigger();
      } catch {
        // ignore malformed hints
      }
    });
    return () => {
      refresh.cancel();
      source.close();
    };
  }, [router]);
  return null;
}
