-- VrtićOS D0 — organizations, facilities, academic_years, groups, profiles, memberships,
-- private.platform_admins and audit_events. RLS policies follow in the next migration.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  timezone text not null default 'Europe/Zagreb',
  locale text not null default 'hr' check (locale in ('hr', 'it')),
  absence_cutoff_local time,
  quiet_hours_start time not null default '18:00',
  quiet_hours_end time not null default '06:30',
  privacy_notice_version text check (char_length(privacy_notice_version) <= 40),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.organizations is 'Tenant root (kindergarten). Sensitivity R1.';

create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  address text check (char_length(address) <= 200),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index facilities_org_name_active_uq on public.facilities (organization_id, lower(name)) where archived_at is null;
comment on table public.facilities is 'Physical location ("objekt"). Sensitivity R1.';

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 60),
  starts_on date not null,
  ends_on date not null,
  status public.academic_year_status not null default 'planned',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on < ends_on),
  unique (organization_id, id)
);
create unique index academic_years_one_active_uq on public.academic_years (organization_id) where status = 'active';
comment on table public.academic_years is 'Pedagoška godina. Sensitivity R1.';

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  facility_id uuid not null,
  academic_year_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  capacity int check (capacity between 1 and 60),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  -- composite FKs: a group can only reference a facility/year of the same kindergarten (SR-TEN-04)
  foreign key (organization_id, facility_id) references public.facilities (organization_id, id) on delete restrict,
  foreign key (organization_id, academic_year_id) references public.academic_years (organization_id, id) on delete restrict
);
create unique index groups_org_year_name_uq on public.groups (organization_id, academic_year_id, lower(name));
create index groups_facility_idx on public.groups (facility_id);
create index groups_academic_year_idx on public.groups (academic_year_id);
comment on table public.groups is 'Skupina. Sensitivity R1 (R3 once linked to children).';

create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  first_name text not null check (char_length(first_name) between 1 and 60),
  last_name text not null check (char_length(last_name) between 1 and 60),
  display_name text check (char_length(display_name) <= 80),
  locale text not null default 'hr' check (locale in ('hr', 'it')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Global person profile, 1:1 with auth.users. No email copy. Sensitivity R2.';

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  role public.org_role not null,
  status public.membership_status not null default 'active',
  valid_during daterange not null default daterange(current_date, null),
  notice_ack_version text check (char_length(notice_ack_version) <= 40),
  notice_ack_at timestamptz,
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, profile_id, role),
  unique (organization_id, id)
);
create index memberships_profile_idx on public.memberships (profile_id, status);
create index memberships_org_role_idx on public.memberships (organization_id, role);
comment on table public.memberships is 'User ↔ kindergarten with role and validity. Sensitivity R2.';

create table private.platform_admins (
  profile_id uuid primary key references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);
comment on table private.platform_admins is 'Platform operators. Not exposed; populated by operator procedure (SR-OPS-04).';

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  action text not null check (char_length(action) <= 80),
  target_table text not null,
  target_id uuid,
  outcome text not null default 'success' check (outcome in ('success', 'denied', 'error')),
  correlation_id text,
  details jsonb not null default '{}'::jsonb
);
create index audit_events_org_time_idx on public.audit_events (organization_id, occurred_at desc);
create index audit_events_target_idx on public.audit_events (target_table, target_id);
comment on table public.audit_events is 'Append-only audit log. No values of personal data, only column names (SR-AUD-01/02). Sensitivity R3.';

-- Guards and timestamps ------------------------------------------------------------------------
create trigger organizations_touch before update on public.organizations for each row execute function private.touch_updated_at();
do $$
declare t text;
begin
  foreach t in array array['facilities', 'academic_years', 'groups', 'memberships'] loop
    execute format('create trigger %I_tenant_guard before update on public.%I for each row execute function private.guard_tenant_columns()', t, t);
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
  end loop;
end $$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
