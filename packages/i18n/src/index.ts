import { hr } from './locales/hr.ts';

export { hr, type Catalog } from './locales/hr.ts';
export { it } from './locales/it.ts';
export { formatTime, formatLongDate, pluralCategory, DEFAULT_TIME_ZONE } from './format.ts';

/** i18next resources object. Croatian is the source and fallback language. */
export const resources = { hr: { translation: hr } } as const;
export const fallbackLng = 'hr';
