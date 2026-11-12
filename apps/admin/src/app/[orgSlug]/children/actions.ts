'use server';

// D2-G: children, enrolments, guardians, links, restrictions and pickup persons. Each action re-resolves the caller
// (DAL), validates with the shared Zod schemas and writes AS THE USER: RLS, column grants, guard triggers and the RPCs
// (transfer, withdrawal, D-37 cancellation) make the final decision. Results travel as allow-listed flash keys.
import { toDateRange } from '@vrticos/domain';
import {
  fromPostgrestError,
  zCancelInput,
  zChildInput,
  zChildUpdateInput,
  zEndRecordInput,
  zEnrolInput,
  zGuardianInviteInput,
  zGuardianLinkInput,
  zLinkRightsInput,
  zPickupInput,
  zRestrictionInput,
  zTransferInput,
  zWithdrawInput,
} from '@vrticos/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getOrgContext, type OrgContext } from '@/lib/dal';
import type { FlashError, FlashOk } from '@/lib/flash';
import { callInviteMember } from '@/lib/invite';

type Fields = Record<string, FormDataEntryValue | undefined>;

async function context(formData: FormData): Promise<OrgContext> {
  return getOrgContext(String(formData.get('slug') ?? ''));
}
/** Form fields as a plain object without the routing field; empty optional inputs are dropped. */
function fields(formData: FormData): Fields {
  const out: Fields = {};
  for (const [k, v] of formData.entries()) {
    if (k === 'slug' || k.startsWith('$ACTION')) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}
const pathOf = (ctx: OrgContext, childId?: string) => `/${ctx.org.slug}/children${childId ? `/${childId}` : ''}`;
function done(ctx: OrgContext, ok: FlashOk, childId?: string): never {
  revalidatePath(`/${ctx.org.slug}`, 'layout');
  redirect(`${pathOf(ctx, childId)}?ok=${ok}` as Route);
}
function fail(ctx: OrgContext, code: FlashError, childId?: string, ref?: string): never {
  redirect(`${pathOf(ctx, childId)}?e=${code}${ref ? `&ref=${ref}` : ''}` as Route);
}
/** PostgREST/RPC error → catalogued code. Hidden rows and denials look the same (no existence oracle). */
function dbFail(ctx: OrgContext, err: { code?: string; message?: string }, childId?: string): never {
  const mapped = fromPostgrestError(err).code;
  fail(ctx, mapped === 'NOT_FOUND' ? 'PERMISSION_DENIED' : mapped, childId);
}
const childIdOf = (formData: FormData): string | undefined => {
  const v = formData.get('childId');
  return typeof v === 'string' && /^[0-9a-f-]{36}$/.test(v) ? v : undefined;
};

// Children -----------------------------------------------------------------------------------------------------
export async function createChild(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zChildInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED');
  const { data, error } = await ctx.supabase
    .from('children')
    .insert({ organization_id: ctx.org.id, first_name: parsed.data.firstName, last_name: parsed.data.lastName, internal_ref: parsed.data.internalRef ?? null })
    .select('id')
    .single();
  if (error) dbFail(ctx, error);
  done(ctx, 'saved', data.id);
}

export async function updateChild(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zChildUpdateInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { data, error } = await ctx.supabase
    .from('children')
    .update({ first_name: parsed.data.firstName, last_name: parsed.data.lastName, internal_ref: parsed.data.internalRef ?? null })
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.childId)
    .select('id');
  if (error) dbFail(ctx, error, childId);
  if (!data?.length) fail(ctx, 'NOT_FOUND', childId);
  done(ctx, 'saved', childId);
}

// Enrolment, transfer, withdrawal, cancellation (D2-E, D-35, D-36, D-37) ------------------------------------------
export async function enrolChild(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zEnrolInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { error } = await ctx.supabase.from('enrollments').insert({
    organization_id: ctx.org.id,
    child_id: parsed.data.childId,
    group_id: parsed.data.groupId,
    valid_during: toDateRange(parsed.data.from, null),
  });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'enrolled', childId);
}

export async function transferChild(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zTransferInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { error } = await ctx.supabase
    .schema('api')
    .rpc('transfer_child', { p_child_id: parsed.data.childId, p_group_id: parsed.data.groupId, p_effective_on: parsed.data.effectiveOn });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'transferred', childId);
}

export async function withdrawChild(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zWithdrawInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { error } = await ctx.supabase.schema('api').rpc('withdraw_child', { p_child_id: parsed.data.childId, p_last_day: parsed.data.lastDay });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'withdrawn', childId);
}

export async function cancelFutureRecord(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zCancelInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { error } = await ctx.supabase
    .schema('api')
    .rpc('cancel_future_record', { p_kind: parsed.data.kind, p_record_id: parsed.data.recordId, p_reason: parsed.data.reason });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'cancelled', childId);
}

// Guardians and links (FR-04-4, D-31, D-32) -----------------------------------------------------------------------
export async function linkGuardian(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zGuardianLinkInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  let guardianId = parsed.data.guardianId;
  if (!guardianId) {
    // A new guardian record holds names only (no contact data); the account is attached later by the invitation.
    const { data, error } = await ctx.supabase
      .from('guardians')
      .insert({ organization_id: ctx.org.id, first_name: parsed.data.firstName!, last_name: parsed.data.lastName! })
      .select('id')
      .single();
    if (error) dbFail(ctx, error, childId);
    guardianId = data.id;
  }
  const { error } = await ctx.supabase.from('child_guardians').insert({
    organization_id: ctx.org.id,
    child_id: parsed.data.childId,
    guardian_id: guardianId,
    can_view: parsed.data.canView,
    can_report_absence: parsed.data.canReportAbsence,
    receives_messages: parsed.data.receivesMessages,
    valid_during: toDateRange(parsed.data.from, null),
  });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'linked', childId);
}

export async function updateLinkRights(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zLinkRightsInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { data, error } = await ctx.supabase
    .from('child_guardians')
    .update({ can_view: parsed.data.canView, can_report_absence: parsed.data.canReportAbsence, receives_messages: parsed.data.receivesMessages })
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.linkId)
    .select('id');
  if (error) dbFail(ctx, error, childId);
  if (!data?.length) fail(ctx, 'NOT_FOUND', childId);
  done(ctx, 'saved', childId);
}

/** Ends a link, restriction or pickup authorization: valid through the chosen last day (today or later). */
async function endRecord(formData: FormData, table: 'child_guardians' | 'access_restrictions' | 'pickup_authorizations') {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zEndRecordInput.safeParse(fields(formData));
  // Like D-36 for enrolments: an end is never set in the past from the admin screens.
  if (!parsed.success || parsed.data.lastDay < ctx.today) fail(ctx, 'VALIDATION_FAILED', childId);
  const { data, error } = await ctx.supabase
    .from(table)
    .update({ valid_during: toDateRange(parsed.data.from, parsed.data.lastDay) })
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.recordId)
    .select('id');
  if (error) dbFail(ctx, error, childId);
  if (!data?.length) fail(ctx, 'NOT_FOUND', childId);
  done(ctx, 'closed', childId);
}
export async function endLink(formData: FormData) {
  return endRecord(formData, 'child_guardians');
}
export async function endRestriction(formData: FormData) {
  return endRecord(formData, 'access_restrictions');
}
export async function endPickup(formData: FormData) {
  return endRecord(formData, 'pickup_authorizations');
}

export async function inviteGuardian(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zGuardianInviteInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { data: g } = await ctx.supabase
    .from('guardian_directory')
    .select('first_name, last_name')
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.guardianId)
    .maybeSingle();
  if (!g) fail(ctx, 'NOT_FOUND', childId);
  const failure = await callInviteMember(ctx, {
    organizationId: ctx.org.id,
    email: parsed.data.email,
    role: 'guardian',
    firstName: g.first_name!,
    lastName: g.last_name!,
    guardianId: parsed.data.guardianId,
  });
  if (!failure) done(ctx, 'invited', childId);
  fail(ctx, failure.code, childId, failure.ref);
}

// Restrictions (FR-04-5/6: managers only, internal reference only, explicit confirmation) ---------------------------
export async function addRestriction(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zRestrictionInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { error } = await ctx.supabase.from('access_restrictions').insert({
    organization_id: ctx.org.id,
    child_guardian_id: parsed.data.linkId,
    valid_during: toDateRange(parsed.data.from, null),
    reference: parsed.data.reference ?? null,
  });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'restricted', childId);
}

// Pickup persons (FR-04-7/8, D-34: names and validity only, managers only) ------------------------------------------
export async function addPickup(formData: FormData) {
  const ctx = await context(formData);
  const childId = childIdOf(formData);
  const parsed = zPickupInput.safeParse(fields(formData));
  if (!parsed.success) fail(ctx, 'VALIDATION_FAILED', childId);
  const { error } = await ctx.supabase.from('pickup_authorizations').insert({
    organization_id: ctx.org.id,
    child_id: parsed.data.childId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    valid_during: toDateRange(parsed.data.from, parsed.data.to ?? null),
  });
  if (error) dbFail(ctx, error, childId);
  done(ctx, 'saved', childId);
}
