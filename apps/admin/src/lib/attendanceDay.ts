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
  /** D3-H: the person who handed over or picked up the child (name only), and the D-38 (b) mark. */
  handover: { name: string; restricted: boolean } | null;
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
          .select('id, child_id, kind, occurred_at, corrects_id, correction_reason, source, handover_child_guardian_id, handover_pickup_id')
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
  const all = (events.data ?? []) as {
    id: string; child_id: string; kind: EventRow['kind']; occurred_at: string; corrects_id: string | null; correction_reason: EventRow['reason']; source: string;
    handover_child_guardian_id: string | null; handover_pickup_id: string | null;
  }[];
  const person = await handoverNames(ctx, all);
  const voided = new Set(all.filter((e) => e.kind === 'void').map((e) => e.corrects_id));
  const days: ChildDay[] = rows
    .map((r) => {
      const ev = all
        .filter((e) => e.child_id === r.child_id)
        .map((e) => ({ id: e.id, kind: e.kind, occurredAt: e.occurred_at, correctsId: e.corrects_id, reason: e.correction_reason, source: e.source, voided: voided.has(e.id), handover: person(e) }));
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

/** Names of the handover persons referenced by the events (managers read links, guardians and pickup persons). */
async function handoverNames(ctx: OrgContext, rows: { handover_child_guardian_id: string | null; handover_pickup_id: string | null }[]) {
  const { supabase } = ctx;
  const links = [...new Set(rows.map((r) => r.handover_child_guardian_id).filter((x): x is string => x !== null))];
  const pickups = [...new Set(rows.map((r) => r.handover_pickup_id).filter((x): x is string => x !== null))];
  const [overview, people] = await Promise.all([
    links.length ? supabase.from('child_guardian_overview').select('id, guardian_id, is_restricted').in('id', links) : Promise.resolve({ data: [] }),
    pickups.length ? supabase.from('pickup_authorizations').select('id, first_name, last_name').in('id', pickups) : Promise.resolve({ data: [] }),
  ]);
  const ov = (overview.data ?? []) as { id: string; guardian_id: string; is_restricted: boolean }[];
  const guardianIds = [...new Set(ov.map((o) => o.guardian_id))];
  const guardians = guardianIds.length ? await supabase.from('guardians').select('id, first_name, last_name').in('id', guardianIds) : { data: [] };
  const gName = new Map(((guardians.data ?? []) as { id: string; first_name: string; last_name: string }[]).map((g) => [g.id, `${g.first_name} ${g.last_name}`]));
  const linkInfo = new Map(ov.map((o) => [o.id, { name: gName.get(o.guardian_id) ?? '—', restricted: o.is_restricted }]));
  const pickupName = new Map(((people.data ?? []) as { id: string; first_name: string; last_name: string }[]).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));
  return (r: { handover_child_guardian_id: string | null; handover_pickup_id: string | null }) =>
    r.handover_child_guardian_id
      ? (linkInfo.get(r.handover_child_guardian_id) ?? { name: '—', restricted: false })
      : r.handover_pickup_id
        ? { name: pickupName.get(r.handover_pickup_id) ?? '—', restricted: false }
        : null;
}
