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
  it('contains a multi-kindergarten guardian and a platform admin', () => {
    const w = buildWorld();
    expect(w.people.some((p) => p.memberships.length === 2)).toBe(true);
    expect(w.people.filter((p) => p.platformAdmin)).toHaveLength(1);
  });
});
