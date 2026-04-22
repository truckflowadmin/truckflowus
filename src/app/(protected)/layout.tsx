import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { loadCompanyFeatures, NAV_FEATURE_MAP } from '@/lib/features';
import { LanguageProvider } from '@/components/LanguageProvider';
import IdleLogout from '@/components/IdleLogout';
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

  // Check subscription status — block if suspended or paused
  if (session.companyId) {
    try {
      const company = await prisma.$queryRaw<{ suspended: boolean; subscriptionPausedAt: Date | null }[]>`
        SELECT "suspended", "subscriptionPausedAt" FROM "Company" WHERE "id" = ${session.companyId} LIMIT 1
      `;
      const co = company[0];
      if (co?.suspended) {
        redirect('/suspended?reason=suspended');
      }
      if (co?.subscriptionPausedAt) {
        redirect('/suspended?reason=paused');
      }
    } catch {
      // Columns may not exist yet — skip check
    }
  }

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
      <IdleLogout />
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
