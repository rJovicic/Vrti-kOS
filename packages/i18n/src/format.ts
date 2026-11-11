export const DEFAULT_TIME_ZONE = 'Europe/Zagreb';

/** "07:42" in the kindergarten's time zone. */
export function formatTime(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('hr-HR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }).format(date);
}

/** "utorak, 11. studenoga 2026." */
export function formatLongDate(date: Date, timeZone: string = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('hr-HR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone }).format(date);
}

/** Croatian plural category for i18next-style keys (one / few / other). */
export function pluralCategory(n: number): 'one' | 'few' | 'other' {
  return new Intl.PluralRules('hr-HR').select(n) as 'one' | 'few' | 'other';
}

/** Short Croatian calendar date for a plain YYYY-MM-DD value (no time zone shift), e.g. 11. 11. 2026. */
export function formatDay(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y!, m! - 1, d!)),
  );
}
