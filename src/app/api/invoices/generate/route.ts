import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { nextFriday } from 'date-fns';

export const dynamic = 'force-dynamic';

/** Compute invoice due date based on a broker's rule */
function computeBrokerDueDate(
  rule: string,
  customDays: number | null,
  periodEnd: Date,
): Date {
  switch (rule) {
    case 'NEXT_FRIDAY': {
      const fri = nextFriday(periodEnd);
      return fri;
    }
    case 'NET_15':
      return new Date(periodEnd.getTime() + 15 * 86400000);
    case 'NET_30':
      return new Date(periodEnd.getTime() + 30 * 86400000);
    case 'NET_45':
      return new Date(periodEnd.getTime() + 45 * 86400000);
    case 'NET_60':
      return new Date(periodEnd.getTime() + 60 * 86400000);
    case 'CUSTOM':
      return new Date(periodEnd.getTime() + (customDays ?? 30) * 86400000);
    default:
      return new Date(periodEnd.getTime() + 30 * 86400000);
  }
}

async function nextInvoiceNumber(companyId: string): Promise<number> {
  const last = await prisma.invoice.findFirst({
    where: { companyId },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  return (last?.invoiceNumber ?? 1000) + 1;
}

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch (e: any) {
    console.error('[POST generate invoice] Auth failed:', e.message);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const invoiceType = String(formData.get('invoiceType') || 'CUSTOMER');
    const taxRateStr = String(formData.get('taxRate') || '0');

    if (invoiceType === 'BROKER') {
      return await generateBrokerInvoice(session, formData, taxRateStr);
    } else {
      return await generateCustomerInvoice(session, formData, taxRateStr);
    }
  } catch (e: any) {
    console.error('[POST generate invoice] ERROR:', e.message);
    return NextResponse.json({ error: e.message || 'Failed to generate invoice' }, { status: 400 });
  }
}

async function generateCustomerInvoice(
  session: { companyId: string },
  formData: FormData,
  taxRateStr: string,
) {
  const customerId = String(formData.get('customerId') || '');
  const periodStartStr = String(formData.get('periodStart') || '');
  const periodEndStr = String(formData.get('periodEnd') || '');
  if (!customerId || !periodStartStr || !periodEndStr) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  periodEnd.setHours(23, 59, 59, 999);

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
  });

  if (tickets.length === 0) {
    return NextResponse.json(
      { error: 'No uninvoiced completed tickets in that period for this customer' },
      { status: 400 },
    );
  }

  let subtotal = 0;
  for (const t of tickets) {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    subtotal += rate * Number(t.quantity);
  }
  const taxRate = Math.max(0, Number(taxRateStr) || 0) / 100;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const invoiceNumber = await nextInvoiceNumber(session.companyId);
  const invoice = await prisma.invoice.create({
    data: {
      companyId: session.companyId,
      customerId,
      invoiceNumber,
      periodStart,
      periodEnd,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status: 'DRAFT',
      dueDate: new Date(Date.now() + 30 * 86400000),
    },
  });

  await prisma.ticket.updateMany({
    where: { id: { in: tickets.map(t => t.id) } },
    data: { invoiceId: invoice.id },
  });

  console.log(`[generate invoice] Created customer invoice ${invoice.id} with ${tickets.length} tickets`);
  revalidatePath('/invoices');
  return NextResponse.json({ success: true, invoiceId: invoice.id });
}

async function generateBrokerInvoice(
  session: { companyId: string },
  formData: FormData,
  taxRateStr: string,
) {
  const brokerId = String(formData.get('brokerId') || '');
  const periodStartStr = String(formData.get('periodStart') || '');
  const periodEndStr = String(formData.get('periodEnd') || '');
  if (!brokerId || !periodStartStr || !periodEndStr) {
    return NextResponse.json({ error: 'All fields required' }, { status: 400 });
  }

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  periodEnd.setHours(23, 59, 59, 999);

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
  });

  if (tickets.length === 0) {
    const allBrokerTickets = await prisma.ticket.count({
      where: { companyId: session.companyId, brokerId },
    });
    const completedCount = await prisma.ticket.count({
      where: { companyId: session.companyId, brokerId, status: 'COMPLETED' },
    });
    const uninvoicedCount = await prisma.ticket.count({
      where: { companyId: session.companyId, brokerId, status: 'COMPLETED', invoiceId: null },
    });
    return NextResponse.json(
      {
        error:
          `No matching tickets found. This broker has ${allBrokerTickets} total ticket(s), ` +
          `${completedCount} completed, ${uninvoicedCount} uninvoiced. ` +
          `Check that tickets are marked COMPLETED and their dates fall within the selected period.`,
      },
      { status: 400 },
    );
  }

  let subtotal = 0;
  for (const t of tickets) {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    subtotal += rate * Number(t.quantity);
  }
  const taxRate = Math.max(0, Number(taxRateStr) || 0) / 100;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  const broker = await prisma.broker.findUnique({
    where: { id: brokerId },
    select: { dueDateRule: true, dueDateDays: true },
  });
  const dueDate = computeBrokerDueDate(
    broker?.dueDateRule ?? 'NEXT_FRIDAY',
    broker?.dueDateDays ?? null,
    periodEnd,
  );

  const invoiceNumber = await nextInvoiceNumber(session.companyId);
  const invoice = await prisma.invoice.create({
    data: {
      companyId: session.companyId,
      invoiceType: 'BROKER',
      brokerId,
      invoiceNumber,
      periodStart,
      periodEnd,
      subtotal,
      taxRate,
      taxAmount,
      total,
      status: 'DRAFT',
      dueDate,
    },
  });

  await prisma.ticket.updateMany({
    where: { id: { in: tickets.map(t => t.id) } },
    data: { invoiceId: invoice.id },
  });

  console.log(`[generate invoice] Created broker invoice ${invoice.id} with ${tickets.length} tickets`);
  revalidatePath('/invoices');
  return NextResponse.json({ success: true, invoiceId: invoice.id });
}
