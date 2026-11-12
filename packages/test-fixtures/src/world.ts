import { createRandom } from './random.ts';
import { givenNames, surnames } from './names.ts';

export const EMAIL_DOMAIN = 'demo.vrtic.test'; // reserved .test TLD — mail can never be delivered

export type Role = 'org_admin' | 'director' | 'educator' | 'guardian';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  memberships: { orgKey: OrgKey; role: Role; id?: string }[];
  platformAdmin?: boolean;
}

export type OrgKey = 'alfa' | 'beta';

export interface Org {
  key: OrgKey;
  id: string;
  name: string;
  slug: string;
  facilities: { id: string; name: string; address: string }[];
  academicYear: { id: string; name: string; startsOn: string; endsOn: string };
  groups: { id: string; name: string; facilityIndex: number; capacity: number }[];
  /** Synthetic privacy notice published by this kindergarten (FR-01-5 demo). Never a real legal text. */
  privacyNotice?: { version: string; title: string; body: string };
}

/**
 * Demo notice text: says plainly that it is not a legal notice and makes no statement about real processing.
 * The real notice is written and published by each kindergarten as the controller (FR-01-5, ⚖️).
 */
export const DEMO_PRIVACY_NOTICE = {
  version: 'demo-2026-11',
  title: 'Obavijest o privatnosti (DEMO)',
  body: [
    'OVO NIJE PRAVNA OBAVIJEST. Tekst je izmišljen za demonstraciju aplikacije VrtićOS i ne opisuje stvarnu obradu osobnih podataka.',
    'Stvarnu obavijest o privatnosti piše i objavljuje vrtić kao voditelj obrade. Aplikacija je prikazuje prije prvog prikaza podataka i bilježi da ste je pročitali, zajedno s verzijom teksta.',
    'Potvrda čitanja nije privola.',
  ].join('\n\n'),
};

export interface Assignment {
  id: string;
  orgKey: OrgKey;
  membershipId: string;
  groupId: string;
  type: 'regular' | 'substitute';
  /** Substitutes are relative to the day the seed is loaded, so the demo always shows one in effect. */
  days?: { fromToday: number; toToday: number };
  approvedBy?: string;
}

export interface Invitation {
  id: string;
  orgKey: OrgKey;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  state: 'pending' | 'expired' | 'revoked';
  createdBy: string;
}

export interface World {
  orgs: Org[];
  people: Person[];
  assignments: Assignment[];
  invitations: Invitation[];
}

/** Builds the synthetic demo world (kindergartens Alfa and Beta). Same seed → same world. */
export function buildWorld(seed = 20261111): World {
  const r = createRandom(seed);
  const year = { name: '2026./2027.', startsOn: '2026-09-01', endsOn: '2027-08-31' };
  const orgs: Org[] = [
    {
      key: 'alfa', id: r.uuid(), name: 'Vrtić Alfa (demo)', slug: 'alfa-demo',
      facilities: [
        { id: r.uuid(), name: 'Objekt Maslina', address: 'Ulica izmišljena 1, Demo grad' },
        { id: r.uuid(), name: 'Objekt Lavanda', address: 'Ulica izmišljena 7, Demo grad' },
      ],
      academicYear: { id: r.uuid(), ...year },
      groups: [
        { id: r.uuid(), name: 'Galebovi', facilityIndex: 0, capacity: 20 },
        { id: r.uuid(), name: 'Školjke', facilityIndex: 0, capacity: 18 },
        { id: r.uuid(), name: 'Jedrilice', facilityIndex: 1, capacity: 22 },
        { id: r.uuid(), name: 'Sunčice', facilityIndex: 1, capacity: 16 },
      ],
    },
    {
      key: 'beta', id: r.uuid(), name: 'Vrtić Beta (demo)', slug: 'beta-demo',
      privacyNotice: DEMO_PRIVACY_NOTICE,
      facilities: [{ id: r.uuid(), name: 'Objekt Bura', address: 'Trg izmišljeni 3, Demo selo' }],
      academicYear: { id: r.uuid(), ...year },
      groups: [
        { id: r.uuid(), name: 'Borovi', facilityIndex: 0, capacity: 20 },
        { id: r.uuid(), name: 'Kamenčići', facilityIndex: 0, capacity: 15 },
      ],
    },
  ];

  const people: Person[] = [];
  const used = new Set<string>();
  const person = (local: string, memberships: Person['memberships'], platformAdmin = false): Person => {
    let firstName: string, lastName: string;
    do {
      firstName = r.pick(givenNames);
      lastName = r.pick(surnames);
    } while (used.has(`${firstName} ${lastName}`));
    used.add(`${firstName} ${lastName}`);
    const p: Person = { id: r.uuid(), firstName, lastName, email: `${local}@${EMAIL_DOMAIN}`, memberships, ...(platformAdmin ? { platformAdmin } : {}) };
    people.push(p);
    return p;
  };

  person('platforma', [], true);
  for (const org of orgs) {
    person(`uprava.${org.key}`, [{ orgKey: org.key, role: 'org_admin' }]);
    if (org.key === 'alfa') person(`ravnateljica.${org.key}`, [{ orgKey: org.key, role: 'director' }]);
    org.groups.forEach((_, i) => person(`odgojitelj.${org.key}.${i + 1}`, [{ orgKey: org.key, role: 'educator' }]));
    const guardians = org.key === 'alfa' ? 12 : 6;
    for (let i = 1; i <= guardians; i++) person(`roditelj.${org.key}.${i}`, [{ orgKey: org.key, role: 'guardian' }]);
  }
  // A guardian with children in both kindergartens (multi-tenant user, NEG-02).
  person('roditelj.oba', [{ orgKey: 'alfa', role: 'guardian' }, { orgKey: 'beta', role: 'guardian' }]);

  // D1 additions — generated after all D0 entities so existing ids stay stable.
  for (const p of people) for (const m of p.memberships) m.id = r.uuid();
  const membership = (local: string, orgKey: OrgKey) =>
    people.find((p) => p.email === `${local}@${EMAIL_DOMAIN}`)!.memberships.find((m) => m.orgKey === orgKey)!.id!;
  const manager = (orgKey: OrgKey) => people.find((p) => p.email === `uprava.${orgKey}@${EMAIL_DOMAIN}`)!.id;

  const assignments: Assignment[] = [];
  for (const org of orgs) {
    org.groups.forEach((g, i) => {
      assignments.push({ id: r.uuid(), orgKey: org.key, membershipId: membership(`odgojitelj.${org.key}.${i + 1}`, org.key), groupId: g.id, type: 'regular' });
    });
  }
  // Odgojitelj Alfa 1 covers Sunčice this week as an approved substitute (FR-03-3).
  const alfa = orgs[0]!;
  assignments.push({
    id: r.uuid(), orgKey: 'alfa', membershipId: membership('odgojitelj.alfa.1', 'alfa'), groupId: alfa.groups[3]!.id,
    type: 'substitute', days: { fromToday: 0, toToday: 5 }, approvedBy: manager('alfa'),
  });

  const invitations: Invitation[] = (['pending', 'expired', 'revoked'] as const).map((state, i) => {
    const firstName = r.pick(givenNames);
    const lastName = r.pick(surnames);
    return { id: r.uuid(), orgKey: 'alfa', email: `pozvan.alfa.${i + 1}@${EMAIL_DOMAIN}`, role: i === 0 ? 'educator' : 'guardian', firstName, lastName, state, createdBy: manager('alfa') };
  });
  return { orgs, people, assignments, invitations };
}
