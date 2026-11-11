import { z } from 'zod';

/** Single-row actions (archive, revoke): only an id. */
export const zIdInput = z.object({ id: z.uuid() }).strict();

export const zAcademicYearStatusInput = z.object({ id: z.uuid(), status: z.enum(['active', 'closed']) }).strict();

/** Managers may suspend or re-activate a membership; ending and role changes are not client actions. */
export const zMembershipStatusInput = z.object({ id: z.uuid(), status: z.enum(['active', 'suspended']) }).strict();

/** Staff assignment form (FS-03). Dates are inclusive in the UI; a substitute always has an end (FR-03-3). */
export const zAssignmentInput = z
  .object({
    membershipId: z.uuid(),
    groupId: z.uuid(),
    type: z.enum(['regular', 'substitute']),
    from: z.iso.date(),
    to: z.iso.date().optional(),
  })
  .strict()
  .refine((v) => v.type === 'regular' || v.to !== undefined, { message: 'substitute_requires_end', path: ['to'] })
  .refine((v) => v.to === undefined || v.from <= v.to, { message: 'starts_before_ends', path: ['to'] });

export const zEndAssignmentInput = z.object({ id: z.uuid(), from: z.iso.date() }).strict();

export type AssignmentInput = z.infer<typeof zAssignmentInput>;
