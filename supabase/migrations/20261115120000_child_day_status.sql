-- VrtićOS D3-C — day status of children (FR-05-1, FR-05-7, FR-05-9; AC-05-6/7; d3-plan §4).
-- One read model for the educator list, the admin view and the guardian's Parent Home:
--   status: `expected` | `absent` (an active absence covers the day, nothing recorded) | `present` | `departed` |
--           `not_enrolled` (no enrolment that day, e.g. a linked child without a group, D-32);
--   arrived_at / departed_at: the latest effective arrival and departure of that day;
--   absence_reported / absence_is_late: an active absence covers the day (for the check-in confirmation, AC-05-7).
-- Scope (decided by the existing helpers, never by the caller):
--   * managers (MFA): children of their kindergarten, any day;
--   * educators: children in `educator_child_ids()` (their groups today), any day of those children;
--   * guardians: children in `guardian_child_ids('can_view')` (no active restriction), **today only**, and without any
--     staff data: no record ids, no recorder (FR-05-9: no identity of the person who recorded).
-- `recorded_by` is never returned to anyone here; staff see it on the event rows they may read (D3-A).

create function private.child_day_status(p_day date, p_group_id uuid)
returns table (
  child_id uuid, organization_id uuid, local_date date, group_id uuid, status text,
  arrived_at timestamptz, departed_at timestamptz, absence_reported boolean, absence_is_late boolean,
  last_record_id uuid, last_record_kind public.attendance_kind
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select distinct on (s.id) s.id, s.organization_id, s.staff
    from (
      select c.id, c.organization_id, true as staff from public.children c where private.is_org_manager(c.organization_id)
      union all
      select c.id, c.organization_id, true from public.children c where c.id in (select private.educator_child_ids())
      union all
      select c.id, c.organization_id, false from public.children c where c.id in (select private.guardian_child_ids('can_view'))
    ) s
    order by s.id, s.staff desc
  ),
  scoped as (
    select v.id, v.organization_id, v.staff, coalesce(p_day, private.org_today(v.organization_id)) as day
    from viewer v
  ),
  dayrows as (
    select s.*, (select e.group_id from public.enrollments e where e.child_id = s.id and e.valid_during @> s.day limit 1) as group_id
    from scoped s
    where s.staff or s.day = private.org_today(s.organization_id)
  )
  select d.id, d.organization_id, d.day, d.group_id,
         case when last_ev.kind = 'check_in' then 'present'
              when last_ev.kind = 'check_out' then 'departed'
              when d.group_id is null then 'not_enrolled'
              when ab.id is not null then 'absent'
              else 'expected' end,
         (select max(x.occurred_at) from private.attendance_effective(d.id, d.day) x where x.kind = 'check_in'),
         case when last_ev.kind = 'check_out' then last_ev.occurred_at end,
         ab.id is not null,
         coalesce(ab.is_late, false),
         case when d.staff then last_ev.id end,
         case when d.staff then last_ev.kind end
  from dayrows d
  left join lateral (
    select x.id, x.kind, x.occurred_at from private.attendance_effective(d.id, d.day) x
    order by x.occurred_at desc, (x.kind = 'check_out') desc limit 1
  ) last_ev on true
  left join lateral (
    select a.id, a.is_late from public.absence_records a
    where a.child_id = d.id and a.status = 'active' and d.day between a.starts_on and a.ends_on limit 1
  ) ab on true
  where p_group_id is null or d.group_id = p_group_id
$$;
revoke execute on function private.child_day_status(date, uuid) from public, anon;
grant execute on function private.child_day_status(date, uuid) to authenticated;

create function api.child_day_status(p_day date default null, p_group_id uuid default null)
returns table (
  child_id uuid, organization_id uuid, local_date date, group_id uuid, status text,
  arrived_at timestamptz, departed_at timestamptz, absence_reported boolean, absence_is_late boolean,
  last_record_id uuid, last_record_kind public.attendance_kind
)
language sql stable security invoker set search_path = '' as $$
  select * from private.child_day_status(p_day, p_group_id)
$$;
revoke execute on function api.child_day_status(date, uuid) from public, anon;
grant execute on function api.child_day_status(date, uuid) to authenticated;
comment on function api.child_day_status(date, uuid) is
  'D3-C: status djece za dan (očekuje se, izostanak, u vrtiću, otišlo). Skrbnik samo danas i bez podataka o djelatniku.';
