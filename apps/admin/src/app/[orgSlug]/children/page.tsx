import type { Route } from 'next';
import Link from 'next/link';
import { formatDay } from '@vrticos/i18n';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { loadChildren } from '@/lib/children';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { createChild } from './actions';

export const dynamic = 'force-dynamic';

export default async function Children({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  const children = await loadChildren(ctx);
  const base = `/${ctx.org.slug}/children`;

  return (
    <>
      <PageHeader title={t('admin.nav.children')} lede={t('admin.children.lede')} />
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="c-list">
          <h2 id="c-list">{t('admin.nav.children')}</h2>
          {children.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.children.name')}</th>
                  <th>{t('admin.children.group')}</th>
                  <th>{t('admin.children.status')}</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`${base}/${c.id}` as Route}>
                        <b>{c.name}</b>
                      </Link>
                      {c.internalRef ? (
                        <>
                          <br />
                          <span className="muted">{c.internalRef}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="wrap">
                      {c.groupName ?? <span className="muted">{t('admin.children.noGroup')}</span>}
                      {c.plannedGroupName && c.status === 'active' ? (
                        <>
                          <br />
                          <span className="muted">{t('admin.children.enrollments.state.future')}</span>
                        </>
                      ) : null}
                    </td>
                    <td>
                      <span className={`pill ${c.status === 'active' ? 'present' : 'departed'}`}>{t(`admin.children.statusLabel.${c.status}`)}</span>
                      {c.withdrawnOn ? <span className="muted"> {formatDay(c.withdrawnOn)}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pad muted">{t('admin.children.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="c-add">
          <h2 id="c-add">{t('admin.children.addTitle')}</h2>
          <form action={createChild} className="pad stack">
            <input type="hidden" name="slug" value={ctx.org.slug} />
            <label className="field">
              {t('admin.children.firstName')}
              <input name="firstName" required maxLength={60} autoComplete="off" />
            </label>
            <label className="field">
              {t('admin.children.lastName')}
              <input name="lastName" required maxLength={60} autoComplete="off" />
            </label>
            <label className="field">
              {t('admin.children.internalRef')}
              <input name="internalRef" maxLength={40} autoComplete="off" />
            </label>
            <p className="small muted">{t('admin.children.minimalNote')}</p>
            <button className="btn primary" type="submit">
              {t('admin.children.add')}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
