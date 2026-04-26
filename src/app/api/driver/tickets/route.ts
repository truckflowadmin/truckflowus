import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';

// Prevent Vercel/Next.js edge caching — always fetch fresh data
export const dynamic = 'force-dynamic';

/**
 * GET /api/driver/tickets
 * Returns all tickets assigned to the authenticated driver.
 */
export async function GET(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { driverId, companyId } = session;

  const tickets = await prisma.ticket.findMany({
    where: {
      companyId,
      driverId,
      deletedAt: null,
    },
    select: {
      id: true,
      ticketNumber: true,
      material: true,
      hauledFrom: true,
      hauledTo: true,
      quantity: true,
      quantityType: true,
      status: true,
      date: true,
      ticketRef: true,
      photoUrl: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    tickets: tickets.map((t) => ({
      ...t,
      quantity: Number(t.quantity),
    })),
  });
}
