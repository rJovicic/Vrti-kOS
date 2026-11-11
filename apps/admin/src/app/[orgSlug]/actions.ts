'use server';

// Kindergarten structure and staff mutations. Each action re-resolves the caller (DAL), validates input with the
// shared Zod schemas, and writes AS THE USER — RLS, column grants and guard triggers make the final decision.
import { toDateRange } from '@vrticos/domain';
import {
  fromPostgrestError,
  zAcademicYearInput,
  zAcademicYearStatusInput,
  zAssignmentInput,
  zEndAssignmentInput,
  zFacilityInput,
  zGroupInput,
  zIdInput,
  zInviteMemberInput,
  zMembershipStatusInput,
} from '@vrticos/validation';
import type { Route } from 'next';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getOrgContext, type OrgContext } from '@/lib/dal';
import { env } from '@/lib/env';
import type { FlashError, FlashOk } from '@/lib/flash';

type Section = 'facilities' | 'academic-years' | 'groups' | 'staff' | 'invitations';

async function context(formData: FormData): Promise<OrgContext> {
  return getOrgContext(String(formData.get('slug') ?? ''));
}
function done(ctx: OrgContext, section: Section, ok: FlashOk): never {
  revalidatePath(`/${ctx.org.slug}`, 'layout');
  redirect(`/${ctx.org.slug}/${section}?ok=${ok}` as Route);
}
function fail(ctx: OrgContext, section: Section, code: FlashError, ref?: string): never {
  redirect(`/${ctx.org.slug}/${section}?e=${code}${ref ? `&ref=${ref}` : ''}` as Route);
}
function dbFail(ctx: OrgContext, section: Section, err: { code?: string }): never {
  const mapped = fromPostgrestError(err).code;
  fail(ctx, section, mapped === 'NOT_FOUND' ? 'PERMISSION_DENIED' : (mapped as FlashError));
}
const opt = (v: FormDataEntryValue | null): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s === '' ? undefined : s;
};

// Facilities ---------------------------------------------------------------------------------------------
export async function createFacility(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zFacilityInput.safeParse({ organizationId: ctx.org.id, name: formData.get('name'), address: opt(formData.get('address')) });
  if (!parsed.success) fail(ctx, 'facilities', 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.from('facilities').insert({ organization_id: ctx.org.id, name: parsed.data.name, address: parsed.data.address ?? null });
  if (error) dbFail(ctx, 'facilities', error);
  done(ctx, 'facilities', 'saved');
}

export async function archiveFacility(formData: FormData) {
  const ctx = await context(formData);
  const id = zIdInput.safeParse({ id: formData.get('id') });
  if (!id.success) fail(ctx, 'facilities', 'VALIDATION_FAILED');
  const { data, error } = await ctx.supabase
    .from('facilities')
    .update({ archived_at: new Date().toISOString() })
    .eq('organization_id', ctx.org.id)
    .eq('id', id.data.id)
    .select('id');
  if (error) dbFail(ctx, 'facilities', error);
  if (!data?.length) fail(ctx, 'facilities', 'NOT_FOUND');
  done(ctx, 'facilities', 'saved');
}

// Academic years -----------------------------------------------------------------------------------------
export async function createAcademicYear(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAcademicYearInput.safeParse({
    organizationId: ctx.org.id,
    name: formData.get('name'),
    startsOn: formData.get('startsOn'),
    endsOn: formData.get('endsOn'),
  });
  if (!parsed.success) fail(ctx, 'academic-years', 'VALIDATION_FAILED');
  const { error } = await ctx.supabase
    .from('academic_years')
    .insert({ organization_id: ctx.org.id, name: parsed.data.name, starts_on: parsed.data.startsOn, ends_on: parsed.data.endsOn, status: 'planned' });
  if (error) dbFail(ctx, 'academic-years', error);
  done(ctx, 'academic-years', 'saved');
}

export async function setAcademicYearStatus(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAcademicYearStatusInput.safeParse({ id: formData.get('id'), status: formData.get('status') });
  if (!parsed.success) fail(ctx, 'academic-years', 'VALIDATION_FAILED');
  const { data, error } = await ctx.supabase
    .from('academic_years')
    .update({ status: parsed.data.status })
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.id)
    .select('id');
  if (error) dbFail(ctx, 'academic-years', error);
  if (!data?.length) fail(ctx, 'academic-years', 'NOT_FOUND');
  done(ctx, 'academic-years', 'saved');
}

// Groups -------------------------------------------------------------------------------------------------
export async function createGroup(formData: FormData) {
  const ctx = await context(formData);
  const capacity = opt(formData.get('capacity'));
  const parsed = zGroupInput.safeParse({
    organizationId: ctx.org.id,
    facilityId: formData.get('facilityId'),
    academicYearId: formData.get('academicYearId'),
    name: formData.get('name'),
    capacity: capacity === undefined ? undefined : Number(capacity),
  });
  if (!parsed.success) fail(ctx, 'groups', 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.from('groups').insert({
    organization_id: ctx.org.id,
    facility_id: parsed.data.facilityId,
    academic_year_id: parsed.data.academicYearId,
    name: parsed.data.name,
    capacity: parsed.data.capacity ?? null,
  });
  if (error) dbFail(ctx, 'groups', error);
  done(ctx, 'groups', 'saved');
}

// Staff: memberships and assignments ---------------------------------------------------------------------
export async function setMembershipStatus(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zMembershipStatusInput.safeParse({ id: formData.get('id'), status: formData.get('status') });
  if (!parsed.success) fail(ctx, 'staff', 'VALIDATION_FAILED');
  const { data, error } = await ctx.supabase
    .from('memberships')
    .update({ status: parsed.data.status })
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.id)
    .select('id');
  if (error) dbFail(ctx, 'staff', error);
  if (!data?.length) fail(ctx, 'staff', 'NOT_FOUND');
  done(ctx, 'staff', parsed.data.status === 'suspended' ? 'suspended' : 'reactivated');
}

export async function createAssignment(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zAssignmentInput.safeParse({
    membershipId: formData.get('membershipId'),
    groupId: formData.get('groupId'),
    type: formData.get('type'),
    from: formData.get('from'),
    to: opt(formData.get('to')),
  });
  if (!parsed.success) fail(ctx, 'staff', 'VALIDATION_FAILED');
  const { error } = await ctx.supabase.from('staff_assignments').insert({
    organization_id: ctx.org.id,
    membership_id: parsed.data.membershipId,
    group_id: parsed.data.groupId,
    assignment_type: parsed.data.type,
    valid_during: toDateRange(parsed.data.from, parsed.data.to ?? null),
  });
  if (error) dbFail(ctx, 'staff', error);
  done(ctx, 'staff', 'saved');
}

/**
 * Ends an assignment: it is no longer valid from tomorrow (today's work stays recorded). For immediate loss of
 * access, managers suspend the membership — documented in the staff screen.
 */
export async function endAssignment(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zEndAssignmentInput.safeParse({ id: formData.get('id'), from: formData.get('from') });
  if (!parsed.success) fail(ctx, 'staff', 'VALIDATION_FAILED');
  const lastDay = parsed.data.from > ctx.today ? parsed.data.from : ctx.today;
  const { data, error } = await ctx.supabase
    .from('staff_assignments')
    .update({ valid_during: toDateRange(parsed.data.from, lastDay) })
    .eq('organization_id', ctx.org.id)
    .eq('id', parsed.data.id)
    .select('id');
  if (error) dbFail(ctx, 'staff', error);
  if (!data?.length) fail(ctx, 'staff', 'NOT_FOUND');
  done(ctx, 'staff', 'ended');
}

// Invitations --------------------------------------------------------------------------------------------
export async function inviteMember(formData: FormData) {
  const ctx = await context(formData);
  const parsed = zInviteMemberInput.safeParse({
    organizationId: ctx.org.id,
    email: formData.get('email'),
    role: formData.get('role'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  });
  // Guardian invitations belong to the child record (FR-01-1, D2); the database also limits org_admin invites.
  if (!parsed.success || parsed.data.role === 'guardian') fail(ctx, 'invitations', 'VALIDATION_FAILED');
  const { data: session } = await ctx.supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) redirect('/sign-in');
  const correlationId = crypto.randomUUID();
  let status = 0;
  let code: string | undefined;
  try {
    const res = await fetch(`${env.supabaseUrl}/functions/v1/invite-member`, {
      method: 'POST',
      headers: {
        apikey: env.supabasePublishableKey,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
      },
      body: JSON.stringify(parsed.data),
      cache: 'no-store',
    });
    status = res.status;
    code = ((await res.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code;
  } catch {
    // network failure: falls through to INTERNAL with the correlation id
  }
  if (status === 201) done(ctx, 'invitations', 'invited');
  if (status === 401) redirect('/sign-in');
  if (code === 'INVITATION_PENDING_EXISTS' || code === 'VALIDATION_FAILED' || code === 'PERMISSION_DENIED') fail(ctx, 'invitations', code);
  fail(ctx, 'invitations', 'INTERNAL', correlationId);
}

export async function revokeInvitation(formData: FormData) {
  const ctx = await context(formData);
  const id = zIdInput.safeParse({ id: formData.get('id') });
  if (!id.success) fail(ctx, 'invitations', 'VALIDATION_FAILED');
  const { data, error } = await ctx.supabase
    .from('invitations')
    .update({ status: 'revoked' })
    .eq('organization_id', ctx.org.id)
    .eq('id', id.data.id)
    .eq('status', 'pending')
    .select('id');
  if (error) dbFail(ctx, 'invitations', error);
  if (!data?.length) fail(ctx, 'invitations', 'NOT_FOUND');
  done(ctx, 'invitations', 'revoked');
}
