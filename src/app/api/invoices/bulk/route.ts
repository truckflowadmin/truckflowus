import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { InvoiceStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: string[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];

/**
 * POST /api/invoices/bulk
 * Body (JSON): { ids: string[], action: 'status' | 'cancel', status?: string }
 */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ids: string[] = body.ids;
    const action: string = body.action;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No invoices selected' }, { status: 400 });
    }

    // Verify all invoices belong to this company
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: ids }, companyId: session.companyId },
      select: { id: true },
    });
    const validIds = invoices.map(i => i.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid invoices found' }, { status: 404 });
    }

    if (action === 'status') {
      const status = body.status as InvoiceStatus;
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      const result = await prisma.invoice.updateMany({
        where: { id: { in: validIds } },
        data: { status },
      });

      revalidatePath('/invoices');
      return NextResponse.json({ success: true, updated: result.count });
    }

    if (action === 'cancel') {
      // Get ticket IDs linked to these invoices
      const linkedTicketIds = (await prisma.ticket.findMany({
        where: { invoiceId: { in: validIds } },
        select: { id: true },
      })).map(t => t.id);

      // Release tickets
      await prisma.ticket.updateMany({
        where: { id: { in: linkedTicketIds } },
        data: { invoiceId: null, tripSheetId: null },
      });
      // Ensure dispatcherReviewedAt
      await prisma.ticket.updateMany({
        where: { id: { in: linkedTicketIds }, dispatcherReviewedAt: null },
        data: { dispatcherReviewedAt: new Date() },
      });

      // Soft-delete invoices
      const result = await prisma.invoice.updateMany({
        where: { id: { in: validIds } },
        data: { status: 'CANCELLED' },
      });

      revalidatePath('/invoices');
      revalidatePath('/tickets');
      return NextResponse.json({ success: true, cancelled: result.count, ticketsReleased: linkedTicketIds.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bulk action failed' }, { status: 500 });
  }
}
