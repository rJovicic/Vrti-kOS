// Correlation ids (api-conventions §9, R-51): one id per user action, sent as `x-correlation-id` on every request that
// action makes (PostgREST, Edge Functions), so the audit rows and server logs of that action can be tied together.
// The id carries no personal data and is never logged by the app.

export const CORRELATION_HEADER = 'x-correlation-id';

/** The format the database stores (audit trigger) and Edge Functions accept; anything else is replaced server-side. */
export const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * `mob-<time base36>-<16 random base36 chars>`. Not a secret and not used for authorization, so Math.random is
 * adequate (no extra crypto dependency); the time prefix keeps ids from different sessions apart.
 */
export function newCorrelationId(now: number = Date.now(), random: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < 16; i++) suffix += Math.floor(random() * 36).toString(36);
  return `mob-${now.toString(36)}-${suffix}`;
}
