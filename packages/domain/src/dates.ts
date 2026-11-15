/** Local calendar date (YYYY-MM-DD) of an instant in the kindergarten's time zone. Mirrors SQL private.org_today(). */
export function orgLocalDate(instant: Date, timeZone = 'Europe/Zagreb'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** UI shows inclusive end dates; the database stores half-open [from, to). */
export function inclusiveEndToExclusive(endInclusive: string): string {
  const d = new Date(`${endInclusive}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function exclusiveEndToInclusive(endExclusive: string): string {
  const d = new Date(`${endExclusive}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** A Postgres `daterange` as dates the UI understands: inclusive start, inclusive end (null = open). */
export interface DateSpan {
  from: string | null;
  toInclusive: string | null;
}

/** Parses PostgREST's canonical daterange text, e.g. `[2026-09-01,2026-11-12)` or `[2026-09-01,)`. */
export function parseDateRange(text: string): DateSpan | null {
  const m = /^([[(])(\d{4}-\d{2}-\d{2})?,(\d{4}-\d{2}-\d{2})?([\])])$/.exec(text.trim());
  if (!m) return null;
  const [, , lower, upper, upperBracket] = m;
  return {
    from: lower ?? null,
    toInclusive: upper ? (upperBracket === ']' ? upper : exclusiveEndToInclusive(upper)) : null,
  };
}

/** Builds a canonical half-open daterange literal from an inclusive span. */
export function toDateRange(from: string, toInclusive: string | null): string {
  return `[${from},${toInclusive ? inclusiveEndToExclusive(toInclusive) : ''})`;
}

/** True if `day` (YYYY-MM-DD) lies within the span. */
export function spanContains(span: DateSpan, day: string): boolean {
  return (span.from === null || span.from <= day) && (span.toInclusive === null || day <= span.toInclusive);
}

/** Minutes the time zone is ahead of UTC at `instant` (e.g. 60 for Zagreb in winter, 120 in summer). */
export function timeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The instant of a wall-clock time (`HH:MM`) on a calendar day in the kindergarten's time zone, as ISO UTC. Used when a
 * manager types the time of an event. Re-checks the offset after the first guess so DST changes are handled.
 */
export function zonedTimeToIso(day: string, time: string, timeZone = 'Europe/Zagreb'): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!d || !t) throw new Error('invalid day or time');
  const guess = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  let utc = guess - timeZoneOffsetMinutes(new Date(guess), timeZone) * 60_000;
  const second = guess - timeZoneOffsetMinutes(new Date(utc), timeZone) * 60_000;
  if (second !== utc) utc = second;
  return new Date(utc).toISOString();
}
