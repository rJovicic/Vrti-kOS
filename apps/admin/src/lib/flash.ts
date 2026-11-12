import { t } from '@/lib/i18n';

// Messages travel as allow-listed keys in the query string (never free text, never personal data).
const okKeys = ['saved', 'invited', 'revoked', 'suspended', 'reactivated', 'ended'] as const;
const errorKeys = {
  VALIDATION_FAILED: 'errors.VALIDATION_FAILED',
  PERMISSION_DENIED: 'errors.PERMISSION_DENIED',
  NOT_FOUND: 'errors.NOT_FOUND',
  CONFLICT: 'errors.CONFLICT',
  INVITATION_PENDING_EXISTS: 'errors.INVITATION_PENDING_EXISTS',
  MEMBERSHIP_SUSPENDED: 'errors.MEMBERSHIP_SUSPENDED',
  RATE_LIMITED: 'errors.RATE_LIMITED',
  INTERNAL: 'errors.INTERNAL',
  CODE_INVALID: 'auth.codeInvalid',
  MFA_INVALID: 'auth.mfaInvalid',
} as const;
export type FlashError = keyof typeof errorKeys;
export type FlashOk = (typeof okKeys)[number];

export function readFlash(params: Record<string, string | string[] | undefined>): { kind: 'ok' | 'error'; text: string } | null {
  const e = typeof params.e === 'string' ? params.e : undefined;
  if (e && e in errorKeys) {
    const ref = typeof params.ref === 'string' && /^[0-9a-f-]{36}$/.test(params.ref) ? params.ref : '—';
    return { kind: 'error', text: t(errorKeys[e as FlashError], { correlationId: ref }) };
  }
  const ok = typeof params.ok === 'string' ? params.ok : undefined;
  if (ok && (okKeys as readonly string[]).includes(ok)) return { kind: 'ok', text: t(`admin.ok.${ok}`) };
  return null;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
