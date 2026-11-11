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
