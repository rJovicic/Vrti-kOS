/** MVP organization roles (roles-and-permissions.md, DD-05). Platform admin is not a membership role. */
export const orgRoles = ['org_admin', 'director', 'educator', 'guardian'] as const;
export type OrgRole = (typeof orgRoles)[number];

/** A-03: org_admin and director share one permission set in the MVP. */
export const managerRoles: readonly OrgRole[] = ['org_admin', 'director'];
