import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';
import {
  removeTicketFromSheetAction,
  updateTripSheetStatusAction,
  deleteTripSheetAction,
  bulkUpdateTripSheetStatusAction,
} from './actions';
import { TripSheetsPage } from './TripSheetsPage';

export const dynamic = 'force-dynamic';

export default async function TripSheetsListPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const broker = await prisma.broker.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!broker) notFound();

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: session.companyId },
    select: { name: true },
  });

  // Fetch sheets with full ticket data for inline expansion
  const sheets = await prisma.tripSheet.findMany({
    where: { brokerId: broker.id, companyId: session.companyId },
    include: {
      tickets: {
        where: { deletedAt: null },
        include: {
          customer: true,
          driver: { include: { assignedTruck: { select: { truckNumber: true } } } },
        },
        orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
      },
    },
    orderBy: { weekEnding: 'desc' },
  });

  const sheetRows = sheets.map((s) => {
    const totalDue = s.tickets.reduce((sum, t) => {
      const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
      return sum + rate * Number(t.quantity);
    }, 0);

    return {
      id: s.id,
      weekEnding: s.weekEnding.toISOString(),
      status: s.status,
      ticketCount: s.tickets.length,
      totalDue: totalDue.toFixed(2),
      createdAt: s.createdAt.toISOString(),
      tickets: s.tickets.map((t) => ({
        id: t.id,
        ticketNumber: t.ticketNumber,
        ticketRef: t.ticketRef,
        date: t.date ? t.date.toISOString() : null,
        completedAt: t.completedAt ? t.completedAt.toISOString() : null,
        customerName: t.customer?.name ?? null,
        hauledFrom: t.hauledFrom,
        hauledTo: t.hauledTo,
        quantity: Number(t.quantity),
        quantityType: t.quantityType,
        ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit) : 0,
        truckNumber: (t.driver as any)?.assignedTruck?.truckNumber ?? t.truckNumber ?? '',
        driverName: t.driver?.name ?? '(Unassigned)',
      })),
    };
  });

  // Available tickets for adding to draft sheets
  const availableTickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      tripSheetId: null,
    },
    include: { customer: true, driver: true },
    orderBy: [{ date: 'desc' }],
    take: 200,
  });

  const serializedAvailable = availableTickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    ticketRef: t.ticketRef,
    date: t.date ? format(t.date, 'yyyy-MM-dd') : null,
    customer: t.customer?.name ?? null,
    driver: t.driver?.name ?? null,
    hauledFrom: t.hauledFrom,
    hauledTo: t.hauledTo,
    quantity: Number(t.quantity),
    quantityType: t.quantityType,
    ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit).toFixed(2) : null,
  }));

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <Link href={`/brokers/${broker.id}`} className="text-sm text-steel-500 hover:text-steel-800">
          &larr; {broker.name}
        </Link>
        <div className="flex items-center justify-between mt-1">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trip Sheets</h1>
            <p className="text-sm text-steel-500 mt-0.5">
              {broker.name} &middot; {Number(broker.commissionPct)}% commission
            </p>
          </div>
          <Link href={`/brokers/${broker.id}/trip-sheets/new`} className="btn-accent">
            + New Trip Sheet
          </Link>
        </div>
      </header>

      <TripSheetsPage
        brokerId={broker.id}
        brokerName={broker.name}
        brokerEmail={broker.email}
        companyName={company.name}
        sheets={sheetRows}
        availableTickets={serializedAvailable}
        removeAction={removeTicketFromSheetAction}
        updateStatusAction={updateTripSheetStatusAction}
        deleteAction={deleteTripSheetAction}
        bulkUpdateStatusAction={bulkUpdateTripSheetStatusAction}
      />
    </div>
  );
}
