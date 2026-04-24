import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

/**
 * GET /api/dashboard/stats
 * Returns live dashboard tile counts — always fresh, never cached.
 */
export async function GET() {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const companyId = session.companyId;

  const [pending, inProgress, completedToday, completedWeek, driversActive, openInvoiceAgg] =
    await Promise.all([
      prisma.ticket.count({
        where: { companyId, status: 'PENDING', deletedAt: null },
      }),
      prisma.ticket.count({
        where: { companyId, status: { in: ['DISPATCHED', 'IN_PROGRESS'] }, deletedAt: null },
      }),
      // Done Today — use ticket date (haul date) for accurate counts
      prisma.ticket.count({
        where: {
          companyId,
          status: 'COMPLETED',
          deletedAt: null,
          date: { gte: todayStart, lte: todayEnd },
        },
      }),
      // Done This Week — use ticket date (haul date) for accurate counts
      prisma.ticket.count({
        where: {
          companyId,
          status: 'COMPLETED',
          deletedAt: null,
          date: { gte: weekStart, lte: weekEnd },
        },
      }),
      prisma.driver.count({ where: { companyId, active: true } }),
      prisma.invoice.aggregate({
        where: { companyId, status: { in: ['SENT', 'OVERDUE'] } },
        _sum: { total: true },
        _count: true,
      }),
    ]);

  const res = NextResponse.json({
    pending,
    inProgress,
    completedToday,
    completedWeek,
    driversActive,
    openInvoiceTotal: Number(openInvoiceAgg._sum.total ?? 0),
    openInvoiceCount: openInvoiceAgg._count,
    ts: now.toISOString(),
  });

  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');

  return res;
}
