import type { Route } from 'next';
import Link from 'next/link';
import { formatDay } from '@vrticos/i18n';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { loadStaff, type AssignmentRow } from '@/lib/staff';
import { createAssignment, endAssignment, setMembershipStatus } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Staff({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  const { org, userId, today, isOrgAdmin } = ctx;
  const { staff, groups, assignments } = await loadStaff(ctx);
  const { data: own } = await ctx.supabase.from('memberships').select('id').eq('organization_id', org.id).eq('profile_id', userId);
  const ownIds = new Set((own ?? []).map((m) => m.id));
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const educators = staff.filter((s) => s.role === 'educator' && s.status === 'active');

  const describe = (a: AssignmentRow) => {
    const range = a.span.toInclusive ? `${formatDay(a.span.from!)} – ${formatDay(a.span.toInclusive)}` : t('admin.staff.since', { date: formatDay(a.span.from!) });
    return `${groupName.get(a.groupId) ?? '—'} · ${a.type === 'substitute' ? t('admin.staff.substitute') : t('admin.staff.regular')} · ${range}`;
  };

  return (
    <>
      <PageHeader title={t('admin.nav.staff')} lede={t('admin.staff.lede')}>
        <Link className="btn secondary" href={`/${org.slug}/invitations` as Route}>
          {t('admin.staff.invite')}
        </Link>
      </PageHeader>
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="s-list">
          <h2 id="s-list">{t('admin.nav.staff')}</h2>
          {staff.length ? (
            <table>
              <thead>
                <tr>
                  <th>{t('admin.staff.name')}</th>
                  <th>{t('admin.staff.assignments')}</th>
                  <th>{t('admin.staff.status')}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const mine = assignments.filter((a) => a.membershipId === s.membershipId && a.current);
                  return (
                    <tr key={s.membershipId}>
                      <td>
                        <b>{s.name}</b>
                        <br />
                        <span className="muted">{t(`admin.roles.${s.role}`)}</span>
                      </td>
                      <td className="wrap">
                        {s.role !== 'educator' ? (
                          <span className="muted">—</span>
                        ) : mine.length ? (
                          <ul className="plain">
                            {mine.map((a) => (
                              <li key={a.id}>
                                <span>{describe(a)}</span>
                                {a.span.toInclusive === null || a.span.toInclusive > today ? (
                                  <form action={endAssignment} className="inline">
                                    <input type="hidden" name="slug" value={org.slug} />
                                    <input type="hidden" name="id" value={a.id} />
                                    <input type="hidden" name="from" value={a.span.from!} />
                                    <button className="btn text" type="submit">
                                      {t('admin.staff.end')}
                                    </button>
                                  </form>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="muted">{t('admin.staff.noAssignments')}</span>
                        )}
                      </td>
                      <td className="actions">
                        <span className={`pill ${s.status === 'active' ? 'present' : 'absent'}`}>{t(`admin.staff.statusLabel.${s.status}`)}</span>
                        {ownIds.has(s.membershipId) || s.status === 'ended' || (s.role === 'org_admin' && !isOrgAdmin) ? null : (
                          <form action={setMembershipStatus}>
                            <input type="hidden" name="slug" value={org.slug} />
                            <input type="hidden" name="id" value={s.membershipId} />
                            <input type="hidden" name="status" value={s.status === 'active' ? 'suspended' : 'active'} />
                            <button
                              className="btn text"
                              type="submit"
                              title={s.status === 'active' ? t('admin.staff.suspendConfirm') : undefined}
                            >
                              {s.status === 'active' ? t('admin.staff.suspend') : t('admin.staff.reactivate')}
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="pad muted">{t('admin.staff.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="s-assign">
          <h2 id="s-assign">{t('admin.staff.assignTitle')}</h2>
          <form action={createAssignment} className="pad stack">
            <input type="hidden" name="slug" value={org.slug} />
            <label className="field">
              {t('admin.staff.educator')}
              <select name="membershipId" required>
                {educators.map((s) => (
                  <option key={s.membershipId} value={s.membershipId}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              {t('admin.staff.group')}
              <select name="groupId" required>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="field">
              <legend>{t('admin.staff.type')}</legend>
              <label className="radio">
                <input type="radio" name="type" value="regular" defaultChecked /> {t('admin.staff.regular')}
              </label>
              <label className="radio">
                <input type="radio" name="type" value="substitute" /> {t('admin.staff.substitute')}
              </label>
            </fieldset>
            <label className="field">
              {t('admin.staff.from')}
              <input name="from" type="date" required defaultValue={today} />
            </label>
            <label className="field">
              {t('admin.staff.to')}
              <input name="to" type="date" />
            </label>
            <button className="btn primary" type="submit" disabled={!educators.length || !groups.length}>
              {t('admin.staff.assign')}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
