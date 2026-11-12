import { describe, expect, it } from 'vitest';
import { toSeedSql } from './sql.ts';
import { buildWorld, EMAIL_DOMAIN } from './world.ts';

describe('synthetic world', () => {
  it('is deterministic', () => {
    expect(toSeedSql(buildWorld())).toBe(toSeedSql(buildWorld()));
  });
  it('only uses the reserved .test domain', () => {
    expect(buildWorld().people.every((p) => p.email.endsWith(`@${EMAIL_DOMAIN}`))).toBe(true);
  });
  it('has unique ids and names', () => {
    const w = buildWorld();
    const ids = [...w.people.map((p) => p.id), ...w.orgs.flatMap((o) => [o.id, ...o.groups.map((g) => g.id)])];
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(w.people.map((p) => `${p.firstName} ${p.lastName}`)).size).toBe(w.people.length);
  });
  it('assigns every educator to exactly one regular group and has one bounded substitute', () => {
    const w = buildWorld();
    const regular = w.assignments.filter((a) => a.type === 'regular');
    expect(regular).toHaveLength(w.orgs.reduce((n, o) => n + o.groups.length, 0));
    const subs = w.assignments.filter((a) => a.type === 'substitute');
    expect(subs).toHaveLength(1);
    expect(subs[0]!.days && subs[0]!.approvedBy).toBeTruthy();
  });
  it('children are enrolled in a group of their own kindergarten, five per group, with unique names', () => {
    const w = buildWorld();
    const enrolled = w.children.filter((c) => c.groupId !== null);
    for (const c of enrolled) expect(w.orgs.find((o) => o.key === c.orgKey)!.groups.some((g) => g.id === c.groupId)).toBe(true);
    expect(enrolled).toHaveLength(w.orgs.reduce((n, o) => n + o.groups.length, 0) * 5);
    expect(w.children.filter((c) => c.groupId === null)).toHaveLength(1);
    expect(new Set(w.children.map((c) => `${c.firstName} ${c.lastName}`)).size).toBe(w.children.length);
  });
  it('guardian links stay inside one kindergarten and cover several guardians per child and several children per guardian', () => {
    const w = buildWorld();
    for (const l of w.guardianLinks) {
      expect(w.children.find((c) => c.id === l.childId)!.orgKey).toBe(l.orgKey);
      expect(w.guardians.find((g) => g.id === l.guardianId)!.orgKey).toBe(l.orgKey);
    }
    const perChild = new Map<string, number>();
    const perGuardian = new Map<string, number>();
    for (const l of w.guardianLinks) {
      perChild.set(l.childId, (perChild.get(l.childId) ?? 0) + 1);
      perGuardian.set(l.guardianId, (perGuardian.get(l.guardianId) ?? 0) + 1);
    }
    expect(Math.max(...perChild.values())).toBeGreaterThan(1);
    expect(Math.max(...perGuardian.values())).toBeGreaterThan(1);
    expect(w.children.some((c) => c.groupId === null && w.guardianLinks.some((l) => l.childId === c.id))).toBe(true);
    expect(new Set(w.guardianLinks.map((l) => `${l.childId}:${l.guardianId}`)).size).toBe(w.guardianLinks.length);
  });
  it('assignments never cross kindergartens', () => {
    const w = buildWorld();
    for (const a of w.assignments) {
      expect(w.orgs.find((o) => o.key === a.orgKey)!.groups.some((g) => g.id === a.groupId)).toBe(true);
      const owner = w.people.find((p) => p.memberships.some((m) => m.id === a.membershipId))!;
      expect(owner.memberships.find((m) => m.id === a.membershipId)!.orgKey).toBe(a.orgKey);
    }
  });
  it('has pending, expired and revoked invitations on the .test domain', () => {
    const w = buildWorld();
    expect(w.invitations.map((i) => i.state).sort()).toEqual(['expired', 'pending', 'revoked']);
    expect(w.invitations.every((i) => i.email.endsWith(`@${EMAIL_DOMAIN}`))).toBe(true);
  });
  it('contains a multi-kindergarten guardian and a platform admin', () => {
    const w = buildWorld();
    expect(w.people.some((p) => p.memberships.length === 2)).toBe(true);
    expect(w.people.filter((p) => p.platformAdmin)).toHaveLength(1);
  });
  it('pickup authorizations belong to a child of the same kindergarten and carry names only', () => {
    const w = buildWorld();
    expect(w.pickupAuthorizations.length).toBeGreaterThan(0);
    for (const a of w.pickupAuthorizations) {
      expect(w.children.find((c) => c.id === a.childId)!.orgKey).toBe(a.orgKey);
      expect(Object.keys(a).sort()).toEqual(['childId', 'firstName', 'id', 'lastName', 'orgKey']);
    }
  });
});
