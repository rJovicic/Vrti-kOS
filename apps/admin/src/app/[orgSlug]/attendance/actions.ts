'use server';

// D3-G: manager actions on attendance and absences. Each action re-resolves the caller (DAL), validates with the
// shared Zod schemas and calls the RPCs AS THE USER (D3-A/B): the database authorizes, checks the order of events,
// keeps the original event, and audits. Results travel as allow-listed flash keys back to the same group and day.
import { randomUUID } from 'node:crypto';
import { zonedTimeToIso } from '@vrticos/domain';
import {
  fromPostgrestError,
  zAbsenceOnBehalfInput,
  zAttendanceCorrectionInput,
  zCancelAbsenceInput,
  zMissedAttendanceInput,
  zRecordNowInput,
} from '@vrticos/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getOrgContext, type OrgContext } from '@/lib/dal';
import type { FlashError, FlashOk } from '@/lib/flash';

type Fields = Record<string, FormDataEntryValue | undefined>;

function fields(formData: FormData): Fields {
  const out: Fields = {};
  for (const [k, v] of formData.entries()) {
    if (k === 'slug' || k.startsWith('$ACTION')) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}
const back = (ctx: OrgContext, formData: FormData) => {
  const group = String(formData.get('group') ?? '');
  const date = String(formData.get('date') ?? '');
  const q = /^[0-9a-f-]{36}$/.test(group) && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `group=${group}&date=${date}&` : '';
  return `/${ctx.org.slug}/attendance?${q}`;
};
function done(ctx: OrgContext, formData: FormData, ok: FlashOk): never {
  revalidatePath(`/${ctx.org.slug}/attendance`);
  redirect(`${back(ctx, formData)}ok=${ok}` as Route);
}
function fail(ctx: OrgContext, formData: FormData, code: FlashError): never {
  redirect(`${back(ctx, formData)}e=${code}` as Route);
}
function dbFail(ctx: OrgContext, formData: FormData, err: { code?: string; message?: string }): never {
  const mapped = fromPostgrestError(err).code;
  fail(ctx, formData, mapped === 'NOT_FOUND' ? 'PERMISSION_DENIED' : mapped);
}
const context = (formData: FormData) => getOrgContext(String(formData.get('slug') ?? ''));

export async function recordNow(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zRecordNowInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, formData, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase
    .schema('api')
    .rpc('record_attendance', { p_child_id: parsed.data.childId, p_kind: parsed.data.kind, p_idempotency_key: randomUUID(), p_source: 'admin' });
  if (error) dbFail(ctx, formData, error);
  done(ctx, formData, 'recorded');
}

export async function correctAttendance(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAttendanceCorrectionInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, formData, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.schema('api').rpc('correct_attendance', {
    p_record_id: parsed.data.recordId,
    p_reason: parsed.data.reason,
    p_idempotency_key: randomUUID(),
    ...(parsed.data.time ? { p_new_occurred_at: zonedTimeToIso(parsed.data.date, parsed.data.time, ctx.org.timezone) } : {}),
    p_source: 'admin',
  });
  if (error) dbFail(ctx, formData, error);
  done(ctx, formData, 'corrected');
}

export async function recordMissed(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zMissedAttendanceInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, formData, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.schema('api').rpc('record_missed_attendance', {
    p_child_id: parsed.data.childId,
    p_kind: parsed.data.kind,
    p_occurred_at: zonedTimeToIso(parsed.data.date, parsed.data.time, ctx.org.timezone),
    p_reason: parsed.data.reason,
    p_idempotency_key: randomUUID(),
    p_source: 'admin',
  });
  if (error) dbFail(ctx, formData, error);
  done(ctx, formData, 'corrected');
}

export async function absenceOnBehalf(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAbsenceOnBehalfInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, formData, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase
    .schema('api')
    .rpc('record_absence_on_behalf', { p_child_id: parsed.data.childId, p_starts_on: parsed.data.from, p_ends_on: parsed.data.to });
  if (error) dbFail(ctx, formData, error);
  done(ctx, formData, 'absenceRecorded');
}

export async function cancelAbsence(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zCancelAbsenceInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, formData, 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.schema('api').rpc('cancel_absence', { p_absence_id: parsed.data.absenceId });
  if (error) dbFail(ctx, formData, error);
  done(ctx, formData, 'absenceCancelled');
}
