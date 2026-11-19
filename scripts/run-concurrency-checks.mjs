// Concurrency checks for Q-T22 (same-day cancellation) and D-41b (historical correction): two real database sessions
// on the local stack (pgTAP runs in one session and cannot show this). Each scenario starts session B in the
// background, lets it take its lock, then runs session A and checks the outcome:
//   * lock checks — while one side holds the child lock, the other side times out (lock_timeout) instead of running;
//   * serialization checks — without a timeout the second side waits, then sees the first side's committed result and
//     refuses (RECORD_HAS_DEPENDENTS / CORRECTION_CONFLICTS / HANDOVER_INVALID), so no inconsistent state can arise.
// Data: a dedicated synthetic kindergarten per run (unique slug). Local stack only (the URL must be localhost).
// Exits non-zero on any failed scenario.
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const url = process.env.DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
if (!/@(127\.0\.0\.1|localhost):/.test(url)) {
  console.error('refusing: concurrency checks run only against the local stack');
  process.exit(1);
}
const sql = (text) => spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', text], { encoding: 'utf8' });
const run = (text) => new Promise((resolve) => {
  const p = spawn('psql', [url, '-qAt', '-c', text]);
  let out = '';
  p.stdout.on('data', (d) => (out += d));
  p.stderr.on('data', (d) => (out += d));
  p.on('close', (code) => resolve({ code, out }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- synthetic kindergarten ----------------------------------------------------------------------------------------------
const tag = randomUUID().slice(0, 8);
const id = () => randomUUID();
const ids = { org: id(), fac: id(), year: id(), group: id(), mgr: id(), edu: id(), eduM: id(), x: id(), y: id(), z: id(), w: id(), v: id(),
  px: id(), py: id(), pz: id(), pv: id(), gd: id(), gr: id(), lw: id(), conv: id(), u: id(), eu: id() };
const setup = `
insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('${ids.mgr}', 'cc-mgr-${tag}@t.test', 'authenticated', 'authenticated', now()),
  ('${ids.edu}', 'cc-edu-${tag}@t.test', 'authenticated', 'authenticated', now()),
  ('${ids.gd}', 'cc-gd-${tag}@t.test', 'authenticated', 'authenticated', now());
insert into public.profiles (id, first_name, last_name) values ('${ids.mgr}', 'Racun', 'mgr'), ('${ids.edu}', 'Racun', 'edu'), ('${ids.gd}', 'Racun', 'gd');
insert into public.organizations (id, name, slug) values ('${ids.org}', 'Test istodobnost ${tag}', 'test-cc-${tag}');
insert into public.facilities (id, organization_id, name) values ('${ids.fac}', '${ids.org}', 'Objekt');
insert into public.academic_years (id, organization_id, name, starts_on, ends_on, status) values ('${ids.year}', '${ids.org}', 'PG', current_date - 60, current_date + 300, 'active');
insert into public.groups (id, organization_id, facility_id, academic_year_id, name) values ('${ids.group}', '${ids.org}', '${ids.fac}', '${ids.year}', 'S1');
insert into public.memberships (id, organization_id, profile_id, role, valid_during) values
  (gen_random_uuid(), '${ids.org}', '${ids.mgr}', 'org_admin', daterange(current_date - 30, null)),
  ('${ids.eduM}', '${ids.org}', '${ids.edu}', 'educator', daterange(current_date - 30, null)),
  (gen_random_uuid(), '${ids.org}', '${ids.gd}', 'guardian', daterange(current_date - 30, null));
insert into public.staff_assignments (organization_id, membership_id, group_id, valid_during) values ('${ids.org}', '${ids.eduM}', '${ids.group}', daterange(current_date - 30, null));
insert into public.children (id, organization_id, first_name, last_name) values
  ${['x', 'y', 'z', 'w', 'v', 'u'].map((k) => `('${ids[k]}', '${ids.org}', 'Dijete', '${k}')`).join(', ')};
insert into public.enrollments (organization_id, child_id, group_id, valid_during) values
  ${['x', 'y', 'z', 'w', 'v'].map((k) => `('${ids.org}', '${ids[k]}', '${ids.group}', daterange(current_date - 30, null))`).join(', ')};
insert into public.pickup_authorizations (id, organization_id, child_id, first_name, last_name, valid_during) values
  ('${ids.px}', '${ids.org}', '${ids.x}', 'Osoba', 'X', daterange(current_date, null)),
  ('${ids.py}', '${ids.org}', '${ids.y}', 'Osoba', 'Y', daterange(current_date, null)),
  ('${ids.pz}', '${ids.org}', '${ids.z}', 'Osoba', 'Z', daterange(current_date, null)),
  ('${ids.pv}', '${ids.org}', '${ids.v}', 'Osoba', 'V', daterange(current_date - 10, null));
-- U is enrolled only from today (enrolment EU). Guardian GD is linked to W from today (link LW) with an open conversation.
insert into public.enrollments (id, organization_id, child_id, group_id, valid_during) values ('${ids.eu}', '${ids.org}', '${ids.u}', '${ids.group}', daterange(current_date, null));
insert into public.guardians (id, organization_id, profile_id, first_name, last_name) values ('${ids.gr}', '${ids.org}', '${ids.gd}', 'Skrbnik', 'GD');
insert into public.child_guardians (id, organization_id, child_id, guardian_id, can_view, can_report_absence, receives_messages, valid_during)
  values ('${ids.lw}', '${ids.org}', '${ids.w}', '${ids.gr}', true, true, true, daterange(current_date, null));
insert into public.conversations (id, organization_id, child_id, guardian_id) values ('${ids.conv}', '${ids.org}', '${ids.w}', '${ids.gr}');`;
const s = sql(setup);
if (s.status !== 0) {
  console.error(s.stderr);
  process.exit(1);
}
const as = (who, aal = 'aal1') =>
  `select set_config('request.jwt.claims', '{"sub":"${who}","role":"authenticated","aal":"${aal}"}', false); set role authenticated;`;
const manager = as(ids.mgr, 'aal2');
const educator = as(ids.edu);
const attend = (child, pickup = null, kind = 'check_in') =>
  `select * from api.record_attendance('${child}', '${kind}', gen_random_uuid(), now() - interval '1 minute', 'app', null, ${pickup ? `'${pickup}'` : 'null'});`;
const guardian = as(ids.gd);
const cancelOf = (kind, rid) => `select api.cancel_same_day_record('${kind}', '${rid}', 'entered_in_error');`;
const cancel = (pickup) => `select api.cancel_same_day_record('pickup_authorization', '${pickup}', 'entered_in_error');`;
const correct = (pickup) =>
  `select api.correct_relationship_history('pickup_authorization', '${pickup}', daterange(current_date - 20, null), 'wrong_date_recorded', 'Ovlaštenje je stvarno počelo ranije.');`;

const results = [];
async function scenario(name, b, a, expect, delay = 800) {
  const bg = run(`begin; ${b} select pg_sleep(3); ${b.includes('/*commit*/') ? 'commit;' : 'rollback;'}`);
  await sleep(delay);
  const fg = await run(a);
  await bg;
  const ok = expect.test(fg.out);
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : `\n  got: ${fg.out.trim().split('\n').slice(-2).join(' | ')}`}`);
}

// Q-T22 ------------------------------------------------------------------------------------------------------------------
await scenario('Q-T22 lock: while a same-day cancellation holds the child, an attendance write waits (times out)',
  `${manager} ${cancel(ids.px)}`, `set lock_timeout = '1s'; ${educator} ${attend(ids.x)}`, /lock timeout/);
await scenario('Q-T22 lock: while an attendance write holds the child, a same-day cancellation waits (times out)',
  `${educator} ${attend(ids.x)}`, `set lock_timeout = '1s'; ${manager} ${cancel(ids.px)}`, /lock timeout/);
await scenario('Q-T22 serial: a handover committed first makes the waiting cancellation refuse (RECORD_HAS_DEPENDENTS)',
  `/*commit*/ ${educator} ${attend(ids.y, ids.py)}`, `${manager} ${cancel(ids.py)}`, /RECORD_HAS_DEPENDENTS/);
await scenario('Q-T22 serial: a cancellation committed first makes the waiting handover refuse (HANDOVER_INVALID)',
  `/*commit*/ ${manager} ${cancel(ids.pz)}`, `${educator} ${attend(ids.z, ids.pz)}`, /HANDOVER_INVALID/);

await scenario('Q-T22 serial: a link cancelled first makes the guardian\'s waiting absence report refuse',
  `/*commit*/ ${manager} ${cancelOf('child_guardian', ids.lw)}`, `${guardian} select api.report_absence('${ids.w}', current_date + 1, current_date + 1);`, /PERMISSION_DENIED/);
await scenario('Q-T22 serial: a link cancelled first makes the guardian\'s waiting message refuse',
  `/*commit*/ select 1;`, `${guardian} select api.send_message('${ids.conv}', 'Poruka nakon poništenja');`, /PERMISSION_DENIED/, 100);
await scenario('Q-T22 serial: an enrolment cancelled first makes the waiting attendance write refuse',
  `/*commit*/ ${manager} ${cancelOf('enrollment', ids.eu)}`, `${educator} ${attend(ids.u)}`, /PERMISSION_DENIED|CHILD_NOT_ENROLLED/);

// D-41b (only when the correction RPC exists) ----------------------------------------------------------------------------
if (sql(`select to_regprocedure('api.correct_relationship_history(text,uuid,daterange,history_correction_reason,text,text,text)') is not null`).stdout.trim() === 't') {
  await scenario('D-41b lock: while a correction holds the child, an attendance write waits (times out)',
    `${manager} ${correct(ids.pv)}`, `set lock_timeout = '1s'; ${educator} ${attend(ids.v)}`, /lock timeout/);
  await scenario('D-41b lock: while an attendance write holds the child, a correction waits (times out)',
    `${educator} ${attend(ids.v)}`, `set lock_timeout = '1s'; ${manager} ${correct(ids.pv)}`, /lock timeout/);
  await scenario('D-41b serial: a handover committed first makes a waiting name correction refuse (CORRECTION_NAME_IN_USE)',
    `/*commit*/ ${educator} ${attend(ids.v, ids.pv)}`,
    `${manager} select api.correct_relationship_history('pickup_authorization', '${ids.pv}', daterange(current_date - 10, null), 'entered_in_error', 'Ime je pogrešno upisano.', 'Druga', 'Osoba');`,
    /CORRECTION_NAME_IN_USE/);
} else {
  console.log('SKIP D-41b scenarios (api.correct_relationship_history not present)');
}

const failed = results.filter((r) => !r).length;
console.log(`concurrency: ${results.length - failed} passed${failed ? `, ${failed} FAILED` : ''}`);
process.exit(failed ? 1 : 0);
