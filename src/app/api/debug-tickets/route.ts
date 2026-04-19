import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/debug-tickets
 * Debug endpoint — shows all tickets with their job/customer data.
 * Delete after debugging.
 */
export async function GET() {
  const tickets = await prisma.ticket.findMany({
    orderBy: { ticketNumber: 'asc' },
    select: {
      id: true,
      ticketNumber: true,
      customerId: true,
      brokerId: true,
      driverId: true,
      jobId: true,
      truckNumber: true,
      status: true,
      customer: { select: { id: true, name: true } },
      broker: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true, assignedTruck: { select: { truckNumber: true } } } },
      job: { select: { id: true, name: true, customerId: true, brokerId: true, driverId: true, customer: { select: { name: true } }, broker: { select: { name: true } } } },
    },
  });

  return NextResponse.json({
    count: tickets.length,
    tickets: tickets.map((t) => ({
      ticketNumber: t.ticketNumber,
      ticketCustomerId: t.customerId,
      ticketCustomerName: t.customer?.name ?? null,
      ticketBrokerId: t.brokerId,
      ticketBrokerName: t.broker?.name ?? null,
      ticketDriverName: t.driver?.name ?? null,
      ticketTruckNumber: t.truckNumber,
      driverAssignedTruck: t.driver?.assignedTruck?.truckNumber ?? null,
      jobId: t.jobId,
      jobName: t.job?.name ?? null,
      jobCustomerId: t.job?.customerId ?? null,
      jobCustomerName: t.job?.customer?.name ?? null,
      jobBrokerId: t.job?.brokerId ?? null,
      jobBrokerName: t.job?.broker?.name ?? null,
      mismatch: {
        customer: t.jobId ? (t.customerId !== t.job?.customerId) : false,
        broker: t.jobId ? (t.brokerId !== t.job?.brokerId) : false,
      },
    })),
  });
}
