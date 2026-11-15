-- VrtićOS — D4-E: daily overview of a group (FS-10, AC-10-1/2, schema §5.19, A-05, DD-04).
--
--   * One overview per group per day: short text (≤ 1,000) and optional activity tags from a FIXED code list (outdoor,
--     art, music, story — the prototype's tags; an organization-defined list comes later). Group level only: the
--     authoring warning says no names of children, no health or developmental information; no automatic text analysis.
--   * Written only through api.save_daily_entry by an educator assigned to the group TODAY, for today (the kindergarten's
--     calendar): draft → published; after publishing, edits the same day set edited_at ("uređeno"). Managers read, they do
--     not write (FR-10 permission daily_report.write = educator with a schedule). Audit with column names only.
--   * Readers: managers; educators assigned to the group today; guardians — published entries of a day on which a child
--     they may view (can_view, link valid today, no active restriction) was enrolled in the group (FR-10-3, AC-10-1).
--   * Publishing notifies those guardians (content-free, D4-A; push only with D-40).

create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  group_id uuid not null,
  entry_date date not null,
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  activity_tags text[] not null default '{}' check (activity_tags <@ array['outdoor', 'art', 'music', 'story'] and cardinality(activity_tags) <= 4),
  status text not null default 'draft' check (status in ('draft', 'published')),
  author_id uuid default auth.uid() references public.profiles (id) on delete restrict,
  published_at timestamptz,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, group_id, entry_date),
  foreign key (organization_id, group_id) references public.groups (organization_id, id) on delete restrict,
  constraint daily_entries_published check ((status = 'published') = (published_at is not null))
);
comment on table public.daily_entries is 'D4-E: dnevni pregled skupine (FS-10), bez podataka o pojedinom djetetu.';

create trigger daily_entries_audit after insert or update on public.daily_entries
  for each row execute function private.audit_row();
create trigger daily_entries_touch before update on public.daily_entries
  for each row execute function private.touch_updated_at();

-- Who reads -------------------------------------------------------------------------------------------------------------
-- Guardians (profile ids) of the published entry's audience: a viewable child enrolled in the group on that day.
create function private.daily_entry_recipients(p_id uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct gd.profile_id
  from public.daily_entries d
  join public.enrollments e on e.group_id = d.group_id and e.organization_id = d.organization_id and e.valid_during @> d.entry_date
  join public.child_guardians cg on cg.child_id = e.child_id and cg.organization_id = d.organization_id
  join public.guardians gd on gd.id = cg.guardian_id and gd.organization_id = cg.organization_id
  where d.id = p_id and d.status = 'published'
    and gd.profile_id is not null
    and cg.can_view
    and cg.valid_during @> private.org_today(d.organization_id)
    and not exists (select 1 from public.access_restrictions ar
                    where ar.child_guardian_id = cg.id and ar.organization_id = cg.organization_id
                      and ar.valid_during @> private.org_today(d.organization_id))
    and exists (select 1 from public.memberships m
                where m.organization_id = d.organization_id and m.profile_id = gd.profile_id and m.role = 'guardian'
                  and m.status = 'active' and m.valid_during @> private.org_today(d.organization_id))
$$;
revoke execute on function private.daily_entry_recipients(uuid) from public, anon, authenticated;

create function private.can_read_daily_entry(p_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (select private.daily_entry_recipients(p_id))
$$;
revoke execute on function private.can_read_daily_entry(uuid) from public, anon;
grant execute on function private.can_read_daily_entry(uuid) to authenticated;

alter table public.daily_entries enable row level security;
create policy daily_entries_select on public.daily_entries for select to authenticated
  using ((select private.is_org_manager(organization_id))
         or group_id in (select private.educator_group_ids())
         or (status = 'published' and private.can_read_daily_entry(id)));
revoke all on public.daily_entries from anon, authenticated;
grant select on public.daily_entries to authenticated;

-- Write -----------------------------------------------------------------------------------------------------------------
create function private.save_daily_entry(p_group_id uuid, p_body text, p_tags text[], p_publish boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_today date;
  v public.daily_entries;
  v_tags text[] := coalesce(p_tags, '{}');
begin
  if p_group_id is null or p_publish is null then
    raise exception 'INVALID_ARGUMENTS' using errcode = '22023';
  end if;
  select g.organization_id into v_org from public.groups g where g.id = p_group_id;
  -- Same answer for unknown groups, other kindergartens, managers and educators of other groups (AC-10-2).
  if v_org is null or p_group_id not in (select private.educator_group_ids()) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if p_body is null or char_length(btrim(p_body)) not between 1 and 1000
     or not (v_tags <@ array['outdoor', 'art', 'music', 'story']) or cardinality(v_tags) > 4 then
    raise exception 'DAILY_ENTRY_CONTENT_INVALID';
  end if;
  v_today := private.org_today(v_org);
  perform pg_advisory_xact_lock(hashtextextended('vrticos.daily_entry:' || p_group_id::text || ':' || v_today::text, 0));
  select * into v from public.daily_entries d where d.group_id = p_group_id and d.entry_date = v_today;
  if v.id is null then
    insert into public.daily_entries (organization_id, group_id, entry_date, body, activity_tags, status, author_id, published_at)
    values (v_org, p_group_id, v_today, btrim(p_body), coalesce((select array_agg(distinct t order by t) from unnest(v_tags) t), '{}'), case when p_publish then 'published' else 'draft' end,
            (select auth.uid()), case when p_publish then now() end)
    returning * into v;
    if p_publish then
      perform private.notify(v_org, array(select private.daily_entry_recipients(v.id)), 'daily_entry.published', 'daily_entry', v.id);
    end if;
    return v.id;
  end if;
  if v.status = 'published' then
    -- Same-day edit after publishing: marked "uređeno"; no new notification. Unpublishing is not possible.
    update public.daily_entries
    set body = btrim(p_body), activity_tags = coalesce((select array_agg(distinct t order by t) from unnest(v_tags) t), '{}'), edited_at = now()
    where id = v.id;
    return v.id;
  end if;
  update public.daily_entries
  set body = btrim(p_body), activity_tags = coalesce((select array_agg(distinct t order by t) from unnest(v_tags) t), '{}'),
      status = case when p_publish then 'published' else 'draft' end,
      published_at = case when p_publish then now() end
  where id = v.id;
  if p_publish then
    perform private.notify(v_org, array(select private.daily_entry_recipients(v.id)), 'daily_entry.published', 'daily_entry', v.id);
  end if;
  return v.id;
end $$;
revoke execute on function private.save_daily_entry(uuid, text, text[], boolean) from public, anon;
grant execute on function private.save_daily_entry(uuid, text, text[], boolean) to authenticated;

create function api.save_daily_entry(p_group_id uuid, p_body text, p_tags text[] default '{}', p_publish boolean default false) returns uuid
language sql security invoker set search_path = '' as $$
  select private.save_daily_entry(p_group_id, p_body, p_tags, p_publish)
$$;
revoke execute on function api.save_daily_entry(uuid, text, text[], boolean) from public, anon;
grant execute on function api.save_daily_entry(uuid, text, text[], boolean) to authenticated;
comment on function api.save_daily_entry(uuid, text, text[], boolean) is
  'D4-E: dnevni pregled vlastite skupine za danas (nacrt ili objava; izmjena nakon objave označena „uređeno”).';
