import type { ReactNode } from 'react';
import { signOut } from '@/app/actions';
import { Nav } from '@/components/Nav';
import { getOrgContext } from '@/lib/dal';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** Shell only. Each page and action calls getOrgContext itself; this layout is not an authorization boundary. */
export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const { org } = await getOrgContext(orgSlug);
  const base = `/${org.slug}`;
  const items = [
    { href: base, label: t('admin.nav.overview') },
    { href: `${base}/facilities`, label: t('admin.nav.facilities') },
    { href: `${base}/academic-years`, label: t('admin.nav.academicYears') },
    { href: `${base}/groups`, label: t('admin.nav.groups') },
    { href: `${base}/children`, label: t('admin.nav.children') },
    { href: `${base}/staff`, label: t('admin.nav.staff') },
    { href: `${base}/invitations`, label: t('admin.nav.invitations') },
  ];
  return (
    <div className="app">
      <aside className="side">
        <div className="org">
          <b>{org.name}</b>
          <span>
            {org.roles.map((r) => t(`admin.roles.${r}`)).join(', ')} · {t('admin.mfaConfirmed')}
          </span>
        </div>
        <Nav items={items} label={t('common.appName')} />
        <span className="spacer" />
        <form action={signOut}>
          <button className="btn text" type="submit">
            {t('auth.signOut')}
          </button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
