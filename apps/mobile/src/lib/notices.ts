import { notificationTypes, type NotificationType } from '@vrticos/i18n';
import type { Database } from '@vrticos/db-types';
import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

// D4-D notification centre. Everything is read AS THE SIGNED-IN PERSON: `notifications` holds only the type and a
// resource reference (D4-A), and each resource is loaded under its own RLS — an announcement the person may no longer
// read simply does not come back (FR-08-3, FR-07-4). Nothing is stored on the device.

// The i18n list of types must match the database enum (compile-time check).
type DbType = Database['public']['Enums']['notification_type'];
const typesMatch: [DbType] extends [NotificationType] ? ([NotificationType] extends [DbType] ? true : never) : never = true;
void typesMatch;

export interface NoticeAnnouncement {
  id: string;
  title: string;
  body: string;
  publishedAt: string;
  edited: boolean;
  kindergarten: string;
  /** Unread notifications that point at this announcement (opening it marks them read). */
  unreadIds: string[];
}
export interface NoticeAbsence {
  notificationId: string;
  unread: boolean;
  createdAt: string;
  /** Null when the report is no longer readable (e.g. the child left the group). */
  detail: { childName: string; startsOn: string; endsOn: string } | null;
}
export interface Notices {
  announcements: NoticeAnnouncement[];
  absences: NoticeAbsence[];
  unread: number;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  resource_id: string;
  created_at: string;
  read_at: string | null;
}

export async function loadNotices(kindergartens: { id: string; name: string }[], correlationId: string = newCorrelationId()): Promise<Notices> {
  const [notifications, announcements] = await Promise.all([
    supabase.from('notifications').select('id, type, resource_id, created_at, read_at').order('created_at', { ascending: false }).setHeader(CORRELATION_HEADER, correlationId),
    supabase
      .from('announcements')
      .select('id, organization_id, title, body, published_at, edited_at')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .setHeader(CORRELATION_HEADER, correlationId),
  ]);
  if (notifications.error) throw notifications.error;
  if (announcements.error) throw announcements.error;
  const rows = (notifications.data ?? []) as NotificationRow[];
  const unreadFor = (resource: string) => rows.filter((n) => n.resource_id === resource && n.read_at === null).map((n) => n.id);
  const kg = new Map(kindergartens.map((k) => [k.id, k.name]));

  const absenceRows = rows.filter((n) => n.type === 'absence.reported');
  let absences: NoticeAbsence[] = [];
  if (absenceRows.length) {
    const reports = await supabase
      .from('absence_records')
      .select('id, child_id, starts_on, ends_on')
      .in('id', absenceRows.map((n) => n.resource_id))
      .setHeader(CORRELATION_HEADER, correlationId);
    if (reports.error) throw reports.error;
    const byId = new Map(((reports.data ?? []) as { id: string; child_id: string; starts_on: string; ends_on: string }[]).map((r) => [r.id, r]));
    const childIds = [...new Set([...byId.values()].map((r) => r.child_id))];
    const children = childIds.length
      ? await supabase.from('children').select('id, first_name, last_name').in('id', childIds).setHeader(CORRELATION_HEADER, correlationId)
      : { data: [], error: null };
    if (children.error) throw children.error;
    const name = new Map(((children.data ?? []) as { id: string; first_name: string; last_name: string }[]).map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
    absences = absenceRows.map((n) => {
      const r = byId.get(n.resource_id);
      return {
        notificationId: n.id,
        unread: n.read_at === null,
        createdAt: n.created_at,
        detail: r && name.has(r.child_id) ? { childName: name.get(r.child_id)!, startsOn: r.starts_on, endsOn: r.ends_on } : null,
      };
    });
  }

  return {
    announcements: ((announcements.data ?? []) as { id: string; organization_id: string; title: string; body: string; published_at: string; edited_at: string | null }[]).map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      publishedAt: a.published_at,
      edited: a.edited_at !== null,
      kindergarten: kg.get(a.organization_id) ?? '',
      unreadIds: unreadFor(a.id),
    })),
    absences,
    unread: rows.filter((n) => n.read_at === null).length,
  };
}

/** Marks own notifications read (all when `ids` is omitted). */
export async function markRead(ids?: string[], correlationId: string = newCorrelationId()): Promise<void> {
  const { error } = await supabase
    .schema('api')
    .rpc('mark_notifications_read', ids ? { p_ids: ids } : {})
    .setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
}

/** Push preference per type (FR-08-4). Default: on. */
export async function loadPreferences(): Promise<Record<NotificationType, boolean>> {
  const { data, error } = await supabase.from('notification_preferences').select('type, push_enabled');
  if (error) throw error;
  const out = Object.fromEntries(notificationTypes.map((x) => [x, true])) as Record<NotificationType, boolean>;
  for (const r of (data ?? []) as { type: NotificationType; push_enabled: boolean }[]) out[r.type] = r.push_enabled;
  return out;
}

export async function setPreference(profileId: string, type: NotificationType, pushEnabled: boolean): Promise<void> {
  const { error } = await supabase.from('notification_preferences').upsert({ profile_id: profileId, type, push_enabled: pushEnabled }, { onConflict: 'profile_id,type' });
  if (error) throw error;
}
