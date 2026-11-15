import type { OrgContext } from '@/lib/dal';

// D3-G read model for the admin attendance page: the day status of a group (api.child_day_status, D3-C), the event
// rows of that day (managers read them, D3-A) and the absences from that day on (D3-B). Read as the manager.

export interface EventRow {
  id: string;
  kind: 'check_in' | 'check_out' | 'void';
  occurredAt: string;
  correctsId: string | null;
  reason: 'entry_error' | 'forgot' | 'other' | null;
  source: string;
  voided: boolean;
}
export interface ChildDay {
  childId: string;
  name: string;
  status: 'expected' | 'absent' | 'present' | 'departed' | 'not_enrolled';
  arrivedAt: string | null;
  departedAt: string | null;
  absenceReported: boolean;
  absenceIsLate: boolean;
  events: EventRow[];
  corrected: boolean;
}
export interface AbsenceItem {
  id: string;
  childId: string;
  name: string;
  startsOn: string;
  endsOn: string;
  source: 'guardian' | 'staff_on_behalf';
  isLate: boolean;
}

export async function loadAttendanceDay(ctx: OrgContext, groupId: string, date: string) {
  const { supabase, org } = ctx;
  const status = await supabase.schema('api').rpc('child_day_status', { p_day: date, p_group_id: groupId });
  const rows = (status.data ?? []) as {
    child_id: string; status: ChildDay['status']; arrived_at: string | null; departed_at: string | null; absence_reported: boolean; absence_is_late: boolean;
  }[];
  const ids = rows.map((r) => r.child_id);
  const [children, events, absences] = ids.length
    ? await Promise.all([
        supabase.from('children').select('id, first_name, last_name').in('id', ids),
        supabase
          .from('attendance_records')
          .select('id, child_id, kind, occurred_at, corrects_id, correction_reason, source')
          .eq('organization_id', org.id)
          .eq('local_date', date)
          .in('child_id', ids)
          .order('occurred_at'),
        supabase
          .from('absence_records')
          .select('id, child_id, starts_on, ends_on, source, is_late')
          .eq('organization_id', org.id)
          .eq('status', 'active')
          .gte('ends_on', date)
          .in('child_id', ids)
          .order('starts_on'),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const name = new Map((children.data ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
  const all = (events.data ?? []) as { id: string; child_id: string; kind: EventRow['kind']; occurred_at: string; corrects_id: string | null; correction_reason: EventRow['reason']; source: string }[];
  const voided = new Set(all.filter((e) => e.kind === 'void').map((e) => e.corrects_id));
  const days: ChildDay[] = rows
    .map((r) => {
      const ev = all
        .filter((e) => e.child_id === r.child_id)
        .map((e) => ({ id: e.id, kind: e.kind, occurredAt: e.occurred_at, correctsId: e.corrects_id, reason: e.correction_reason, source: e.source, voided: voided.has(e.id) }));
      return {
        childId: r.child_id,
        name: name.get(r.child_id) ?? '—',
        status: r.status,
        arrivedAt: r.arrived_at,
        departedAt: r.departed_at,
        absenceReported: r.absence_reported,
        absenceIsLate: r.absence_is_late,
        events: ev,
        corrected: ev.some((e) => e.reason !== null),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  const absenceItems: AbsenceItem[] = ((absences.data ?? []) as { id: string; child_id: string; starts_on: string; ends_on: string; source: AbsenceItem['source']; is_late: boolean }[]).map((a) => ({
    id: a.id,
    childId: a.child_id,
    name: name.get(a.child_id) ?? '—',
    startsOn: a.starts_on,
    endsOn: a.ends_on,
    source: a.source,
    isLate: a.is_late,
  }));
  return { days, absences: absenceItems, failed: Boolean(status.error) };
}
