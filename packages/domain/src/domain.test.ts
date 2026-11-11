import { describe, expect, it } from 'vitest';
import { attendanceStateForDay, nextAction } from './attendance.ts';
import { exclusiveEndToInclusive, inclusiveEndToExclusive, orgLocalDate } from './dates.ts';

describe('dates', () => {
  it('uses the kindergarten local day, not UTC', () => {
    expect(orgLocalDate(new Date('2026-11-10T23:30:00Z'))).toBe('2026-11-11');
  });
  it('round-trips inclusive/exclusive ends', () => {
    expect(inclusiveEndToExclusive('2027-06-30')).toBe('2027-07-01');
    expect(exclusiveEndToInclusive('2027-07-01')).toBe('2027-06-30');
  });
});

describe('attendance state', () => {
  const ci = { id: 'a', kind: 'check_in' as const, occurredAt: '2026-11-11T06:42:00Z' };
  const co = { id: 'b', kind: 'check_out' as const, occurredAt: '2026-11-11T14:10:00Z' };
  it('expected → present → departed', () => {
    expect(attendanceStateForDay([], false)).toBe('expected');
    expect(attendanceStateForDay([ci], false)).toBe('present');
    expect(attendanceStateForDay([ci, co], false)).toBe('departed');
  });
  it('a void undoes the event it corrects', () => {
    expect(attendanceStateForDay([ci, { id: 'v', kind: 'void', occurredAt: '2026-11-11T06:42:05Z', correctsId: 'a' }], false)).toBe('expected');
  });
  it('reported absence shows until a check-in is confirmed', () => {
    expect(attendanceStateForDay([], true)).toBe('absent');
    expect(nextAction('absent')).toBe('confirm_check_in');
    expect(nextAction('departed')).toBeNull();
  });
});
