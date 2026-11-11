// Data access layer: every page and Server Action resolves the caller here (Next.js auth guide: never rely on a
// layout for authorization). The database still decides — RLS requires an active manager membership and AAL2.
import { orgLocalDate } from '@vrticos/domain';
import { notFound, redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient, type ServerClient } from '@/lib/supabase/server';

export type ManagerRole = 'org_admin' | 'director';

export interface Auth {
  supabase: ServerClient;
  userId: string;
  aal: 'aal1' | 'aal2';
}

export interface ManagedOrg {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  roles: ManagerRole[];
}

/** Verified claims (getClaims validates the JWT signature), or null when signed out. */
export const getAuth = cache(async (): Promise<Auth | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { supabase, userId: claims.sub, aal: claims.aal === 'aal2' ? 'aal2' : 'aal1' };
});

export async function requireUser(): Promise<Auth> {
  const auth = await getAuth();
  if (!auth) redirect('/sign-in');
  return auth;
}

/** Kindergartens where the caller holds an active manager membership (readable at AAL1: own rows only). */
export const getManagedOrgs = cache(async (): Promise<ManagedOrg[]> => {
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from('memberships')
    .select('role, organization:organizations(id, name, slug, timezone)')
    .eq('profile_id', userId)
    .eq('status', 'active')
    .in('role', ['org_admin', 'director']);
  const byId = new Map<string, ManagedOrg>();
  for (const row of data ?? []) {
    const org = row.organization; // null when the membership is not valid today (member_org_ids)
    if (!org) continue;
    const entry = byId.get(org.id) ?? { ...org, roles: [] };
    entry.roles.push(row.role as ManagerRole);
    byId.set(org.id, entry);
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'hr'));
});

export interface OrgContext extends Auth {
  org: ManagedOrg;
  today: string;
  isOrgAdmin: boolean;
}

/** Manager of this kindergarten with an MFA (AAL2) session — otherwise MFA step or 404 (no existence leak). */
export const getOrgContext = cache(async (slug: string): Promise<OrgContext> => {
  const auth = await requireUser();
  const org = (await getManagedOrgs()).find((o) => o.slug === slug);
  if (!org) notFound();
  if (auth.aal !== 'aal2') redirect('/mfa');
  return { ...auth, org, today: orgLocalDate(new Date(), org.timezone), isOrgAdmin: org.roles.includes('org_admin') };
});
