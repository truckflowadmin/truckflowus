'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Lang } from '@/lib/i18n';
import translations from '@/lib/i18n/translations';

interface LanguageCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  statusLabel: (status: string) => string;
}

const LanguageContext = createContext<LanguageCtx>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
  statusLabel: (s) => s.replace(/_/g, ' '),
});

export function LanguageProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    // Persist to cookie so server components pick it up on next request
    document.cookie = `lang=${l};path=/;max-age=${365 * 86400};SameSite=Lax`;
    // Reload so server components re-render with new language
    window.location.reload();
  }, []);

  const tFn = useCallback(
    (key: string) => {
      const entry = translations[key];
      if (!entry) return key;
      return entry[lang] ?? entry.en ?? key;
    },
    [lang],
  );

  const statusLabelFn = useCallback(
    (status: string) => {
      const key = `status.${status}`;
      const entry = translations[key];
      if (entry) return entry[lang] ?? status.replace(/_/g, ' ');
      return status.replace(/_/g, ' ');
    },
    [lang],
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: tFn, statusLabel: statusLabelFn }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook for client components to read & change language.
 */
export function useLanguage() {
  return useContext(LanguageContext);
}
