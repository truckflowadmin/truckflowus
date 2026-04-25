import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { startOfWeek } from 'date-fns';

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
  // Use US Eastern so "today" and "this week" match the dispatcher's local day
  const etDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const refUTC = new Date(`${etDateStr}T12:00:00Z`);
  const refET = new Date(refUTC.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const etOffsetMs = refET.getTime() - refUTC.getTime();
  const todayStartET = new Date(`${etDateStr}T00:00:00Z`);
  todayStartET.setTime(todayStartET.getTime() - etOffsetMs);
  const todayEndET = new Date(todayStartET.getTime() + 24 * 60 * 60 * 1000 - 1);

  // Week boundaries in ET
  const nowET = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const weekStartET = startOfWeek(nowET, { weekStartsOn: 1 });
  const weekStartUTC = new Date(weekStartET.getTime() - etOffsetMs);
  const weekEndUTC = new Date(weekStartUTC.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);

  const companyId = session.companyId;

  const [pending, inProgress, completedToday, completedWeek, driversActive, openInvoiceAgg] =
    await Promise.all([
      prisma.ticket.count({
        where: { companyId, status: 'PENDING', deletedAt: null },
      }),
      prisma.ticket.count({
        where: { companyId, status: { in: ['DISPATCHED', 'IN_PROGRESS'] }, deletedAt: null },
      }),
      // Done Today — count tickets created today (includes driver uploads)
      prisma.ticket.count({
        where: {
          companyId,
          status: 'COMPLETED',
          deletedAt: null,
          createdAt: { gte: todayStartET, lte: todayEndET },
        },
      }),
      // Done This Week — count tickets created this week
      prisma.ticket.count({
        where: {
          companyId,
          status: 'COMPLETED',
          deletedAt: null,
          createdAt: { gte: weekStartUTC, lte: weekEndUTC },
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
