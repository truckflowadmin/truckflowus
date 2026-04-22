import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { SuperadminSidebar } from '@/components/SuperadminSidebar';
import { LanguageProvider } from '@/components/LanguageProvider';
import IdleLogout from '@/components/IdleLogout';
import type { Lang } from '@/lib/i18n';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'SUPERADMIN') redirect('/dashboard');

  const lang = (cookies().get('lang')?.value === 'es' ? 'es' : 'en') as Lang;

  return (
    <LanguageProvider initialLang={lang}>
      <IdleLogout />
      <div className="min-h-screen lg:flex bg-[#0f0719]">
        <SuperadminSidebar user={{ name: session.name, email: session.email }} />
        <main className="flex-1 overflow-x-hidden min-w-0 text-steel-100">{children}</main>
      </div>
    </LanguageProvider>
  );
}
