'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

/**
 * Add selected tickets to an existing DRAFT trip sheet.
 */
export async function addTicketsToExistingTripSheetAction(ticketIds: string[], tripSheetId: string) {
  const session = await requireSession();
  if (ticketIds.length === 0) throw new Error('No tickets selected');

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: tripSheetId, companyId: session.companyId },
  });
  if (!sheet) throw new Error('Trip sheet not found');
  if (sheet.status !== 'DRAFT') throw new Error('Can only add tickets to DRAFT trip sheets');

  // Verify tickets are valid
  const tickets = await prisma.ticket.findMany({
    where: {
      id: { in: ticketIds },
      companyId: session.companyId,
      status: 'COMPLETED',
      dispatcherReviewedAt: { not: null },
      invoiceId: null,
      tripSheetId: null,
    },
  });
  if (tickets.length === 0) throw new Error('No valid billable tickets found');

  // All tickets must match the trip sheet's broker
  const mismatch = tickets.filter((t) => t.brokerId !== sheet.brokerId);
  if (mismatch.length > 0) {
    throw new Error(`${mismatch.length} ticket(s) belong to a different broker than this trip sheet`);
  }

  await prisma.ticket.updateMany({
    where: { id: { in: tickets.map((t) => t.id) } },
    data: { tripSheetId: sheet.id },
  });

  // Recalculate total
  const allSheetTickets = await prisma.ticket.findMany({ where: { tripSheetId: sheet.id } });
  const totalDue = allSheetTickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);
  await prisma.tripSheet.update({ where: { id: sheet.id }, data: { totalDue } });

  revalidatePath('/tickets');
  revalidatePath(`/brokers/${sheet.brokerId}/trip-sheets`);
  return { added: tickets.length, sheetId: sheet.id, brokerId: sheet.brokerId };
}

/**
 * Add selected tickets to an existing DRAFT invoice.
 */
export async function addTicketsToExistingInvoiceAction(ticketIds: string[], invoiceId: string) {
  const session = await requireSession();
  if (ticketIds.length === 0) throw new Error('No tickets selected');

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, companyId: session.companyId },
  });
  if (!invoice) throw new Error('Invoice not found');
  if (invoice.status !== 'DRAFT') throw new Error('Can only add tickets to DRAFT invoices');

  const tickets = await prisma.ticket.findMany({
    where: {
      id: { in: ticketIds },
      companyId: session.companyId,
      status: 'COMPLETED',
      dispatcherReviewedAt: { not: null },
      invoiceId: null,
      tripSheetId: null,
    },
  });
  if (tickets.length === 0) throw new Error('No valid billable tickets found');

  // All tickets must match the invoice's customer
  const mismatch = tickets.filter((t) => t.customerId !== invoice.customerId);
  if (mismatch.length > 0) {
    throw new Error(`${mismatch.length} ticket(s) belong to a different customer than this invoice`);
  }

  await prisma.ticket.updateMany({
    where: { id: { in: tickets.map((t) => t.id) } },
    data: { invoiceId: invoice.id },
  });

  // Recalculate totals
  const allInvoiceTickets = await prisma.ticket.findMany({ where: { invoiceId: invoice.id } });
  const subtotal = allInvoiceTickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);
  const taxAmount = subtotal * Number(invoice.taxRate);
  const total = subtotal + taxAmount;

  // Update period bounds
  const dates = allInvoiceTickets
    .map((t) => t.date ?? t.completedAt ?? t.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { subtotal, taxAmount, total, periodStart: dates[0], periodEnd: dates[dates.length - 1] },
  });

  revalidatePath('/tickets');
  revalidatePath('/invoices');
  revalidatePath(`/invoices/${invoice.id}`);
  return { added: tickets.length, invoiceId: invoice.id };
}

/**
 * Create a trip sheet from selected completed+reviewed tickets that share a broker.
 */
export async function createTripSheetFromTicketsAction(formData: FormData) {
  const session = await requireSession();
  const ticketIds = formData.getAll('ticketIds').map(String).filter(Boolean);
  const weekEnding = String(formData.get('weekEnding') || '');

  if (ticketIds.length === 0) throw new Error('No tickets selected');
  if (!weekEnding) throw new Error('Week ending date is required');

  // Fetch tickets and validate
  const tickets = await prisma.ticket.findMany({
    where: {
      id: { in: ticketIds },
      companyId: session.companyId,
      status: 'COMPLETED',
      dispatcherReviewedAt: { not: null },
    },
  });

  if (tickets.length === 0) throw new Error('No valid completed & reviewed tickets found');

  // All tickets must share the same broker
  const brokerIds = [...new Set(tickets.map((t) => t.brokerId).filter(Boolean))];
  if (brokerIds.length === 0) throw new Error('Selected tickets have no broker assigned');
  if (brokerIds.length > 1) throw new Error('Selected tickets belong to different brokers — select tickets for one broker at a time');

  const brokerId = brokerIds[0]!;

  // Check tickets aren't already on a trip sheet
  const alreadyOnSheet = tickets.filter((t) => t.tripSheetId);
  if (alreadyOnSheet.length > 0) {
    throw new Error(`${alreadyOnSheet.length} ticket(s) are already on a trip sheet`);
  }

  const broker = await prisma.broker.findFirst({
    where: { id: brokerId, companyId: session.companyId },
  });
  if (!broker) throw new Error('Broker not found');

  // Calculate total
  const totalDue = tickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  const sheet = await prisma.tripSheet.create({
    data: {
      companyId: session.companyId,
      brokerId,
      weekEnding: new Date(weekEnding + 'T23:59:59.999'),
      totalDue,
    },
  });

  // Link tickets to trip sheet
  await prisma.ticket.updateMany({
    where: { id: { in: tickets.map((t) => t.id) } },
    data: { tripSheetId: sheet.id },
  });

  revalidatePath('/tickets');
  revalidatePath(`/brokers/${brokerId}/trip-sheets`);
  redirect(`/brokers/${brokerId}/trip-sheets`);
}

/**
 * Create an invoice from selected completed+reviewed tickets that share a customer (no broker).
 */
export async function createInvoiceFromTicketsAction(formData: FormData) {
  const session = await requireSession();
  const ticketIds = formData.getAll('ticketIds').map(String).filter(Boolean);
  const taxRateStr = String(formData.get('taxRate') || '0');

  if (ticketIds.length === 0) throw new Error('No tickets selected');

  const tickets = await prisma.ticket.findMany({
    where: {
      id: { in: ticketIds },
      companyId: session.companyId,
      status: 'COMPLETED',
      dispatcherReviewedAt: { not: null },
    },
  });

  if (tickets.length === 0) throw new Error('No valid completed & reviewed tickets found');

  // All tickets must share the same customer
  const customerIds = [...new Set(tickets.map((t) => t.customerId).filter(Boolean))];
  if (customerIds.length === 0) throw new Error('Selected tickets have no customer assigned');
  if (customerIds.length > 1) throw new Error('Selected tickets belong to different customers — select tickets for one customer at a time');

  const customerId = customerIds[0]!;

  // Check tickets aren't already on an invoice
  const alreadyInvoiced = tickets.filter((t) => t.invoiceId);
  if (alreadyInvoiced.length > 0) {
    throw new Error(`${alreadyInvoiced.length} ticket(s) are already on an invoice`);
  }

  // Calculate totals
  let subtotal = 0;
  for (const t of tickets) {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    subtotal += rate * Number(t.quantity);
  }
  const taxRate = Math.max(0, Number(taxRateStr) || 0) / 100;
  const taxAmount = subtotal * taxRate;
  const total = subtotal + taxAmount;

  // Determine period from ticket dates
  const dates = tickets
    .map((t) => t.date ?? t.completedAt ?? t.createdAt)
    .sort((a, b) => a.getTime() - b.getTime());
  const periodStart = dates[0];
  const periodEnd = dates[dates.length - 1];

  // Next invoice number
  const last = await prisma.invoice.findFirst({
    where: { companyId: session.companyId },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const invoiceNumber = (last?.invoiceNumber ?? 1000) + 1;

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

  // Link tickets to invoice
  await prisma.ticket.updateMany({
    where: { id: { in: tickets.map((t) => t.id) } },
    data: { invoiceId: invoice.id },
  });

  revalidatePath('/tickets');
  revalidatePath('/invoices');
  redirect(`/invoices/${invoice.id}`);
}
