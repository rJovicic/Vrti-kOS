import { formatDay } from '@vrticos/i18n';
import { orgLocalDate } from '@vrticos/domain';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { inviteMember, revokeInvitation } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Invitations({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const { supabase, org, isOrgAdmin } = await getOrgContext(orgSlug);
  const { data: rows } = await supabase
    .from('invitations')
    .select('id, email, role, first_name, last_name, status, expires_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const now = Date.now();
  // Only an org_admin may invite another org_admin; the database enforces the same rule.
  const roles: ('educator' | 'director' | 'org_admin')[] = isOrgAdmin ? ['educator', 'director', 'org_admin'] : ['educator', 'director'];

  return (
    <>
      <PageHeader title={t('admin.nav.invitations')} lede={t('admin.invitations.lede')} />
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="i-list">
          <h2 id="i-list">{t('admin.nav.invitations')}</h2>
          {rows?.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.staff.name')}</th>
                  <th>{t('admin.invitations.role')}</th>
                  <th>{t('admin.invitations.expires')}</th>
                  <th>{t('admin.staff.status')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => {
                  const state = i.status === 'pending' && Date.parse(i.expires_at) <= now ? 'expired' : i.status;
                  return (
                    <tr key={i.id}>
                      <td>
                        <b>
                          {i.first_name} {i.last_name}
                        </b>
                        <br />
                        <span className="muted">{i.email}</span>
                      </td>
                      <td>{t(`admin.roles.${i.role}`)}</td>
                      <td>{formatDay(orgLocalDate(new Date(i.expires_at), org.timezone))}</td>
                      <td className="actions">
                        <span className={`pill ${state === 'pending' ? 'info' : state === 'accepted' ? 'present' : 'departed'}`}>
                          {t(`admin.invitations.status.${state}`)}
                        </span>
                        {state === 'pending' ? (
                          <form action={revokeInvitation}>
                            <input type="hidden" name="slug" value={org.slug} />
                            <input type="hidden" name="id" value={i.id} />
                            <button className="btn text" type="submit">
                              {t('admin.invitations.revoke')}
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="pad muted">{t('admin.invitations.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="i-new">
          <h2 id="i-new">{t('admin.staff.invite')}</h2>
          <form action={inviteMember} className="pad stack">
            <input type="hidden" name="slug" value={org.slug} />
            <label className="field">
              {t('admin.invitations.firstName')}
              <input name="firstName" required maxLength={60} autoComplete="off" />
            </label>
            <label className="field">
              {t('admin.invitations.lastName')}
              <input name="lastName" required maxLength={60} autoComplete="off" />
            </label>
            <label className="field">
              {t('admin.invitations.email')}
              <input name="email" type="email" required maxLength={254} autoComplete="off" />
            </label>
            <label className="field">
              {t('admin.invitations.role')}
              <select name="role" required>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {t(`admin.roles.${r}`)}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn primary" type="submit">
              {t('admin.invitations.send')}
            </button>
            <p className="muted small">{t('admin.invitations.guardianLater')}</p>
          </form>
        </section>
      </div>
    </>
  );
}
