import { type ErrorCode, errorCodes, errorMessageKey } from '@vrticos/validation';
import { t } from '@/lib/i18n';

// Messages travel as allow-listed keys in the query string (never free text, never personal data).
const okKeys = ['saved', 'invited', 'revoked', 'suspended', 'reactivated', 'ended'] as const;
// Error flashes are exactly the central catalog (D1-13): every code has the message key `errors.<CODE>`.
export type FlashError = ErrorCode;
export type FlashOk = (typeof okKeys)[number];

export function readFlash(params: Record<string, string | string[] | undefined>): { kind: 'ok' | 'error'; text: string } | null {
  const e = typeof params.e === 'string' ? params.e : undefined;
  const code = errorCodes.find((c) => c === e);
  if (code) {
    const ref = typeof params.ref === 'string' && /^[0-9a-f-]{36}$/.test(params.ref) ? params.ref : '—';
    return { kind: 'error', text: t(errorMessageKey(code), { correlationId: ref }) };
  }
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  if (ok && (okKeys as readonly string[]).includes(ok)) return { kind: 'ok', text: t(`admin.ok.${ok}`) };
  return null;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
