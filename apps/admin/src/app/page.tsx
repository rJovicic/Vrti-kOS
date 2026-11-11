import Link from 'next/link';
import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { signOut } from '@/app/actions';
import { AuthCard } from '@/components/AuthCard';
import { getManagedOrgs, requireUser } from '@/lib/dal';
import { t } from '@/lib/i18n';

// Personal-data pages must never be statically generated or cached (SR-WEB-04).
export const dynamic = 'force-dynamic';

/** Entry: routes the signed-in user to MFA, their kindergarten, or an explanation (no admin role). */
export default async function Home() {
  const { aal } = await requireUser();
  const orgs = await getManagedOrgs();
  if (orgs.length === 0) {
    return (
      <AuthCard title={t('auth.noAdminAccess')} lede={t('auth.noAdminAccessHelp')}>
        <form action={signOut}>
          <button className="btn secondary" type="submit">
            {t('auth.signOut')}
          </button>
        </form>
      </AuthCard>
    );
  }
  if (aal !== 'aal2') redirect('/mfa');
  if (orgs.length === 1) redirect(`/${orgs[0]!.slug}` as Route);
  return (
    <AuthCard title={t('auth.chooseOrg')}>
      <nav className="list" aria-label={t('auth.chooseOrg')}>
        {orgs.map((o) => (
          <Link key={o.id} className="row" href={`/${o.slug}` as Route}>
            <span className="grow t">{o.name}</span>
          </Link>
        ))}
      </nav>
    </AuthCard>
  );
}
