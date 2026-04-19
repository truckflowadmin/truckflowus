import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import JobDetail from './JobDetail';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, companyId: session.companyId },
    include: {
      customer: { select: { id: true, name: true } },
      broker: { select: { id: true, name: true } },
      driver: { select: { id: true, name: true } },
      assignments: {
        include: { driver: { select: { id: true, name: true, assignedTruck: { select: { truckNumber: true, truckType: true } } } } },
        orderBy: { assignedAt: 'asc' },
      },
      tickets: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          ticketNumber: true,
          status: true,
          quantity: true,
          quantityType: true,
          hauledFrom: true,
          hauledTo: true,
          material: true,
          ticketRef: true,
          date: true,
          ratePerUnit: true,
          completedAt: true,
          invoiceId: true,
          photoUrl: true,
          scannedTons: true,
          scannedYards: true,
          scannedTicketNumber: true,
          scannedDate: true,
          scannedAt: true,
        },
      },
    },
  });

  if (!job) notFound();

  const invoiced = job.tickets.some(t => t.invoiceId != null);

  // Fetch assignment details via raw SQL (generated client doesn't know new columns)
  const rawAssignments: any[] = await prisma.$queryRaw`
    SELECT ja.id, ja."driverId", d.name AS "driverName", ja."truckNumber",
           t."truckType", ja."assignedAt", ja.status,
           ja."startedAt", ja."completedAt", ja."driverTimeSeconds", ja."lastResumedAt"
    FROM "JobAssignment" ja
    JOIN "Driver" d ON d.id = ja."driverId"
    LEFT JOIN "Truck" t ON t.id = d."assignedTruckId"
    WHERE ja."jobId" = ${id}
    ORDER BY ja."assignedAt" ASC
  `;

  // Serialize for client component
  const serialized = {
    ...job,
    hauledFromAddress: job.hauledFromAddress,
    hauledToAddress: job.hauledToAddress,
    ratePerUnit: job.ratePerUnit?.toString() ?? null,
    date: job.date?.toISOString() ?? null,
    requiredTruckCount: job.requiredTruckCount,
    requiredTruckType: job.requiredTruckType,
    assignments: rawAssignments.map((a: any) => ({
      id: a.id,
      driverId: a.driverId,
      driverName: a.driverName,
      truckNumber: a.truckNumber,
      truckType: a.truckType ?? null,
      assignedAt: a.assignedAt instanceof Date ? a.assignedAt.toISOString() : a.assignedAt,
      status: a.status ?? 'ASSIGNED',
      startedAt: a.startedAt instanceof Date ? a.startedAt.toISOString() : (a.startedAt ?? null),
      completedAt: a.completedAt instanceof Date ? a.completedAt.toISOString() : (a.completedAt ?? null),
      driverTimeSeconds: a.driverTimeSeconds ?? 0,
      lastResumedAt: a.lastResumedAt instanceof Date ? a.lastResumedAt.toISOString() : (a.lastResumedAt ?? null),
    })),
    driverTimeSeconds: job.driverTimeSeconds ?? 0,
    lastResumedAt: job.lastResumedAt?.toISOString() ?? null,
    assignedAt: job.assignedAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: undefined,
    tickets: job.tickets.map((t) => ({
      ...t,
      quantity: Number(t.quantity),
      ratePerUnit: t.ratePerUnit?.toString() ?? null,
      date: t.date?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      scannedAt: t.scannedAt?.toISOString() ?? null,
    })),
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <Link href="/jobs" className="text-sm text-steel-500 hover:text-steel-700">
        ← Back to Jobs
      </Link>
      <div className="mt-3">
        <JobDetail job={serialized} invoiced={invoiced} />
      </div>
    </div>
  );
}
