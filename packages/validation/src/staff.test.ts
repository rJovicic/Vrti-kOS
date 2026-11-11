import { describe, expect, it } from 'vitest';
import { zAcademicYearStatusInput, zAssignmentInput, zMembershipStatusInput } from './staff.ts';

const ids = { membershipId: '0b1f6f6e-0000-4000-8000-000000000001', groupId: '0b1f6f6e-0000-4000-8000-000000000002' };

describe('staff validation', () => {
  it('accepts an open-ended regular assignment', () => {
    expect(zAssignmentInput.parse({ ...ids, type: 'regular', from: '2026-09-01' }).to).toBeUndefined();
  });
  it('requires an end date for a substitute (FR-03-3)', () => {
    expect(() => zAssignmentInput.parse({ ...ids, type: 'substitute', from: '2026-11-11' })).toThrow();
    expect(zAssignmentInput.parse({ ...ids, type: 'substitute', from: '2026-11-11', to: '2026-11-11' }).to).toBe('2026-11-11');
  });
  it('rejects reversed ranges, unknown keys and invalid dates', () => {
    expect(() => zAssignmentInput.parse({ ...ids, type: 'regular', from: '2026-11-11', to: '2026-11-10' })).toThrow();
    expect(() => zAssignmentInput.parse({ ...ids, type: 'regular', from: '2026-11-11', approvedBy: ids.groupId })).toThrow();
    expect(() => zAssignmentInput.parse({ ...ids, type: 'regular', from: '2026-02-30' })).toThrow();
  });
  it('limits status changes to the allowed transitions', () => {
    expect(() => zMembershipStatusInput.parse({ id: ids.groupId, status: 'ended' })).toThrow();
    expect(() => zAcademicYearStatusInput.parse({ id: ids.groupId, status: 'planned' })).toThrow();
  });
});
