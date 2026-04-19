import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * GET /api/invoices/cleanup
 *
 * Shows all DRAFT invoices and tickets linked to them — diagnostic only.
 *
 * DELETE /api/invoices/cleanup
 *
 * Deletes ALL draft invoices and releases their tickets.
 * Use this to clean up ghost invoices from failed generation attempts.
 */

export async function GET(_req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const drafts = await prisma.invoice.findMany({
    where: { companyId: session.companyId, status: 'DRAFT' },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceType: true,
      createdAt: true,
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const allInvoices = await prisma.invoice.findMany({
    where: { companyId: session.companyId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      invoiceType: true,
      createdAt: true,
      _count: { select: { tickets: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const lockedTickets = await prisma.ticket.count({
    where: { companyId: session.companyId, invoiceId: { not: null } },
  });

  const readyToBill = await prisma.ticket.count({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      invoiceId: null,
    },
  });

  return NextResponse.json({
    allInvoices: allInvoices.map(i => ({
      id: i.id,
      number: `INV-${String(i.invoiceNumber).padStart(4, '0')}`,
      status: i.status,
      type: i.invoiceType,
      tickets: i._count.tickets,
      created: i.createdAt,
    })),
    draftCount: drafts.length,
    totalInvoices: allInvoices.length,
    lockedTickets,
    readyToBill,
  });
}

export async function DELETE(_req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find all DRAFT invoices for this company
  const drafts = await prisma.invoice.findMany({
    where: { companyId: session.companyId, status: 'DRAFT' },
    select: { id: true, invoiceNumber: true },
  });

  if (drafts.length === 0) {
    return NextResponse.json({ message: 'No draft invoices to clean up', deleted: 0, ticketsReleased: 0 });
  }

  const draftIds = drafts.map(d => d.id);

  // Get ticket IDs linked to draft invoices before releasing
  const linkedTicketIds = (await prisma.ticket.findMany({
    where: { invoiceId: { in: draftIds } },
    select: { id: true },
  })).map(t => t.id);

  // Release tickets — clear invoiceId and tripSheetId
  const released = await prisma.ticket.updateMany({
    where: { id: { in: linkedTicketIds } },
    data: { invoiceId: null, tripSheetId: null },
  });

  // Ensure dispatcherReviewedAt is set so tickets show in Ready to Bill
  await prisma.ticket.updateMany({
    where: { id: { in: linkedTicketIds }, dispatcherReviewedAt: null },
    data: { dispatcherReviewedAt: new Date() },
  });

  // Delete all draft invoices
  const deleted = await prisma.invoice.deleteMany({
    where: { id: { in: draftIds } },
  });

  // Verify
  const remainingDrafts = await prisma.invoice.count({
    where: { companyId: session.companyId, status: 'DRAFT' },
  });
  const readyToBill = await prisma.ticket.count({
    where: { companyId: session.companyId, status: 'COMPLETED', invoiceId: null },
  });

  revalidatePath('/invoices');
  revalidatePath('/tickets');

  return NextResponse.json({
    success: true,
    deleted: deleted.count,
    ticketsReleased: released.count,
    remainingDrafts,
    readyToBill,
    deletedInvoices: drafts.map(d => `INV-${String(d.invoiceNumber).padStart(4, '0')}`),
  });
}
