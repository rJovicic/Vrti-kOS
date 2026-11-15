import { describe, expect, it } from 'vitest';
import { hr } from './locales/hr.ts';
import { notificationTypes, pushPayload } from './push.ts';

// ST-PUSH-01 / AC-07-4: every push template rendered; no payload contains a name, group, title, text or sender.
const synthetic = ['Lea', 'Babić', 'Galebovi', 'Objekt Maslina', 'Ana Skrbnik', 'Izlet u petak', 'temperatura', 'Dječji vrtić Alfa'];
const id = '00000000-0000-4000-8000-000000000001';

describe('push payloads (SR-PUSH-01)', () => {
  it('every type has a generic text without placeholders', () => {
    for (const type of notificationTypes) {
      expect(hr.push.types[type]).toMatch(/\S/);
      expect(hr.push.types[type]).not.toMatch(/\{\{|\}\}/);
    }
    expect(hr.push.title).not.toMatch(/\{\{/);
  });

  it('a payload holds only the generic text and the opaque id — no synthetic personal data can appear', () => {
    for (const type of notificationTypes) {
      const json = JSON.stringify(pushPayload(type, id));
      for (const word of synthetic) expect(json).not.toContain(word);
      expect(Object.keys(pushPayload(type, id).data)).toEqual(['notificationId']);
    }
  });

  it('refuses anything but an id as data', () => {
    expect(() => pushPayload('message.received', 'Lea Babić')).toThrow();
  });
});
