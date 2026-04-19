import translations, { type Lang } from './translations';

export type { Lang };

/** Cookie name used to persist the language choice. */
export const LANG_COOKIE = 'lang';

/** Default language if cookie not set. */
export const DEFAULT_LANG: Lang = 'en';

/**
 * Translate a key.
 * Falls back to the English value, then to the raw key.
 */
export function t(key: string, lang: Lang): string {
  const entry = translations[key];
  if (!entry) return key; // missing key → return key itself
  return entry[lang] ?? entry.en ?? key;
}

/**
 * Get the current language on the SERVER side.
 * Must only be called in Server Components / Server Actions.
 */
export function getServerLang(): Lang {
  // Dynamic import avoidance: next/headers can only be used at module top-level in server code
  // We do a lazy require so this file can also be imported in client components.
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { cookies } = require('next/headers');
    const lang = cookies().get(LANG_COOKIE)?.value;
    if (lang === 'es') return 'es';
    return 'en';
  } catch {
    return 'en';
  }
}

/**
 * Translate a status value for display.
 * E.g. statusLabel('IN_PROGRESS', 'es') → 'EN PROGRESO'
 */
export function statusLabel(status: string, lang: Lang): string {
  const key = `status.${status}`;
  const entry = translations[key];
  if (entry) return entry[lang] ?? status.replace(/_/g, ' ');
  return status.replace(/_/g, ' ');
}
