import { z } from 'zod';

// D2-G admin forms for children, enrolments, guardians, links, restrictions and pickup persons. The database decides
// (RLS, guards, RPCs); these schemas only reject malformed input early and mirror the SQL limits.

const name = z
  .string()
  .transform((s) => s.normalize('NFC').trim())
  .pipe(
    z
      .string()
      .min(1)
      .max(60)
      .refine((s) => ![...s].some((ch) => { const c = ch.codePointAt(0) ?? 0; return c < 0x20 || c === 0x7f; }), { message: 'control_characters' }),
  );
const optionalText = (max: number) =>
  z
    .string()
    .transform((s) => s.normalize('NFC').trim())
    .pipe(z.string().max(max))
    .optional()
    .transform((s) => (s ? s : undefined));
const day = z.iso.date();
const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

/** FR-04-1: minimum child data only (no date of birth, OIB, address, photo or health data — Q-P03). */
export const zChildInput = z.object({ firstName: name, lastName: name, internalRef: optionalText(40) }).strict();
export const zChildUpdateInput = zChildInput.extend({ childId: z.uuid() }).strict();

/** First enrolment of a child (later changes go through transfer/withdrawal). */
export const zEnrolInput = z.object({ childId: z.uuid(), groupId: z.uuid(), from: day }).strict();

/** D2-E: transfer from a date (D-36: today or later — enforced in the database). */
export const zTransferInput = z.object({ childId: z.uuid(), groupId: z.uuid(), effectiveOn: day }).strict();

/** D2-E / D-35: withdrawal with the last day; the manager must confirm the consequences explicitly. */
export const zWithdrawInput = z
  .object({ childId: z.uuid(), lastDay: day, confirm: checkbox })
  .strict()
  .refine((v) => v.confirm, { message: 'confirmation_required', path: ['confirm'] });

/** D-37: cancellation of a record that has not taken effect; the reason is a fixed code (no free text in the audit). */
export const cancellationReasons = ['entered_in_error', 'plan_changed', 'withdrawal_planned', 'other'] as const;
export const zCancelInput = z
  .object({
    childId: z.uuid(),
    kind: z.enum(['enrollment', 'child_guardian', 'pickup_authorization']),
    recordId: z.uuid(),
    reason: z.enum(cancellationReasons),
  })
  .strict();

/** FR-04-4: link an existing guardian record or a new one (names only, no contact data). */
const rights = { canView: checkbox, canReportAbsence: checkbox, receivesMessages: checkbox };
export const zGuardianLinkInput = z
  .object({
    childId: z.uuid(),
    guardianId: z.uuid().optional(),
    firstName: name.optional(),
    lastName: name.optional(),
    from: day,
    ...rights,
  })
  .strict()
  .refine((v) => (v.guardianId !== undefined) !== (v.firstName !== undefined && v.lastName !== undefined), {
    message: 'existing_or_new_guardian',
    path: ['guardianId'],
  })
  // Mirrors the SQL check: without the right to view, no other right.
  .refine((v) => v.canView || !(v.canReportAbsence || v.receivesMessages), { message: 'rights_require_view', path: ['canView'] });

export const zLinkRightsInput = z
  .object({ childId: z.uuid(), linkId: z.uuid(), ...rights })
  .strict()
  .refine((v) => v.canView || !(v.canReportAbsence || v.receivesMessages), { message: 'rights_require_view', path: ['canView'] });

/** Ends a link, restriction or pickup authorization: valid through `lastDay` (inclusive). */
export const zEndRecordInput = z.object({ childId: z.uuid(), recordId: z.uuid(), from: day, lastDay: day }).strict()
  .refine((v) => v.from <= v.lastDay, { message: 'starts_before_ends', path: ['lastDay'] });

/** FR-04-5/6: a restriction carries only an internal case reference — never a reason; the manager confirms the effect. */
export const zRestrictionInput = z
  .object({ childId: z.uuid(), linkId: z.uuid(), from: day, reference: optionalText(100), confirm: checkbox })
  .strict()
  .refine((v) => v.confirm, { message: 'confirmation_required', path: ['confirm'] });

/** FR-04-7, D-34: first and last name and validity only; no phone, no relationship. */
export const zPickupInput = z
  .object({ childId: z.uuid(), firstName: name, lastName: name, from: day, to: day.optional() })
  .strict()
  .refine((v) => v.to === undefined || v.from <= v.to, { message: 'starts_before_ends', path: ['to'] });

/** D2-F: invite the guardian of a record (the e-mail is not stored on the guardian record). */
export const zGuardianInviteInput = z
  .object({ childId: z.uuid(), guardianId: z.uuid(), email: z.string().trim().toLowerCase().pipe(z.email().max(254)) })
  .strict();
