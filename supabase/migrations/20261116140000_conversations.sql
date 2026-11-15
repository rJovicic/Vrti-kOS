-- VrtićOS — D4-F: conversations between guardians and the child's educators (FS-11, AC-11-1/2/3, schema §5.17/5.18).
--
--   * One conversation per child (A-07). Participants are NEVER stored: private.child_participant_ids(child) computes them
--     from current relationships — guardians whose link is valid today with `receives_messages`, no active restriction
--     and an active guardian membership; educators assigned today to the child's group with an active membership. The
--     same function decides reading, opening, sending and the fan-out. A former educator loses the whole conversation the
--     day the assignment or enrolment ends (FR-11-4, AC-11-2).
--   * Managers have NO access to content (Q-T16, FR-11-6, SR-AUTHZ-11): not through RLS, not through any RPC.
--   * Messages: text only, ≤ 2,000 characters, no attachments (FR-11-3); the sender may withdraw within 5 minutes — the
--     text is removed (NULL) and "poruka uklonjena" stays (FR-11-5). Writes only through RPCs. Audit with ids and column
--     names only (never text). Sending notifies the other participants without content (FR-11-7, D4-A).
--   * Display (FR-11-2): api.conversation_participants lists who can see the conversation — guardians by name, educators
--     as "the educators of group X"; api.conversation_messages shows staff messages by role, guardians' by name.

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  child_id uuid not null,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, child_id),
  foreign key (organization_id, child_id) references public.children (organization_id, id) on delete restrict
);
comment on table public.conversations is 'D4-F: razgovor o djetetu (jedan po djetetu); sudionici se računaju iz trenutnih odnosa.';

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  conversation_id uuid not null,
  sender_id uuid not null references public.profiles (id) on delete restrict,
  body text check (body is null or char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  unique (organization_id, id),
  foreign key (organization_id, conversation_id) references public.conversations (organization_id, id) on delete restrict,
  constraint messages_withdrawn check ((withdrawn_at is null) = (body is not null))
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
comment on table public.messages is 'D4-F: poruke razgovora (samo tekst); povučena poruka nema teksta.';

create trigger conversations_audit after insert on public.conversations for each row execute function private.audit_row();
create trigger messages_audit after insert or update on public.messages for each row execute function private.audit_row();

-- Participants ------------------------------------------------------------------------------------------------------------
create function private.child_guardian_participants(p_child uuid)
returns table (profile_id uuid, first_name text, last_name text)
language sql stable security definer set search_path = '' as $$
  select distinct gd.profile_id, gd.first_name, gd.last_name
  from public.child_guardians cg
  join public.guardians gd on gd.id = cg.guardian_id and gd.organization_id = cg.organization_id
  where cg.child_id = p_child
    and gd.profile_id is not null
    and cg.receives_messages
    and cg.valid_during @> private.org_today(cg.organization_id)
    and not exists (select 1 from public.access_restrictions ar
                    where ar.child_guardian_id = cg.id and ar.organization_id = cg.organization_id
                      and ar.valid_during @> private.org_today(cg.organization_id))
    and exists (select 1 from public.memberships m
                where m.organization_id = cg.organization_id and m.profile_id = gd.profile_id and m.role = 'guardian'
                  and m.status = 'active' and m.valid_during @> private.org_today(cg.organization_id))
$$;
revoke execute on function private.child_guardian_participants(uuid) from public, anon, authenticated;

create function private.child_educator_participants(p_child uuid)
returns table (profile_id uuid, group_id uuid)
language sql stable security definer set search_path = '' as $$
  select distinct m.profile_id, e.group_id
  from public.enrollments e
  join public.staff_assignments sa on sa.group_id = e.group_id and sa.organization_id = e.organization_id
  join public.memberships m on m.id = sa.membership_id and m.organization_id = sa.organization_id
  where e.child_id = p_child
    and e.valid_during @> private.org_today(e.organization_id)
    and sa.valid_during @> private.org_today(e.organization_id)
    and m.role = 'educator' and m.status = 'active' and m.valid_during @> private.org_today(e.organization_id)
$$;
revoke execute on function private.child_educator_participants(uuid) from public, anon, authenticated;

create function private.child_participant_ids(p_child uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select profile_id from private.child_guardian_participants(p_child)
  union
  select profile_id from private.child_educator_participants(p_child)
$$;
revoke execute on function private.child_participant_ids(uuid) from public, anon, authenticated;

create function private.can_access_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.conversations c
                 where c.id = p_conversation and (select auth.uid()) in (select private.child_participant_ids(c.child_id)))
$$;
revoke execute on function private.can_access_conversation(uuid) from public, anon;
grant execute on function private.can_access_conversation(uuid) to authenticated;

-- Same answer for unknown ids, other kindergartens, managers and people who are not (or no longer) participants.
create function private.conversation_for_participant(p_conversation uuid) returns public.conversations
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  select * into v from public.conversations c where c.id = p_conversation;
  if v.id is null or (select auth.uid()) not in (select private.child_participant_ids(v.child_id)) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v;
end $$;
revoke execute on function private.conversation_for_participant(uuid) from public, anon, authenticated;

-- RLS -----------------------------------------------------------------------------------------------------------------------
alter table public.conversations enable row level security;
create policy conversations_select on public.conversations for select to authenticated using (private.can_access_conversation(id));
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

alter table public.messages enable row level security;
create policy messages_select on public.messages for select to authenticated using (private.can_access_conversation(conversation_id));
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

-- RPCs ----------------------------------------------------------------------------------------------------------------------
-- Opens (or returns) the conversation about a child the caller takes part in. Idempotent.
create function private.open_conversation(p_child_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_id uuid;
begin
  select c.organization_id into v_org from public.children c where c.id = p_child_id;
  if v_org is null or (select auth.uid()) not in (select private.child_participant_ids(p_child_id)) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  insert into public.conversations (organization_id, child_id) values (v_org, p_child_id)
  on conflict (organization_id, child_id) do nothing;
  select c.id into v_id from public.conversations c where c.child_id = p_child_id and c.organization_id = v_org;
  return v_id;
end $$;

create function private.send_message(p_conversation_id uuid, p_body text) returns uuid
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
  perform private.notify(v.organization_id, array(select private.child_participant_ids(v.child_id)), 'message.received', 'conversation', v.id);
  return v_id;
end $$;

create function private.withdraw_message(p_message_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v public.messages;
begin
  select * into v from public.messages m where m.id = p_message_id;
  if v.id is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  perform private.conversation_for_participant(v.conversation_id);
  if v.sender_id is distinct from (select auth.uid()) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
  if v.withdrawn_at is not null then
    raise exception 'MESSAGE_ALREADY_WITHDRAWN';
  end if;
  if v.created_at < now() - interval '5 minutes' then
    raise exception 'MESSAGE_WITHDRAW_EXPIRED';
  end if;
  update public.messages set body = null, withdrawn_at = now() where id = p_message_id;
  return p_message_id;
end $$;

-- FR-11-2: who can see the conversation — guardians by name, educators as "the educators of group X".
create function private.conversation_participants(p_conversation_id uuid) returns table (kind text, name text, is_me boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  v := private.conversation_for_participant(p_conversation_id);
  return query
    select 'guardian'::text, (g.first_name || ' ' || g.last_name)::text, g.profile_id = (select auth.uid())
    from private.child_guardian_participants(v.child_id) g
    union all
    select distinct 'group'::text, gr.name::text, false
    from private.child_educator_participants(v.child_id) e join public.groups gr on gr.id = e.group_id;
end $$;

-- Messages for display: staff by role (no name), guardians by name; withdrawn ones without text.
create function private.conversation_messages(p_conversation_id uuid)
returns table (id uuid, body text, created_at timestamptz, withdrawn boolean, mine boolean, sender_kind text, sender_name text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v public.conversations;
begin
  v := private.conversation_for_participant(p_conversation_id);
  return query
    select m.id, m.body, m.created_at, m.withdrawn_at is not null, m.sender_id = (select auth.uid()),
           case when gd.id is not null then 'guardian' else 'staff' end,
           case when gd.id is not null then gd.first_name || ' ' || gd.last_name end
    from public.messages m
    left join lateral (select g.id, g.first_name, g.last_name from public.guardians g
                       join public.child_guardians cg on cg.guardian_id = g.id and cg.child_id = v.child_id
                       where g.profile_id = m.sender_id and g.organization_id = v.organization_id limit 1) gd on true
    where m.conversation_id = v.id
    order by m.created_at;
end $$;

revoke execute on function private.open_conversation(uuid) from public, anon;
revoke execute on function private.send_message(uuid, text) from public, anon;
revoke execute on function private.withdraw_message(uuid) from public, anon;
revoke execute on function private.conversation_participants(uuid) from public, anon;
revoke execute on function private.conversation_messages(uuid) from public, anon;
grant execute on function private.open_conversation(uuid) to authenticated;
grant execute on function private.send_message(uuid, text) to authenticated;
grant execute on function private.withdraw_message(uuid) to authenticated;
grant execute on function private.conversation_participants(uuid) to authenticated;
grant execute on function private.conversation_messages(uuid) to authenticated;

create function api.open_conversation(p_child_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.open_conversation(p_child_id) $$;
create function api.send_message(p_conversation_id uuid, p_body text) returns uuid
language sql security invoker set search_path = '' as $$ select private.send_message(p_conversation_id, p_body) $$;
create function api.withdraw_message(p_message_id uuid) returns uuid
language sql security invoker set search_path = '' as $$ select private.withdraw_message(p_message_id) $$;
create function api.conversation_participants(p_conversation_id uuid) returns table (kind text, name text, is_me boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.conversation_participants(p_conversation_id) $$;
create function api.conversation_messages(p_conversation_id uuid)
returns table (id uuid, body text, created_at timestamptz, withdrawn boolean, mine boolean, sender_kind text, sender_name text)
language sql stable security invoker set search_path = '' as $$ select * from private.conversation_messages(p_conversation_id) $$;

revoke execute on function api.open_conversation(uuid) from public, anon;
revoke execute on function api.send_message(uuid, text) from public, anon;
revoke execute on function api.withdraw_message(uuid) from public, anon;
revoke execute on function api.conversation_participants(uuid) from public, anon;
revoke execute on function api.conversation_messages(uuid) from public, anon;
grant execute on function api.open_conversation(uuid) to authenticated;
grant execute on function api.send_message(uuid, text) to authenticated;
grant execute on function api.withdraw_message(uuid) to authenticated;
grant execute on function api.conversation_participants(uuid) to authenticated;
grant execute on function api.conversation_messages(uuid) to authenticated;
comment on function api.open_conversation(uuid) is 'D4-F: razgovor o djetetu (samo sudionici; uprava nema pristup, Q-T16).';
comment on function api.send_message(uuid, text) is 'D4-F: poruka (samo tekst do 2.000 znakova); obavještava ostale sudionike bez sadržaja.';
comment on function api.withdraw_message(uuid) is 'D4-F: povlačenje vlastite poruke u roku od 5 minuta.';
comment on function api.conversation_participants(uuid) is 'D4-F: tko vidi razgovor (FR-11-2).';
comment on function api.conversation_messages(uuid) is 'D4-F: poruke za prikaz; djelatnici po ulozi, skrbnici po imenu.';
