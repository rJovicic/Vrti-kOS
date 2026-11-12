import { parseDateRange, spanContains, type DateSpan } from '@vrticos/domain';
import type { OrgContext } from '@/lib/dal';

// D2-G read models. Everything is read AS THE MANAGER (RLS + column grants decide); joins happen in memory.

export type Timing = 'past' | 'current' | 'future';
export const timingOf = (span: DateSpan, today: string): Timing =>
  spanContains(span, today) ? 'current' : span.from !== null && span.from > today ? 'future' : 'past';

const spanOf = (range: unknown): DateSpan => parseDateRange(String(range)) ?? { from: null, toInclusive: null };

export interface ChildListRow {
  id: string;
  name: string;
  internalRef: string | null;
  status: 'active' | 'withdrawn';
  withdrawnOn: string | null;
  groupName: string | null;
  plannedGroupName: string | null;
}

/** Children of the kindergarten with today's group (and the next planned group, if any). */
export async function loadChildren(ctx: OrgContext): Promise<ChildListRow[]> {
  const { supabase, org, today } = ctx;
  const [children, enrollments, groups] = await Promise.all([
    supabase.from('children').select('id, first_name, last_name, internal_ref, status, withdrawn_on').eq('organization_id', org.id),
    supabase.from('enrollments').select('child_id, group_id, valid_during').eq('organization_id', org.id),
    supabase.from('groups').select('id, name').eq('organization_id', org.id),
  ]);
  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const current = new Map<string, string>();
  const planned = new Map<string, { from: string; group: string }>();
  for (const e of enrollments.data ?? []) {
    const span = spanOf(e.valid_during);
    const timing = timingOf(span, today);
    if (timing === 'current') current.set(e.child_id, e.group_id);
    if (timing === 'future' && (!planned.has(e.child_id) || planned.get(e.child_id)!.from > span.from!)) planned.set(e.child_id, { from: span.from!, group: e.group_id });
  }
  return (children.data ?? [])
    .map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      internalRef: c.internal_ref,
      status: c.status,
      withdrawnOn: c.withdrawn_on,
      groupName: current.has(c.id) ? (groupName.get(current.get(c.id)!) ?? null) : null,
      plannedGroupName: planned.has(c.id) ? (groupName.get(planned.get(c.id)!.group) ?? null) : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'hr'));
}

export interface EnrollmentRow { id: string; groupId: string; groupName: string; span: DateSpan; timing: Timing }
export interface LinkRow {
  id: string;
  guardianId: string;
  guardianName: string;
  guardianActive: boolean;
  hasAccount: boolean | null;
  invitation: 'pending' | 'accepted' | null;
  canView: boolean;
  canReportAbsence: boolean;
  receivesMessages: boolean;
  span: DateSpan;
  timing: Timing;
  restrictions: RestrictionRow[];
}
export interface RestrictionRow { id: string; span: DateSpan; timing: Timing; reference: string | null }
export interface PickupRow { id: string; name: string; span: DateSpan; timing: Timing }

export interface ChildDetail {
  id: string;
  firstName: string;
  lastName: string;
  internalRef: string | null;
  status: 'active' | 'withdrawn';
  withdrawnOn: string | null;
  enrollments: EnrollmentRow[];
  links: LinkRow[];
  pickups: PickupRow[];
  groups: { id: string; name: string }[];
  guardians: { id: string; name: string }[];
}

const byStart = <T extends { span: DateSpan }>(a: T, b: T) => (a.span.from ?? '').localeCompare(b.span.from ?? '');

/** One child with its enrolment history, guardian links (rights, restrictions, account state) and pickup persons. */
export async function loadChild(ctx: OrgContext, childId: string): Promise<ChildDetail | null> {
  const { supabase, org, today } = ctx;
  const { data: child } = await supabase
    .from('children')
    .select('id, first_name, last_name, internal_ref, status, withdrawn_on')
    .eq('organization_id', org.id)
    .eq('id', childId)
    .maybeSingle();
  if (!child) return null;
  const [enrollments, links, pickups, groups, directory] = await Promise.all([
    supabase.from('enrollments').select('id, group_id, valid_during').eq('child_id', childId),
    supabase.from('child_guardians').select('id, guardian_id, can_view, can_report_absence, receives_messages, valid_during').eq('child_id', childId),
    supabase.from('pickup_authorizations').select('id, first_name, last_name, valid_during').eq('child_id', childId),
    supabase.from('groups').select('id, name, archived_at').eq('organization_id', org.id).order('name'),
    supabase.from('guardian_directory').select('id, first_name, last_name, status, has_account').eq('organization_id', org.id),
  ]);
  const linkIds = (links.data ?? []).map((l) => l.id);
  const guardianIds = [...new Set((links.data ?? []).map((l) => l.guardian_id))];
  const [restrictions, invitations] = await Promise.all([
    linkIds.length
      ? supabase.from('access_restrictions').select('id, child_guardian_id, valid_during, reference').in('child_guardian_id', linkIds)
      : Promise.resolve({ data: [] as { id: string; child_guardian_id: string; valid_during: unknown; reference: string | null }[] }),
    guardianIds.length
      ? supabase.from('invitations').select('guardian_id, status, expires_at').in('guardian_id', guardianIds).in('status', ['pending', 'accepted'])
      : Promise.resolve({ data: [] as { guardian_id: string | null; status: string; expires_at: string }[] }),
  ]);

  const groupName = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const guardian = new Map((directory.data ?? []).map((g) => [g.id!, g]));
  const now = Date.now();
  const invitationOf = (gid: string): LinkRow['invitation'] => {
    const rows = (invitations.data ?? []).filter((i) => i.guardian_id === gid);
    if (rows.some((i) => i.status === 'accepted')) return 'accepted';
    if (rows.some((i) => i.status === 'pending' && Date.parse(i.expires_at) > now)) return 'pending';
    return null;
  };

  return {
    id: child.id,
    firstName: child.first_name,
    lastName: child.last_name,
    internalRef: child.internal_ref,
    status: child.status,
    withdrawnOn: child.withdrawn_on,
    enrollments: (enrollments.data ?? [])
      .map((e) => {
        const span = spanOf(e.valid_during);
        return { id: e.id, groupId: e.group_id, groupName: groupName.get(e.group_id) ?? '—', span, timing: timingOf(span, today) };
      })
      .sort(byStart),
    links: (links.data ?? [])
      .map((l) => {
        const span = spanOf(l.valid_during);
        const g = guardian.get(l.guardian_id);
        return {
          id: l.id,
          guardianId: l.guardian_id,
          guardianName: g ? `${g.first_name} ${g.last_name}` : '—',
          guardianActive: g?.status === 'active',
          hasAccount: g?.has_account ?? null,
          invitation: invitationOf(l.guardian_id),
          canView: l.can_view,
          canReportAbsence: l.can_report_absence,
          receivesMessages: l.receives_messages,
          span,
          timing: timingOf(span, today),
          restrictions: (restrictions.data ?? [])
            .filter((r) => r.child_guardian_id === l.id)
            .map((r) => {
              const rs = spanOf(r.valid_during);
              return { id: r.id, span: rs, timing: timingOf(rs, today), reference: r.reference };
            })
            .sort(byStart),
        };
      })
      .sort((a, b) => a.guardianName.localeCompare(b.guardianName, 'hr')),
    pickups: (pickups.data ?? [])
      .map((p) => {
        const span = spanOf(p.valid_during);
        return { id: p.id, name: `${p.first_name} ${p.last_name}`, span, timing: timingOf(span, today) };
      })
      .sort(byStart),
    groups: (groups.data ?? []).filter((g) => !g.archived_at).map((g) => ({ id: g.id, name: g.name })),
    guardians: (directory.data ?? [])
      .filter((g) => g.status === 'active')
      .map((g) => ({ id: g.id!, name: `${g.first_name} ${g.last_name}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hr')),
  };
}
