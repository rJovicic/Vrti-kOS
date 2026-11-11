/** Attendance tag state for one child on one day (signature component of the design system). */
export type AttendanceState = 'expected' | 'present' | 'departed' | 'absent';

export interface AttendanceEvent {
  id: string;
  kind: 'check_in' | 'check_out' | 'void';
  occurredAt: string;
  correctsId?: string | null;
}

/**
 * Derives today's state from immutable events (voids remove the event they correct).
 * Authorization is NOT decided here — the database decides what the caller may see.
 */
export function attendanceStateForDay(events: AttendanceEvent[], absenceReported: boolean): AttendanceState {
  const voided = new Set(events.filter((e) => e.kind === 'void' && e.correctsId).map((e) => e.correctsId));
  const live = events.filter((e) => e.kind !== 'void' && !voided.has(e.id)).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  const last = live.at(-1);
  if (last?.kind === 'check_out') return 'departed';
  if (last?.kind === 'check_in') return 'present';
  return absenceReported ? 'absent' : 'expected';
}

/** Next action a tap performs on a tag; departed children need an explicit correction, not a tap. */
export function nextAction(state: AttendanceState): 'check_in' | 'check_out' | 'confirm_check_in' | null {
  switch (state) {
    case 'expected':
      return 'check_in';
    case 'present':
      return 'check_out';
    case 'absent':
      return 'confirm_check_in';
    case 'departed':
      return null;
  }
}
