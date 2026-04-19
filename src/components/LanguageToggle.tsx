'use client';

/**
 * Standalone EN / ES toggle that sets a cookie and hard-navigates.
 * Does NOT depend on LanguageProvider context — reads/writes the cookie directly
 * so it works even if the provider isn't mounted or context is stale.
 */
export default function LanguageToggle({ variant = 'dispatcher' }: { variant?: 'dispatcher' | 'superadmin' | 'driver' }) {
  // Read current lang directly from the cookie (not from context)
  function getLang(): 'en' | 'es' {
    if (typeof document === 'undefined') return 'en';
    const match = document.cookie.match(/(?:^|;\s*)lang=(en|es)/);
    return (match?.[1] as 'en' | 'es') ?? 'en';
  }

  function switchTo(l: 'en' | 'es') {
    // Set the cookie
    document.cookie = `lang=${l};path=/;max-age=${365 * 86400};SameSite=Lax`;
    // Force full page reload with cache-bust to ensure server reads the new cookie
    window.location.href = window.location.pathname + window.location.search;
  }

  const lang = getLang();

  const themes = {
    dispatcher: {
      wrapper: 'bg-steel-800/60 border border-steel-700',
      active: 'bg-safety text-diesel shadow-sm',
      inactive: 'text-steel-400 hover:text-white hover:bg-steel-700',
    },
    superadmin: {
      wrapper: 'bg-purple-950/60 border border-purple-800',
      active: 'bg-purple-500 text-white shadow-sm',
      inactive: 'text-purple-400 hover:text-white hover:bg-purple-800',
    },
    driver: {
      wrapper: 'bg-steel-100 border border-steel-300',
      active: 'bg-safety text-diesel shadow-sm',
      inactive: 'text-steel-500 hover:text-steel-800 hover:bg-steel-200',
    },
  };

  const th = themes[variant];

  return (
    <div className={`inline-flex items-center rounded-lg p-0.5 gap-0.5 ${th.wrapper}`}>
      <button
        type="button"
        onClick={() => switchTo('en')}
        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
          lang === 'en' ? th.active : th.inactive
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo('es')}
        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
          lang === 'es' ? th.active : th.inactive
        }`}
      >
        ES
      </button>
    </div>
  );
}
