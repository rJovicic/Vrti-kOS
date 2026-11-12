import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { DateSpan } from '@vrticos/domain';
import { formatDay } from '@vrticos/i18n';
import { cancellationReasons } from '@vrticos/validation';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { loadChild, type LinkRow, type Timing } from '@/lib/children';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import {
  addPickup,
  addRestriction,
  cancelFutureRecord,
  endLink,
  endPickup,
  endRestriction,
  enrolChild,
  inviteGuardian,
  linkGuardian,
  transferChild,
  updateChild,
  updateLinkRights,
  withdrawChild,
} from '../actions';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const period = (s: DateSpan) =>
  s.toInclusive ? `${formatDay(s.from!)} – ${formatDay(s.toInclusive)}` : t('admin.children.pickups.since', { date: formatDay(s.from!) });
const statePill: Record<Timing, string> = { past: 'departed', current: 'present', future: 'expected' };

/** A secondary form behind a disclosure button: the default view stays calm, every action is one click away. */
function Disclose({ label, children, tone = 'secondary' }: { label: string; children: ReactNode; tone?: 'secondary' | 'text' }) {
  return (
    <details className="disclose">
      <summary className={`btn ${tone}`}>{label}</summary>
      <div className="disclose-body">{children}</div>
    </details>
  );
}

export default async function ChildPage({ params, searchParams }: { params: Promise<{ orgSlug: string; childId: string }>; searchParams: SearchParams }) {
  const [{ orgSlug, childId }, flash] = await Promise.all([params, searchParams]);
  const ctx = await getOrgContext(orgSlug);
  if (!UUID.test(childId)) notFound();
  const child = await loadChild(ctx, childId);
  if (!child) notFound();
  const { org, today } = ctx;
  const active = child.status === 'active';
  const current = child.enrollments.find((e) => e.timing === 'current');
  const hasFuture = child.enrollments.some((e) => e.timing === 'future');
  const name = `${child.firstName} ${child.lastName}`;

  const ids = (
    <>
      <input type="hidden" name="slug" value={org.slug} />
      <input type="hidden" name="childId" value={child.id} />
    </>
  );
  const ReasonSelect = () => (
    <label className="field">
      {t('admin.children.cancel.reason')}
      <select name="reason" required>
        {cancellationReasons.map((r) => (
          <option key={r} value={r}>
            {t(`admin.children.cancel.reasons.${r}`)}
          </option>
        ))}
      </select>
    </label>
  );
  const CancelForm = ({ kind, recordId }: { kind: 'enrollment' | 'pickup_authorization'; recordId: string }) => (
    <Disclose label={t('admin.children.cancel.action')} tone="text">
      <form action={cancelFutureRecord} className="stack">
        {ids}
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="recordId" value={recordId} />
        <p className="small muted">{t('admin.children.cancel.note')}</p>
        <ReasonSelect />
        <button className="btn secondary" type="submit">
          {t('admin.children.cancel.action')}
        </button>
      </form>
    </Disclose>
  );
  const EndFields = ({ recordId, span }: { recordId: string; span: DateSpan }) => (
    <>
      {ids}
      <input type="hidden" name="recordId" value={recordId} />
      <input type="hidden" name="from" value={span.from!} />
      <label className="field">
        {t('admin.children.guardians.lastDay')}
        <input name="lastDay" type="date" required min={today} defaultValue={today} />
      </label>
      <button className="btn secondary" type="submit">
        {t('admin.children.guardians.endSubmit')}
      </button>
    </>
  );
  const EndForm = ({ action, recordId, span, title }: { action: (f: FormData) => Promise<void>; recordId: string; span: DateSpan; title: string }) => (
    <form action={action} className="stack">
      <h3>{title}</h3>
      <EndFields recordId={recordId} span={span} />
    </form>
  );
  const EndDisclose = ({ action, recordId, span, label }: { action: (f: FormData) => Promise<void>; recordId: string; span: DateSpan; label: string }) => (
    <Disclose label={label} tone="text">
      <form action={action} className="stack">
        <EndFields recordId={recordId} span={span} />
      </form>
    </Disclose>
  );

  const accountCell = (l: LinkRow) => {
    if (l.restrictions.some((r) => r.timing === 'current')) return <span className="pill departed">{t('admin.children.guardians.noAccess')}</span>;
    if (l.hasAccount) return <span className="pill present">{t('admin.children.guardians.accountActive')}</span>;
    if (l.invitation === 'pending') return <span className="pill info">{t('admin.children.guardians.invitationPending')}</span>;
    return <span className="pill expected">{t('admin.children.guardians.noAccount')}</span>;
  };
  const yesNo = (v: boolean) => t(v ? 'admin.children.guardians.yes' : 'admin.children.guardians.no');
  const visibleLinks = child.links.filter((l) => l.timing !== 'past');
  const pastLinks = child.links.filter((l) => l.timing === 'past');

  const lede = !active
    ? t('admin.children.ledeWithdrawn', { date: formatDay(child.withdrawnOn!) })
    : current
      ? t('admin.children.ledeGroup', { group: current.groupName, date: formatDay(current.span.from!) })
      : t('admin.children.ledeNoGroup');

  return (
    <>
      <p className="small">
        <Link href={`/${org.slug}/children` as Route}>← {t('admin.children.back')}</Link>
      </p>
      <PageHeader title={name} lede={lede}>
        {active ? (
          <div className="header-actions">
            {current && !hasFuture ? (
              <Disclose label={t('admin.children.enrollments.transfer')}>
                <form action={transferChild} className="stack">
                  {ids}
                  <label className="field">
                    {t('admin.staff.group')}
                    <select name="groupId" required>
                      {child.groups
                        .filter((g) => g.id !== current.groupId)
                        .map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="field">
                    {t('admin.children.enrollments.transferFrom')}
                    <input name="effectiveOn" type="date" required min={today} defaultValue={today} />
                  </label>
                  <p className="small muted">{t('admin.children.enrollments.transferNote')}</p>
                  <button className="btn primary" type="submit">
                    {t('admin.children.enrollments.transferSubmit')}
                  </button>
                </form>
              </Disclose>
            ) : null}
            <Disclose label={t('admin.children.enrollments.withdraw')}>
              <form action={withdrawChild} className="stack">
                {ids}
                <label className="field">
                  {t('admin.children.enrollments.lastDay')}
                  <input name="lastDay" type="date" required min={today} defaultValue={today} />
                </label>
                <p className="small muted">{t('admin.children.enrollments.withdrawNote')}</p>
                <label className="radio">
                  <input type="checkbox" name="confirm" required /> {t('admin.children.enrollments.withdrawConfirm')}
                </label>
                <button className="btn primary" type="submit">
                  {t('admin.children.enrollments.withdrawSubmit')}
                </button>
              </form>
            </Disclose>
          </div>
        ) : (
          <span className="pill departed">{t('admin.children.statusLabel.withdrawn')}</span>
        )}
      </PageHeader>
      <Flash params={flash} />
      <div className="grid2">
        <div className="column">
          <section className="panel" aria-labelledby="g-title">
            <h2 id="g-title">
              {t('admin.children.guardians.title')} <small>{t('admin.children.guardians.lede')}</small>
            </h2>
            {visibleLinks.length ? (
              <table className="compact">
                <thead>
                  <tr>
                    <th>{t('admin.children.guardians.name')}</th>
                    <th>{t('admin.children.guardians.canView')}</th>
                    <th>{t('admin.children.guardians.canReportAbsence')}</th>
                    <th>{t('admin.children.guardians.receivesMessages')}</th>
                    <th>{t('admin.children.guardians.account')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLinks.map((l) => {
                    const restriction = l.restrictions.find((r) => r.timing !== 'past');
                    return (
                      <tr key={l.id}>
                        <td className="wrap name-cell">
                          <b>{l.guardianName}</b>
                          <br />
                          <span className="muted">{period(l.span)}</span>
                          {restriction ? (
                            <>
                              <br />
                              <span className="pill absent">
                                {t('admin.children.guardians.restricted')} {t('admin.children.guardians.restrictedFrom', { date: formatDay(restriction.span.from!) })}
                              </span>
                              {restriction.reference ? <span className="muted"> · {t('admin.children.guardians.reference', { ref: restriction.reference })}</span> : null}
                            </>
                          ) : null}
                        </td>
                        <td>{yesNo(l.canView)}</td>
                        <td>{yesNo(l.canReportAbsence)}</td>
                        <td>{yesNo(l.receivesMessages)}</td>
                        <td>{accountCell(l)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="pad muted">{t('admin.children.guardians.empty')}</p>
            )}
            {active
              ? visibleLinks.map((l) => {
                  const restriction = l.restrictions.find((r) => r.timing !== 'past');
                  return (
                    <details className="manage" id={`veza-${l.id}`} key={l.id}>
                      <summary>{t('admin.children.guardians.manageTitle', { name: l.guardianName })}</summary>
                      <div className="manage-body">
                        {l.timing === 'future' ? (
                          <form action={cancelFutureRecord} className="stack">
                            {ids}
                            <input type="hidden" name="kind" value="child_guardian" />
                            <input type="hidden" name="recordId" value={l.id} />
                            <h3>{t('admin.children.cancel.action')}</h3>
                            <p className="small muted">{t('admin.children.cancel.note')}</p>
                            <ReasonSelect />
                            <button className="btn secondary" type="submit">
                              {t('admin.children.cancel.action')}
                            </button>
                          </form>
                        ) : (
                          <>
                            <form action={updateLinkRights} className="stack">
                              {ids}
                              <input type="hidden" name="linkId" value={l.id} />
                              <h3>{t('admin.children.guardians.rights')}</h3>
                              <label className="radio">
                                <input type="checkbox" name="canView" defaultChecked={l.canView} /> {t('admin.children.guardians.canView')}
                              </label>
                              <label className="radio">
                                <input type="checkbox" name="canReportAbsence" defaultChecked={l.canReportAbsence} /> {t('admin.children.guardians.canReportAbsence')}
                              </label>
                              <label className="radio">
                                <input type="checkbox" name="receivesMessages" defaultChecked={l.receivesMessages} /> {t('admin.children.guardians.receivesMessages')}
                              </label>
                              <button className="btn secondary" type="submit">
                                {t('admin.children.guardians.saveRights')}
                              </button>
                            </form>
                            {!l.hasAccount && l.invitation !== 'pending' && l.guardianActive ? (
                              <form action={inviteGuardian} className="stack">
                                {ids}
                                <input type="hidden" name="guardianId" value={l.guardianId} />
                                <h3>{t('admin.children.guardians.invite')}</h3>
                                <label className="field">
                                  {t('admin.children.guardians.inviteEmail')}
                                  <input name="email" type="email" required maxLength={254} autoComplete="off" />
                                </label>
                                <p className="small muted">{t('admin.children.guardians.inviteNote')}</p>
                                <button className="btn secondary" type="submit">
                                  {t('admin.children.guardians.invite')}
                                </button>
                              </form>
                            ) : null}
                            {restriction ? (
                              <EndForm action={endRestriction} recordId={restriction.id} span={restriction.span} title={t('admin.children.guardians.endRestriction')} />
                            ) : (
                              <form action={addRestriction} className="stack danger-zone">
                                {ids}
                                <input type="hidden" name="linkId" value={l.id} />
                                <h3>{t('admin.children.guardians.restrictTitle', { name: l.guardianName })}</h3>
                                <p className="small muted">{t('admin.children.guardians.restrictNote')}</p>
                                <label className="field">
                                  {t('admin.children.guardians.restrictReference')}
                                  <input name="reference" maxLength={100} autoComplete="off" />
                                </label>
                                <label className="field">
                                  {t('admin.children.guardians.from')}
                                  <input name="from" type="date" required min={today} defaultValue={today} />
                                </label>
                                <label className="radio">
                                  <input type="checkbox" name="confirm" required /> {t('admin.children.guardians.restrictConfirm')}
                                </label>
                                <button className="btn primary" type="submit">
                                  {t('admin.children.guardians.restrictSubmit')}
                                </button>
                              </form>
                            )}
                            <EndForm action={endLink} recordId={l.id} span={l.span} title={t('admin.children.guardians.end')} />
                          </>
                        )}
                      </div>
                    </details>
                  );
                })
              : null}
            {pastLinks.length ? (
              <p className="pad small muted">
                {pastLinks.map((l) => `${l.guardianName} (${period(l.span)})`).join(' · ')}
              </p>
            ) : null}
            {active ? (
              <div className="pad">
                <Disclose label={t('admin.children.guardians.add')}>
                  <form action={linkGuardian} className="stack">
                    {ids}
                    <label className="field">
                      {t('admin.children.guardians.existing')}
                      <select name="guardianId" defaultValue="">
                        <option value="">{t('admin.children.guardians.chooseExisting')}</option>
                        {child.guardians.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      {t('admin.children.guardians.newFirstName')}
                      <input name="firstName" maxLength={60} autoComplete="off" />
                    </label>
                    <label className="field">
                      {t('admin.children.guardians.newLastName')}
                      <input name="lastName" maxLength={60} autoComplete="off" />
                    </label>
                    <fieldset className="field">
                      <legend>{t('admin.children.guardians.rights')}</legend>
                      <label className="radio">
                        <input type="checkbox" name="canView" defaultChecked /> {t('admin.children.guardians.canView')}
                      </label>
                      <label className="radio">
                        <input type="checkbox" name="canReportAbsence" defaultChecked /> {t('admin.children.guardians.canReportAbsence')}
                      </label>
                      <label className="radio">
                        <input type="checkbox" name="receivesMessages" defaultChecked /> {t('admin.children.guardians.receivesMessages')}
                      </label>
                    </fieldset>
                    <label className="field">
                      {t('admin.children.guardians.from')}
                      <input name="from" type="date" required defaultValue={today} />
                    </label>
                    <button className="btn primary" type="submit">
                      {t('admin.children.guardians.linkSubmit')}
                    </button>
                  </form>
                </Disclose>
              </div>
            ) : null}
          </section>

          <section className="panel" aria-labelledby="e-title">
            <h2 id="e-title">
              {t('admin.children.enrollments.title')} <small>{t('admin.children.enrollments.lede')}</small>
            </h2>
            {child.enrollments.length ? (
              <table>
                <thead>
                  <tr>
                    <th>{t('admin.children.enrollments.group')}</th>
                    <th>{t('admin.children.enrollments.period')}</th>
                    <th>{t('admin.children.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {child.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <b>{e.groupName}</b>
                      </td>
                      <td>{period(e.span)}</td>
                      <td>
                        <span className={`pill ${statePill[e.timing]}`}>{t(`admin.children.enrollments.state.${e.timing}`)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="pad muted">{t('admin.children.enrollments.empty')}</p>
            )}
            {active
              ? child.enrollments
                  .filter((e) => e.timing === 'future')
                  .map((e) => (
                    <div className="pad row-inline" key={e.id}>
                      <span className="small">
                        {t('admin.children.enrollments.state.future')}: <b>{e.groupName}</b> · {period(e.span)}
                      </span>
                      <CancelForm kind="enrollment" recordId={e.id} />
                    </div>
                  ))
              : null}
            {active && !current && !hasFuture ? (
              <div className="pad">
                <Disclose label={t('admin.children.enrollments.enrol')}>
                  <form action={enrolChild} className="stack">
                    {ids}
                    <label className="field">
                      {t('admin.staff.group')}
                      <select name="groupId" required>
                        {child.groups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      {t('admin.children.enrollments.from')}
                      <input name="from" type="date" required defaultValue={today} />
                    </label>
                    <button className="btn primary" type="submit" disabled={!child.groups.length}>
                      {t('admin.children.enrollments.enrol')}
                    </button>
                  </form>
                </Disclose>
              </div>
            ) : null}
          </section>
        </div>

        <div className="column">
          <section className="panel" aria-labelledby="b-title">
            <h2 id="b-title">{t('admin.children.basics')}</h2>
            <div className="pad stack">
              <dl className="kv">
                <dt>{t('admin.children.firstName')}</dt>
                <dd>{child.firstName}</dd>
                <dt>{t('admin.children.lastName')}</dt>
                <dd>{child.lastName}</dd>
                <dt>{t('admin.children.internalRefShort')}</dt>
                <dd>{child.internalRef ?? '—'}</dd>
                <dt>{t('admin.children.status')}</dt>
                <dd>{t(`admin.children.statusLabel.${child.status}`)}</dd>
              </dl>
              <p className="small muted">{t('admin.children.minimalNote')}</p>
              <Disclose label={t('admin.children.edit')}>
                <form action={updateChild} className="stack">
                  {ids}
                  <label className="field">
                    {t('admin.children.firstName')}
                    <input name="firstName" required maxLength={60} defaultValue={child.firstName} autoComplete="off" />
                  </label>
                  <label className="field">
                    {t('admin.children.lastName')}
                    <input name="lastName" required maxLength={60} defaultValue={child.lastName} autoComplete="off" />
                  </label>
                  <label className="field">
                    {t('admin.children.internalRef')}
                    <input name="internalRef" maxLength={40} defaultValue={child.internalRef ?? ''} autoComplete="off" />
                  </label>
                  <button className="btn secondary" type="submit">
                    {t('admin.children.save')}
                  </button>
                </form>
              </Disclose>
            </div>
          </section>

          <section className="panel" aria-labelledby="p-title">
            <h2 id="p-title">{t('admin.children.pickups.title')}</h2>
            <p className="pad small muted">{t('admin.children.pickups.lede')}</p>
            {child.pickups.length ? (
              <div>
                {child.pickups.map((p) => (
                  <div className="row" key={p.id}>
                    <span className="grow">
                      <span className="t">{p.name}</span>
                      <br />
                      <span className="muted small">{period(p.span)}</span>
                    </span>
                    <span className={`pill ${statePill[p.timing]}`}>{t(`admin.children.enrollments.state.${p.timing}`)}</span>
                    {active && p.timing === 'future' ? <CancelForm kind="pickup_authorization" recordId={p.id} /> : null}
                    {active && p.timing === 'current' ? <EndDisclose action={endPickup} recordId={p.id} span={p.span} label={t('admin.children.pickups.end')} /> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="pad muted">{t('admin.children.pickups.empty')}</p>
            )}
            {active ? (
              <div className="pad">
                <Disclose label={t('admin.children.pickups.add')}>
                  <form action={addPickup} className="stack">
                    {ids}
                    <label className="field">
                      {t('admin.children.firstName')}
                      <input name="firstName" required maxLength={60} autoComplete="off" />
                    </label>
                    <label className="field">
                      {t('admin.children.lastName')}
                      <input name="lastName" required maxLength={60} autoComplete="off" />
                    </label>
                    <label className="field">
                      {t('admin.children.pickups.from')}
                      <input name="from" type="date" required defaultValue={today} />
                    </label>
                    <label className="field">
                      {t('admin.children.pickups.to')}
                      <input name="to" type="date" />
                    </label>
                    <button className="btn primary" type="submit">
                      {t('admin.children.pickups.submit')}
                    </button>
                  </form>
                </Disclose>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </>
  );
}
