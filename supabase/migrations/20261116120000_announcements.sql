-- VrtićOS — D4-B: announcements of the kindergarten (FS-07, AC-07-1…5, schema §5.16, SR-AUTHZ-10).
--
--   * public.announcements: title ≤ 120, text ≤ 4,000, no attachments, no "urgent" flag. Audience = scope (whole
--     kindergarten, facilities or groups) × roles (guardians, staff). Lifecycle draft → published → archived.
--   * Writes only through RPCs, managers with MFA only (educators: matrix "***" open → denied, SR-AUTHZ-10). Audience ids
--     are checked against the same kindergarten and scope. Audience is fixed once published.
--   * Edit after publishing keeps the previous version in public.announcement_revisions (managers only, AC-07-3) and
--     marks the announcement "uređeno" (edited_at); the audit records only the fact and the changed column names.
--   * Who receives an announcement is computed when it is read, from current relationships (FR-07-4, AC-07-2):
--     private.announcement_recipients(id) is the single definition used by RLS and by the fan-out on publishing.
--       guardians — account linked to a child of the kindergarten with `can_view`, link valid today and started on or
--                   before the publishing day [pretpostavka FR-07-4], no active restriction, active guardian membership;
--                   for facility/group scope the child is enrolled today in a matching group;
--       staff     — active educators assigned today to a matching group (any group for the whole kindergarten), and the
--                   kindergarten's managers for announcements to the whole kindergarten.
--   * Publishing notifies the recipients (content-free, D4-A). Archived announcements are visible to managers only.

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  author_id uuid default auth.uid() references public.profiles (id) on delete restrict,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  audience_scope text not null check (audience_scope in ('organization', 'facility', 'group')),
  audience_ids uuid[] not null default '{}',
  audience_roles text[] not null check (cardinality(audience_roles) between 1 and 2 and audience_roles <@ array['guardians', 'staff']),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  edited_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint announcements_scope_ids check ((audience_scope = 'organization') = (cardinality(audience_ids) = 0)),
  constraint announcements_published check ((status = 'draft') = (published_at is null))
);
create index announcements_org_idx on public.announcements (organization_id, status, published_at desc);
create index announcements_audience_idx on public.announcements using gin (audience_ids);
comment on table public.announcements is 'D4-B: obavijesti vrtića (FS-07). Publika se računa pri čitanju iz trenutnih odnosa.';

create table public.announcement_revisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  announcement_id uuid not null,
  title text not null,
  body text not null,
  revised_by uuid default auth.uid() references public.profiles (id) on delete restrict,
  revised_at timestamptz not null default now(),
  foreign key (organization_id, announcement_id) references public.announcements (organization_id, id) on delete restrict
);
create index announcement_revisions_idx on public.announcement_revisions (announcement_id, revised_at desc);
comment on table public.announcement_revisions is 'D4-B: prethodne verzije objavljene obavijesti (AC-07-3), vidljive samo upravi.';

create trigger announcements_audit after insert or update on public.announcements
  for each row execute function private.audit_row();
create trigger announcements_touch before update on public.announcements
  for each row execute function private.touch_updated_at();

-- Audience ---------------------------------------------------------------------------------------------------------------
create function private.announcement_recipients(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  with a as (
    select an.*, private.org_today(an.organization_id) as today,
           (an.published_at at time zone coalesce(o.timezone, 'Europe/Zagreb'))::date as published_on
    from public.announcements an join public.organizations o on o.id = an.organization_id
    where an.id = p_id and an.status = 'published'
  )
  -- guardians
  select gd.profile_id
  from a
  join public.child_guardians cg on cg.organization_id = a.organization_id
  join public.guardians gd on gd.id = cg.guardian_id and gd.organization_id = cg.organization_id
  where 'guardians' = any (a.audience_roles)
    and gd.profile_id is not null
    and cg.can_view
    and cg.valid_during @> a.today
    and lower(cg.valid_during) <= a.published_on
    and not exists (select 1 from public.access_restrictions ar
                    where ar.child_guardian_id = cg.id and ar.organization_id = cg.organization_id and ar.valid_during @> a.today)
    and exists (select 1 from public.memberships m
                where m.organization_id = a.organization_id and m.profile_id = gd.profile_id and m.role = 'guardian'
                  and m.status = 'active' and m.valid_during @> a.today)
    and (a.audience_scope = 'organization'
         or exists (select 1 from public.enrollments e join public.groups g on g.id = e.group_id
                    where e.child_id = cg.child_id and e.valid_during @> a.today
                      and ((a.audience_scope = 'group' and g.id = any (a.audience_ids))
                           or (a.audience_scope = 'facility' and g.facility_id = any (a.audience_ids)))))
  union
  -- educators
  select m.profile_id
  from a
  join public.memberships m on m.organization_id = a.organization_id
  where 'staff' = any (a.audience_roles)
    and m.role = 'educator' and m.status = 'active' and m.valid_during @> a.today
    and exists (select 1 from public.staff_assignments sa join public.groups g on g.id = sa.group_id
                where sa.membership_id = m.id and sa.valid_during @> a.today
                  and (a.audience_scope = 'organization'
                       or (a.audience_scope = 'group' and g.id = any (a.audience_ids))
                       or (a.audience_scope = 'facility' and g.facility_id = any (a.audience_ids))))
  union
  -- managers, for the whole kindergarten
  select m.profile_id
  from a
  join public.memberships m on m.organization_id = a.organization_id
  where 'staff' = any (a.audience_roles) and a.audience_scope = 'organization'
    and m.role in ('org_admin', 'director') and m.status = 'active' and m.valid_during @> a.today
$$;
revoke execute on function private.announcement_recipients(uuid) from public, anon, authenticated;

create function private.can_read_announcement(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (select private.announcement_recipients(p_id))
$$;
revoke execute on function private.can_read_announcement(uuid) from public, anon;
grant execute on function private.can_read_announcement(uuid) to authenticated;

alter table public.announcements enable row level security;
create policy announcements_select on public.announcements for select to authenticated
  using ((select private.is_org_manager(organization_id)) or (status = 'published' and private.can_read_announcement(id)));
revoke all on public.announcements from anon, authenticated;
grant select on public.announcements to authenticated;

alter table public.announcement_revisions enable row level security;
create policy announcement_revisions_select on public.announcement_revisions for select to authenticated
  using ((select private.is_org_manager(organization_id)));
revoke all on public.announcement_revisions from anon, authenticated;
grant select on public.announcement_revisions to authenticated;

-- Writes -------------------------------------------------------------------------------------------------------------------
-- Same answer for unknown ids, other kindergartens and non-managers.
create function private.announcement_for_manager(p_id uuid) returns public.announcements
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.announcements;
begin
  select * into v from public.announcements a where a.id = p_id;
  if v.id is null or not private.is_org_manager(v.organization_id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v;
end $$;
revoke execute on function private.announcement_for_manager(uuid) from public, anon, authenticated;

create function private.announcement_check_content(p_title text, p_body text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_title is null or p_body is null or char_length(btrim(p_title)) not between 1 and 120 or char_length(btrim(p_body)) not between 1 and 4000 then
    raise exception 'ANNOUNCEMENT_CONTENT_INVALID';
  end if;
end $$;
revoke execute on function private.announcement_check_content(text, text) from public, anon, authenticated;

create function private.announcement_check_audience(p_org uuid, p_scope text, p_ids uuid[], p_roles text[]) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ids uuid[] := coalesce(p_ids, '{}');
begin
  if p_scope is null or p_scope not in ('organization', 'facility', 'group')
     or p_roles is null or cardinality(p_roles) not between 1 and 2 or not (p_roles <@ array['guardians', 'staff'])
     or (p_scope = 'organization') <> (cardinality(v_ids) = 0)
     or (select count(distinct x) from unnest(v_ids) x) <> cardinality(v_ids)
     or (p_scope = 'facility' and (select count(*) from public.facilities f where f.organization_id = p_org and f.id = any (v_ids)) <> cardinality(v_ids))
     or (p_scope = 'group' and (select count(*) from public.groups g where g.organization_id = p_org and g.id = any (v_ids)) <> cardinality(v_ids)) then
    raise exception 'ANNOUNCEMENT_AUDIENCE_INVALID';
  end if;
end $$;
revoke execute on function private.announcement_check_audience(uuid, text, uuid[], text[]) from public, anon, authenticated;

-- Create (p_id null) or change a draft.
create function private.save_announcement_draft(p_org uuid, p_id uuid, p_title text, p_body text, p_scope text, p_ids uuid[], p_roles text[])
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.announcements;
begin
  if p_id is null then
    if p_org is null or not private.is_org_manager(p_org) then
      raise exception 'PERMISSION_DENIED' using errcode = '42501';
    end if;
  else
    v := private.announcement_for_manager(p_id);
    if v.status <> 'draft' then
      raise exception 'ANNOUNCEMENT_STATE_INVALID';
    end if;
    p_org := v.organization_id;
  end if;
  perform private.announcement_check_content(p_title, p_body);
  perform private.announcement_check_audience(p_org, p_scope, p_ids, p_roles);
  if p_id is null then
    insert into public.announcements (organization_id, author_id, title, body, audience_scope, audience_ids, audience_roles)
    values (p_org, (select auth.uid()), btrim(p_title), btrim(p_body), p_scope, coalesce(p_ids, '{}'), p_roles)
    returning id into p_id;
  else
    update public.announcements set title = btrim(p_title), body = btrim(p_body), audience_scope = p_scope,
           audience_ids = coalesce(p_ids, '{}'), audience_roles = p_roles
    where id = p_id;
  end if;
  return p_id;
end $$;

create function private.publish_announcement(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.announcements;
begin
  v := private.announcement_for_manager(p_id);
  if v.status <> 'draft' then
    raise exception 'ANNOUNCEMENT_STATE_INVALID';
  end if;
  update public.announcements set status = 'published', published_at = now() where id = p_id;
  perform private.notify(v.organization_id, array(select private.announcement_recipients(p_id)),
                         'announcement.published', 'announcement', p_id);
  return p_id;
end $$;

-- Edit after publishing: the previous text becomes a revision; the audience stays.
create function private.edit_announcement(p_id uuid, p_title text, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.announcements;
begin
  v := private.announcement_for_manager(p_id);
  if v.status <> 'published' then
    raise exception 'ANNOUNCEMENT_STATE_INVALID';
  end if;
  perform private.announcement_check_content(p_title, p_body);
  if btrim(p_title) = v.title and btrim(p_body) = v.body then
    return p_id;
  end if;
  insert into public.announcement_revisions (organization_id, announcement_id, title, body)
  values (v.organization_id, v.id, v.title, v.body);
  update public.announcements set title = btrim(p_title), body = btrim(p_body), edited_at = now() where id = p_id;
  return p_id;
end $$;

create function private.archive_announcement(p_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.announcements;
begin
  v := private.announcement_for_manager(p_id);
  if v.status <> 'published' then
    raise exception 'ANNOUNCEMENT_STATE_INVALID';
  end if;
  update public.announcements set status = 'archived', archived_at = now() where id = p_id;
  return p_id;
end $$;

revoke execute on function private.save_announcement_draft(uuid, uuid, text, text, text, uuid[], text[]) from public, anon;
revoke execute on function private.publish_announcement(uuid) from public, anon;
revoke execute on function private.edit_announcement(uuid, text, text) from public, anon;
revoke execute on function private.archive_announcement(uuid) from public, anon;
grant execute on function private.save_announcement_draft(uuid, uuid, text, text, text, uuid[], text[]) to authenticated;
grant execute on function private.publish_announcement(uuid) to authenticated;
grant execute on function private.edit_announcement(uuid, text, text) to authenticated;
grant execute on function private.archive_announcement(uuid) to authenticated;

-- Exposed wrappers (SECURITY INVOKER, SR-API-01) ---------------------------------------------------------------------------
create function api.save_announcement_draft(
  p_organization_id uuid, p_title text, p_body text, p_audience_scope text, p_audience_ids uuid[], p_audience_roles text[], p_id uuid default null
) returns uuid
language sql security invoker set search_path = '' as $$
  select private.save_announcement_draft(p_organization_id, p_id, p_title, p_body, p_audience_scope, p_audience_ids, p_audience_roles)
$$;
create function api.publish_announcement(p_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.publish_announcement(p_id) $$;
create function api.edit_announcement(p_id uuid, p_title text, p_body text) returns uuid
language sql security invoker set search_path = '' as $$ select private.edit_announcement(p_id, p_title, p_body) $$;
create function api.archive_announcement(p_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.archive_announcement(p_id) $$;

revoke execute on function api.save_announcement_draft(uuid, text, text, text, uuid[], text[], uuid) from public, anon;
revoke execute on function api.publish_announcement(uuid) from public, anon;
revoke execute on function api.edit_announcement(uuid, text, text) from public, anon;
revoke execute on function api.archive_announcement(uuid) from public, anon;
grant execute on function api.save_announcement_draft(uuid, text, text, text, uuid[], text[], uuid) to authenticated;
grant execute on function api.publish_announcement(uuid) to authenticated;
grant execute on function api.edit_announcement(uuid, text, text) to authenticated;
grant execute on function api.archive_announcement(uuid) to authenticated;
comment on function api.save_announcement_draft(uuid, text, text, text, uuid[], text[], uuid) is 'D4-B: novi nacrt obavijesti ili izmjena nacrta (uprava uz MFA).';
comment on function api.publish_announcement(uuid) is 'D4-B: objava nacrta; obavještava trenutnu publiku bez sadržaja.';
comment on function api.edit_announcement(uuid, text, text) is 'D4-B: izmjena objavljene obavijesti; prethodna verzija ostaje u povijesti.';
comment on function api.archive_announcement(uuid) is 'D4-B: arhiviranje objavljene obavijesti.';
