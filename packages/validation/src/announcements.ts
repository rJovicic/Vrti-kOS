import { z } from 'zod';

// D4-C admin forms for announcements (FS-07). The database decides (D4-B RPCs); these schemas reject malformed input
// early and shape the audience. Limits as FR-07-2: title ≤ 120, text ≤ 4,000; no attachments, no "urgent" flag.

export const announcementScopes = ['organization', 'facility', 'group'] as const;
export const announcementRoles = ['guardians', 'staff'] as const;

const title = z.string().trim().min(1).max(120);
const body = z.string().trim().min(1).max(4000);

export const zAnnouncementDraftInput = z
  .object({
    id: z.uuid().optional(),
    title,
    body,
    scope: z.enum(announcementScopes),
    facilities: z.array(z.uuid()).default([]),
    groups: z.array(z.uuid()).default([]),
    roles: z.array(z.enum(announcementRoles)).min(1).max(2),
  })
  .strict()
  .transform((v) => ({
    id: v.id,
    title: v.title,
    body: v.body,
    scope: v.scope,
    ids: v.scope === 'facility' ? [...new Set(v.facilities)] : v.scope === 'group' ? [...new Set(v.groups)] : [],
    roles: [...new Set(v.roles)],
  }))
  .refine((v) => (v.scope === 'organization') === (v.ids.length === 0), { message: 'audience_ids_match_scope', path: ['ids'] });

export const zAnnouncementEditInput = z.object({ id: z.uuid(), title, body }).strict();
export const zAnnouncementIdInput = z.object({ id: z.uuid() }).strict();
