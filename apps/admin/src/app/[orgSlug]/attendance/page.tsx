import type { ReactNode } from 'react';
import { formatDay, formatTime } from '@vrticos/i18n';
import { attendanceCorrectionReasons, zAttendanceDayQuery } from '@vrticos/validation';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { loadAttendanceDay, type ChildDay } from '@/lib/attendanceDay';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { absenceOnBehalf, cancelAbsence, correctAttendance, recordMissed, recordNow } from './actions';

export const dynamic = 'force-dynamic';

const pill: Record<ChildDay['status'], string> = { present: 'present', departed: 'departed', absent: 'absent', expected: 'expected', not_enrolled: 'expected' };
const label: Record<ChildDay['status'], string> = {
  present: 'attendance.present',
  departed: 'attendance.departed',
  absent: 'attendance.absent',
  expected: 'attendance.expected',
  not_enrolled: 'attendance.expected',
};

function Disclose({ text, children }: { text: string; children: ReactNode }) {
  return (
    <details className="disclose">
      <summary className="btn text">{text}</summary>
      <div className="disclose-body">{children}</div>
    </details>
  );
}

/** D3-G: attendance of one group on one day (prototype "Dolasci"), corrections with reason, absences on behalf. */
export default async function Attendance({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, query] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  const { org, today, supabase } = ctx;
  const { data: groups } = await supabase.from('groups').select('id, name').eq('organization_id', org.id).is('archived_at', null).order('name');
  const parsed = zAttendanceDayQuery.safeParse({ group: query.group ?? groups?.[0]?.id, date: query.date ?? today });
  const groupId = parsed.success ? parsed.data.group : groups?.[0]?.id;
  const date = parsed.success ? parsed.data.date : today;
  const groupName = groups?.find((g) => g.id === groupId)?.name ?? '';
  const data = groupId ? await loadAttendanceDay(ctx, groupId, date) : { days: [], absences: [], failed: false };
  const isToday = date === today;
  const time = (iso: string | null) => (iso ? formatTime(new Date(iso), org.timezone) : '—');
  const count = (s: ChildDay['status']) => data.days.filter((d) => d.status === s).length;
  const hidden = (
    <>
      <input type="hidden" name="slug" value={org.slug} />
      <input type="hidden" name="group" value={groupId ?? ''} />
      <input type="hidden" name="date" value={date} />
    </>
  );
  const reasonSelect = (
    <label className="field">
      {t('admin.attendance.reason')}
      <select name="reason" required>
        {attendanceCorrectionReasons.map((r) => (
          <option key={r} value={r}>
            {t(`admin.attendance.reasons.${r}`)}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader title={t('admin.nav.attendance')} lede={groupName ? `${groupName} · ${formatDay(date)}` : t('admin.attendance.lede')}>
        <form className="header-actions" method="get">
          <label className="field">
            {t('admin.attendance.group')}
            <select name="group" defaultValue={groupId}>
              {(groups ?? []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            {t('admin.attendance.date')}
            <input name="date" type="date" max={today} defaultValue={date} />
          </label>
          <button className="btn secondary" type="submit">
            {t('admin.attendance.show')}
          </button>
        </form>
      </PageHeader>
      <Flash params={query} />
      {!groups?.length ? <p className="muted">{t('admin.attendance.noGroups')}</p> : null}
      {groupId ? (
        <>
          <p className="muted small">
            {t('admin.attendance.counts', { present: count('present'), expected: count('expected'), departed: count('departed'), absent: count('absent') })}
          </p>
          <div className="grid2">
            <section className="panel" aria-labelledby="att-list">
              <h2 id="att-list">
                {t('admin.nav.attendance')} <small>{t('admin.attendance.lede')}</small>
              </h2>
              {data.days.length ? (
                <table className="compact">
                  <thead>
                    <tr>
                      <th>{t('admin.attendance.child')}</th>
                      <th>{t('admin.attendance.state')}</th>
                      <th>{t('admin.attendance.arrival')}</th>
                      <th>{t('admin.attendance.departure')}</th>
                      <th>{t('admin.attendance.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.map((d) => (
                      <tr key={d.childId}>
                        <td className="wrap name-cell">
                          <b>{d.name}</b>
                        </td>
                        <td>
                          <span className={`pill ${pill[d.status]}`}>{t(label[d.status])}</span>
                        </td>
                        <td>{time(d.arrivedAt)}</td>
                        <td>{time(d.departedAt)}</td>
                        <td className="wrap">
                          {d.events
                            .filter((e) => e.kind !== 'void' && !e.voided && e.handover)
                            .map((e) => (
                              <span key={e.id} className="small">
                                {t(e.kind === 'check_in' ? 'admin.attendance.handedOverBy' : 'admin.attendance.pickedUpBy', { name: e.handover!.name })}
                                {e.handover!.restricted ? ` (${t('attendance.handoverRestricted')})` : ''}
                                <br />
                              </span>
                            ))}
                          {d.corrected ? <span className="muted">{t('admin.attendance.corrected')}</span> : null}
                          {d.absenceIsLate ? <span className="muted"> · {t('admin.attendance.lateAbsence')}</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="pad muted">{t('admin.attendance.empty')}</p>
              )}
              {data.days.map((d) => {
                const live = d.events.filter((e) => e.kind !== 'void' && !e.voided);
                return (
                  <details className="manage" key={d.childId}>
                    <summary>{t('admin.attendance.correctTitle', { name: d.name })}</summary>
                    <div className="manage-body">
                      {isToday && (d.status === 'expected' || d.status === 'absent' || d.status === 'present') ? (
                        <form action={recordNow} className="stack">
                          {hidden}
                          <input type="hidden" name="childId" value={d.childId} />
                          <input type="hidden" name="kind" value={d.status === 'present' ? 'check_out' : 'check_in'} />
                          <h3>{t(d.status === 'present' ? 'admin.attendance.recordDeparture' : 'admin.attendance.recordArrival')}</h3>
                          <button className="btn secondary" type="submit">
                            {t(d.status === 'present' ? 'admin.attendance.recordDeparture' : 'admin.attendance.recordArrival')}
                          </button>
                        </form>
                      ) : null}
                      {live.length ? (
                        <form action={correctAttendance} className="stack">
                          {hidden}
                          <h3>{t('admin.attendance.correct')}</h3>
                          <p className="small muted">{t('admin.attendance.correctNote')}</p>
                          <label className="field">
                            {t('admin.attendance.correctEvent')}
                            <select name="recordId" required>
                              {live.map((e) => (
                                <option key={e.id} value={e.id}>
                                  {t(`admin.attendance.kinds.${e.kind}`)} · {time(e.occurredAt)}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            {t('admin.attendance.newTime')}
                            <input name="time" type="time" />
                          </label>
                          {reasonSelect}
                          <button className="btn primary" type="submit">
                            {t('admin.attendance.saveCorrection')}
                          </button>
                        </form>
                      ) : null}
                      <form action={recordMissed} className="stack">
                        {hidden}
                        <input type="hidden" name="childId" value={d.childId} />
                        <h3>{t('admin.attendance.missed')}</h3>
                        <label className="field">
                          {t('admin.attendance.kind')}
                          <select name="kind" required>
                            <option value="check_in">{t('admin.attendance.kinds.check_in')}</option>
                            <option value="check_out">{t('admin.attendance.kinds.check_out')}</option>
                          </select>
                        </label>
                        <label className="field">
                          {t('admin.attendance.time')}
                          <input name="time" type="time" required />
                        </label>
                        {reasonSelect}
                        <button className="btn secondary" type="submit">
                          {t('admin.attendance.saveMissed')}
                        </button>
                      </form>
                    </div>
                  </details>
                );
              })}
            </section>

            <section className="panel" aria-labelledby="abs-list">
              <h2 id="abs-list">{t('admin.attendance.absences')}</h2>
              {data.absences.length ? (
                <div>
                  {data.absences.map((a) => (
                    <div className="row" key={a.id}>
                      <span className="grow">
                        <span className="t">{a.name}</span>
                        <br />
                        <span className="muted small">
                          {a.startsOn === a.endsOn ? formatDay(a.startsOn) : `${formatDay(a.startsOn)} – ${formatDay(a.endsOn)}`} ·{' '}
                          {t(a.source === 'guardian' ? 'admin.attendance.sourceGuardian' : 'admin.attendance.sourceStaff')}
                          {a.isLate ? ` · ${t('admin.attendance.lateAbsence')}` : ''}
                        </span>
                      </span>
                      {a.endsOn >= today ? (
                        <Disclose text={t('admin.attendance.cancelAbsence')}>
                          <form action={cancelAbsence} className="stack">
                            {hidden}
                            <input type="hidden" name="absenceId" value={a.id} />
                            <button className="btn secondary" type="submit">
                              {t('admin.attendance.cancelAbsence')}
                            </button>
                          </form>
                        </Disclose>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pad muted">{t('admin.attendance.absencesEmpty')}</p>
              )}
              {data.days.length ? (
                <div className="pad">
                  <Disclose text={t('admin.attendance.onBehalf')}>
                    <form action={absenceOnBehalf} className="stack">
                      {hidden}
                      <label className="field">
                        {t('admin.attendance.child')}
                        <select name="childId" required>
                          {data.days.map((d) => (
                            <option key={d.childId} value={d.childId}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        {t('admin.attendance.from')}
                        <input name="from" type="date" required min={today} defaultValue={today} />
                      </label>
                      <label className="field">
                        {t('admin.attendance.to')}
                        <input name="to" type="date" required min={today} defaultValue={today} />
                      </label>
                      <button className="btn primary" type="submit">
                        {t('admin.attendance.saveAbsence')}
                      </button>
                    </form>
                  </Disclose>
                </div>
              ) : null}
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
