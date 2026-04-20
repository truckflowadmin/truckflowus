import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getSession, requireSession } from '@/lib/auth';
import { formatPrice, FEATURE_CATALOG } from '@/lib/features';
import DismissibleBanner from '@/components/DismissibleBanner';

export const metadata: Metadata = {
  title: 'Plans & Pricing',
  description:
    'Choose a TruckFlowUS plan for your hauling company. Ticketing, dispatch, invoicing, and fleet management at every tier.',
};

export const dynamic = 'force-dynamic';

async function submitRequest(formData: FormData) {
  'use server';
  const session = await requireSession();
  const planId = String(formData.get('planId') || '');
  const message = String(formData.get('message') || '').trim() || null;

  if (!planId) throw new Error('Plan required');

  // Check company doesn't already have this plan
  const company = await prisma.company.findUnique({ where: { id: session.companyId }, select: { planId: true } });
  if (company?.planId === planId) {
    redirect('/subscribe?error=already_subscribed');
  }

  // Check no pending request already exists
  const existing = await prisma.subscriptionRequest.findFirst({
    where: { companyId: session.companyId, status: 'PENDING' },
  });
  if (existing) {
    redirect('/subscribe?error=pending');
  }

  await prisma.subscriptionRequest.create({
    data: {
      companyId: session.companyId,
      planId,
      message,
    },
  });

  revalidatePath('/subscribe');
  redirect('/subscribe?submitted=1');
}

export default async function SubscribePage({
  searchParams,
}: {
  searchParams: { submitted?: string; error?: string };
}) {
  const session = await getSession();
  if (!session || !session.companyId) redirect('/login');
  const companyId = session.companyId;

  const [company, plans, pendingRequest] = await Promise.all([
    prisma.company.findUnique({
      where: { id: companyId },
      include: { plan: true },
    }),
    prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.subscriptionRequest.findFirst({
      where: { companyId: session.companyId, status: 'PENDING' },
      include: { plan: true },
    }),
  ]);

  if (!company) redirect('/login');

  // Check for most recent rejected request
  const lastRejected = await prisma.subscriptionRequest.findFirst({
    where: { companyId: companyId, status: 'REJECTED' },
    orderBy: { updatedAt: 'desc' },
    include: { plan: true },
  });

  const hasPlan = !!company.planId;

  // Dispatcher feature highlights per plan (non-view, non-driver features)
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
          {!hasPlan && (
            <p className="text-steel-300 text-sm max-w-xl">
              Select a subscription plan to get started. Your request will be reviewed
              by our team and activated shortly.
            </p>
          )}
          {hasPlan && (
            <p className="text-steel-300 text-sm max-w-xl">
              You're currently on the <span className="text-safety font-semibold">{company.plan?.name}</span> plan.
              Want to upgrade? Select a new plan below.
            </p>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Pending request banner */}
        {(pendingRequest || searchParams.submitted) && (
          <DismissibleBanner type="info" title="Request Pending" clearHref="/subscribe">
            <p className="text-sm text-blue-700 mt-1">
              Your request for the <span className="font-semibold">{pendingRequest?.plan?.name ?? 'selected'}</span> plan
              has been submitted and is awaiting review. We'll activate your subscription as soon as it's approved.
            </p>
          </DismissibleBanner>
        )}

        {/* Already subscribed error */}
        {searchParams.error === 'already_subscribed' && (
          <DismissibleBanner type="warning" title="Already Subscribed" clearHref="/subscribe">
            <p className="text-sm text-amber-700 mt-1">
              You are already subscribed to this plan. Choose a different plan to upgrade or downgrade.
            </p>
          </DismissibleBanner>
        )}

        {/* Already pending error */}
        {searchParams.error === 'pending' && (
          <DismissibleBanner type="warning" title="Request Already Pending" clearHref="/subscribe">
            <p className="text-sm text-amber-700 mt-1">
              You already have a pending subscription request. Please wait for it to be reviewed before submitting a new one.
            </p>
          </DismissibleBanner>
        )}

        {/* Last rejected banner */}
        {lastRejected && !pendingRequest && (
          <DismissibleBanner type="error" title="Previous Request Declined">
            <p className="text-sm text-red-700 mt-1">
              Your request for the <span className="font-semibold">{lastRejected.plan.name}</span> plan was declined.
              {lastRejected.reviewNote && (
                <> Reason: <span className="italic">"{lastRejected.reviewNote}"</span></>
              )}
            </p>
            <p className="text-sm text-red-600 mt-1">You can submit a new request below.</p>
          </DismissibleBanner>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.map((plan) => {
            const isCurrent = company.planId === plan.id;
            const isPending = pendingRequest?.planId === plan.id;
            const planFeatures = plan.features as string[];
            const highlights = dispatcherFeatures.filter((f) => planFeatures.includes(f.key));

            return (
              <div
                key={plan.id}
                className={`rounded-xl border-2 bg-white overflow-hidden flex flex-col ${
                  isCurrent
                    ? 'border-safety shadow-lg'
                    : isPending
                      ? 'border-blue-300 shadow-md'
                      : 'border-steel-200 hover:border-steel-300'
                }`}
              >
                {/* Header */}
                <div className={`p-5 ${isCurrent ? 'bg-safety/10' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold text-lg text-steel-900">{plan.name}</h3>
                    {isCurrent && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-safety text-diesel px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    )}
                    {isPending && (
                      <span className="text-[10px] uppercase tracking-wider font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        Pending
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
                  {isCurrent ? (
                    <div className="text-center text-sm text-steel-500 font-medium py-2">
                      Your current plan
                    </div>
                  ) : isPending ? (
                    <div className="text-center text-sm text-blue-600 font-medium py-2">
                      Awaiting approval
                    </div>
                  ) : pendingRequest ? (
                    <button
                      disabled
                      className="w-full py-2.5 rounded-lg text-sm font-semibold bg-steel-100 text-steel-400 cursor-not-allowed"
                    >
                      Request pending
                    </button>
                  ) : (
                    <form action={submitRequest}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <details>
                        <summary className="w-full py-2.5 rounded-lg text-sm font-semibold bg-diesel text-white hover:bg-steel-800 transition-colors cursor-pointer text-center list-none">
                          {hasPlan ? 'Request Upgrade' : 'Select Plan'}
                        </summary>
                        <div className="mt-3 space-y-2">
                          <textarea
                            name="message"
                            placeholder="Add a note (optional)..."
                            rows={2}
                            className="input text-xs w-full"
                          />
                          <button
                            type="submit"
                            className="btn-accent w-full text-sm"
                          >
                            Submit Request
                          </button>
                        </div>
                      </details>
                    </form>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Skip to dashboard if they already have a plan */}
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
