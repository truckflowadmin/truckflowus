'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import type { QuantityType } from '@prisma/client';
import { enforceTicketLimit } from '@/lib/features';

interface JobScannedTicketInput {
  jobId: string;
  photoUrl: string;
  quantity: number;
  quantityType: QuantityType;
  ticketRef: string | null;
  date: string | null;
  // These can override job defaults if needed
  hauledFrom: string | null;
  hauledTo: string | null;
  material: string | null;
  customerId: string | null;
  driverId: string | null;
  brokerId: string | null;
  ratePerUnit: number | null;
  truckNumber: string | null;
  // Scanned data for audit
  scannedTons: string | null;
  scannedYards: string | null;
  scannedTicketNumber: string | null;
  scannedDate: string | null;
  scannedRawText: string | null;
}

export async function bulkCreateJobTicketsAction(ticketsJson: string) {
  const session = await requireSession();
  const tickets: JobScannedTicketInput[] = JSON.parse(ticketsJson);

  if (!tickets.length) throw new Error('No tickets to create');

  const jobId = tickets[0].jobId;
  if (!jobId) throw new Error('No job ID provided');

  // Verify job belongs to this company — include driver's current truck assignment
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: session.companyId },
    include: { driver: { select: { truckNumber: true, assignedTruck: { select: { truckNumber: true } } } } },
  });
  if (!job) throw new Error('Job not found');

  // Block adding tickets to invoiced jobs
  const invoicedCount = await prisma.ticket.count({
    where: { jobId, invoiceId: { not: null } },
  });
  if (invoicedCount > 0) {
    throw new Error('This job has invoiced tickets and cannot be modified');
  }

  await enforceTicketLimit(session.companyId, tickets.length);

  const created: number[] = [];

  for (const t of tickets) {
    // Use job defaults, allow per-ticket overrides
    const hauledFrom = (t.hauledFrom || job.hauledFrom).trim();
    const hauledTo = (t.hauledTo || job.hauledTo).trim();
    if (!hauledFrom || !hauledTo) continue;

    const material = t.material || job.material;
    // Always use job's customer/driver/broker — these must match the job
    const customerId = job.customerId;
    const driverId = job.driverId;
    const brokerId = job.brokerId;
    const ratePerUnit = t.ratePerUnit ?? (job.ratePerUnit ? Number(job.ratePerUnit) : null);
    const quantityType = t.quantityType || job.quantityType || 'LOADS';

    // Get next ticket number — raw SQL bypasses soft-delete middleware
    const ticketNumRows = await prisma.$queryRaw<[{ maxNum: number | null }]>`
      SELECT MAX("ticketNumber") AS "maxNum" FROM "Ticket" WHERE "companyId" = ${session.companyId}
    `;
    const ticketNumber = (ticketNumRows[0]?.maxNum ?? 1000) + 1;

    // Save material for reuse
    if (material) {
      await prisma.material.upsert({
        where: { companyId_name: { companyId: session.companyId, name: material } },
        update: {},
        create: { companyId: session.companyId, name: material },
      });
    }

    // Truck number: driver's assigned truck takes priority, then job, then driver profile fallback
    const driverTruck = job.driver?.assignedTruck?.truckNumber ?? null;
    const truckNumber = driverTruck || null;

    await prisma.ticket.create({
      data: {
        companyId: session.companyId,
        ticketNumber,
        jobId,
        customerId,
        driverId,
        brokerId,
        truckNumber,
        material: material || undefined,
        quantityType,
        quantity: t.quantity || 1,
        hauledFrom,
        hauledTo,
        ticketRef: t.ticketRef || undefined,
        date: t.date ? new Date(t.date) : (job.date ?? undefined),
        ratePerUnit: ratePerUnit ?? undefined,
        status: driverId ? 'DISPATCHED' : 'PENDING',
        dispatchedAt: driverId ? new Date() : undefined,
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

  // Update job completedLoads count
  if (created.length > 0) {
    const newCompleted = job.completedLoads + created.length;
    const jobDone = job.totalLoads > 0 && newCompleted >= job.totalLoads;
    await prisma.job.update({
      where: { id: jobId },
      data: {
        completedLoads: newCompleted,
        status: jobDone ? 'COMPLETED' : job.status === 'CREATED' || job.status === 'ASSIGNED' ? 'IN_PROGRESS' : job.status,
        startedAt: job.startedAt ?? new Date(),
        completedAt: jobDone ? new Date() : undefined,
      },
    });
  }

  revalidatePath('/tickets');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/jobs');
  return { created: created.length, ticketNumbers: created };
}
