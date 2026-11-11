import { parseDateRange, spanContains, type DateSpan } from '@vrticos/domain';
import type { OrgContext } from '@/lib/dal';

export interface StaffMember {
  membershipId: string;
  name: string;
  role: 'org_admin' | 'director' | 'educator';
  status: 'active' | 'suspended' | 'ended';
}

export interface AssignmentRow {
  id: string;
  membershipId: string;
  groupId: string;
  type: 'regular' | 'substitute';
  span: DateSpan;
  validToday: boolean;
  current: boolean; // today or in the future
}

/** Staff, groups and assignments of one kindergarten, read as the manager (RLS). Joined in memory. */
export async function loadStaff(ctx: OrgContext) {
  const { supabase, org, today } = ctx;
  const [memberships, groups, assignments] = await Promise.all([
    supabase.from('memberships').select('id, profile_id, role, status').eq('organization_id', org.id).neq('role', 'guardian'),
    supabase.from('groups').select('id, name, facility_id, academic_year_id').eq('organization_id', org.id).is('archived_at', null).order('name'),
    supabase.from('staff_assignments').select('id, membership_id, group_id, assignment_type, valid_during').eq('organization_id', org.id),
  ]);
  const profileIds = [...new Set((memberships.data ?? []).map((m) => m.profile_id))];
  const { data: profiles } = profileIds.length
    ? await supabase.from('profiles').select('id, first_name, last_name').in('id', profileIds)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

  const staff: StaffMember[] = (memberships.data ?? [])
    .map((m) => ({ membershipId: m.id, name: names.get(m.profile_id) ?? '—', role: m.role as StaffMember['role'], status: m.status }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'));

  const rows: AssignmentRow[] = [];
  for (const a of assignments.data ?? []) {
    const span = parseDateRange(String(a.valid_during));
    if (!span) continue;
    rows.push({
      id: a.id,
      membershipId: a.membership_id,
      groupId: a.group_id,
      type: a.assignment_type,
      span,
      validToday: spanContains(span, today),
      current: span.toInclusive === null || span.toInclusive >= today,
    });
  }
  rows.sort((a, b) => (a.span.from ?? '').localeCompare(b.span.from ?? ''));
  return { staff, groups: groups.data ?? [], assignments: rows };
}
