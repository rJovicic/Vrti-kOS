import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { loadStaff } from '@/lib/staff';
import { createGroup } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Groups({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  const { supabase, org } = ctx;
  const [{ data: facilities }, { data: years }, { data: groups }, staffData] = await Promise.all([
    supabase.from('facilities').select('id, name').eq('organization_id', org.id).is('archived_at', null).order('name'),
    supabase.from('academic_years').select('id, name, status').eq('organization_id', org.id).neq('status', 'closed').order('starts_on'),
    supabase.from('groups').select('id, name, capacity, facility_id, academic_year_id').eq('organization_id', org.id).is('archived_at', null).order('name'),
    loadStaff(ctx),
  ]);
  const facilityName = new Map((facilities ?? []).map((f) => [f.id, f.name]));
  const yearName = new Map((years ?? []).map((y) => [y.id, y.name]));
  const staffName = new Map(staffData.staff.map((s) => [s.membershipId, s]));
  const educatorsToday = (groupId: string) =>
    staffData.assignments
      .filter((a) => a.groupId === groupId && a.validToday && staffName.get(a.membershipId)?.status === 'active')
      .map((a) => `${staffName.get(a.membershipId)?.name}${a.type === 'substitute' ? ` (${t('admin.staff.substitute').toLowerCase()})` : ''}`);
  const canCreate = (facilities?.length ?? 0) > 0 && (years?.length ?? 0) > 0;

  return (
    <>
      <PageHeader title={t('admin.nav.groups')} lede={t('admin.groups.lede')} />
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="g-list">
          <h2 id="g-list">{t('admin.nav.groups')}</h2>
          {groups?.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.groups.name')}</th>
                  <th>{t('admin.groups.year')}</th>
                  <th>{t('admin.groups.capacity')}</th>
                  <th>{t('admin.groups.educators')}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const eds = educatorsToday(g.id);
                  return (
                    <tr key={g.id}>
                      <td>
                        <b>{g.name}</b>
                        <br />
                        <span className="muted">{facilityName.get(g.facility_id) ?? '—'}</span>
                      </td>
                      <td>{yearName.get(g.academic_year_id) ?? '—'}</td>
                      <td>{g.capacity ?? '—'}</td>
                      <td className="wrap">{eds.length ? eds.join(', ') : <span className="muted">{t('admin.groups.noEducator')}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="pad muted">{t('admin.groups.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="g-new">
          <h2 id="g-new">{t('admin.groups.add')}</h2>
          {canCreate ? (
            <form action={createGroup} className="pad stack">
              <input type="hidden" name="slug" value={org.slug} />
              <label className="field">
                {t('admin.groups.name')}
                <input name="name" required maxLength={80} />
              </label>
              <label className="field">
                {t('admin.groups.facility')}
                <select name="facilityId" required>
                  {facilities!.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t('admin.groups.year')}
                <select name="academicYearId" required>
                  {years!.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} · {t(`admin.years.status.${y.status}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {t('admin.groups.capacity')}
                <input name="capacity" type="number" min={1} max={60} />
              </label>
              <button className="btn primary" type="submit">
                {t('admin.groups.add')}
              </button>
            </form>
          ) : (
            <p className="pad muted">{t('admin.groups.empty')}</p>
          )}
        </section>
      </div>
    </>
  );
}
