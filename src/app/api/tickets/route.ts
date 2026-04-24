import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/tickets
 * Update a single ticket's fields.
 * Body (JSON): { id, ...fields }
 */
export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 });

    const ticket = await prisma.ticket.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.invoiceId) return NextResponse.json({ error: 'Cannot edit invoiced ticket' }, { status: 403 });

    const data: any = {};

    if (fields.quantity !== undefined) {
      const qty = parseFloat(fields.quantity);
      if (isNaN(qty) || qty < 0) return NextResponse.json({ error: 'Invalid quantity' }, { status: 400 });
      data.quantity = qty;
    }
    if (fields.quantityType !== undefined) {
      const valid = ['LOADS', 'TONS', 'YARDS'];
      if (!valid.includes(fields.quantityType)) return NextResponse.json({ error: 'Invalid quantity type' }, { status: 400 });
      data.quantityType = fields.quantityType;
    }
    if (fields.hauledFrom !== undefined) data.hauledFrom = fields.hauledFrom?.trim() || '';
    if (fields.hauledTo !== undefined) data.hauledTo = fields.hauledTo?.trim() || '';
    if (fields.material !== undefined) data.material = fields.material?.trim() || null;
    if (fields.ticketRef !== undefined) data.ticketRef = fields.ticketRef?.trim() || null;
    if (fields.date !== undefined) data.date = fields.date ? new Date(fields.date) : null;
    if (fields.ratePerUnit !== undefined) data.ratePerUnit = fields.ratePerUnit ? parseFloat(fields.ratePerUnit) : null;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updated = await prisma.ticket.update({ where: { id }, data });

    revalidatePath('/tickets');
    revalidatePath('/jobs');
    return NextResponse.json({
      success: true,
      ticket: {
        id: updated.id,
        quantity: Number(updated.quantity),
        quantityType: updated.quantityType,
        hauledFrom: updated.hauledFrom,
        hauledTo: updated.hauledTo,
        material: updated.material,
        ticketRef: updated.ticketRef,
        date: updated.date?.toISOString() ?? null,
        ratePerUnit: updated.ratePerUnit?.toString() ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/tickets?id=xxx
 * Delete a single ticket.
 */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ticket id' }, { status: 400 });

    const ticket = await prisma.ticket.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!ticket) return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    if (ticket.invoiceId) return NextResponse.json({ error: 'Cannot delete invoiced ticket' }, { status: 403 });

    // Block deletion if ticket belongs to a PAID trip sheet
    if (ticket.tripSheetId) {
      const sheet = await prisma.tripSheet.findUnique({ where: { id: ticket.tripSheetId }, select: { status: true } });
      if (sheet?.status === 'PAID') {
        return NextResponse.json({ error: 'This ticket belongs to a paid trip sheet and cannot be deleted' }, { status: 403 });
      }
    }

    await prisma.ticket.update({ where: { id }, data: { deletedAt: new Date() } });

    revalidatePath('/tickets');
    revalidatePath('/jobs');
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Delete failed' }, { status: 500 });
  }
}
