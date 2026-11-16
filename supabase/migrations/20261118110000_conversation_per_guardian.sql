-- VrtićOS — D-42: one conversation per child AND guardian (resolves D-10; Q-T16 and Q-T20 answered 2026-11-16).
--
--   * A conversation belongs to (child, guardian record). Participants are still computed, never stored:
--       - that guardian, while the link to the child is valid today, has `receives_messages`, has no active
--         restriction, and the guardian's membership is active;
--       - every educator assigned today to the child's group (Q-T20: the whole team of the group, as before).
--     A second guardian of the same child is never a participant of another guardian's conversation: no messages, no
--     history, no participants list, no notifications. A former educator or guardian loses access on the next request.
--   * Managers and platform admins have no path to the content (Q-T16, D-42): not through RLS, not through any RPC.
--   * Every denial answers like an unknown id (PERMISSION_DENIED), so the existence of another guardian's conversation
--     is not revealed. The educator's contact list (api.message_contacts) only names guardians the educator may already
--     see (D-31) and, for a guardian, only their own entries.
--   * Existing history: the per-child model (D4-F) did not store who saw which message, so it cannot be split safely.
--     This migration REFUSES to run if any conversation or message exists (Q-T19 stays open). Nothing is copied,
--     reassigned, deleted or widened. In every environment so far (local reset, CI) the tables are empty here because
--     the synthetic seed runs after the migrations.

do $$
begin
  if exists (select 1 from public.conversations) or exists (select 1 from public.messages) then
    raise exception 'D42_EXISTING_CONVERSATIONS: per-child conversations exist and cannot be split per guardian without a business rule (Q-T19). Nothing was changed.';
  end if;
end $$;

-- Schema -------------------------------------------------------------------------------------------------------------------
alter table public.conversations drop constraint conversations_organization_id_child_id_key;
alter table public.conversations add column guardian_id uuid not null;
alter table public.conversations
  add constraint conversations_guardian_fkey foreign key (organization_id, guardian_id)
    references public.guardians (organization_id, id) on delete restrict,
  add constraint conversations_child_guardian_key unique (organization_id, child_id, guardian_id);
create index conversations_guardian_idx on public.conversations (guardian_id);
comment on table public.conversations is 'D-42: razgovor o djetetu s jednim skrbnikom; sudionici se računaju iz trenutnih odnosa.';
comment on column public.conversations.guardian_id is 'D-42: zapis skrbnika u vrtiću (ne račun); drugi skrbnik istog djeteta nema pristup.';

-- Participants -------------------------------------------------------------------------------------------------------------
-- The profile of ONE guardian of a child while that guardian may take part (same conditions as D4-F, per guardian).
create function private.conversation_guardian_profile(p_child uuid, p_guardian uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select gd.profile_id
  from public.child_guardians cg
  join public.guardians gd on gd.id = cg.guardian_id and gd.organization_id = cg.organization_id
  where cg.child_id = p_child
    and cg.guardian_id = p_guardian
    and gd.profile_id is not null
    and cg.receives_messages
    and cg.valid_during @> private.org_today(cg.organization_id)
    and not exists (select 1 from public.access_restrictions ar
                    where ar.child_guardian_id = cg.id and ar.organization_id = cg.organization_id
                      and ar.valid_during @> private.org_today(cg.organization_id))
    and exists (select 1 from public.memberships m
                where m.organization_id = cg.organization_id and m.profile_id = gd.profile_id and m.role = 'guardian'
                  and m.status = 'active' and m.valid_during @> private.org_today(cg.organization_id))
  limit 1
$$;
revoke execute on function private.conversation_guardian_profile(uuid, uuid) from public, anon, authenticated;

create function private.conversation_participant_ids(p_conversation uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select private.conversation_guardian_profile(c.child_id, c.guardian_id)
  from public.conversations c where c.id = p_conversation
  union
  select e.profile_id
  from public.conversations c, private.child_educator_participants(c.child_id) e
  where c.id = p_conversation
$$;
revoke execute on function private.conversation_participant_ids(uuid) from public, anon, authenticated;

-- RLS helper (same name and signature as D4-F, so the existing policies now follow the new rule).
create or replace function private.can_access_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null
     and (select auth.uid()) in (select x from private.conversation_participant_ids(p_conversation) x where x is not null)
$$;

create or replace function private.conversation_for_participant(p_conversation uuid) returns public.conversations
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  select * into v from public.conversations c where c.id = p_conversation;
  if v.id is null or not private.can_access_conversation(v.id) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v;
end $$;

-- The per-child participant function is no longer the rule for anything; removing it avoids accidental reuse.
drop function private.child_participant_ids(uuid);

-- RPCs ---------------------------------------------------------------------------------------------------------------------
-- Opens (or returns) the conversation between a child's guardian and the group's educators. Idempotent.
--   guardian: always their OWN record for the child (p_guardian_id must be omitted or be their own record);
--   educator: names the guardian, who must be a participant today.
drop function api.open_conversation(uuid);
drop function private.open_conversation(uuid);
create function private.open_conversation(p_child_id uuid, p_guardian_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_guardian uuid;
  v_id uuid;
begin
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  if v_org is null or v_uid is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  select g.id into v_guardian from public.guardians g where g.organization_id = v_org and g.profile_id = v_uid;
  if v_guardian is not null and (p_guardian_id is null or p_guardian_id = v_guardian)
     and private.conversation_guardian_profile(p_child_id, v_guardian) = v_uid then
    p_guardian_id := v_guardian;                                    -- a guardian opens their own conversation
  elsif p_guardian_id is not null
     and exists (select 1 from private.child_educator_participants(p_child_id) e where e.profile_id = v_uid)
     and private.conversation_guardian_profile(p_child_id, p_guardian_id) is not null then
    null;                                                             -- an educator of the group, with a participant guardian
  else
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  insert into public.conversations (organization_id, child_id, guardian_id) values (v_org, p_child_id, p_guardian_id)
  on conflict (organization_id, child_id, guardian_id) do nothing;
  select c.id into v_id from public.conversations c
  where c.organization_id = v_org and c.child_id = p_child_id and c.guardian_id = p_guardian_id;
  return v_id;
end $$;
revoke execute on function private.open_conversation(uuid, uuid) from public, anon;
grant execute on function private.open_conversation(uuid, uuid) to authenticated;

create or replace function private.send_message(p_conversation_id uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.conversations;
  v_id uuid;
begin
  v := private.conversation_for_participant(p_conversation_id);
  if p_body is null or char_length(btrim(p_body)) not between 1 and 2000 then
    raise exception 'MESSAGE_CONTENT_INVALID';
  end if;
  insert into public.messages (organization_id, conversation_id, sender_id, body)
  values (v.organization_id, v.id, (select auth.uid()), btrim(p_body))
  returning id into v_id;
  -- Only the participants of THIS conversation (the sender is skipped by private.notify).
  perform private.notify(v.organization_id, array(select x from private.conversation_participant_ids(v.id) x where x is not null),
                         'message.received', 'conversation', v.id);
  return v_id;
end $$;

-- FR-11-2: who can see the conversation — the one guardian by name, the educators as "the educators of group X".
create or replace function private.conversation_participants(p_conversation_id uuid) returns table (kind text, name text, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  v := private.conversation_for_participant(p_conversation_id);
  return query
    select 'guardian'::text, (g.first_name || ' ' || g.last_name)::text, g.profile_id = (select auth.uid())
    from public.guardians g
    where g.id = v.guardian_id and g.organization_id = v.organization_id
      and private.conversation_guardian_profile(v.child_id, v.guardian_id) is not null
    union all
    select distinct 'group'::text, gr.name::text, false
    from private.child_educator_participants(v.child_id) e join public.groups gr on gr.id = e.group_id;
end $$;

-- Messages for display: staff by role (no name), the guardian by name; withdrawn ones without text.
create or replace function private.conversation_messages(p_conversation_id uuid)
returns table (id uuid, body text, created_at timestamptz, withdrawn boolean, mine boolean, sender_kind text, sender_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  v := private.conversation_for_participant(p_conversation_id);
  return query
    select m.id, m.body, m.created_at, m.withdrawn_at is not null, m.sender_id = (select auth.uid()),
           case when g.id is not null then 'guardian' else 'staff' end,
           case when g.id is not null then g.first_name || ' ' || g.last_name end
    from public.messages m
    left join public.guardians g on g.id = v.guardian_id and g.organization_id = v.organization_id and g.profile_id = m.sender_id
    where m.conversation_id = v.id
    order by m.created_at;
end $$;

-- Who the caller can talk to: one row per (child, guardian) conversation the caller may open today.
--   guardian: their own entry per child; educator: every participant guardian of the children of their groups today.
-- Names only for guardians the caller may already see (D-31); no contacts. conversation_id is null until opened.
create function private.message_contacts()
returns table (child_id uuid, guardian_id uuid, guardian_name text, is_me boolean, conversation_id uuid)
language sql stable security definer set search_path = '' as $$
  with kids as (
    select c.id, c.organization_id from public.children c
    where c.organization_id in (select private.member_org_ids())
  ), pairs as (
    select k.id as child_id, k.organization_id, cg.guardian_id, private.conversation_guardian_profile(k.id, cg.guardian_id) as profile_id
    from kids k join public.child_guardians cg on cg.child_id = k.id and cg.organization_id = k.organization_id
  )
  select distinct p.child_id, p.guardian_id, g.first_name || ' ' || g.last_name, p.profile_id = (select auth.uid()), cv.id
  from pairs p
  join public.guardians g on g.id = p.guardian_id and g.organization_id = p.organization_id
  left join public.conversations cv on cv.organization_id = p.organization_id and cv.child_id = p.child_id and cv.guardian_id = p.guardian_id
  where p.profile_id is not null
    and (p.profile_id = (select auth.uid())
         or exists (select 1 from private.child_educator_participants(p.child_id) e where e.profile_id = (select auth.uid())))
$$;
revoke execute on function private.message_contacts() from public, anon;
grant execute on function private.message_contacts() to authenticated;

create function api.open_conversation(p_child_id uuid, p_guardian_id uuid default null) returns uuid
language sql security invoker set search_path = '' as $$ select private.open_conversation(p_child_id, p_guardian_id) $$;
create function api.message_contacts()
returns table (child_id uuid, guardian_id uuid, guardian_name text, is_me boolean, conversation_id uuid)
language sql stable security invoker set search_path = '' as $$ select * from private.message_contacts() $$;
revoke execute on function api.open_conversation(uuid, uuid) from public, anon;
revoke execute on function api.message_contacts() from public, anon;
grant execute on function api.open_conversation(uuid, uuid) to authenticated;
grant execute on function api.message_contacts() to authenticated;
comment on function api.open_conversation(uuid, uuid) is 'D-42: razgovor o djetetu s jednim skrbnikom (skrbnik: vlastiti; odgojitelj: navodi skrbnika). Uprava nema pristup.';
comment on function api.message_contacts() is 'D-42: s kim pozivatelj danas može razgovarati (dijete + skrbnik); samo imena koja već smije vidjeti.';
