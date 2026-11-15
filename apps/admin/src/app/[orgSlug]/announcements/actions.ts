'use server';

// D4-C: manager actions on announcements. Each action re-resolves the caller (DAL), validates with the shared Zod
// schemas and calls the D4-B RPCs AS THE USER: the database authorizes (managers with MFA), checks the audience against
// the kindergarten, keeps revisions, audits and notifies. Results travel as allow-listed flash keys.
import { fromPostgrestError, zAnnouncementDraftInput, zAnnouncementEditInput, zAnnouncementIdInput } from '@vrticos/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getOrgContext, type OrgContext } from '@/lib/dal';
import type { FlashError, FlashOk } from '@/lib/flash';

const context = (formData: FormData) => getOrgContext(String(formData.get('slug') ?? ''));
const done = (ctx: OrgContext, ok: FlashOk): never => {
  revalidatePath(`/${ctx.org.slug}/announcements`);
  redirect(`/${ctx.org.slug}/announcements?ok=${ok}` as Route);
};
const fail = (ctx: OrgContext, code: FlashError): never => redirect(`/${ctx.org.slug}/announcements?e=${code}` as Route);
const dbFail = (ctx: OrgContext, err: { code?: string; message?: string }): never => {
  const mapped = fromPostgrestError(err).code;
  return fail(ctx, mapped === 'NOT_FOUND' ? 'PERMISSION_DENIED' : mapped);
};
const text = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
};
const list = (formData: FormData, key: string) => formData.getAll(key).filter((v): v is string => typeof v === 'string' && v !== '');

export async function saveAnnouncementDraft(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAnnouncementDraftInput.safeParse({
    ...(text(formData, 'id') ? { id: text(formData, 'id') } : {}),
    title: formData.get('title') ?? '',
    body: formData.get('body') ?? '',
    scope: formData.get('scope') ?? '',
    facilities: list(formData, 'facilities'),
    groups: list(formData, 'groups'),
    roles: list(formData, 'roles'),
  });
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED');
  const v = parsed.data!;
  const { error } = await ctx.supabase.schema('api').rpc('save_announcement_draft', {
    p_organization_id: ctx.org.id,
    p_title: v.title,
    p_body: v.body,
    p_audience_scope: v.scope,
    p_audience_ids: v.ids,
    p_audience_roles: v.roles,
    ...(v.id ? { p_id: v.id } : {}),
  });
  if (error) dbFail(ctx, error);
  done(ctx, 'draftSaved');
}

export async function publishAnnouncement(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAnnouncementIdInput.safeParse({ id: formData.get('id') });
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.schema('api').rpc('publish_announcement', { p_id: parsed.data!.id });
  if (error) dbFail(ctx, error);
  done(ctx, 'published');
}

export async function editAnnouncement(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAnnouncementEditInput.safeParse({ id: formData.get('id'), title: formData.get('title') ?? '', body: formData.get('body') ?? '' });
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.schema('api').rpc('edit_announcement', { p_id: parsed.data!.id, p_title: parsed.data!.title, p_body: parsed.data!.body });
  if (error) dbFail(ctx, error);
  done(ctx, 'edited');
}

export async function archiveAnnouncement(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAnnouncementIdInput.safeParse({ id: formData.get('id') });
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.schema('api').rpc('archive_announcement', { p_id: parsed.data!.id });
  if (error) dbFail(ctx, error);
  done(ctx, 'archived');
}
