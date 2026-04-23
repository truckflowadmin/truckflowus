import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Sidebar } from '@/components/Sidebar';
import { NotificationBell } from '@/components/NotificationBell';
import { loadCompanyFeatures, NAV_FEATURE_MAP, getLimitStatus } from '@/lib/features';
import { LanguageProvider } from '@/components/LanguageProvider';
import LimitWarningBanner from '@/components/LimitWarningBanner';
import BillingAlertBanner from '@/components/BillingAlertBanner';
import IdleLogout from '@/components/IdleLogout';
import type { Lang } from '@/lib/i18n';
import { sendBillingEmail } from '@/lib/billing-emails';

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

  // Check subscription status — block if suspended, paused, or trial expired
  let billingAlert: { type: 'trial_ending' | 'payment_overdue'; daysLeft?: number; daysOverdue?: number } | null = null;
  if (session.companyId) {
    try {
      const company = await prisma.$queryRaw<{
        suspended: boolean;
        subscriptionPausedAt: Date | null;
        trialEndsAt: Date | null;
        subscriptionStatus: string | null;
        nextPaymentDue: Date | null;
        gracePeriodDays: number;
        autoSuspendOnOverdue: boolean;
        planId: string | null;
      }[]>`
        SELECT "suspended", "subscriptionPausedAt", "trialEndsAt",
               "subscriptionStatus", "nextPaymentDue", "gracePeriodDays",
               "autoSuspendOnOverdue", "planId"
        FROM "Company" WHERE "id" = ${session.companyId} LIMIT 1
      `;
      const co = company[0];
      if (co?.suspended) {
        redirect('/suspended?reason=suspended');
      }
      if (co?.subscriptionPausedAt) {
        redirect('/suspended?reason=paused');
      }

      // Trial expiration enforcement
      if (co?.trialEndsAt) {
        const now = new Date();
        const trialEnd = new Date(co.trialEndsAt);
        const daysLeft = Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000);

        if (daysLeft <= 0 && co.subscriptionStatus !== 'ACTIVE') {
          // Trial expired and no active subscription — redirect to subscribe
          redirect('/subscribe?billing=trial_expired');
        }

        if (daysLeft > 0 && daysLeft <= 3 && co.subscriptionStatus !== 'ACTIVE') {
          billingAlert = { type: 'trial_ending', daysLeft };
          // Send trial ending email (idempotent — only sends once per day via console log dedup)
          if (daysLeft === 3) {
            sendBillingEmail(session.companyId, 'trial_ending', { trialEndsAt: trialEnd }).catch(() => {});
          }
        }
      }

      // Grace period / overdue enforcement
      if (co?.nextPaymentDue && co.subscriptionStatus !== 'ACTIVE') {
        const now = new Date();
        const due = new Date(co.nextPaymentDue);
        const daysOverdue = Math.floor((now.getTime() - due.getTime()) / 86400000);

        if (daysOverdue > 0) {
          billingAlert = { type: 'payment_overdue', daysOverdue };

          // Auto-suspend if past grace period
          if (co.autoSuspendOnOverdue && daysOverdue > co.gracePeriodDays) {
            const suspendNow = new Date();
            await prisma.$executeRaw`
              UPDATE "Company"
              SET "suspended" = true,
                  "suspendedAt" = ${suspendNow},
                  "subscriptionPausedAt" = ${suspendNow}
              WHERE "id" = ${session.companyId} AND "suspended" = false
            `;
            sendBillingEmail(session.companyId, 'account_suspended').catch(() => {});
            redirect('/suspended?reason=suspended');
          }
        }
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

  // Check plan limits for warning banner
  let limitStatus: Awaited<ReturnType<typeof getLimitStatus>> | null = null;
  if (session.companyId) {
    try {
      limitStatus = await getLimitStatus(session.companyId);
    } catch {
      // Columns may not exist yet — skip
    }
  }

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
          {/* Billing alert banner (trial ending / payment overdue) */}
          {billingAlert && (
            <BillingAlertBanner
              type={billingAlert.type}
              daysLeft={billingAlert.daysLeft}
              daysOverdue={billingAlert.daysOverdue}
              lang={lang}
            />
          )}
          {/* Plan limit warning banner */}
          {limitStatus && (limitStatus.driversOver || limitStatus.ticketsOver) && (
            <LimitWarningBanner
              maxDrivers={limitStatus.maxDrivers}
              maxTicketsPerMonth={limitStatus.maxTicketsPerMonth}
              currentDrivers={limitStatus.currentDrivers}
              currentMonthTickets={limitStatus.currentMonthTickets}
              driversOver={limitStatus.driversOver}
              ticketsOver={limitStatus.ticketsOver}
              planName={limitStatus.planName}
              lang={lang}
            />
          )}
          {children}
        </main>
      </div>
    </LanguageProvider>
  );
}
