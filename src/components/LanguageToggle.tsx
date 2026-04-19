'use client';

import { useLanguage } from './LanguageProvider';

/**
 * A small EN / ES toggle for the sidebar.
 * `variant` controls colour scheme:
 *   - "dispatcher" (dark steel sidebar)
 *   - "superadmin" (dark purple sidebar)
 *   - "driver" (light mobile theme)
 */
export default function LanguageToggle({ variant = 'dispatcher' }: { variant?: 'dispatcher' | 'superadmin' | 'driver' }) {
  const { lang, setLang } = useLanguage();

  const baseClasses = 'px-2.5 py-1 text-xs font-semibold rounded transition-colors';

  const styles = {
    dispatcher: {
      active: 'bg-safety text-diesel',
      inactive: 'bg-steel-800 text-steel-400 hover:text-steel-200',
      container: '',
    },
    superadmin: {
      active: 'bg-purple-600 text-white',
      inactive: 'bg-purple-950 text-purple-400 hover:text-purple-200',
      container: '',
    },
    driver: {
      active: 'bg-safety text-diesel',
      inactive: 'bg-steel-200 text-steel-600 hover:text-steel-800',
      container: '',
    },
  };

  const s = styles[variant];

  return (
    <div className={`flex items-center gap-1 ${s.container}`}>
      <button
        onClick={() => lang !== 'en' && setLang('en')}
        className={`${baseClasses} ${lang === 'en' ? s.active : s.inactive}`}
        aria-label="English"
      >
        EN
      </button>
      <button
        onClick={() => lang !== 'es' && setLang('es')}
        className={`${baseClasses} ${lang === 'es' ? s.active : s.inactive}`}
        aria-label="Español"
      >
        ES
      </button>
    </div>
  );
}
