/**
 * Central error code catalog (api-conventions §4, backlog D1-13).
 *
 * `errorCatalog` lists every code a client can receive — from Edge Functions, Server Actions, mapped PostgREST
 * errors and Auth flows — with its HTTP status. The user-facing text is always the i18n key `errors.<CODE>`
 * (`packages/i18n`), never server prose. `catalog.test.ts` scans the repository so a code used anywhere must exist
 * here and every code here must have a Croatian message.
 */
export const errorCatalog = {
  VALIDATION_FAILED: { status: 400 },
  /** Sign-in e-mail code wrong or expired (Auth verifyOtp). */
  CODE_INVALID: { status: 400 },
  /** TOTP code wrong (Auth MFA verify). */
  MFA_INVALID: { status: 400 },
  AUTH_REQUIRED: { status: 401 },
  /** Session ended or could not be refreshed; the app returns to sign-in (mobile shell, D1-10). */
  AUTH_SESSION_EXPIRED: { status: 401 },
  PERMISSION_DENIED: { status: 403 },
  NOT_FOUND: { status: 404 },
  METHOD_NOT_ALLOWED: { status: 405 },
  CONFLICT: { status: 409 },
  INVITATION_PENDING_EXISTS: { status: 409 },
  /** R-48: a suspended membership is lifted by reactivation, not by a new invitation. */
  MEMBERSHIP_SUSPENDED: { status: 409 },
  /** R-50: the kindergarten reached its invitation limit for the rolling hour. */
  INVITATION_LIMIT_REACHED: { status: 429 },
  RATE_LIMITED: { status: 429 },
  INTERNAL: { status: 500 },
} as const satisfies Record<string, { status: number }>;

export type ErrorCode = keyof typeof errorCatalog;
export const errorCodes = Object.keys(errorCatalog) as ErrorCode[];

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(errorCatalog, value);
}
export const errorStatus = (code: ErrorCode): number => errorCatalog[code].status;
export const errorMessageKey = (code: ErrorCode): `errors.${ErrorCode}` => `errors.${code}`;

/**
 * Exception names raised by the database (`raise exception '<NAME>'`) and the public code each one maps to.
 * Internal: only `exposedDbErrors` reach a client unchanged; everything else is generalised (SR-API-04).
 */
export const dbErrorCatalog = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  ONLY_ORG_ADMIN_MAY_INVITE_ORG_ADMIN: 'PERMISSION_DENIED',
  ONLY_ORG_ADMIN_MAY_CHANGE_ORG_ADMIN: 'PERMISSION_DENIED',
  INVITATION_ONLY_PENDING_CAN_BE_REVOKED: 'PERMISSION_DENIED',
  MEMBERSHIP_SELF_CHANGE_FORBIDDEN: 'PERMISSION_DENIED',
  MEMBERSHIP_IMMUTABLE_COLUMNS: 'PERMISSION_DENIED',
  MEMBERSHIP_ACK_IS_PERSONAL: 'PERMISSION_DENIED',
  TENANT_COLUMNS_IMMUTABLE: 'PERMISSION_DENIED',
  ASSIGNMENT_IMMUTABLE_COLUMNS: 'PERMISSION_DENIED',
  AUDIT_APPEND_ONLY: 'PERMISSION_DENIED',
  PASSWORDS_DISABLED: 'PERMISSION_DENIED',
  EMAIL_NOT_VERIFIED: 'PERMISSION_DENIED',
  ASSIGNMENT_REQUIRES_EDUCATOR: 'VALIDATION_FAILED',
  SUBSTITUTE_REQUIRES_APPROVER: 'VALIDATION_FAILED',
  INVALID_ARGUMENTS: 'VALIDATION_FAILED',
  MEMBERSHIP_SUSPENDED: 'MEMBERSHIP_SUSPENDED',
} as const satisfies Record<string, ErrorCode>;
export type DbErrorName = keyof typeof dbErrorCatalog;

/** Database exceptions (errcode P0001) whose name is safe to show: raised only after authorization succeeded. */
export const exposedDbErrors = ['MEMBERSHIP_SUSPENDED'] as const satisfies readonly DbErrorName[];

export interface ApiError {
  code: ErrorCode;
  /** i18n key, never server prose. */
  message: `errors.${ErrorCode}`;
  correlationId?: string;
  fields?: Record<string, string>;
}

const envelope = (code: ErrorCode, correlationId?: string): ApiError =>
  correlationId ? { code, message: errorMessageKey(code), correlationId } : { code, message: errorMessageKey(code) };

type PgError = { code?: string; message?: string };

const exposedDbError = (err: PgError): ErrorCode | null =>
  err.code === 'P0001' && (exposedDbErrors as readonly string[]).includes(err.message ?? '')
    ? dbErrorCatalog[err.message as DbErrorName]
    : null;

/**
 * Maps a PostgREST/Postgres error to the public envelope. RLS denials and missing rows map to the
 * same NOT_FOUND response so existence is never revealed (SR-API-04).
 */
export function fromPostgrestError(err: PgError, correlationId?: string): ApiError {
  const exposed = exposedDbError(err);
  if (exposed) return envelope(exposed, correlationId);
  switch (err.code) {
    case '42501': // insufficient_privilege (RLS / grants / guards)
    case 'PGRST116': // no rows for single()
    case '23503': // foreign_key_violation — same response as not found
      return envelope('NOT_FOUND', correlationId);
    case '23505': // unique_violation
    case '23P01': // exclusion_violation
      return envelope('CONFLICT', correlationId);
    case '23514': // check_violation
    case '22P02': // invalid_text_representation
    case '22023': // invalid_parameter_value (INVALID_ARGUMENTS)
      return envelope('VALIDATION_FAILED', correlationId);
    default:
      return envelope('INTERNAL', correlationId);
  }
}

/**
 * invite-member: the invitation row is inserted as the caller (RLS + guard decide). The answer is the same for a
 * kindergarten that does not exist and one the caller may not manage (PERMISSION_DENIED); the specific codes are
 * only possible after the guard authorized the caller.
 * - 23505: one pending invitation per person, role and kindergarten;
 * - no error but no row returned: the guard skipped the insert because the limit was reached (R-50);
 * - P0001 MEMBERSHIP_SUSPENDED (R-48).
 */
export function fromInvitationInsertError(err: PgError | null): ErrorCode {
  if (!err) return 'INVITATION_LIMIT_REACHED';
  if (err.code === '23505') return 'INVITATION_PENDING_EXISTS';
  return exposedDbError(err) ?? 'PERMISSION_DENIED';
}
