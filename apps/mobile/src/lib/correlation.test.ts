import { describe, expect, it } from 'vitest';
import { CORRELATION_ID_PATTERN, newCorrelationId } from './correlation';

describe('mobile correlation ids', () => {
  it('match the format the database and Edge Functions accept', () => {
    for (let i = 0; i < 200; i++) expect(newCorrelationId()).toMatch(CORRELATION_ID_PATTERN);
  });
  it('are distinct per action and carry no personal data (only a prefix, time and random characters)', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newCorrelationId()));
    expect(ids.size).toBe(500);
    expect(newCorrelationId(0, () => 0)).toBe('mob-0-0000000000000000');
  });
});
