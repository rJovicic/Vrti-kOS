import { describe, expect, it } from 'vitest';
import { formatDay, formatLongDate, formatTime, pluralCategory } from './format.ts';
import { hr } from './locales/hr.ts';

describe('Croatian formatting', () => {
  it('formats time in Europe/Zagreb, 24h', () => {
    expect(formatTime(new Date('2026-11-11T06:42:00Z'))).toBe('07:42');
  });
  it('formats a long date with Croatian month genitive', () => {
    expect(formatLongDate(new Date('2026-11-11T10:00:00Z'))).toContain('studenoga');
  });
  it('uses Croatian plural categories', () => {
    expect([1, 3, 5, 21, 22, 25].map(pluralCategory)).toEqual(['one', 'few', 'other', 'one', 'few', 'other']);
  });
  it('keeps diacritics intact in the catalog', () => {
    expect(hr.attendance.present).toBe('U vrtiću');
    expect(JSON.stringify(hr)).toMatch(/[čćđšž]/);
  });
});

describe('formatDay', () => {
  it('formats a plain date without shifting the day', () => {
    expect(formatDay('2026-11-30').replace(/\s/g, ' ')).toMatch(/^30\. ?11\. ?2026\.?$/);
  });
});
