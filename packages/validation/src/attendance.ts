import { z } from 'zod';

// D3-G admin forms for attendance and absences. The database decides (RPCs, D3-A/B); these schemas reject malformed
// input early. No free text anywhere: reasons are fixed categories (SR-AUTHZ-12) and absences have no reason (FR-06-2).

const day = z.iso.date();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const attendanceCorrectionReasons = ['entry_error', 'forgot', 'other'] as const;

/** The group and day the admin attendance page shows. */
export const zAttendanceDayQuery = z.object({ group: z.uuid(), date: day }).strict();

/** Correct an event: a reason category, optionally the right time of that same day. */
export const zAttendanceCorrectionInput = z
  .object({ group: z.uuid(), date: day, recordId: z.uuid(), reason: z.enum(attendanceCorrectionReasons), time: time.optional() })
  .strict();

/** A missed arrival or departure added later (e.g. forgotten departure, FS-05 edge case). */
export const zMissedAttendanceInput = z
  .object({ group: z.uuid(), date: day, childId: z.uuid(), kind: z.enum(['check_in', 'check_out']), time, reason: z.enum(attendanceCorrectionReasons) })
  .strict();

/** Record an arrival or departure now (manager, today). */
export const zRecordNowInput = z.object({ group: z.uuid(), date: day, childId: z.uuid(), kind: z.enum(['check_in', 'check_out']) }).strict();

/** Absence on behalf of a guardian (FR-06-7): child and inclusive dates only. */
export const zAbsenceOnBehalfInput = z
  .object({ group: z.uuid(), date: day, childId: z.uuid(), from: day, to: day })
  .strict()
  .refine((v) => v.from <= v.to, { message: 'starts_before_ends', path: ['to'] });

export const zCancelAbsenceInput = z.object({ group: z.uuid(), date: day, absenceId: z.uuid() }).strict();
