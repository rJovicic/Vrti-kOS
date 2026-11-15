// Pure helpers of the attendance screen (no client imports, so Vitest can load them).

/** "Lana B." — first name and initial of the last name, as in the prototype tiles. */
export const displayName = (first: string, last: string): string => `${first} ${last.charAt(0).toLocaleUpperCase('hr')}.`;

/** A random v4 UUID for idempotency (not a secret; uniqueness only). */
export function newIdempotencyKey(random: () => number = Math.random): string {
  const hex = Array.from({ length: 32 }, () => Math.floor(random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  const h = hex.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Catalogued business code of a failed write (P0001 message), or null for anything else. */
export function businessCode(error: unknown): string | null {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === 'P0001' && typeof e.message === 'string' && /^[A-Z_]+$/.test(e.message) ? e.message : null;
}
