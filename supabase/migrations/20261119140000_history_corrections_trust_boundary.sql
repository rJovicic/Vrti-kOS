-- VrtićOS — D-41b: accurate description of what protects public.history_corrections (owner review, 2026-11-19).
-- Documentation only (comments); no change to privileges, policies or triggers.
--
-- The append-only triggers (history_corrections_no_change: BEFORE UPDATE OR DELETE; history_corrections_no_truncate:
-- BEFORE TRUNCATE) stop every write in a normal session — the application roles (authenticated, anon, service_role,
-- which also have no UPDATE/DELETE/TRUNCATE privilege) and the table owner alike. They are NOT a guarantee against a
-- privileged operator: the table owner can ALTER TABLE … DISABLE TRIGGER or DROP TRIGGER, and a superuser can also
-- bypass triggers (e.g. session_replication_role = replica). The header of 20261119120000 said "append-only for every
-- role"; that holds for normal sessions only. A guarantee against the operator would need an external immutable audit
-- sink or a separate architecture (not built; needs approval).

comment on table public.history_corrections is
  'D-41b: povijesni ispravci odnosa djeteta. Aplikacijske uloge ne mogu mijenjati ni brisati zapise (bez privilegija; okidači i za vlasnika u običnoj sesiji). Vlasnik tablice ili superuser može isključiti okidače — to nije zaštita od privilegiranog operatera. Bilješka (R4) ostaje samo ovdje; čita je samo uprava s MFA-om.';
comment on function private.history_corrections_immutable() is
  'D-41b: odbija UPDATE/DELETE/TRUNCATE u običnoj sesiji (i za vlasnika). Ne štiti od vlasnika/superusera koji isključi ili ukloni okidač.';
