'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import type { QuantityType } from '@prisma/client';

interface ScannedTicketInput {
  photoUrl: string;
  hauledFrom: string;
  hauledTo: string;
  material: string | null;
  quantityType: QuantityType;
  quantity: number;
  ticketRef: string | null;
  date: string | null;
  customerId: string | null;
  driverId: string | null;
  brokerId: string | null;
  ratePerUnit: number | null;
  scannedTons: string | null;
  scannedYards: string | null;
  scannedTicketNumber: string | null;
  scannedDate: string | null;
  scannedRawText: string | null;
}

export async function bulkCreateTicketsAction(ticketsJson: string) {
  const session = await requireSession();
  const tickets: ScannedTicketInput[] = JSON.parse(ticketsJson);

  if (!tickets.length) throw new Error('No tickets to create');

  const created: number[] = [];

  for (const t of tickets) {
    if (!t.hauledFrom?.trim() || !t.hauledTo?.trim()) continue;

    // Get next ticket number
    const last = await prisma.ticket.findFirst({
      where: { companyId: session.companyId },
      orderBy: { ticketNumber: 'desc' },
      select: { ticketNumber: true },
    });
    const ticketNumber = (last?.ticketNumber ?? 1000) + 1;

    // Save material for future reuse
    if (t.material) {
      await prisma.material.upsert({
        where: { companyId_name: { companyId: session.companyId, name: t.material } },
        update: {},
        create: { companyId: session.companyId, name: t.material },
      });
    }

    // Auto-fill truck number from driver's assigned truck
    let ticketTruck: string | null = null;
    if (t.driverId) {
      const d = await prisma.driver.findUnique({ where: { id: t.driverId }, select: { assignedTruck: { select: { truckNumber: true } } } });
      ticketTruck = d?.assignedTruck?.truckNumber || null;
    }

    await prisma.ticket.create({
      data: {
        companyId: session.companyId,
        ticketNumber,
        customerId: t.customerId || undefined,
        driverId: t.driverId || undefined,
        brokerId: t.brokerId || undefined,
        truckNumber: ticketTruck,
        material: t.material || undefined,
        quantityType: t.quantityType || 'LOADS',
        quantity: t.quantity || 1,
        hauledFrom: t.hauledFrom.trim(),
        hauledTo: t.hauledTo.trim(),
        ticketRef: t.ticketRef || undefined,
        date: t.date ? new Date(t.date) : undefined,
        ratePerUnit: t.ratePerUnit ?? undefined,
        status: t.driverId ? 'DISPATCHED' : 'PENDING',
        dispatchedAt: t.driverId ? new Date() : undefined,
        photoUrl: t.photoUrl || undefined,
        scannedTons: t.scannedTons,
        scannedYards: t.scannedYards,
        scannedTicketNumber: t.scannedTicketNumber,
        scannedDate: t.scannedDate,
        scannedRawText: t.scannedRawText,
        scannedAt: new Date(),
      },
    });

    created.push(ticketNumber);
  }

  revalidatePath('/tickets');
  return { created: created.length, ticketNumbers: created };
}
