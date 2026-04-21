'use client';

/**
 * EN / ES toggle for the public marketing pages.
 * Reads/writes the 'lang' cookie directly (same as the app toggle).
 */
export default function PublicLanguageToggle() {
  function getLang(): 'en' | 'es' {
    if (typeof document === 'undefined') return 'en';
    const match = document.cookie.match(/(?:^|;\s*)lang=(en|es)/);
    return (match?.[1] as 'en' | 'es') ?? 'en';
  }

  function switchTo(l: 'en' | 'es') {
    document.cookie = `lang=${l};path=/;max-age=${365 * 86400};SameSite=Lax`;
    window.location.href = window.location.pathname + window.location.search;
  }

  const lang = getLang();

  return (
    <div className="inline-flex items-center rounded-lg p-0.5 gap-0.5 bg-steel-800/60 border border-steel-700">
      <button
        type="button"
        onClick={() => switchTo('en')}
        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
          lang === 'en'
            ? 'bg-safety text-diesel shadow-sm'
            : 'text-steel-400 hover:text-white hover:bg-steel-700'
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo('es')}
        className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all duration-150 cursor-pointer ${
          lang === 'es'
            ? 'bg-safety text-diesel shadow-sm'
            : 'text-steel-400 hover:text-white hover:bg-steel-700'
        }`}
      >
        ES
      </button>
    </div>
  );
}
