import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.redirect(new URL('/login', process.env.APP_URL || 'http://localhost:3000'));
  }

  const url = req.nextUrl;
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const status = url.searchParams.get('status');

  const where: any = { companyId: session.companyId };
  if (from) where.createdAt = { ...where.createdAt, gte: new Date(from) };
  if (to) {
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    where.createdAt = { ...where.createdAt, lte: end };
  }
  if (status) where.status = status;

  const tickets = await prisma.ticket.findMany({
    where,
    include: { driver: true, customer: true },
    orderBy: { createdAt: 'desc' },
  });

  const header = [
    'Ticket #', 'Status', 'Customer', 'Driver', 'Truck #', 'Material', 'Type', 'Qty',
    'Rate/Unit', 'Total', 'Hauled From', 'Hauled To', 'Ticket Ref', 'Date',
    'Created', 'Dispatched', 'Started', 'Completed',
  ];

  const rows = tickets.map((t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    const qty = Number(t.quantity);
    const total = rate * qty;
    return [
      t.ticketNumber,
      t.status,
      t.customer?.name ?? '',
      t.driver?.name ?? '',
      t.truckNumber ?? '',
      t.material ?? '',
      t.quantityType,
      t.quantityType === 'TONS' ? qty : Math.round(qty),
      rate.toFixed(2),
      total.toFixed(2),
      `"${t.hauledFrom.replace(/"/g, '""')}"`,
      `"${t.hauledTo.replace(/"/g, '""')}"`,
      t.ticketRef ?? '',
      t.date ? format(t.date, 'yyyy-MM-dd') : '',
      t.createdAt ? format(t.createdAt, 'yyyy-MM-dd HH:mm') : '',
      t.dispatchedAt ? format(t.dispatchedAt, 'yyyy-MM-dd HH:mm') : '',
      t.startedAt ? format(t.startedAt, 'yyyy-MM-dd HH:mm') : '',
      t.completedAt ? format(t.completedAt, 'yyyy-MM-dd HH:mm') : '',
    ].join(',');
  });

  const csv = [header.join(','), ...rows].join('\n');
  const dateLabel = from && to ? `${from}_to_${to}` : format(new Date(), 'yyyy-MM-dd');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="tickets_export_${dateLabel}.csv"`,
    },
  });
}
