import { CORRELATION_HEADER, newCorrelationId } from './correlation';
import { supabase } from './supabase';

// D4-E daily overview of a group. Read and written AS THE SIGNED-IN PERSON: the educator of the group writes today's
// overview through `api.save_daily_entry`; guardians read published overviews of days on which their child was in the
// group (RLS). Group level only — no child data. Nothing is stored on the device.

export const activityTags = ['outdoor', 'art', 'music', 'story'] as const;
export type ActivityTag = (typeof activityTags)[number];
export const DAILY_ENTRY_MAX = 1000;

export interface DailyEntry {
  id: string;
  groupId: string;
  date: string;
  body: string;
  tags: ActivityTag[];
  status: 'draft' | 'published';
  publishedAt: string | null;
  edited: boolean;
}

interface Row {
  id: string;
  group_id: string;
  entry_date: string;
  body: string;
  activity_tags: ActivityTag[];
  status: 'draft' | 'published';
  published_at: string | null;
  edited_at: string | null;
}
const toEntry = (r: Row): DailyEntry => ({
  id: r.id,
  groupId: r.group_id,
  date: r.entry_date,
  body: r.body,
  tags: r.activity_tags ?? [],
  status: r.status,
  publishedAt: r.published_at,
  edited: r.edited_at !== null,
});
const columns = 'id, group_id, entry_date, body, activity_tags, status, published_at, edited_at';

/** The group's overviews the caller may read, newest first (educator: drafts too; guardian: published only). */
export async function loadGroupEntries(groupId: string, correlationId: string = newCorrelationId()): Promise<DailyEntry[]> {
  const { data, error } = await supabase.from('daily_entries').select(columns).eq('group_id', groupId).order('entry_date', { ascending: false }).setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toEntry).slice(0, 8);
}

/** Published overviews of a given day the caller may read (Parent Home "Danas"). */
export async function loadPublishedOn(date: string, correlationId: string = newCorrelationId()): Promise<DailyEntry[]> {
  const { data, error } = await supabase.from('daily_entries').select(columns).eq('entry_date', date).eq('status', 'published').setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toEntry);
}

export async function saveDailyEntry(groupId: string, body: string, tags: ActivityTag[], publish: boolean, correlationId: string = newCorrelationId()): Promise<string> {
  const { data, error } = await supabase
    .schema('api')
    .rpc('save_daily_entry', { p_group_id: groupId, p_body: body, p_tags: tags, p_publish: publish })
    .setHeader(CORRELATION_HEADER, correlationId);
  if (error) throw error;
  return data as string;
}
