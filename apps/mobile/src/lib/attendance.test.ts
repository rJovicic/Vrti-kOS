import { describe, expect, it } from 'vitest';
import { businessCode, classify, displayName, newIdempotencyKey } from './attendanceKeys';

describe('attendance helpers (D3-D)', () => {
  it('tile names are first name and last initial, diacritics kept', () => {
    expect(displayName('Lana', 'Babić')).toBe('Lana B.');
    expect(displayName('Šime', 'đurić')).toBe('Šime Đ.');
  });

  it('idempotency keys are random UUID v4 and differ per call', () => {
    const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(200);
    for (const k of keys) expect(k).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('only catalogued business errors raised after authorization are shown by code', () => {
    expect(businessCode({ code: 'P0001', message: 'ATTENDANCE_STATE_CONFLICT' })).toBe('ATTENDANCE_STATE_CONFLICT');
    expect(businessCode({ code: '42501', message: 'PERMISSION_DENIED' })).toBeNull();
    expect(businessCode({ code: 'P0001', message: 'some prose with spaces' })).toBeNull();
    expect(businessCode(null)).toBeNull();
  });
  it('offline queue: undelivered requests stay queued, server refusals become visible failures', () => {
    expect(classify({ code: '', message: 'TypeError: Network request failed' })).toEqual({ ok: false, network: true });
    expect(classify({ code: 'PGRST303', status: 401, message: 'JWT expired' })).toEqual({ ok: false, network: true });
    expect(classify({ code: 'P0001', message: 'ATTENDANCE_STATE_CONFLICT' })).toEqual({ ok: false, network: false, code: 'ATTENDANCE_STATE_CONFLICT' });
    expect(classify({ code: '42501', message: 'PERMISSION_DENIED' })).toEqual({ ok: false, network: false, code: 'PERMISSION_DENIED' });
    expect(classify({ code: '23505', message: 'duplicate' })).toEqual({ ok: false, network: false, code: 'INTERNAL' });
  });
});
