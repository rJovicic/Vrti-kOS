import { createRandom } from './random.ts';
import { givenNames, surnames } from './names.ts';

export const EMAIL_DOMAIN = 'demo.vrtic.test'; // reserved .test TLD — mail can never be delivered

export type Role = 'org_admin' | 'director' | 'educator' | 'guardian';

export interface Person {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  memberships: { orgKey: OrgKey; role: Role }[];
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
}

export interface World {
  orgs: Org[];
  people: Person[];
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
  return { orgs, people };
}
