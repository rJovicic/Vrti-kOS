// Mobile app shell (D1-10): who may see which part of the app. Pure functions over rows the database already
// filtered with RLS — the shell decides presentation and routing, never security (ADR-0005, SR-AUTHZ).

export type OrgRole = 'org_admin' | 'director' | 'educator' | 'guardian';
/** The mobile app has two working modes; managers work in the web admin (FS-02). */
export type MobileMode = 'educator' | 'guardian';

export interface MembershipRow {
  role: OrgRole;
  notice_ack_version: string | null;
  organization: { id: string; name: string; privacy_notice_version: string | null } | null;
}

export interface Kindergarten {
  id: string;
  name: string;
}

/** A kindergarten whose published notice version this person has not acknowledged. */
export interface PendingNotice extends Kindergarten {
  version: string;
}

/** A notice text as stored by the kindergarten (`public.privacy_notices`, readable by its active members). */
export interface PrivacyNotice {
  organizationId: string;
  version: string;
  title: string;
  body: string;
  /** Synthetic demo text: the app must label it as not being a legal notice. */
  isDemo: boolean;
}

export interface Access {
  /** Mobile modes this person may use, educator first (daily work). */
  modes: MobileMode[];
  /** Active only as org_admin/director: the app shows where the work happens instead of empty tabs. */
  managerOnly: boolean;
  kindergartens: Kindergarten[];
  /** Kindergartens whose current privacy notice this person has not acknowledged yet (FR-01-5). */
  noticePending: PendingNotice[];
}

/** Rows must be the caller's own ACTIVE memberships (the query filters status; RLS filters ownership). */
export function deriveAccess(rows: readonly MembershipRow[]): Access {
  const active = rows.filter((r): r is MembershipRow & { organization: NonNullable<MembershipRow['organization']> } => r.organization !== null);
  const roles = new Set(active.map((r) => r.role));
  const modes: MobileMode[] = [];
  if (roles.has('educator')) modes.push('educator');
  if (roles.has('guardian')) modes.push('guardian');
  const kindergartens = unique(active.map((r) => ({ id: r.organization.id, name: r.organization.name })));
  // A kindergarten counts once even if the person has several roles there; every role row must carry the
  // acknowledgement of the current version (the database refuses any other version).
  const pending = new Map<string, PendingNotice>();
  for (const r of active) {
    const published = r.organization.privacy_notice_version;
    if (published !== null && r.notice_ack_version !== published && !pending.has(r.organization.id)) {
      pending.set(r.organization.id, { id: r.organization.id, name: r.organization.name, version: published });
    }
  }
  const noticePending = [...pending.values()].sort((a, b) => a.name.localeCompare(b.name, 'hr'));
  return { modes, managerOnly: active.length > 0 && modes.length === 0, kindergartens, noticePending };
}

function unique(list: Kindergarten[]): Kindergarten[] {
  const seen = new Map<string, Kindergarten>();
  for (const k of list) if (!seen.has(k.id)) seen.set(k.id, k);
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, 'hr'));
}

export type LoadStatus = 'loading' | 'error' | 'expired' | 'loaded';

/** What the signed-in part of the app renders, in order of precedence. Fail closed: anything unknown blocks. */
export type ShellGate =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'sessionExpired' }
  | { kind: 'noMembership' }
  | { kind: 'noticeRequired'; kindergartens: PendingNotice[] }
  | { kind: 'ready'; access: Access };

export function shellGate(status: LoadStatus, access: Access | null): ShellGate {
  if (status === 'expired') return { kind: 'sessionExpired' };
  if (status === 'loading') return { kind: 'loading' };
  if (status === 'error' || access === null) return { kind: 'error' };
  if (access.kindergartens.length === 0) return { kind: 'noMembership' };
  if (access.noticePending.length > 0) return { kind: 'noticeRequired', kindergartens: access.noticePending };
  return { kind: 'ready', access };
}
