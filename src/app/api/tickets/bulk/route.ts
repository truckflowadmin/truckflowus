import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { TicketStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: TicketStatus[] = [
  'PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED',
];

/**
 * POST /api/tickets/bulk
 * Body (JSON): { ids: string[], action: 'status', status?: string }
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
      return NextResponse.json({ error: 'No tickets selected' }, { status: 400 });
    }

    // Verify all tickets belong to this company
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: ids }, companyId: session.companyId },
      select: {
        id: true, startedAt: true, completedAt: true, dispatchedAt: true,
        customerId: true, driverId: true, material: true, quantity: true,
        hauledFrom: true, hauledTo: true, ratePerUnit: true, date: true,
        truckNumber: true, photoUrl: true, ticketNumber: true, invoiceId: true,
      },
    });
    const validIds = tickets.map(t => t.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid tickets found' }, { status: 404 });
    }

    // Block changes on invoiced tickets
    const invoicedTickets = tickets.filter(t => t.invoiceId);
    if (invoicedTickets.length > 0) {
      return NextResponse.json(
        { error: `${invoicedTickets.length} ticket(s) are on an invoice and cannot be modified` },
        { status: 403 },
      );
    }

    if (action === 'status') {
      const status = body.status as TicketStatus;
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      // Validate required fields before allowing COMPLETED
      if (status === 'COMPLETED') {
        const incomplete: string[] = [];
        for (const t of tickets) {
          const missing: string[] = [];
          if (!t.customerId) missing.push('Customer');
          if (!t.driverId) missing.push('Driver');
          if (!t.material) missing.push('Material');
          if (!t.quantity || Number(t.quantity) <= 0) missing.push('Quantity');
          if (!t.hauledFrom) missing.push('Hauled From');
          if (!t.hauledTo) missing.push('Hauled To');
          if (!t.ratePerUnit) missing.push('Rate');
          if (!t.date) missing.push('Date');
          if (!t.truckNumber) missing.push('Truck #');
          if (!t.photoUrl) missing.push('Photo');
          if (missing.length > 0) incomplete.push(`#${String(t.ticketNumber).padStart(4, '0')}: ${missing.join(', ')}`);
        }
        if (incomplete.length > 0) {
          return NextResponse.json(
            { error: `Cannot complete — missing info:\n${incomplete.join('\n')}` },
            { status: 400 },
          );
        }
      }

      // Build timestamp patches per ticket
      const now = new Date();
      const updates = tickets.map(t => {
        const patch: any = { status };
        if (status === 'DISPATCHED' && !t.dispatchedAt) patch.dispatchedAt = now;
        if (status === 'IN_PROGRESS' && !t.startedAt) patch.startedAt = now;
        if (status === 'COMPLETED' && !t.completedAt) {
          patch.completedAt = now;
          if (!t.startedAt) patch.startedAt = now;
        }
        return prisma.ticket.update({ where: { id: t.id }, data: patch });
      });
      await Promise.all(updates);

      revalidatePath('/tickets');
      revalidatePath('/dashboard');
      return NextResponse.json({ success: true, updated: validIds.length });
    }

    if (action === 'edit') {
      const fields = body.fields as Record<string, any> | undefined;
      if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) {
        return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
      }

      // Build the update data — only allow known editable fields
      const data: any = {};

      if (fields.customerId !== undefined) {
        if (fields.customerId) {
          const customer = await prisma.customer.findFirst({ where: { id: fields.customerId, companyId: session.companyId } });
          if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 400 });
          data.customerId = fields.customerId;
        } else {
          data.customerId = null;
        }
      }

      if (fields.driverId !== undefined) {
        if (fields.driverId) {
          const driver = await prisma.driver.findFirst({ where: { id: fields.driverId, companyId: session.companyId } });
          if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 400 });
          // Check driver has assigned truck
          if (!driver.assignedTruckId) {
            return NextResponse.json({ error: `Driver ${driver.name} has no truck assigned` }, { status: 400 });
          }
          data.driverId = fields.driverId;
        } else {
          data.driverId = null;
        }
      }

      if (fields.brokerId !== undefined) {
        if (fields.brokerId) {
          const broker = await prisma.broker.findFirst({ where: { id: fields.brokerId, companyId: session.companyId } });
          if (!broker) return NextResponse.json({ error: 'Broker not found' }, { status: 400 });
          data.brokerId = fields.brokerId;
        } else {
          data.brokerId = null;
        }
      }

      if (fields.material !== undefined) data.material = fields.material?.trim() || null;
      if (fields.hauledFrom !== undefined) data.hauledFrom = fields.hauledFrom?.trim() || '';
      if (fields.hauledTo !== undefined) data.hauledTo = fields.hauledTo?.trim() || '';
      if (fields.truckNumber !== undefined) data.truckNumber = fields.truckNumber?.trim() || null;
      if (fields.ticketRef !== undefined) data.ticketRef = fields.ticketRef?.trim() || null;
      if (fields.date !== undefined) data.date = fields.date ? new Date(fields.date) : null;
      if (fields.ratePerUnit !== undefined) data.ratePerUnit = fields.ratePerUnit ? parseFloat(fields.ratePerUnit) : null;
      if (fields.quantityType !== undefined) {
        const validQtyTypes = ['LOADS', 'TONS', 'YARDS'];
        if (!validQtyTypes.includes(fields.quantityType)) {
          return NextResponse.json({ error: 'Invalid quantity type' }, { status: 400 });
        }
        data.quantityType = fields.quantityType;
      }

      if (Object.keys(data).length === 0) {
        return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
      }

      await prisma.ticket.updateMany({
        where: { id: { in: validIds } },
        data,
      });

      revalidatePath('/tickets');
      revalidatePath('/dashboard');
      return NextResponse.json({ success: true, updated: validIds.length, fields: Object.keys(data) });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bulk action failed' }, { status: 500 });
  }
}
