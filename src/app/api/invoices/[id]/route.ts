import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/** Soft-delete: mark CANCELLED and release tickets back to Ready to Bill */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  let session;
  try {
    session = await requireSession();
  } catch (e: any) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const invoiceId = params.id;

  try {
    const inv = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId: session.companyId },
      include: { _count: { select: { tickets: true } } },
    });
    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Get ticket IDs linked to this invoice
    const linkedTicketIds = (await prisma.ticket.findMany({
      where: { invoiceId },
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

    // Soft-delete: mark invoice as CANCELLED (keeps the record)
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${invoiceId}`);
    revalidatePath('/tickets');

    return NextResponse.json({
      success: true,
      cancelled: invoiceId,
      ticketsReleased: released.count,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || 'Cancel failed', code: e.code },
      { status: 500 },
    );
  }
}
