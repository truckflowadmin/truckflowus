import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/tickets/fix-reviews  → preview what will change
 * POST /api/tickets/fix-reviews  → apply the fix
 *
 * Clears dispatcherReviewedAt on tickets that are NOT completed,
 * since only completed tickets should be reviewable.
 */
export async function GET(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find tickets that have a review but are NOT completed
  const needsFix = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      dispatcherReviewedAt: { not: null },
      NOT: { status: 'COMPLETED' },
    },
    select: { id: true, ticketNumber: true, status: true },
    orderBy: { ticketNumber: 'asc' },
  });

  // Also count completed tickets with and without review
  const [completedReviewed, completedUnreviewed, totalTickets] = await Promise.all([
    prisma.ticket.count({
      where: { companyId: session.companyId, status: 'COMPLETED', dispatcherReviewedAt: { not: null } },
    }),
    prisma.ticket.count({
      where: { companyId: session.companyId, status: 'COMPLETED', dispatcherReviewedAt: null },
    }),
    prisma.ticket.count({ where: { companyId: session.companyId } }),
  ]);

  return NextResponse.json({
    preview: true,
    totalTickets,
    completedReviewed,
    completedUnreviewed,
    nonCompletedWithReview: needsFix.length,
    willClearReview: needsFix.map(t => ({
      ticketNumber: t.ticketNumber,
      status: t.status,
    })),
  });
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Clear review on non-completed tickets
  const cleared = await prisma.ticket.updateMany({
    where: {
      companyId: session.companyId,
      dispatcherReviewedAt: { not: null },
      NOT: { status: 'COMPLETED' },
    },
    data: {
      dispatcherReviewedAt: null,
      dispatcherReviewedBy: null,
    },
  });

  revalidatePath('/tickets');

  return NextResponse.json({
    success: true,
    reviewsCleared: cleared.count,
    message: `Cleared review status on ${cleared.count} non-completed ticket(s).`,
  });
}
