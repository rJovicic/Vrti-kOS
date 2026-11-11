// Shared HTTP helpers for VrtićOS Edge Functions (api-conventions.md §4, §9).
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:3000').split(',').map((s) => s.trim());

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-correlation-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function json(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export function error(req: Request, status: number, code: string, correlationId: string): Response {
  return json(req, status, { error: { code, message: `errors.${code}`, correlationId } });
}

export function bearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  return h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : null;
}

/** Structured log line without personal data (SR-LOG-02): ids, codes and timings only. */
export function log(fn: string, correlationId: string, outcome: string, extra: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ fn, correlationId, outcome, ...extra }));
}
