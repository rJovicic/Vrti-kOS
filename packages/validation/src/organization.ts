import { z } from 'zod';

const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.normalize('NFC').trim())
    .pipe(
      z
        .string()
        .min(1)
        .max(max)
        .refine((s) => ![...s].some((ch) => { const c = ch.codePointAt(0) ?? 0; return c < 0x20 || c === 0x7f; }), { message: 'control_characters' }),
    );

/** Mirrors SQL checks in supabase/migrations (lengths must stay identical). */
export const zFacilityInput = z
  .object({
    organizationId: z.uuid(),
    name: cleanText(120),
    address: cleanText(200).optional(),
  })
  .strict();

export const zAcademicYearInput = z
  .object({
    organizationId: z.uuid(),
    name: cleanText(60),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
  })
  .strict()
  .refine((v) => v.startsOn < v.endsOn, { message: 'starts_before_ends', path: ['endsOn'] });

export const zGroupInput = z
  .object({
    organizationId: z.uuid(),
    facilityId: z.uuid(),
    academicYearId: z.uuid(),
    name: cleanText(80),
    capacity: z.number().int().min(1).max(60).optional(),
  })
  .strict();

export const zOrganizationSettingsInput = z
  .object({
    quietHoursStart: z.iso.time().optional(),
    quietHoursEnd: z.iso.time().optional(),
    absenceCutoffLocal: z.iso.time().optional(),
  })
  .strict();

export type FacilityInput = z.infer<typeof zFacilityInput>;
export type AcademicYearInput = z.infer<typeof zAcademicYearInput>;
export type GroupInput = z.infer<typeof zGroupInput>;
