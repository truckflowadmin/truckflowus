'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getTruckOverrides } from '@/lib/truck-overrides';
import { nextFriday } from 'date-fns';
import type { InvoiceStatus } from '@prisma/client';

/** Compute invoice due date based on a broker's rule */
function computeBrokerDueDate(
  rule: string,
  customDays: number | null,
  periodEnd: Date,
): Date {
  switch (rule) {
    case 'NEXT_FRIDAY': {
      // Friday after the period end (Sunday)
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

export async function generateInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const customerId = String(formData.get('customerId') || '');
  const periodStartStr = String(formData.get('periodStart') || '');
  const periodEndStr = String(formData.get('periodEnd') || '');
  const taxRateStr = String(formData.get('taxRate') || '0');
  if (!customerId || !periodStartStr || !periodEndStr) throw new Error('All fields required');

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  periodEnd.setHours(23, 59, 59, 999);

  // Match tickets by date OR completedAt
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
    throw new Error('No uninvoiced completed tickets in that period for this customer');
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

  revalidatePath('/invoices');
  return { invoiceId: invoice.id };
}

export async function generateBrokerInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const brokerId = String(formData.get('brokerId') || '');
  const periodStartStr = String(formData.get('periodStart') || '');
  const periodEndStr = String(formData.get('periodEnd') || '');
  const taxRateStr = String(formData.get('taxRate') || '0');
  if (!brokerId || !periodStartStr || !periodEndStr) throw new Error('All fields required');

  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);

  // Validate period is Mon–Sun (same week)
  const startDay = periodStart.getUTCDay(); // 0=Sun, 1=Mon
  const endDay = periodEnd.getUTCDay();
  const diffDays = Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000);
  if (startDay !== 1 || endDay !== 0 || diffDays !== 6) {
    throw new Error('Broker invoice period must be a full week: Monday through Sunday.');
  }

  periodEnd.setHours(23, 59, 59, 999);

  // Match tickets by date, completedAt, OR createdAt — brokers track by ticket date
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
    // Give a helpful diagnostic message
    const allBrokerTickets = await prisma.ticket.count({
      where: { companyId: session.companyId, brokerId },
    });
    const completedCount = await prisma.ticket.count({
      where: { companyId: session.companyId, brokerId, status: 'COMPLETED' },
    });
    const uninvoicedCount = await prisma.ticket.count({
      where: { companyId: session.companyId, brokerId, status: 'COMPLETED', invoiceId: null },
    });
    throw new Error(
      `No matching tickets found. This broker has ${allBrokerTickets} total ticket(s), ` +
      `${completedCount} completed, ${uninvoicedCount} uninvoiced. ` +
      `Check that tickets are marked COMPLETED and their dates fall within the selected week.`
    );
  }

  // Validate all tickets fall within the same Mon–Sun week
  for (const t of tickets) {
    const ticketDate = t.date ?? t.completedAt;
    if (ticketDate) {
      const td = new Date(ticketDate);
      if (td < periodStart || td > periodEnd) {
        throw new Error(
          `Ticket #${String(t.ticketNumber).padStart(4, '0')} date falls outside the selected week.`
        );
      }
    }
  }

  let subtotal = 0;
  for (const t of tickets) {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    subtotal += rate * Number(t.quantity);
  }
  const taxRate = Math.max(0, Number(taxRateStr) || 0) / 100;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Get broker's due date rule
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

  revalidatePath('/invoices');
  return { invoiceId: invoice.id };
}

export async function updateDueDateAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const dueDateStr = String(formData.get('dueDate') || '');
  const inv = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!inv) throw new Error('Invoice not found');
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;
  await prisma.invoice.update({ where: { id }, data: { dueDate } });
  revalidatePath(`/invoices/${id}`);
}

export async function updateInvoiceStatusAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const status = String(formData.get('status') || '') as InvoiceStatus;
  const inv = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!inv) throw new Error('Invoice not found');
  await prisma.invoice.update({ where: { id }, data: { status } });
  revalidatePath(`/invoices/${id}`);
  revalidatePath('/invoices');
}

export async function saveInvoiceNotesAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const notes = String(formData.get('notes') || '').trim() || null;
  const inv = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!inv) throw new Error('Invoice not found');
  await prisma.invoice.update({ where: { id }, data: { notes } });
  revalidatePath(`/invoices/${id}`);
}

export async function deleteInvoiceAction(formData: FormData) {
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const inv = await prisma.invoice.findFirst({ where: { id, companyId: session.companyId } });
  if (!inv) throw new Error('Invoice not found');

  // Get ticket IDs before releasing
  const linkedTicketIds = (await prisma.ticket.findMany({
    where: { invoiceId: id },
    select: { id: true },
  })).map(t => t.id);

  // Release tickets — clear invoiceId and tripSheetId so they return to Ready to Bill
  await prisma.ticket.updateMany({
    where: { id: { in: linkedTicketIds } },
    data: { invoiceId: null, tripSheetId: null },
  });

  // Ensure dispatcherReviewedAt is set so tickets show in Ready to Bill
  await prisma.ticket.updateMany({
    where: { id: { in: linkedTicketIds }, dispatcherReviewedAt: null },
    data: { dispatcherReviewedAt: new Date() },
  });

  // Soft-delete: mark as CANCELLED instead of removing
  await prisma.invoice.update({ where: { id }, data: { status: 'CANCELLED' } });

  revalidatePath('/invoices');
  revalidatePath('/tickets');
}

export async function emailInvoiceAction(formData: FormData) {
  const { sendEmail } = await import('@/lib/email');
  const { generateInvoicePdf, generateBrokerInvoicePdf } = await import('@/lib/pdf');
  const { format } = await import('date-fns');

  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const toOverride = String(formData.get('to') || '').trim();

  const invoice = await prisma.invoice.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: true,
      broker: true,
      tickets: {
        orderBy: { completedAt: 'asc' },
        include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
      },
      company: true,
    },
  });
  if (!invoice) throw new Error('Invoice not found');

  const truckOverrides = await getTruckOverrides(session.companyId, invoice.tickets.map((t) => t.truckNumber ?? ''));

  const isBroker = invoice.invoiceType === 'BROKER';
  const recipientName = isBroker
    ? invoice.broker?.name ?? 'Broker'
    : invoice.customer?.contact || invoice.customer?.name || 'Customer';
  const recipientEmail = isBroker ? invoice.broker?.email : invoice.customer?.email;

  const to = toOverride || recipientEmail;
  if (!to) throw new Error(`No email address — set one on the ${isBroker ? 'broker' : 'customer'} record or enter one below.`);

  let pdfBuffer: Buffer;
  if (isBroker && invoice.broker) {
    const brokerContacts = Array.isArray(invoice.broker.contacts)
      ? invoice.broker.contacts as any[]
      : JSON.parse(String(invoice.broker.contacts || '[]'));
    pdfBuffer = await generateBrokerInvoicePdf({
      company: invoice.company,
      broker: {
        name: invoice.broker.name,
        contacts: brokerContacts,
        email: invoice.broker.email,
        mailingAddress: invoice.broker.mailingAddress,
        commissionPct: Number(invoice.broker.commissionPct),
        tripSheetForm: invoice.broker.tripSheetForm,
        logoFile: invoice.broker.logoFile,
      },
      periodEnd: invoice.periodEnd,
      tickets: invoice.tickets.map((t) => ({
        ticketNumber: t.ticketNumber,
        ticketRef: t.ticketRef,
        date: t.date,
        completedAt: t.completedAt,
        customer: t.customer?.name ?? null,
        driver: t.driver?.name ?? null,
        truckNumber: t.truckNumber,
        material: t.material,
        quantityType: t.quantityType,
        quantity: Number(t.quantity),
        hauledFrom: t.hauledFrom,
        hauledTo: t.hauledTo,
        ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit) : 0,
        status: t.status,
        payToName: truckOverrides.get(t.truckNumber ?? '')?.payToName ?? null,
        dispatcherName: truckOverrides.get(t.truckNumber ?? '')?.dispatcherName ?? null,
      })),
    });
  } else {
    pdfBuffer = await generateInvoicePdf(invoice as any);
  }

  const invNum = String(invoice.invoiceNumber).padStart(4, '0');
  const periodLabel = `${format(invoice.periodStart, 'MMM d')} – ${format(invoice.periodEnd, 'MMM d, yyyy')}`;

  const result = await sendEmail({
    to,
    subject: `Invoice #${invNum} from ${invoice.company.name}`,
    text: [
      `Hello ${recipientName},`,
      '',
      `Please find attached invoice #${invNum} for the period ${periodLabel}.`,
      '',
      `Amount due: $${Number(invoice.total).toFixed(2)}`,
      invoice.dueDate ? `Due date: ${format(invoice.dueDate, 'MMM d, yyyy')}` : '',
      '',
      'Thank you for your business.',
      '',
      invoice.company.name,
      [invoice.company.phone, invoice.company.email].filter(Boolean).join(' • '),
    ].filter((l) => l !== undefined).join('\n'),
    attachments: [{
      filename: `INV-${invNum}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });

  if (!result.success) {
    throw new Error(`Failed to send email: ${result.error}`);
  }

  // Auto-advance from DRAFT to SENT
  if (invoice.status === 'DRAFT') {
    await prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
  }

  revalidatePath(`/invoices/${id}`);
  revalidatePath('/invoices');
}
