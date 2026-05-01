import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { startOfWeek, endOfWeek, format, subWeeks, addWeeks } from 'date-fns';
import { TripSheetView } from './TripSheetView';

export const dynamic = 'force-dynamic';

export default async function TripSheetPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { weekStart?: string; weekEnd?: string };
}) {
  const session = await requireSession();
  const [broker, company] = await Promise.all([
    prisma.broker.findFirst({ where: { id: params.id, companyId: session.companyId } }),
    prisma.company.findUniqueOrThrow({ where: { id: session.companyId }, select: { name: true } }),
  ]);
  if (!broker) notFound();

  // Find dispatcher contact from broker contacts
  const contacts = Array.isArray(broker.contacts) ? (broker.contacts as any[]) : [];
  const dispatcherContact = contacts.find(
    (c: any) => c.jobTitle && /dispatch/i.test(c.jobTitle),
  ) ?? contacts[0] ?? null;
  const dispatcherFullName = dispatcherContact?.name ?? company.name;
  const dispatcherName = dispatcherFullName.split(/\s+/)[0];

  // Default to current week (Mon–Sun)
  const now = new Date();
  const defaultStart = startOfWeek(now, { weekStartsOn: 1 });
  const defaultEnd = endOfWeek(now, { weekStartsOn: 1 });

  const weekStart = searchParams.weekStart || format(defaultStart, 'yyyy-MM-dd');
  const weekEnd = searchParams.weekEnd || format(defaultEnd, 'yyyy-MM-dd');

  const startDate = new Date(weekStart + 'T00:00:00');
  const endDate = new Date(weekEnd + 'T23:59:59.999');

  // Previous/next week navigation
  const prevStart = format(subWeeks(startDate, 1), 'yyyy-MM-dd');
  const prevEnd = format(subWeeks(endDate, 1), 'yyyy-MM-dd');
  const nextStart = format(addWeeks(startDate, 1), 'yyyy-MM-dd');
  const nextEnd = format(addWeeks(endDate, 1), 'yyyy-MM-dd');

  // Fetch tickets for this broker in the date range
  const tickets = await prisma.ticket.findMany({
    where: {
      brokerId: broker.id,
      companyId: session.companyId,
      deletedAt: null,
      OR: [
        { date: { gte: startDate, lte: endDate } },
        { date: null, createdAt: { gte: startDate, lte: endDate } },
      ],
    },
    include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
    orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
  });

  const serialized = tickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    date: t.date ? format(t.date, 'yyyy-MM-dd') : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    material: t.material,
    quantityType: t.quantityType,
    quantity: Number(t.quantity),
    hauledFrom: t.hauledFrom,
    hauledTo: t.hauledTo,
    ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit).toFixed(2) : null,
    ticketRef: t.ticketRef,
    customer: t.customer?.name ?? null,
    driver: t.driver?.name ?? null,
    truckNumber: (t.driver as any)?.assignedTruck?.truckNumber ?? null,
    status: t.status,
  }));

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <Link href={`/brokers/${broker.id}`} className="text-sm text-steel-500 hover:text-steel-800">
          ← {broker.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Weekly Trip Sheet</h1>
        <p className="text-sm text-steel-500 mt-0.5">
          {broker.name} · {Number(broker.commissionPct)}% commission
        </p>
      </header>

      {/* Week navigator */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <Link
          href={`/brokers/${broker.id}/trip-sheet?weekStart=${prevStart}&weekEnd=${prevEnd}`}
          className="btn-ghost text-sm"
        >
          ← Prev Week
        </Link>

        <form className="flex items-end gap-2" method="GET">
          <div>
            <label className="label text-xs" htmlFor="weekStart">From</label>
            <input
              id="weekStart"
              name="weekStart"
              type="date"
              className="input text-sm"
              defaultValue={weekStart}
            />
          </div>
          <div>
            <label className="label text-xs" htmlFor="weekEnd">To</label>
            <input
              id="weekEnd"
              name="weekEnd"
              type="date"
              className="input text-sm"
              defaultValue={weekEnd}
            />
          </div>
          <button type="submit" className="btn-accent text-sm">Go</button>
        </form>

        <Link
          href={`/brokers/${broker.id}/trip-sheet?weekStart=${nextStart}&weekEnd=${nextEnd}`}
          className="btn-ghost text-sm"
        >
          Next Week →
        </Link>
      </div>

      <TripSheetView
        brokerId={broker.id}
        brokerName={broker.name}
        brokerEmail={broker.email}
        commissionPct={Number(broker.commissionPct)}
        companyName={company.name}
        dispatcherName={dispatcherName}
        tickets={serialized}
        weekStart={weekStart}
        weekEnd={weekEnd}
      />
    </div>
  );
}
