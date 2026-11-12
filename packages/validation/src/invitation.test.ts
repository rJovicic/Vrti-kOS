import { describe, expect, it } from 'vitest';
import { zEmailInput, zInviteMemberInput, zOtpInput, zTotpInput } from './invitation.ts';

const org = '0b1f6f6e-0000-4000-8000-000000000001';
const base = { organizationId: org, email: ' Ivana.Horvat@Example.TEST ', role: 'educator', firstName: ' Ivana ', lastName: 'Horvat' };

describe('invitation validation', () => {
  it('normalizes e-mail to trimmed lowercase and trims names', () => {
    const r = zInviteMemberInput.parse(base);
    expect(r.email).toBe('ivana.horvat@example.test');
    expect(r.firstName).toBe('Ivana');
  });
  it('keeps Croatian diacritics in NFC form', () => {
    const r = zInviteMemberInput.parse({ ...base, lastName: 'Šimunović-Đurić'.normalize('NFD') });
    expect(r.lastName).toBe('Šimunović-Đurić');
  });
  it('rejects roles that cannot be invited (platform admin, unknown)', () => {
    expect(() => zInviteMemberInput.parse({ ...base, role: 'platform_admin' })).toThrow();
    expect(() => zInviteMemberInput.parse({ ...base, role: 'superuser' })).toThrow();
  });
  it('rejects unknown keys (no mass assignment of status/expiry/creator)', () => {
    expect(() => zInviteMemberInput.parse({ ...base, status: 'accepted' })).toThrow();
    expect(() => zInviteMemberInput.parse({ ...base, expiresAt: '2099-01-01' })).toThrow();
  });
  it('rejects invalid e-mail, empty or control-character names', () => {
    expect(() => zInviteMemberInput.parse({ ...base, email: 'nije-adresa' })).toThrow();
    expect(() => zInviteMemberInput.parse({ ...base, email: `${'a'.repeat(250)}@x.hr` })).toThrow();
    expect(() => zInviteMemberInput.parse({ ...base, firstName: '   ' })).toThrow();
    expect(() => zInviteMemberInput.parse({ ...base, lastName: 'a\u0000b' })).toThrow();
  });
  it('a guardian record id is allowed only for a guardian invitation (D2-F)', () => {
    const guardianId = '0b1f6f6e-0000-4000-8000-0000000000aa';
    expect(zInviteMemberInput.parse({ ...base, role: 'guardian', guardianId }).guardianId).toBe(guardianId);
    expect(zInviteMemberInput.parse({ ...base, role: 'guardian' }).guardianId).toBeUndefined();
    expect(() => zInviteMemberInput.parse({ ...base, role: 'educator', guardianId })).toThrow();
    expect(() => zInviteMemberInput.parse({ ...base, role: 'guardian', guardianId: 'nije-uuid' })).toThrow();
  });
  it('accepts only six-digit codes', () => {
    expect(zOtpInput.parse({ email: 'a@b.hr', code: '012345' }).code).toBe('012345');
    for (const code of ['12345', '1234567', '12a456', ' 123456']) {
      expect(() => zOtpInput.parse({ email: 'a@b.hr', code })).toThrow();
    }
    expect(() => zTotpInput.parse({ factorId: 'x', code: '123456' })).toThrow();
  });
  it('e-mail sign-in input is strict', () => {
    expect(zEmailInput.parse({ email: ' A@B.HR ' }).email).toBe('a@b.hr');
    expect(() => zEmailInput.parse({ email: 'a@b.hr', shouldCreateUser: true })).toThrow();
  });
});
