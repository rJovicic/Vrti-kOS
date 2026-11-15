import { formatDay } from '@vrticos/i18n';
import { Flash } from '@/components/Flash';
import { PageHeader } from '@/components/PageHeader';
import { getOrgContext } from '@/lib/dal';
import type { SearchParams } from '@/lib/flash';
import { t } from '@/lib/i18n';
import { archiveAnnouncement, editAnnouncement, publishAnnouncement, saveAnnouncementDraft } from './actions';

export const dynamic = 'force-dynamic';

interface Row {
  id: string;
  title: string;
  body: string;
  audience_scope: 'organization' | 'facility' | 'group';
  audience_ids: string[];
  audience_roles: ('guardians' | 'staff')[];
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  edited_at: string | null;
  created_at: string;
}
const pill = { draft: 'expected', published: 'present', archived: 'departed' } as const;

/** D4-C: announcements of the kindergarten (FS-07): drafts, publishing, edits with history, archive. Managers only. */
export default async function Announcements({ params, searchParams }: { params: Promise<{ orgSlug: string }>; searchParams: SearchParams }) {
  const [{ orgSlug }, flash] = await Promise.all([params, searchParams]);
  const { supabase, org } = await getOrgContext(orgSlug);
  const [{ data }, { data: facilities }, { data: groups }, { data: revisions }] = await Promise.all([
    supabase
      .from('announcements')
      .select('id, title, body, audience_scope, audience_ids, audience_roles, status, published_at, edited_at, created_at')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false }),
    supabase.from('facilities').select('id, name').eq('organization_id', org.id).is('archived_at', null).order('name'),
    supabase.from('groups').select('id, name').eq('organization_id', org.id).is('archived_at', null).order('name'),
    supabase.from('announcement_revisions').select('id, announcement_id, title, body, revised_at').eq('organization_id', org.id).order('revised_at', { ascending: false }),
  ]);
  const rows = (data ?? []) as Row[];
  const name = new Map([...(facilities ?? []), ...(groups ?? [])].map((x) => [x.id, x.name]));
  const audience = (r: Row) =>
    [
      r.audience_scope === 'organization' ? t('admin.announcements.scopeOrganization') : r.audience_ids.map((id) => name.get(id) ?? '—').join(', '),
      r.audience_roles.map((x) => t(`admin.announcements.role.${x}`)).join(' + '),
    ].join(' · ');
  const hidden = <input type="hidden" name="slug" value={org.slug} />;
  const warning = <p className="small notice">{t('admin.announcements.warning')}</p>;

  const audienceFields = (r?: Row) => (
    <>
      <fieldset className="field">
        <legend>{t('admin.announcements.scope')}</legend>
        {(['organization', 'facility', 'group'] as const).map((s) => (
          <label key={s} className="radio">
            <input type="radio" name="scope" value={s} defaultChecked={(r?.audience_scope ?? 'organization') === s} required />
            {t(`admin.announcements.scope_${s}`)}
          </label>
        ))}
      </fieldset>
      {facilities?.length ? (
        <fieldset className="field">
          <legend>{t('admin.announcements.facilities')}</legend>
          {facilities.map((f) => (
            <label key={f.id} className="radio">
              <input type="checkbox" name="facilities" value={f.id} defaultChecked={r?.audience_scope === 'facility' && r.audience_ids.includes(f.id)} />
              {f.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      {groups?.length ? (
        <fieldset className="field">
          <legend>{t('admin.announcements.groups')}</legend>
          {groups.map((g) => (
            <label key={g.id} className="radio">
              <input type="checkbox" name="groups" value={g.id} defaultChecked={r?.audience_scope === 'group' && r.audience_ids.includes(g.id)} />
              {g.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <fieldset className="field">
        <legend>{t('admin.announcements.roles')}</legend>
        {(['guardians', 'staff'] as const).map((x) => (
          <label key={x} className="radio">
            <input type="checkbox" name="roles" value={x} defaultChecked={r ? r.audience_roles.includes(x) : x === 'guardians'} />
            {t(`admin.announcements.role.${x}`)}
          </label>
        ))}
      </fieldset>
    </>
  );
  const contentFields = (r?: Row) => (
    <>
      <label className="field">
        {t('admin.announcements.title')}
        <input name="title" required maxLength={120} defaultValue={r?.title} />
      </label>
      <label className="field">
        {t('admin.announcements.body')}
        <textarea name="body" required maxLength={4000} rows={6} defaultValue={r?.body} />
      </label>
    </>
  );

  return (
    <>
      <PageHeader title={t('admin.nav.announcements')} lede={t('admin.announcements.lede')} />
      <Flash params={flash} />
      <div className="grid2">
        <section className="panel" aria-labelledby="a-list">
          <h2 id="a-list">{t('admin.nav.announcements')}</h2>
          {rows.length ? (
            rows.map((r) => {
              const history = (revisions ?? []).filter((x) => x.announcement_id === r.id);
              return (
                <details className="manage" key={r.id}>
                  <summary>
                    <span className={`pill ${pill[r.status]}`}>{t(`admin.announcements.status.${r.status}`)}</span> <b>{r.title}</b>
                    <span className="muted small">
                      {' · '}
                      {audience(r)}
                      {r.published_at ? ` · ${formatDay(r.published_at.slice(0, 10))}` : ''}
                      {r.edited_at ? ` · ${t('admin.announcements.edited')}` : ''}
                    </span>
                  </summary>
                  <div className="manage-body">
                    {r.status === 'draft' ? (
                      <>
                        <form action={saveAnnouncementDraft} className="stack">
                          {hidden}
                          <input type="hidden" name="id" value={r.id} />
                          <h3>{t('admin.announcements.editDraft')}</h3>
                          {contentFields(r)}
                          {audienceFields(r)}
                          <button className="btn secondary" type="submit">
                            {t('admin.announcements.saveDraft')}
                          </button>
                        </form>
                        <form action={publishAnnouncement} className="stack">
                          {hidden}
                          <input type="hidden" name="id" value={r.id} />
                          {warning}
                          <button className="btn primary" type="submit">
                            {t('admin.announcements.publish')}
                          </button>
                        </form>
                      </>
                    ) : null}
                    {r.status === 'published' ? (
                      <>
                        <form action={editAnnouncement} className="stack">
                          {hidden}
                          <input type="hidden" name="id" value={r.id} />
                          <h3>{t('admin.announcements.editPublished')}</h3>
                          <p className="small muted">{t('admin.announcements.editNote')}</p>
                          {contentFields(r)}
                          {warning}
                          <button className="btn primary" type="submit">
                            {t('admin.announcements.saveEdit')}
                          </button>
                        </form>
                        <form action={archiveAnnouncement} className="stack">
                          {hidden}
                          <input type="hidden" name="id" value={r.id} />
                          <button className="btn secondary" type="submit">
                            {t('admin.announcements.archive')}
                          </button>
                        </form>
                      </>
                    ) : null}
                    {r.status === 'archived' ? <p className="pre-wrap">{r.body}</p> : null}
                    {history.length ? (
                      <div className="stack">
                        <h3>{t('admin.announcements.history')}</h3>
                        {history.map((h) => (
                          <div key={h.id} className="small">
                            <b>{h.title}</b> <span className="muted">· {t('admin.announcements.until', { day: formatDay(h.revised_at.slice(0, 10)) })}</span>
                            <p className="pre-wrap muted">{h.body}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </details>
              );
            })
          ) : (
            <p className="pad muted">{t('admin.announcements.empty')}</p>
          )}
        </section>
        <section className="panel" aria-labelledby="a-new">
          <h2 id="a-new">{t('admin.announcements.new')}</h2>
          <form action={saveAnnouncementDraft} className="pad stack">
            {hidden}
            {contentFields()}
            {audienceFields()}
            {warning}
            <button className="btn primary" type="submit">
              {t('admin.announcements.saveDraft')}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
