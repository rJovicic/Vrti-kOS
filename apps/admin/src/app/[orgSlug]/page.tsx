import type { Route } from 'next';
import Link from 'next/link';
import { formatLongDate } from '@vrticos/i18n';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function Overview({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { supabase, org } = await getOrgContext(orgSlug);
  const count = { count: 'exact', head: true } as const;
  const [facilities, groups, staff, invitations] = await Promise.all([
    supabase.from('facilities').select('id', count).eq('organization_id', org.id).is('archived_at', null),
    supabase.from('groups').select('id', count).eq('organization_id', org.id).is('archived_at', null),
    supabase.from('memberships').select('id', count).eq('organization_id', org.id).eq('status', 'active').neq('role', 'guardian'),
    supabase.from('invitations').select('id', count).eq('organization_id', org.id).eq('status', 'pending').gt('expires_at', new Date().toISOString()),
  ]);
  const base = `/${org.slug}`;
  const tiles = [
    { label: t('admin.overview.facilities'), value: facilities.count, href: `${base}/facilities` },
    { label: t('admin.overview.groups'), value: groups.count, href: `${base}/groups` },
    { label: t('admin.overview.staff'), value: staff.count, href: `${base}/staff` },
    { label: t('admin.overview.pendingInvitations'), value: invitations.count, href: `${base}/invitations` },
  ];
  return (
    <>
      <PageHeader title={t('admin.nav.overview')} lede={`${formatLongDate(new Date(), org.timezone)} · ${t('admin.overview.lede')}`} />
      <section className="tiles" aria-label={t('admin.nav.overview')}>
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href as Route} className="tile">
            <span className="tile-value">{tile.value ?? '—'}</span>
            <span className="tile-label">{tile.label}</span>
          </Link>
        ))}
      </section>
      <p className="muted">{t('admin.overview.todayNote')}</p>
    </>
  );
}
