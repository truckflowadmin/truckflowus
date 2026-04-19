import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tickets/review
 * Body (JSON): { ticketId: string, action: 'mark' | 'unmark' }
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
    const ticketId: string = body.ticketId;
    const action: string = body.action;

    if (!ticketId || !['mark', 'unmark'].includes(action)) {
      return NextResponse.json({ error: 'Invalid ticketId or action' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, companyId: session.companyId },
    });
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.invoiceId) {
      return NextResponse.json(
        { error: 'This ticket is on an invoice and cannot be modified' },
        { status: 403 },
      );
    }

    if (action === 'mark' && ticket.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Ticket must be completed before it can be reviewed' }, { status: 400 });
    }

    if (action === 'mark') {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          dispatcherReviewedAt: new Date(),
          dispatcherReviewedBy: session.userId,
        },
      });
    } else {
      await prisma.ticket.update({
        where: { id: ticketId },
        data: {
          dispatcherReviewedAt: null,
          dispatcherReviewedBy: null,
        },
      });
    }

    revalidatePath(`/tickets/${ticketId}`);
    revalidatePath('/tickets');

    return NextResponse.json({ success: true, ticketId, action });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Review update failed' }, { status: 500 });
  }
}
