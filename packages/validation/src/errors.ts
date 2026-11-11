/** Stable error codes (api-conventions §4). Clients map them to i18n keys `errors.<CODE>`. */
export const errorCodes = [
  'VALIDATION_FAILED',
  'AUTH_REQUIRED',
  'AUTH_SESSION_EXPIRED',
  'MFA_REQUIRED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'CONFLICT',
  'ATTENDANCE_DUPLICATE',
  'ENROLLMENT_OVERLAP',
  'INVITATION_ALREADY_USED',
  'RATE_LIMITED',
  'INTERNAL',
] as const;
export type ErrorCode = (typeof errorCodes)[number];

export interface ApiError {
  code: ErrorCode;
  /** i18n key, never server prose. */
  message: string;
  correlationId?: string;
  fields?: Record<string, string>;
}

/**
 * Maps a PostgREST/Postgres error to the public envelope. RLS denials and missing rows map to the
 * same NOT_FOUND response so existence is never revealed (SR-API-04).
 */
export function fromPostgrestError(err: { code?: string; message?: string }, correlationId?: string): ApiError {
  const base = correlationId ? { correlationId } : {};
  switch (err.code) {
    case '42501': // insufficient_privilege (RLS / grants)
    case 'PGRST116': // no rows for single()
      return { code: 'NOT_FOUND', message: 'errors.NOT_FOUND', ...base };
    case '23505': // unique_violation
    case '23P01': // exclusion_violation
      return { code: 'CONFLICT', message: 'errors.CONFLICT', ...base };
    case '23503': // foreign_key_violation — same response as not found
      return { code: 'NOT_FOUND', message: 'errors.NOT_FOUND', ...base };
    case '23514': // check_violation
    case '22P02': // invalid_text_representation
      return { code: 'VALIDATION_FAILED', message: 'errors.VALIDATION_FAILED', ...base };
    default:
      return { code: 'INTERNAL', message: 'errors.INTERNAL', ...base };
  }
}
