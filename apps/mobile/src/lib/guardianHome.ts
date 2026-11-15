import { orgLocalDate, parseDateRange, spanContains } from '@vrticos/domain';
import { formatTime } from '@vrticos/i18n';
import type { ChildAttendance, ChildSummary, GuardianHomeData, HomeActivity } from '../features/guardian-home/model/types';
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
  return { children: children.data ?? [], org, placement, group };
}

interface DayStatus {
  child_id: string;
  status: 'expected' | 'absent' | 'present' | 'departed' | 'not_enrolled';
  arrived_at: string | null;
  departed_at: string | null;
}
export interface AbsenceRow {
  id: string;
  child_id: string;
  starts_on: string;
  ends_on: string;
  reported_by: string;
  is_late: boolean;
}

/** Today's status from the D3-C read model (no staff data for guardians) plus the absence covering today. */
function attendanceOf(s: DayStatus | undefined, absences: AbsenceRow[], today: string, timeZone: string): ChildAttendance {
  if (!s || s.status === 'not_enrolled') return { status: 'unavailable' };
  if (s.status === 'present' && s.arrived_at) return { status: 'present', time: formatTime(new Date(s.arrived_at), timeZone) };
  if (s.status === 'departed' && s.departed_at) return { status: 'departed', time: formatTime(new Date(s.departed_at), timeZone) };
  if (s.status === 'absent') {
    const a = absences.find((x) => x.child_id === s.child_id && x.starts_on <= today && x.ends_on >= today);
    return a ? { status: 'absent', absenceStart: a.starts_on, absenceEnd: a.ends_on } : { status: 'absent' };
  }
  return { status: 'expected' };
}

/** Active absences of today or later that the guardian may see (RLS: can_view, no restriction). */
async function currentAbsences(correlationId: string): Promise<AbsenceRow[]> {
  const today = orgLocalDate(new Date());
  const r = await supabase
    .from('absence_records')
    .select('id, child_id, starts_on, ends_on, reported_by, is_late')
    .eq('status', 'active')
    .gte('ends_on', today)
    .setHeader(CORRELATION_HEADER, correlationId);
  if (r.error) throw r.error;
  return (r.data ?? []) as AbsenceRow[];
}

/**
 * "Danas" (D4-E, D4-B): today's published daily overviews of the children's groups and today's or still unread
 * announcements — all read under RLS (only what this guardian may see). Newest first.
 */
async function todayActivities(org: Map<string, Org>, group: Map<string, { id: string; name: string }>, correlationId: string): Promise<HomeActivity[]> {
  const days = [...new Set([...org.values()].map((o) => todayIn(o)))];
  const [entries, announcements, unread] = await Promise.all([
    supabase.from('daily_entries').select('id, group_id, organization_id, entry_date, published_at').in('entry_date', days).eq('status', 'published').setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('announcements').select('id, organization_id, title, published_at').eq('status', 'published').order('published_at', { ascending: false }).setHeader(CORRELATION_HEADER, correlationId),
    supabase.from('notifications').select('resource_id, read_at').eq('type', 'announcement.published').setHeader(CORRELATION_HEADER, correlationId),
  ]);
  for (const r of [entries, announcements, unread]) if (r.error) throw r.error;
  const unreadIds = new Set(((unread.data ?? []) as { resource_id: string; read_at: string | null }[]).filter((n) => n.read_at === null).map((n) => n.resource_id));
  const items: { at: string; activity: HomeActivity }[] = [];
  for (const e of (entries.data ?? []) as { id: string; group_id: string; organization_id: string; entry_date: string; published_at: string }[]) {
    const o = org.get(e.organization_id);
    if (e.entry_date !== todayIn(o)) continue;
    items.push({
      at: e.published_at,
      activity: {
        id: `daily:${e.id}`,
        kind: 'dailyReport',
        groupId: e.group_id,
        entryId: e.id,
        groupName: group.get(e.group_id)?.name ?? '',
        organizationName: o?.name ?? '',
        publishedTime: formatTime(new Date(e.published_at), o?.timezone),
      },
    });
  }
  for (const a of (announcements.data ?? []) as { id: string; organization_id: string; title: string; published_at: string }[]) {
    const o = org.get(a.organization_id);
    const isUnread = unreadIds.has(a.id);
    if (!isUnread && orgLocalDate(new Date(a.published_at), o?.timezone) !== todayIn(o)) continue;
    items.push({ at: a.published_at, activity: { id: `announcement:${a.id}`, kind: 'announcement', title: a.title, organizationName: o?.name ?? '', isUnread } });
  }
  return items.sort((x, y) => y.at.localeCompare(x.at)).map((x) => x.activity);
}

/** Parent Home: the authorized children with today's status (D3-C) and today's activities (D4). */
export async function loadGuardianHome(correlationId: string = newCorrelationId()): Promise<GuardianHomeData> {
  const [{ children, org, placement, group }, links, status, absences] = await Promise.all([
    base(correlationId),
    supabase.from('child_guardians').select('child_id, can_report_absence, valid_during').setHeader(CORRELATION_HEADER, correlationId),
    supabase.schema('api').rpc('child_day_status', {}).setHeader(CORRELATION_HEADER, correlationId),
    currentAbsences(correlationId),
  ]);
  if (links.error) throw links.error;
  if (status.error) throw status.error;
  const byChild = new Map(((status.data ?? []) as DayStatus[]).map((s) => [s.child_id, s]));
  const summaries: ChildSummary[] = children.map((c) => {
    const today = todayIn(org.get(c.organization_id));
    return {
      id: c.id,
      firstName: c.first_name,
      lastName: c.last_name,
      kindergartenName: org.get(c.organization_id)?.name ?? '',
      ...placement(c.id, c.organization_id),
      attendance: attendanceOf(byChild.get(c.id), absences, today, org.get(c.organization_id)?.timezone ?? 'Europe/Zagreb'),
      canReportAbsence: (links.data ?? []).some((l) => l.child_id === c.id && l.can_report_absence && validOn(l.valid_during, today)),
    };
  });
  return { children: summaries, activities: await todayActivities(org, group, correlationId) };
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
  /** Active absences of today or later; `mine` = reported by this account (only those can be cancelled, FS-06). */
  absences: { id: string; startsOn: string; endsOn: string; isLate: boolean; mine: boolean }[];
  canReportAbsence: boolean;
}

/** One authorized child; null when the account may not see it (same answer as an unknown id). */
export async function loadChildDetail(childId: string, me: string, correlationId: string = newCorrelationId()): Promise<ChildDetail | null> {
  const [{ children, org, placement }, pickups, absences, links] = await Promise.all([
    base(correlationId),
    supabase.from('pickup_authorizations').select('id, child_id, first_name, last_name').eq('child_id', childId).setHeader(CORRELATION_HEADER, correlationId),
    currentAbsences(correlationId),
    supabase.from('child_guardians').select('child_id, can_report_absence, valid_during').eq('child_id', childId).setHeader(CORRELATION_HEADER, correlationId),
  ]);
  if (pickups.error) throw pickups.error;
  if (links.error) throw links.error;
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
    absences: absences
      .filter((a) => a.child_id === childId)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))
      .map((a) => ({ id: a.id, startsOn: a.starts_on, endsOn: a.ends_on, isLate: a.is_late, mine: a.reported_by === me })),
    canReportAbsence: (links.data ?? []).some((l) => l.child_id === childId && l.can_report_absence),
  };
}

export async function reportAbsence(childId: string, startsOn: string, endsOn: string, correlationId: string = newCorrelationId()): Promise<void> {
  const { error } = await supabase
    .schema('api')
    .rpc('report_absence', { p_child_id: childId, p_starts_on: startsOn, p_ends_on: endsOn })
    .setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
}

export async function cancelAbsence(absenceId: string, correlationId: string = newCorrelationId()): Promise<void> {
  const { error } = await supabase.schema('api').rpc('cancel_absence', { p_absence_id: absenceId }).setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
}
