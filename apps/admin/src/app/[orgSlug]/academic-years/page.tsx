import { formatDay } from '@vrticos/i18n';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { createAcademicYear, setAcademicYearStatus } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AcademicYears({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const { supabase, org } = await getOrgContext(orgSlug);
  const { data: rows } = await supabase
    .from('academic_years')
    .select('id, name, starts_on, ends_on, status')
    .eq('organization_id', org.id)
    .order('starts_on', { ascending: false });
  const statusAction = (id: string, status: 'active' | 'closed', label: string) => (
    <form action={setAcademicYearStatus}>
      <input type="hidden" name="slug" value={org.slug} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className="btn text" type="submit">
        {label}
      </button>
    </form>
  );
  return (
    <>
      <PageHeader title={t('admin.nav.academicYears')} lede={t('admin.years.lede')} />
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="y-list">
          <h2 id="y-list">{t('admin.nav.academicYears')}</h2>
          {rows?.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.years.name')}</th>
                  <th>{t('admin.years.startsOn')}</th>
                  <th>{t('admin.years.endsOn')}</th>
                  <th>{t('admin.staff.status')}</th>
                  <th>
                    <span className="sr-only">{t('admin.years.activate')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((y) => (
                  <tr key={y.id}>
                    <td>
                      <b>{y.name}</b>
                    </td>
                    <td>{formatDay(y.starts_on)}</td>
                    <td>{formatDay(y.ends_on)}</td>
                    <td>
                      <span className={`pill ${y.status === 'active' ? 'present' : y.status === 'closed' ? 'departed' : 'expected'}`}>
                        {t(`admin.years.status.${y.status}`)}
                      </span>
                    </td>
                    <td className="actions">
                      {y.status === 'planned' ? statusAction(y.id, 'active', t('admin.years.activate')) : null}
                      {y.status === 'active' ? statusAction(y.id, 'closed', t('admin.years.close')) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="pad muted">{t('admin.years.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="y-new">
          <h2 id="y-new">{t('admin.years.add')}</h2>
          <form action={createAcademicYear} className="pad stack">
            <input type="hidden" name="slug" value={org.slug} />
            <label className="field">
              {t('admin.years.name')}
              <input name="name" required maxLength={60} />
            </label>
            <label className="field">
              {t('admin.years.startsOn')}
              <input name="startsOn" type="date" required />
            </label>
            <label className="field">
              {t('admin.years.endsOn')}
              <input name="endsOn" type="date" required />
            </label>
            <button className="btn primary" type="submit">
              {t('admin.years.add')}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
