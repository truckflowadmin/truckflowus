'use client';

import { useState, useCallback } from 'react';
import translations from '@/lib/i18n/translations';
import type { Lang } from '@/lib/i18n/translations';

/**
 * Lightweight hook for public pages. Reads language from cookie.
 * Returns { lang, t } — no context provider needed.
 */
export function usePublicLang() {
  const [lang] = useState<Lang>(() => {
    if (typeof document === 'undefined') return 'en';
    const match = document.cookie.match(/(?:^|;\s*)lang=(en|es)/);
    return (match?.[1] as Lang) ?? 'en';
  });

  const t = useCallback(
    (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] ?? entry.en ?? key;
    },
    [lang],
  );

  return { lang, t };
}
