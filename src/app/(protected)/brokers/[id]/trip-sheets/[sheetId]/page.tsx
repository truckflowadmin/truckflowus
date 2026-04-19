import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';
import { removeTicketFromSheetAction, updateTripSheetStatusAction, deleteTripSheetAction } from '../actions';
import { AddTicketsForm } from './AddTicketsForm';
import { TruckSheetManager } from './TruckSheetManager';

export const dynamic = 'force-dynamic';

export default async function TripSheetDetailPage({
  params,
}: {
  params: { id: string; sheetId: string };
}) {
  const session = await requireSession();

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: params.sheetId, brokerId: params.id, companyId: session.companyId },
    include: {
      broker: true,
      tickets: {
        include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
        orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
      },
    },
  });
  if (!sheet) notFound();

  const isDraft = sheet.status === 'DRAFT';
  const broker = sheet.broker;
  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId }, select: { name: true } });

  // Find dispatcher contact from broker contacts
  const contacts = Array.isArray(broker.contacts) ? (broker.contacts as any[]) : [];
  const dispatcherContact = contacts.find(
    (c: any) => c.jobTitle && /dispatch/i.test(c.jobTitle),
  ) ?? contacts[0] ?? null;
  const dispatcherFullName = dispatcherContact?.name ?? company.name;
  const dispatcherName = dispatcherFullName.split(/\s+/)[0];

  // Available tickets to add (completed, not on any trip sheet)
  const availableTickets = isDraft
    ? await prisma.ticket.findMany({
        where: {
          companyId: session.companyId,
          status: 'COMPLETED',
          tripSheetId: null,
        },
        include: { customer: true, driver: true },
        orderBy: [{ date: 'desc' }],
        take: 200,
      })
    : [];

  // Flatten tickets for the TruckSheetManager client component
  const flatTickets = sheet.tickets.map((t) => ({
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
  }));

  const totalDue = sheet.tickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-steel-200 text-steel-700',
    SENT: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
  };

  const pdfUrl = `/api/brokers/${broker.id}/trip-sheets/${sheet.id}/pdf`;

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <Link href={`/brokers/${broker.id}/trip-sheets`} className="text-sm text-steel-500 hover:text-steel-800">
          ← Trip Sheets for {broker.name}
        </Link>
        <div className="flex items-center justify-between mt-1 flex-wrap gap-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Trip Sheet — Week Ending {format(sheet.weekEnding, 'MMM d, yyyy')}
            </h1>
            <p className="text-sm text-steel-500 mt-0.5">
              {broker.name} · {sheet.tickets.length} tickets · ${totalDue.toFixed(2)}
            </p>
          </div>
          <span className={`badge text-sm px-3 py-1 ${statusColors[sheet.status] ?? ''}`}>
            {sheet.status}
          </span>
        </div>
      </header>

      {/* Delete (draft only) */}
      {isDraft && (
        <div className="mb-6">
          <form action={deleteTripSheetAction}>
            <input type="hidden" name="sheetId" value={sheet.id} />
            <button type="submit" className="text-sm text-red-600 hover:underline">
              Delete Trip Sheet
            </button>
          </form>
        </div>
      )}

      {/* Tickets grouped by truck — selectable with per-truck PDF, print, and email */}
      <TruckSheetManager
        sheetId={sheet.id}
        brokerId={broker.id}
        brokerEmail={broker.email}
        companyName={company.name}
        status={sheet.status}
        tickets={flatTickets}
        isDraft={isDraft}
        removeAction={removeTicketFromSheetAction}
        updateStatusAction={updateTripSheetStatusAction}
        fullPdfUrl={pdfUrl}
      />

      {/* Add more tickets (draft only) */}
      {isDraft && (
        <AddTicketsForm
          sheetId={sheet.id}
          availableTickets={availableTickets.map((t) => ({
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
          }))}
        />
      )}
    </div>
  );
}
