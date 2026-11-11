import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { archiveFacility, createFacility } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Facilities({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const { supabase, org } = await getOrgContext(orgSlug);
  const { data: rows } = await supabase
    .from('facilities')
    .select('id, name, address, archived_at')
    .eq('organization_id', org.id)
    .order('archived_at', { nullsFirst: true })
    .order('name');
  return (
    <>
      <PageHeader title={t('admin.nav.facilities')} lede={t('admin.facilities.lede')} />
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="f-list">
          <h2 id="f-list">{t('admin.nav.facilities')}</h2>
          {rows?.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.facilities.name')}</th>
                  <th>{t('admin.facilities.address')}</th>
                  <th>
                    <span className="sr-only">{t('admin.facilities.archive')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <b>{f.name}</b>
                    </td>
                    <td className="wrap muted">{f.address ?? '—'}</td>
                    <td className="actions">
                      {f.archived_at ? (
                        <span className="pill departed">{t('admin.facilities.archived')}</span>
                      ) : (
                        <form action={archiveFacility}>
                          <input type="hidden" name="slug" value={org.slug} />
                          <input type="hidden" name="id" value={f.id} />
                          <button className="btn text" type="submit">
                            {t('admin.facilities.archive')}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pad muted">{t('admin.facilities.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="f-new">
          <h2 id="f-new">{t('admin.facilities.add')}</h2>
          <form action={createFacility} className="pad stack">
            <input type="hidden" name="slug" value={org.slug} />
            <label className="field">
              {t('admin.facilities.name')}
              <input name="name" required maxLength={120} />
            </label>
            <label className="field">
              {t('admin.facilities.address')}
              <input name="address" maxLength={200} />
            </label>
            <button className="btn primary" type="submit">
              {t('admin.facilities.add')}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
