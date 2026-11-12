import { describe, expect, it } from 'vitest';
import {
  zCancelInput,
  zChildInput,
  zEndRecordInput,
  zGuardianInviteInput,
  zGuardianLinkInput,
  zLinkRightsInput,
  zPickupInput,
  zRestrictionInput,
  zTransferInput,
  zWithdrawInput,
} from './child.ts';

const id = '0b1f6f6e-0000-4000-8000-000000000001';
const id2 = '0b1f6f6e-0000-4000-8000-000000000002';

describe('child forms (D2-G)', () => {
  it('a child has names and an optional internal reference only (FR-04-1, Q-P03)', () => {
    expect(zChildInput.parse({ firstName: ' Lea ', lastName: 'Babić', internalRef: '' })).toEqual({ firstName: 'Lea', lastName: 'Babić', internalRef: undefined });
    expect(zChildInput.parse({ firstName: 'Lea', lastName: 'Babić', internalRef: ' A-2026-031 ' }).internalRef).toBe('A-2026-031');
    expect(() => zChildInput.parse({ firstName: 'Lea', lastName: 'Babić', oib: '12345678901' })).toThrow();
    expect(() => zChildInput.parse({ firstName: 'Lea', lastName: 'Babić', dateOfBirth: '2022-01-01' })).toThrow();
    expect(() => zChildInput.parse({ firstName: 'Lea', lastName: 'Babić', internalRef: 'x'.repeat(41) })).toThrow();
  });

  it('withdrawal and restriction need an explicit confirmation', () => {
    expect(() => zWithdrawInput.parse({ childId: id, lastDay: '2026-11-30' })).toThrow();
    expect(zWithdrawInput.parse({ childId: id, lastDay: '2026-11-30', confirm: 'on' }).confirm).toBe(true);
    expect(() => zRestrictionInput.parse({ childId: id, linkId: id2, from: '2026-11-12' })).toThrow();
    expect(zRestrictionInput.parse({ childId: id, linkId: id2, from: '2026-11-12', reference: '', confirm: 'on' }).reference).toBeUndefined();
    expect(() => zRestrictionInput.parse({ childId: id, linkId: id2, from: '2026-11-12', reference: 'x'.repeat(101), confirm: 'on' })).toThrow();
  });

  it('a cancellation reason is one of the fixed codes (D-37, no free text)', () => {
    expect(zCancelInput.parse({ childId: id, kind: 'enrollment', recordId: id2, reason: 'plan_changed' }).reason).toBe('plan_changed');
    expect(() => zCancelInput.parse({ childId: id, kind: 'enrollment', recordId: id2, reason: 'Lea se seli' })).toThrow();
    expect(() => zCancelInput.parse({ childId: id, kind: 'access_restriction', recordId: id2, reason: 'other' })).toThrow();
  });

  it('a link names either an existing guardian or a new one, and rights need the right to view', () => {
    const base = { childId: id, from: '2026-11-12', canView: 'on' };
    expect(zGuardianLinkInput.parse({ ...base, guardianId: id2 }).guardianId).toBe(id2);
    expect(zGuardianLinkInput.parse({ ...base, firstName: 'Ana', lastName: 'Babić' }).firstName).toBe('Ana');
    expect(() => zGuardianLinkInput.parse({ ...base })).toThrow();
    expect(() => zGuardianLinkInput.parse({ ...base, guardianId: id2, firstName: 'Ana', lastName: 'Babić' })).toThrow();
    expect(() => zGuardianLinkInput.parse({ childId: id, from: '2026-11-12', guardianId: id2, canReportAbsence: 'on' })).toThrow();
    expect(zLinkRightsInput.parse({ childId: id, linkId: id2 })).toMatchObject({ canView: false, canReportAbsence: false, receivesMessages: false });
    expect(() => zLinkRightsInput.parse({ childId: id, linkId: id2, receivesMessages: 'on' })).toThrow();
  });

  it('pickup persons carry names and validity only (D-34)', () => {
    expect(zPickupInput.parse({ childId: id, firstName: 'Mara', lastName: 'Kos', from: '2026-11-12' }).to).toBeUndefined();
    expect(() => zPickupInput.parse({ childId: id, firstName: 'Mara', lastName: 'Kos', from: '2026-11-12', phone: '091' })).toThrow();
    expect(() => zPickupInput.parse({ childId: id, firstName: 'Mara', lastName: 'Kos', from: '2026-11-12', relationship: 'baka' })).toThrow();
    expect(() => zPickupInput.parse({ childId: id, firstName: 'Mara', lastName: 'Kos', from: '2026-11-12', to: '2026-11-11' })).toThrow();
  });

  it('dates, ends and invitations are validated', () => {
    expect(() => zTransferInput.parse({ childId: id, groupId: id2, effectiveOn: '12. 11. 2026.' })).toThrow();
    expect(() => zEndRecordInput.parse({ childId: id, recordId: id2, from: '2026-11-12', lastDay: '2026-11-11' })).toThrow();
    expect(zGuardianInviteInput.parse({ childId: id, guardianId: id2, email: ' Ana@Example.TEST ' }).email).toBe('ana@example.test');
  });
});
