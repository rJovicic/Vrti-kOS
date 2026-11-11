import { describe, expect, it } from 'vitest';
import { totp } from './totp.ts';

describe('totp helper', () => {
  it('matches the RFC 6238 SHA-1 test vector (T = 59 s)', () => {
    // Secret "12345678901234567890" in base32; RFC 6238 expects 94287082 (8 digits) → last 6: 287082.
    expect(totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000)).toBe('287082');
  });
});
