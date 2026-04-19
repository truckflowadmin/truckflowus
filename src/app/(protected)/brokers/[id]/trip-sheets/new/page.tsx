import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';
import { createTripSheetAction } from '../actions';
import { TicketSelector } from './TicketSelector';

export const dynamic = 'force-dynamic';

export default async function NewTripSheetPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const broker = await prisma.broker.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!broker) notFound();

  // Get all completed tickets not yet on a trip sheet
  const tickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      status: 'COMPLETED',
      tripSheetId: null,
    },
    include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } }, broker: true },
    orderBy: [{ date: 'desc' }, { completedAt: 'desc' }],
  });

  const serialized = tickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    ticketRef: t.ticketRef,
    date: t.date ? format(t.date, 'yyyy-MM-dd') : null,
    customer: t.customer?.name ?? null,
    driver: t.driver?.name ?? null,
    truckNumber: (t.driver as any)?.assignedTruck?.truckNumber ?? null,
    material: t.material,
    quantity: Number(t.quantity),
    quantityType: t.quantityType,
    hauledFrom: t.hauledFrom,
    hauledTo: t.hauledTo,
    ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit).toFixed(2) : null,
    currentBroker: t.broker?.name ?? null,
  }));

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <Link href={`/brokers/${broker.id}/trip-sheets`} className="text-sm text-steel-500 hover:text-steel-800">
          ← Trip Sheets for {broker.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">New Trip Sheet</h1>
        <p className="text-sm text-steel-500 mt-0.5">
          Select completed tickets to include on this trip sheet for {broker.name}.
          Tickets from any customer or driver can be added.
        </p>
      </header>

      <TicketSelector
        action={createTripSheetAction}
        brokerId={broker.id}
        tickets={serialized}
      />
    </div>
  );
}
