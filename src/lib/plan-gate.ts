/**
 * Plan gate — checks if a company has a plan assigned.
 * Call from server components/actions that should require an active subscription.
 */

import { redirect } from 'next/navigation';
import { prisma } from './prisma';

/**
 * Redirects to /subscribe if the company has no plan.
 * Call at the top of any page that requires an active subscription.
 */
export async function requirePlan(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { planId: true },
  });
  if (!company?.planId) {
    redirect('/subscribe');
  }
}
