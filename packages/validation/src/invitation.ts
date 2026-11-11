import { z } from 'zod';

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

/** Roles a kindergarten manager may invite. Platform admin is never invitable (SR-PRIV-02). */
export const invitableRoles = ['org_admin', 'director', 'educator', 'guardian'] as const;

/** Input of the invite-member Edge Function and the admin form (SQL checks mirror these limits). */
export const zInviteMemberInput = z
  .object({
    organizationId: z.uuid(),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email().max(254)),
    role: z.enum(invitableRoles),
    firstName: name,
    lastName: name,
  })
  .strict();

export type InviteMemberInput = z.infer<typeof zInviteMemberInput>;

/** E-mail sign-in: always respond the same way whether or not the address is known (SR-AUTHN-03). */
export const zEmailInput = z.object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) }).strict();
export const zOtpInput = z
  .object({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)), code: z.string().regex(/^\d{6}$/) })
  .strict();
export const zTotpInput = z.object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).strict();
