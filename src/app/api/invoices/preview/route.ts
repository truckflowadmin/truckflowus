import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const invoiceType = String(formData.get('invoiceType') || 'CUSTOMER');

    if (invoiceType === 'BROKER') {
      return await previewBroker(session, formData);
    } else {
      return await previewCustomer(session, formData);
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Preview failed' }, { status: 400 });
  }
}

async function previewCustomer(session: { companyId: string }, formData: FormData) {
  const customerId = String(formData.get('customerId') || '');
  const periodStartStr = String(formData.get('periodStart') || '');
  const periodEndStr = String(formData.get('periodEnd') || '');
  if (!customerId || !periodStartStr || !periodEndStr) {
    return NextResponse.json({ error: 'Select a customer and date range' }, { status: 400 });
  }

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  periodEnd.setHours(23, 59, 59, 999);

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, companyId: session.companyId },
    select: { name: true },
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      customerId,
      status: 'COMPLETED',
      invoiceId: null,
      OR: [
        { completedAt: { gte: periodStart, lte: periodEnd } },
        { date: { gte: periodStart, lte: periodEnd } },
      ],
    },
    include: { driver: true },
    orderBy: { completedAt: 'asc' },
  });

  const rows = tickets.map((t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    const qty = Number(t.quantity);
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      date: (t.completedAt ?? t.date)?.toISOString().slice(0, 10) ?? '—',
      driver: t.driver?.name ?? '—',
      material: t.material ?? '—',
      quantity: qty,
      quantityType: t.quantityType,
      rate,
      amount: rate * qty,
      truckNumber: t.truckNumber ?? '—',
    };
  });

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);

  return NextResponse.json({
    success: true,
    billedTo: customer?.name ?? '—',
    ticketCount: rows.length,
    tickets: rows,
    subtotal,
  });
}

async function previewBroker(session: { companyId: string }, formData: FormData) {
  const brokerId = String(formData.get('brokerId') || '');
  const periodStartStr = String(formData.get('periodStart') || '');
  const periodEndStr = String(formData.get('periodEnd') || '');
  if (!brokerId || !periodStartStr || !periodEndStr) {
    return NextResponse.json({ error: 'Select a broker and service period' }, { status: 400 });
  }

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  periodEnd.setHours(23, 59, 59, 999);

  const broker = await prisma.broker.findFirst({
    where: { id: brokerId, companyId: session.companyId },
    select: { name: true },
  });

  const tickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      brokerId,
      status: 'COMPLETED',
      invoiceId: null,
      OR: [
        { date: { gte: periodStart, lte: periodEnd } },
        { completedAt: { gte: periodStart, lte: periodEnd } },
        { createdAt: { gte: periodStart, lte: periodEnd } },
      ],
    },
    include: { driver: true, customer: true },
    orderBy: { completedAt: 'asc' },
  });

  const rows = tickets.map((t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    const qty = Number(t.quantity);
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      date: (t.completedAt ?? t.date)?.toISOString().slice(0, 10) ?? '—',
      driver: t.driver?.name ?? '—',
      customer: t.customer?.name ?? '—',
      material: t.material ?? '—',
      quantity: qty,
      quantityType: t.quantityType,
      rate,
      amount: rate * qty,
      truckNumber: t.truckNumber ?? '—',
    };
  });

  const subtotal = rows.reduce((s, r) => s + r.amount, 0);

  return NextResponse.json({
    success: true,
    billedTo: broker?.name ?? '—',
    ticketCount: rows.length,
    tickets: rows,
    subtotal,
  });
}
