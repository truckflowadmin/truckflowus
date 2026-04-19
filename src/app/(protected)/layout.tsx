import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { loadCompanyFeatures, NAV_FEATURE_MAP } from '@/lib/features';
import { LanguageProvider } from '@/components/LanguageProvider';
import type { Lang } from '@/lib/i18n';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  // Superadmins live at /sa/*; bounce them there so they can't accidentally
  // edit a single tenant's data via dispatcher routes.
  if (session.role === 'SUPERADMIN') redirect('/sa/overview');

  // Check if user must re-set security questions (cleared by superadmin)
  try {
    const rows = await prisma.$queryRaw<{ mustSetSecurityQuestions: boolean }[]>`
      SELECT "mustSetSecurityQuestions" FROM "User" WHERE "id" = ${session.userId} LIMIT 1
    `;
    if (rows[0]?.mustSetSecurityQuestions) {
      redirect('/settings?setupSQ=1');
    }
  } catch {
    // Column may not exist yet — skip check
  }

  // Resolve which sidebar tabs the company's plan unlocks.
  const has = await loadCompanyFeatures(session.companyId!);
  const unlockedTabs: Record<string, boolean> = {};
  for (const [href, featureKey] of Object.entries(NAV_FEATURE_MAP)) {
    unlockedTabs[href] = has(featureKey);
  }

  const lang = (cookies().get('lang')?.value === 'es' ? 'es' : 'en') as Lang;

  return (
    <LanguageProvider initialLang={lang}>
      <div className="min-h-screen lg:flex">
        <Sidebar user={{ name: session.name, email: session.email }} unlockedTabs={unlockedTabs} />
        <main className="flex-1 overflow-x-hidden min-w-0 lg:pr-14">
          {/* Desktop notification bell — fixed top right */}
          <div className="hidden lg:block fixed top-4 right-4 z-50">
            <NotificationBell />
          </div>
          {children}
        </main>
      </div>
    </LanguageProvider>
  );
}
