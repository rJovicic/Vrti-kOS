import { orgLocalDate, parseDateRange, spanContains } from '@vrticos/domain';
import type { ChildSummary, GuardianHomeData } from '../features/guardian-home/model/types';
import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

// D2-H guardian data. Everything is read AS THE SIGNED-IN USER: RLS returns only children the person may view (an
// active link with can_view and no active restriction, D2-B/C), today's group and facility of those children, the
// person's own links and pickup persons valid today (D2-D). The app filters only for presentation, never for access.

interface Org {
  id: string;
  name: string;
  timezone: string;
}
const todayIn = (org: Org | undefined) => orgLocalDate(new Date(), org?.timezone);
const validOn = (range: unknown, day: string) => {
  const span = parseDateRange(String(range));
  return span !== null && spanContains(span, day);
};

async function base(correlationId: string) {
  const [children, orgs, enrollments, groups, facilities] = await Promise.all([
    supabase.from('children').select('id, first_name, last_name, organization_id').order('first_name').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('organizations').select('id, name, timezone').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('enrollments').select('child_id, group_id, valid_during').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('groups').select('id, name, facility_id').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('facilities').select('id, name').setHeader(CORRELATION_HEADER, correlationId),
  ]);
  for (const r of [children, orgs, enrollments, groups, facilities]) if (r.error) throw r.error;
  const org = new Map((orgs.data ?? []).map((o) => [o.id, o as Org]));
  const group = new Map((groups.data ?? []).map((g) => [g.id, g]));
  const facility = new Map((facilities.data ?? []).map((f) => [f.id, f.name]));
  /** Today's group and facility of a child (null while not placed in a group, D-32). */
  const placement = (childId: string, orgId: string) => {
    const today = todayIn(org.get(orgId));
    const e = (enrollments.data ?? []).find((x) => x.child_id === childId && validOn(x.valid_during, today));
    const g = e ? group.get(e.group_id) : undefined;
    return { groupName: g?.name ?? null, locationName: g ? (facility.get(g.facility_id) ?? null) : null };
  };
  return { children: children.data ?? [], org, placement };
}

/** Parent Home: the authorized children; attendance stays `unavailable` and activities empty until D3. */
export async function loadGuardianHome(correlationId: string = newCorrelationId()): Promise<GuardianHomeData> {
  const [{ children, org, placement }, links] = await Promise.all([
    base(correlationId),
    supabase.from('child_guardians').select('child_id, can_report_absence, valid_during').setHeader(CORRELATION_HEADER, correlationId),
  ]);
  if (links.error) throw links.error;
  const summaries: ChildSummary[] = children.map((c) => {
    const today = todayIn(org.get(c.organization_id));
    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      kindergartenName: org.get(c.organization_id)?.name ?? '',
      ...placement(c.id, c.organization_id),
      attendance: { status: 'unavailable' },
      canReportAbsence: (links.data ?? []).some((l) => l.child_id === c.id && l.can_report_absence && validOn(l.valid_during, today)),
    };
  });
  return { children: summaries, activities: [] };
}

export interface ChildDetail {
  id: string;
  firstName: string;
  lastName: string;
  kindergartenName: string;
  groupName: string | null;
  locationName: string | null;
  /** Persons authorized to pick up the child today (read-only, FR-04-8). */
  pickups: { id: string; name: string }[];
}

/** One authorized child; null when the account may not see it (same answer as an unknown id). */
export async function loadChildDetail(childId: string, correlationId: string = newCorrelationId()): Promise<ChildDetail | null> {
  const [{ children, org, placement }, pickups] = await Promise.all([
    base(correlationId),
    supabase.from('pickup_authorizations').select('id, child_id, first_name, last_name').eq('child_id', childId).setHeader(CORRELATION_HEADER, correlationId),
  ]);
  if (pickups.error) throw pickups.error;
  const c = children.find((x) => x.id === childId);
  if (!c) return null;
  return {
    id: c.id,
    firstName: c.first_name,
    lastName: c.last_name,
    kindergartenName: org.get(c.organization_id)?.name ?? '',
    ...placement(c.id, c.organization_id),
    pickups: (pickups.data ?? [])
      .filter((p) => p.child_id === childId)
      .map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'hr')),
  };
}
