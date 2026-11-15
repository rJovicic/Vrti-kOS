import { describe, expect, it } from 'vitest';
import { zAnnouncementDraftInput, zAnnouncementEditInput } from './announcements.ts';

const g = '0b1f6f6e-0000-4000-8000-000000000001';

describe('admin announcement forms (D4-C)', () => {
  it('limits are 120 / 4,000 characters (AC-07-5)', () => {
    expect(() => zAnnouncementEditInput.parse({ id: g, title: 'x'.repeat(121), body: 'y' })).toThrow();
    expect(() => zAnnouncementEditInput.parse({ id: g, title: 'x', body: 'y'.repeat(4001) })).toThrow();
    expect(() => zAnnouncementEditInput.parse({ id: g, title: '  ', body: 'y' })).toThrow();
  });

  it('the audience ids follow the scope; roles are guardians and/or staff', () => {
    const v = zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'group', groups: [g, g], facilities: [g], roles: ['guardians'] });
    expect(v.ids).toEqual([g]);
    expect(() => zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'group', roles: ['guardians'] })).toThrow();
    expect(zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'organization', groups: [g], roles: ['staff'] }).ids).toEqual([]);
    expect(() => zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'organization', roles: [] })).toThrow();
    expect(() => zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'organization', roles: ['parents'] })).toThrow();
  });

  it('no attachment or urgent field is accepted (FR-07-2, FR-07-6)', () => {
    expect(() => zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'organization', roles: ['staff'], urgent: 'on' })).toThrow();
    expect(() => zAnnouncementDraftInput.parse({ title: 'Izlet', body: 'Tekst', scope: 'organization', roles: ['staff'], attachment: 'x' })).toThrow();
  });
});
