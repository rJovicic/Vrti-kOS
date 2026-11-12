import { orgLocalDate, parseDateRange } from '@vrticos/domain';
import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

export interface HomeGroup {
  id: string;
  name: string;
  facility: string | null;
  organization: string;
  substituteUntil: string | null;
}

export interface HomeData {
  isEducator: boolean;
  isGuardian: boolean;
  isManagerOnly: boolean;
  groups: HomeGroup[];
}

/**
 * Everything here is read as the signed-in user; RLS decides what comes back (educators: only groups
 * assigned today, ADR-0005). The app never filters for security, only for presentation.
 */
export async function loadHome(userId: string, correlationId: string = newCorrelationId()): Promise<HomeData> {
  const { data: memberships, error } = await supabase
    .from('memberships')
    .select('role, organization:organizations(id, name, timezone)')
    .eq('profile_id', userId)
    .eq('status', 'active')
    .setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
  const active = (memberships ?? []).filter((m) => m.organization !== null);
  const roles = new Set(active.map((m) => m.role));
  const isEducator = roles.has('educator');
  const isGuardian = roles.has('guardian');

  let groups: HomeGroup[] = [];
  if (isEducator) {
    const [{ data: g, error: gErr }, { data: f }, { data: a }] = await Promise.all([
      supabase.from('groups').select('id, name, organization_id, facility_id').order('name').setHeader(CORRELATION_HEADER, correlationId),
      supabase.from('facilities').select('id, name').setHeader(CORRELATION_HEADER, correlationId),
      supabase.from('staff_assignments').select('group_id, assignment_type, valid_during').setHeader(CORRELATION_HEADER, correlationId),
    ]);
    if (gErr) throw gErr;
    const facility = new Map((f ?? []).map((x) => [x.id, x.name]));
    const orgs = new Map(active.map((m) => [m.organization!.id, m.organization!]));
    groups = (g ?? []).map((x) => {
      const org = orgs.get(x.organization_id);
      const today = orgLocalDate(new Date(), org?.timezone);
      const substitute = (a ?? [])
        .filter((s) => s.group_id === x.id && s.assignment_type === 'substitute')
        .map((s) => parseDateRange(String(s.valid_during)))
        .find((span) => span && (span.from ?? '') <= today && (span.toInclusive ?? '9999') >= today);
      return {
        id: x.id,
        name: x.name,
        facility: facility.get(x.facility_id) ?? null,
        organization: org?.name ?? '',
        substituteUntil: substitute?.toInclusive ?? null,
      };
    });
  }
  return { isEducator, isGuardian, isManagerOnly: active.length > 0 && !isEducator && !isGuardian, groups };
}
