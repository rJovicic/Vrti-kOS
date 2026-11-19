// GET /api/live — D-43 live update hints for the admin app as Server-Sent Events.
//
// The admin keeps the Supabase session in httpOnly cookies and page scripts never see a token (SR-WEB-03), so the
// browser cannot open a Realtime connection itself. This route opens it on the server with the caller's access token,
// joins only the caller's own private topic `user:<id>` (RLS on realtime.messages) and forwards each validated hint
// (kind + ids, never content) to the browser. The stream ends before the access token expires; EventSource reconnects
// through the proxy, which refreshes the session cookie, and the page refetches on every (re)connect.
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { subscribeLiveEvents, type LiveEvent } from '@vrticos/domain';
import { env } from '@/lib/env';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_STREAM_MS = 10 * 60 * 1000;
const EXPIRY_MARGIN_MS = 60 * 1000;
const KEEPALIVE_MS = 25 * 1000;

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  // Same bar as every admin page: a signed-in manager session with MFA (AAL2).
  if (!claims?.sub || claims.aal !== 'aal2') return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) return new Response(null, { status: 401, headers: { 'Cache-Control': 'no-store' } });

  const userId = claims.sub;
  const ttl = Math.max(5_000, Math.min(MAX_STREAM_MS, Number(claims.exp) * 1000 - Date.now() - EXPIRY_MARGIN_MS));
  const realtime = createSupabaseClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => token,
  });

  // Send the caller's token before joining: a private channel joined with only the API key is refused.
  await realtime.realtime.setAuth(token);

  const encoder = new TextEncoder();
  let cleanup = () => undefined as void;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let open = true;
      const send = (event: string, data: unknown) => {
        if (open) controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const stop = subscribeLiveEvents(realtime, userId, {
        // Forward only the kind and ids that parseLiveEvent kept.
        onEvent: (e: LiveEvent) => send('hint', { kind: e.kind, refs: e.refs }),
        onResync: () => send('resync', {}),
        onStatus: (s) => send('status', { status: s }),
      });
      const keepalive = setInterval(() => open && controller.enqueue(encoder.encode(': keepalive\n\n')), KEEPALIVE_MS);
      const end = setTimeout(() => cleanup(), ttl);
      cleanup = () => {
        if (!open) return;
        open = false;
        clearInterval(keepalive);
        clearTimeout(end);
        stop();
        void realtime.removeAllChannels().finally(() => realtime.realtime.disconnect());
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };
      request.signal.addEventListener('abort', () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
