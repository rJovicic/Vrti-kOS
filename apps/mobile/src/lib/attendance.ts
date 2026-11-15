import type { AttendanceState } from '@vrticos/domain';
import { displayName, newIdempotencyKey } from './attendanceKeys';
import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

// D3-D educator attendance. Reads and writes AS THE SIGNED-IN EDUCATOR: `api.child_day_status` returns only children
// of groups assigned today (D3-C), and the record/undo RPCs decide every write (D3-A). The app shapes data only.

export interface AttendanceTile {
  childId: string;
  /** "Lana B." — first name and initial of the last name, as in the prototype tiles. */
  displayName: string;
  fullName: string;
  state: AttendanceState;
  /** ISO instant of the latest arrival (present) or the departure (departed). */
  time: string | null;
  absenceReported: boolean;
  /** Latest effective event, for undo and correction. */
  lastRecordId: string | null;
}

export interface GroupDay {
  tiles: AttendanceTile[];
  loadedAt: Date;
}

interface StatusRow {
  child_id: string;
  status: 'expected' | 'absent' | 'present' | 'departed' | 'not_enrolled';
  arrived_at: string | null;
  departed_at: string | null;
  absence_reported: boolean;
  last_record_id: string | null;
}

export async function loadGroupDay(groupId: string, correlationId: string = newCorrelationId()): Promise<GroupDay> {
  const status = await supabase.schema('api').rpc('child_day_status', { p_group_id: groupId }).setHeader(CORRELATION_HEADER, correlationId);
  if (status.error) throw status.error;
  const rows = ((status.data ?? []) as StatusRow[]).filter((r) => r.status !== 'not_enrolled');
  const names = rows.length
    ? await supabase.from('children').select('id, first_name, last_name').in('id', rows.map((r) => r.child_id)).setHeader(CORRELATION_HEADER, correlationId)
    : { data: [], error: null };
  if (names.error) throw names.error;
  const name = new Map((names.data ?? []).map((c) => [c.id, c]));
  const tiles = rows
    .filter((r) => name.has(r.child_id))
    .map((r) => {
      const c = name.get(r.child_id)!;
      return {
        childId: r.child_id,
        displayName: displayName(c.first_name, c.last_name),
        fullName: `${c.first_name} ${c.last_name}`,
        state: r.status as AttendanceState,
        time: r.status === 'present' ? r.arrived_at : r.status === 'departed' ? r.departed_at : null,
        absenceReported: r.absence_reported,
        lastRecordId: r.last_record_id,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'hr'));
  return { tiles, loadedAt: new Date() };
}

export interface Recorded {
  recordId: string;
  occurredAt: string;
}

export async function recordAttendance(
  childId: string,
  kind: 'check_in' | 'check_out',
  idempotencyKey: string = newIdempotencyKey(),
  correlationId: string = newCorrelationId(),
): Promise<Recorded> {
  const { data, error } = await supabase
    .schema('api')
    .rpc('record_attendance', { p_child_id: childId, p_kind: kind, p_idempotency_key: idempotencyKey })
    .setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
  const row = (data as { record_id: string; occurred_at: string }[])[0]!;
  return { recordId: row.record_id, occurredAt: row.occurred_at };
}

export async function undoAttendance(recordId: string, correlationId: string = newCorrelationId()): Promise<void> {
  const { error } = await supabase
    .schema('api')
    .rpc('undo_attendance', { p_record_id: recordId, p_idempotency_key: newIdempotencyKey() })
    .setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
}

export { businessCode, displayName, newIdempotencyKey } from './attendanceKeys';
