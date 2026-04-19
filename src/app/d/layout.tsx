import { cookies } from 'next/headers';
import { LanguageProvider } from '@/components/LanguageProvider';
import type { Lang } from '@/lib/i18n';

export default function DriverRootLayout({ children }: { children: React.ReactNode }) {
  const lang = (cookies().get('lang')?.value === 'es' ? 'es' : 'en') as Lang;
  return (
    <LanguageProvider initialLang={lang}>
      {children}
    </LanguageProvider>
  );
}
