import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * One-time migration: sync all non-invoiced/non-trip-sheeted tickets
 * so their customerId, brokerId, driverId, and truckNumber match their job
 * and the driver's currently assigned truck.
 *
 * GET /api/migrate-ticket-customers
 *
 * Safe to run multiple times — only updates mismatched tickets.
 * Delete this route after running it.
 */
export async function GET() {
  try {
    // 1) Fix ALL job-linked tickets: sync customer, broker, driver from job
    //    (includes invoiced/trip-sheeted tickets for customer/broker sync)
    const ticketsToFix = await prisma.ticket.findMany({
      where: {
        jobId: { not: null },
      },
      select: {
        id: true,
        ticketNumber: true,
        customerId: true,
        brokerId: true,
        driverId: true,
        truckNumber: true,
        invoiceId: true,
        tripSheetId: true,
        job: {
          select: {
            id: true,
            customerId: true,
            brokerId: true,
            driverId: true,
          },
        },
      },
    });

    const updates: { ticketId: string; ticketNumber: number; changes: Record<string, string | null> }[] = [];

    for (const ticket of ticketsToFix) {
      if (!ticket.job) continue;
      const changes: Record<string, string | null> = {};

      // Always sync customer and broker from job
      if (ticket.job.customerId && ticket.customerId !== ticket.job.customerId) {
        changes.customerId = ticket.job.customerId;
      }
      if (ticket.job.brokerId && ticket.brokerId !== ticket.job.brokerId) {
        changes.brokerId = ticket.job.brokerId;
      }
      // Only sync driver for non-invoiced tickets
      if (!ticket.invoiceId && ticket.job.driverId && ticket.driverId !== ticket.job.driverId) {
        changes.driverId = ticket.job.driverId;
      }

      if (Object.keys(changes).length > 0) {
        updates.push({ ticketId: ticket.id, ticketNumber: ticket.ticketNumber, changes });
      }
    }

    // Apply job-sync updates
    for (const u of updates) {
      await prisma.ticket.update({
        where: { id: u.ticketId },
        data: u.changes,
      });
    }

    // 2) Fix job truckNumbers: update every job's truckNumber to match the
    //    assigned driver's current truck (not stale legacy data)
    const jobsWithDrivers = await prisma.job.findMany({
      where: { driverId: { not: null } },
      select: {
        id: true,
        truckNumber: true,
        driver: {
          select: {
            assignedTruck: { select: { truckNumber: true } },
          },
        },
      },
    });

    let jobTruckUpdates = 0;
    for (const j of jobsWithDrivers) {
      const correctTruck = j.driver?.assignedTruck?.truckNumber ?? null;
      if (j.truckNumber !== correctTruck) {
        await prisma.job.update({
          where: { id: j.id },
          data: { truckNumber: correctTruck },
        });
        jobTruckUpdates++;
      }
    }

    // 3) Fix ticket truckNumbers: update every non-invoiced ticket's truckNumber
    //    to match the driver's currently assigned truck
    const ticketsWithDrivers = await prisma.ticket.findMany({
      where: {
        driverId: { not: null },
        invoiceId: null,
        tripSheetId: null,
      },
      select: {
        id: true,
        truckNumber: true,
        driverId: true,
        driver: {
          select: {
            assignedTruck: { select: { truckNumber: true } },
          },
        },
      },
    });

    let ticketTruckUpdates = 0;
    for (const t of ticketsWithDrivers) {
      const correctTruck = t.driver?.assignedTruck?.truckNumber ?? null;
      if (t.truckNumber !== correctTruck) {
        await prisma.ticket.update({
          where: { id: t.id },
          data: { truckNumber: correctTruck },
        });
        ticketTruckUpdates++;
      }
    }

    return NextResponse.json({
      message: `Synced ${updates.length} tickets to jobs, fixed ${jobTruckUpdates} job truck numbers, fixed ${ticketTruckUpdates} ticket truck numbers`,
      jobSyncs: updates.length,
      jobSyncDetails: updates.map((u) => ({ ticket: u.ticketNumber, ...u.changes })),
      jobTruckFixes: jobTruckUpdates,
      ticketTruckFixes: ticketTruckUpdates,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
