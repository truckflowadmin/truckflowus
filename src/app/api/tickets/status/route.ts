import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { TicketStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: TicketStatus[] = [
  'PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED',
];

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id: string = body.id;
    const status = body.status as TicketStatus;

    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id, companyId: session.companyId },
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

    // Validate required fields before allowing COMPLETED
    if (status === 'COMPLETED') {
      const missing: string[] = [];
      if (!ticket.customerId) missing.push('Customer');
      if (!ticket.driverId) missing.push('Driver');
      if (!ticket.material) missing.push('Material');
      if (!ticket.quantity || Number(ticket.quantity) <= 0) missing.push('Quantity');
      if (!ticket.hauledFrom) missing.push('Hauled From');
      if (!ticket.hauledTo) missing.push('Hauled To');
      if (!ticket.ratePerUnit) missing.push('Rate');
      if (!ticket.date) missing.push('Date');
      if (!ticket.truckNumber) missing.push('Truck #');
      if (!ticket.photoUrl) missing.push('Photo');
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Cannot complete ticket — missing: ${missing.join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Auto-set timestamps on status transitions
    const patch: any = { status };
    const now = new Date();
    if (status === 'DISPATCHED' && !ticket.dispatchedAt) patch.dispatchedAt = now;
    if (status === 'IN_PROGRESS' && !ticket.startedAt) patch.startedAt = now;
    if (status === 'COMPLETED' && !ticket.completedAt) {
      patch.completedAt = now;
      if (!ticket.startedAt) patch.startedAt = now;
    }

    await prisma.ticket.update({ where: { id }, data: patch });

    revalidatePath('/tickets');
    revalidatePath(`/tickets/${id}`);
    revalidatePath('/dashboard');

    return NextResponse.json({ success: true, id, status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 });
  }
}
