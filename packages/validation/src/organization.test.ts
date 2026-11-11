import { describe, expect, it } from 'vitest';
import { fromPostgrestError } from './errors.ts';
import { zAcademicYearInput, zFacilityInput } from './organization.ts';

const org = '0b1f6f6e-0000-4000-8000-000000000001';

describe('validation', () => {
  it('normalizes and keeps Croatian diacritics', () => {
    const r = zFacilityInput.parse({ organizationId: org, name: '  Objekt Šišmiš Đurđevac  ' });
    expect(r.name).toBe('Objekt Šišmiš Đurđevac');
  });
  it('rejects unknown keys (no mass assignment, SR-API-03)', () => {
    expect(() => zFacilityInput.parse({ organizationId: org, name: 'A', created_by: org })).toThrow();
  });
  it('rejects control characters and over-long names', () => {
    expect(() => zFacilityInput.parse({ organizationId: org, name: 'a\u0007b' })).toThrow();
    expect(() => zFacilityInput.parse({ organizationId: org, name: 'x'.repeat(121) })).toThrow();
  });
  it('requires academic year start before end', () => {
    expect(() => zAcademicYearInput.parse({ organizationId: org, name: '2026./2027.', startsOn: '2027-06-30', endsOn: '2026-09-01' })).toThrow();
  });
  it('maps RLS denial and missing row to the same NOT_FOUND (SR-API-04)', () => {
    expect(fromPostgrestError({ code: '42501' }).code).toBe('NOT_FOUND');
    expect(fromPostgrestError({ code: 'PGRST116' }).code).toBe('NOT_FOUND');
  });
});
