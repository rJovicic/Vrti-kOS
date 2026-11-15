import { describe, expect, it } from 'vitest';
import { zAbsenceOnBehalfInput, zAttendanceCorrectionInput, zMissedAttendanceInput } from './attendance.ts';

const g = '0b1f6f6e-0000-4000-8000-000000000001';
const id = '0b1f6f6e-0000-4000-8000-000000000002';

describe('admin attendance forms (D3-G)', () => {
  it('a correction needs a reason category; free text is not a reason', () => {
    expect(zAttendanceCorrectionInput.parse({ group: g, date: '2026-11-15', recordId: id, reason: 'entry_error', time: '07:42' }).time).toBe('07:42');
    expect(() => zAttendanceCorrectionInput.parse({ group: g, date: '2026-11-15', recordId: id })).toThrow();
    expect(() => zAttendanceCorrectionInput.parse({ group: g, date: '2026-11-15', recordId: id, reason: 'zaboravila je' })).toThrow();
    expect(() => zAttendanceCorrectionInput.parse({ group: g, date: '2026-11-15', recordId: id, reason: 'other', note: 'x' })).toThrow();
  });

  it('times are HH:MM and kinds are arrival or departure', () => {
    expect(() => zMissedAttendanceInput.parse({ group: g, date: '2026-11-15', childId: id, kind: 'check_out', time: '7:42', reason: 'forgot' })).toThrow();
    expect(() => zMissedAttendanceInput.parse({ group: g, date: '2026-11-15', childId: id, kind: 'void', time: '07:42', reason: 'forgot' })).toThrow();
    expect(zMissedAttendanceInput.parse({ group: g, date: '2026-11-15', childId: id, kind: 'check_out', time: '15:10', reason: 'forgot' }).kind).toBe('check_out');
  });

  it('an absence on behalf has dates only, in order, and no reason', () => {
    expect(() => zAbsenceOnBehalfInput.parse({ group: g, date: '2026-11-15', childId: id, from: '2026-11-17', to: '2026-11-16' })).toThrow();
    expect(() => zAbsenceOnBehalfInput.parse({ group: g, date: '2026-11-15', childId: id, from: '2026-11-16', to: '2026-11-16', reason: 'bolest' })).toThrow();
  });
});
