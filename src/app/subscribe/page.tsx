import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { formatPrice, FEATURE_CATALOG } from '@/lib/features';
import DismissibleBanner from '@/components/DismissibleBanner';
import SubscribeButton from '@/components/SubscribeButton';

export const metadata: Metadata = {
  title: 'Plans & Pricing — Dump Truck Software',
  description:
    'Affordable dump truck dispatch software plans for hauling companies of all sizes. Includes ticketing, dispatch, invoicing, fleet management, and driver mobile portal.',
  alternates: { canonical: '/subscribe' },
};

export const dynamic = 'force-dynamic';

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: { billing?: string };
}) {
  const session = await getSession();
  if (!session || !session.companyId) redirect('/login');
  const companyId = session.companyId;

  const [company, plans] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: true },
    }),
    prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  if (!company) redirect('/login');

  // Check which plans have PayPal configured
  let paypalPlanMap: Record<string, string> = {};
  try {
    const rows = await prisma.$queryRaw<{ id: string; paypalPlanId: string | null }[]>`
      SELECT "id", "paypalPlanId" FROM "Plan" WHERE "active" = true
    `;
    for (const r of rows) {
      if (r.paypalPlanId) paypalPlanMap[r.id] = r.paypalPlanId;
    }
  } catch { /* fields may not exist yet */ }

  // Check subscription status
  let subscriptionStatus: string | null = null;
  try {
    const rows = await prisma.$queryRaw<{ subscriptionStatus: string | null }[]>`
      SELECT "subscriptionStatus" FROM "Company" WHERE "id" = ${companyId} LIMIT 1
    `;
    subscriptionStatus = rows[0]?.subscriptionStatus ?? null;
  } catch { }

  const hasPlan = !!company.planId;
  const isActive = subscriptionStatus === 'ACTIVE';

  // Dispatcher feature highlights per plan
  const dispatcherFeatures = FEATURE_CATALOG.filter((f) => f.side === 'dispatcher');

  return (
    <div className="min-h-screen bg-steel-100">
      {/* Header */}
      <header className="bg-diesel text-white px-6 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-lg">
              TF
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Choose Your Plan</h1>
              <p className="text-steel-400 text-sm">{company.name}</p>
            </div>
          </div>
          {!hasPlan ? (
            <p className="text-steel-300 text-sm max-w-xl">
              Select a subscription plan and pay with PayPal to get started immediately.
            </p>
          ) : (
            <p className="text-steel-300 text-sm max-w-xl">
              You're currently on the <span className="text-safety font-semibold">{company.plan?.name}</span> plan.
              {isActive ? ' Your subscription is active.' : ' Select a plan below to subscribe.'}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Success banner */}
        {searchParams.billing === 'success' && (
          <DismissibleBanner type="info" title="Payment Successful!" clearHref="/subscribe">
            <p className="text-sm text-blue-700 mt-1">
              Your subscription is now active. You have full access to your plan features.
            </p>
          </DismissibleBanner>
        )}

        {/* Cancelled banner */}
        {searchParams.billing === 'cancelled' && (
          <DismissibleBanner type="warning" title="Payment Cancelled" clearHref="/subscribe">
            <p className="text-sm text-amber-700 mt-1">
              You cancelled the PayPal checkout. No charges were made. You can try again below.
            </p>
          </DismissibleBanner>
        )}

        {/* Error banner */}
        {searchParams.billing === 'error' && (
          <DismissibleBanner type="error" title="Payment Failed" clearHref="/subscribe">
            <p className="text-sm text-red-700 mt-1">
              Something went wrong processing your payment. Please try again or contact support.
            </p>
          </DismissibleBanner>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const isCurrent = company.planId === plan.id;
            const hasPaypal = !!paypalPlanMap[plan.id];
            const planFeatures = plan.features as string[];
            const highlights = dispatcherFeatures.filter((f) => planFeatures.includes(f.key));

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 bg-white overflow-hidden flex flex-col ${
                  isCurrent && isActive
                    ? 'border-safety shadow-lg'
                    : isCurrent
                      ? 'border-blue-300 shadow-md'
                      : 'border-steel-200 hover:border-steel-300'
                }`}
              >
                {/* Header */}
                <div className={`p-5 ${isCurrent && isActive ? 'bg-safety/10' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg text-steel-900">{plan.name}</h3>
                    {isCurrent && isActive && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-safety text-diesel px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                    {isCurrent && !isActive && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-black text-diesel">
                    {formatPrice(plan.priceMonthlyCents)}
                  </div>
                  {plan.description && (
                    <p className="text-xs text-steel-500 mt-1">{plan.description}</p>
                  )}
                </div>

                {/* Limits */}
                <div className="px-5 py-3 border-t border-steel-100 text-xs text-steel-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Drivers</span>
                    <span className="font-semibold">{plan.maxDrivers ?? 'Unlimited'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tickets/mo</span>
                    <span className="font-semibold">{plan.maxTicketsPerMonth ?? 'Unlimited'}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="px-5 py-3 border-t border-steel-100 flex-1">
                  <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold mb-2">
                    Features
                  </div>
                  <ul className="space-y-1.5">
                    {highlights.map((f) => (
                      <li key={f.key} className="flex items-start gap-1.5 text-xs">
                        <span className="text-green-600 mt-0.5">✓</span>
                        <span className="text-steel-700">{f.label}</span>
                      </li>
                    ))}
                    {highlights.length === 0 && (
                      <li className="text-xs text-steel-400 italic">Core features only</li>
                    )}
                  </ul>
                </div>

                {/* Action */}
                <div className="p-5 border-t border-steel-100">
                  {isCurrent && isActive ? (
                    <div className="text-center text-sm text-green-700 font-medium py-2">
                      ✓ Active Subscription
                    </div>
                  ) : hasPaypal ? (
                    <SubscribeButton planId={plan.id} planName={plan.name} isCurrent={isCurrent} />
                  ) : plan.priceMonthlyCents === 0 ? (
                    <div className="text-center text-sm text-steel-400 py-2">
                      Free plan — contact support
                    </div>
                  ) : (
                    <div className="text-center text-sm text-steel-400 py-2">
                      Coming soon
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Back to dashboard */}
        {hasPlan && (
          <div className="text-center mt-8">
            <a href="/dashboard" className="text-sm text-steel-500 hover:text-steel-700 underline">
              Continue to dashboard
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
