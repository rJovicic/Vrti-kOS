// D5: the demo is repeatable and returns to its initial state without manual database repair. Resets the LOCAL database
// (scripts/guard-local.mjs refuses anything else), records the presentation scenario, changes data the way a
// presentation does, resets again and requires the identical scenario — with "today" recomputed for the load day.
// Run with `pnpm demo:verify` (not part of `pnpm test:integration`, because it resets the database).
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { service } from './helpers.ts';

const root = join(import.meta.dirname, '..', '..', '..');
const ALFA_SLUG = 'alfa-demo';

function reset(): void {
  const guard = spawnSync('node', ['scripts/guard-local.mjs'], { cwd: root, encoding: 'utf8' });
  if (guard.status !== 0) throw new Error(`guard refused: ${guard.stderr}`);
  const r = spawnSync('node', ['scripts/supabase.mjs', 'db', 'reset'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`db reset failed: ${r.stderr.slice(-400)}`);
}

/** The scenario as data: what each role would see (counts and states, never row ids generated at load time). */
async function snapshot() {
  const { data: org } = await service.from('organizations').select('id').eq('slug', ALFA_SLUG).single().throwOnError();
  const orgId = org!.id as string;
  const { data: groups } = await service.from('groups').select('id, name').eq('organization_id', orgId).eq('name', 'Galebovi').single().throwOnError();
  const { data: enrolled } = await service.from('enrollments').select('child_id').eq('group_id', groups!.id).throwOnError();
  const q = async (table: string, select: string): Promise<unknown[]> => {
    const { data, error } = await service.from(table).select(select).eq('organization_id', orgId);
    if (error) throw error;
    return (data ?? []) as unknown[];
  };
  const attendance = (await q('attendance_records', 'child_id, kind, local_date, handover_child_guardian_id')) as { kind: string; handover_child_guardian_id: string | null }[];
  const absences = (await q('absence_records', 'starts_on, ends_on, status, source')) as unknown[];
  const announcements = (await q('announcements', 'title, status, audience_scope')) as { title: string }[];
  const daily = (await q('daily_entries', 'entry_date, status, body')) as unknown[];
  const messages = (await q('messages', 'body, withdrawn_at')) as unknown[];
  const notifications = (await q('notifications', 'type, read_at, recipient_id')) as { type: string; read_at: string | null }[];
  const count = (xs: { type: string }[], t: string) => xs.filter((x) => x.type === t).length;
  return {
    galebovi: (enrolled ?? []).length,
    arrivals: attendance.filter((a) => a.kind === 'check_in').length,
    handovers: attendance.filter((a) => a.handover_child_guardian_id !== null).length,
    otherEvents: attendance.filter((a) => a.kind !== 'check_in').length,
    absences: absences.length,
    announcements: announcements.map((a) => a.title).sort(),
    dailyEntries: daily.length,
    messages: messages.length,
    notifications: { announcement: count(notifications, 'announcement.published'), absence: count(notifications, 'absence.reported'), message: count(notifications, 'message.received') },
    unread: notifications.filter((n) => n.read_at === null).length,
  };
}

describe('D5: the demo resets to the same scenario', () => {
  it('reset → scenario → presentation changes → reset → identical scenario', { timeout: 240_000 }, async () => {
    reset();
    const before = await snapshot();
    // Galebovi: five children — three arrived (one handed over), one absent, one expected.
    expect(before).toMatchObject({ galebovi: 5, arrivals: 3, handovers: 1, otherEvents: 0, absences: 1, dailyEntries: 2, messages: 2 });
    expect(before.announcements).toEqual(['Jesenski izlet u petak', 'Roditeljski sastanak u četvrtak']);
    expect(before.notifications.announcement).toBeGreaterThan(0);
    expect(before.notifications.absence).toBeGreaterThan(0);
    expect(before.notifications.message).toBe(1);

    // What a presentation changes: a new announcement, a message, everything read, a departure.
    const { data: org } = await service.from('organizations').select('id').eq('slug', ALFA_SLUG).single().throwOnError();
    await service.from('announcements').insert({ organization_id: org!.id, title: 'Demo izmjena', body: 'x', audience_scope: 'organization', audience_ids: [], audience_roles: ['staff'] }).throwOnError();
    await service.from('notifications').update({ read_at: new Date().toISOString() }).eq('organization_id', org!.id).throwOnError();
    const { data: conv } = await service.from('conversations').select('id, organization_id').limit(1).single().throwOnError();
    const { data: anyone } = await service.from('messages').select('sender_id').eq('conversation_id', conv!.id).limit(1).single().throwOnError();
    await service.from('messages').insert({ organization_id: conv!.organization_id, conversation_id: conv!.id, sender_id: anyone!.sender_id, body: 'Demo poruka' }).throwOnError();
    const changed = await snapshot();
    expect(changed).not.toEqual(before);

    reset();
    expect(await snapshot()).toEqual(before);
  });
});
