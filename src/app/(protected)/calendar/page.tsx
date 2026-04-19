import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import DispatcherCalendar from './DispatcherCalendar';

export default async function CalendarPage() {
  const session = await requireSession();
  const companyId = session.companyId;

  // Date window: 2 months back → 3 months ahead
  const rangeStart = new Date();
  rangeStart.setMonth(rangeStart.getMonth() - 2);
  rangeStart.setDate(1);
  rangeStart.setHours(0, 0, 0, 0);

  const rangeEnd = new Date();
  rangeEnd.setMonth(rangeEnd.getMonth() + 4);
  rangeEnd.setDate(0); // last day of month+3
  rangeEnd.setHours(23, 59, 59, 999);

  // Fetch all three data sources in parallel
  const [timeOffRequests, jobs, tickets] = await Promise.all([
    prisma.timeOffRequest.findMany({
      where: {
        companyId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: rangeEnd },
        endDate: { gte: rangeStart },
      },
      include: { driver: { select: { name: true } } },
      orderBy: { startDate: 'asc' },
    }),
    prisma.job.findMany({
      where: {
        companyId,
        date: { gte: rangeStart, lte: rangeEnd },
        status: { not: 'CANCELLED' },
      },
      include: {
        driver: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.ticket.findMany({
      where: {
        companyId,
        date: { gte: rangeStart, lte: rangeEnd },
        status: { not: 'CANCELLED' },
      },
      include: {
        driver: { select: { name: true } },
        customer: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    }),
  ]);

  // Serialize for client
  const serializedTimeOff = timeOffRequests.map((r) => ({
    id: r.id,
    type: 'timeoff' as const,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate.toISOString(),
    status: r.status,
    driverName: r.driver.name,
    reason: r.reason,
  }));

  const serializedJobs = jobs.map((j) => ({
    id: j.id,
    type: 'job' as const,
    date: j.date!.toISOString(),
    jobNumber: j.jobNumber,
    name: j.name,
    status: j.status,
    driverName: j.driver?.name ?? null,
    customerName: j.customer?.name ?? null,
    material: j.material,
    totalLoads: j.totalLoads,
    completedLoads: j.completedLoads,
  }));

  const serializedTickets = tickets.map((t) => ({
    id: t.id,
    type: 'ticket' as const,
    date: t.date!.toISOString(),
    ticketNumber: t.ticketNumber,
    status: t.status,
    driverName: t.driver?.name ?? null,
    customerName: t.customer?.name ?? null,
    material: t.material,
    hauledFrom: t.hauledFrom,
    hauledTo: t.hauledTo,
  }));

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-steel-900 mb-6">Calendar</h1>
      <DispatcherCalendar
        timeOffEvents={serializedTimeOff}
        jobEvents={serializedJobs}
        ticketEvents={serializedTickets}
      />
    </div>
  );
}
