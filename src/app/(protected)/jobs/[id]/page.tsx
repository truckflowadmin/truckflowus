import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import JobDetail from './JobDetail';
import JobPhotoUpload from '@/components/JobPhotoUpload';

export const dynamic = 'force-dynamic';

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  try {
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
        where: { deletedAt: null },
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

  // Fetch photoUrl via raw SQL (generated client may not know this column yet)
  let jobPhotoUrl: string | null = null;
  try {
    const photoRows: any[] = await prisma.$queryRaw`SELECT "photoUrl" FROM "Job" WHERE id = ${id}`;
    jobPhotoUrl = photoRows[0]?.photoUrl ?? null;
  } catch (photoErr) {
    console.error('[JobDetailPage] photoUrl query failed:', photoErr);
  }

  const invoiced = job.tickets.some(t => t.invoiceId != null);

  // Fetch assignment details via raw SQL (generated client doesn't know new columns)
  let rawAssignments: any[] = [];
  try {
    rawAssignments = await prisma.$queryRaw`
      SELECT ja.id, ja."driverId", d.name AS "driverName", ja."truckNumber",
             t."truckType", ja."assignedAt", ja.status,
             ja."startedAt", ja."completedAt", ja."driverTimeSeconds", ja."lastResumedAt"
      FROM "JobAssignment" ja
      JOIN "Driver" d ON d.id = ja."driverId"
      LEFT JOIN "Truck" t ON t.id = d."assignedTruckId"
      WHERE ja."jobId" = ${id}
      ORDER BY ja."assignedAt" ASC
    `;
  } catch (assignErr) {
    console.error('[JobDetailPage] rawAssignments query failed:', assignErr);
    // Fall back to Prisma assignments from the include
    rawAssignments = job.assignments.map((a: any) => ({
      id: a.id,
      driverId: a.driverId,
      driverName: a.driver?.name ?? 'Unknown',
      truckNumber: a.truckNumber ?? null,
      truckType: a.driver?.assignedTruck?.truckType ?? null,
      assignedAt: a.assignedAt,
      status: 'ASSIGNED',
      startedAt: null,
      completedAt: null,
      driverTimeSeconds: 0,
      lastResumedAt: null,
    }));
  }

  // Serialize for client component — explicitly list fields to avoid passing
  // non-serializable Prisma types (like Decimal) through the ...job spread
  const serialized = {
    id: job.id,
    companyId: job.companyId,
    jobNumber: job.jobNumber,
    name: job.name,
    customerId: job.customerId,
    brokerId: job.brokerId,
    driverId: job.driverId,
    status: job.status,
    hauledFrom: job.hauledFrom,
    hauledFromAddress: job.hauledFromAddress,
    hauledTo: job.hauledTo,
    hauledToAddress: job.hauledToAddress,
    material: job.material,
    truckNumber: job.truckNumber,
    requiredTruckType: job.requiredTruckType,
    requiredTruckCount: job.requiredTruckCount,
    quantityType: job.quantityType,
    totalLoads: job.totalLoads,
    completedLoads: job.completedLoads,
    ratePerUnit: job.ratePerUnit?.toString() ?? null,
    date: job.date?.toISOString() ?? null,
    notes: job.notes,
    photoUrl: job.photoUrl ?? null,
    openForDrivers: job.openForDrivers,
    driverTimeSeconds: job.driverTimeSeconds ?? 0,
    lastResumedAt: job.lastResumedAt?.toISOString() ?? null,
    assignedAt: job.assignedAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    deletedAt: job.deletedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    customer: job.customer,
    broker: job.broker,
    driver: job.driver,
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
    tickets: job.tickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      quantity: Number(t.quantity),
      quantityType: t.quantityType,
      hauledFrom: t.hauledFrom,
      hauledTo: t.hauledTo,
      material: t.material,
      ticketRef: t.ticketRef,
      date: t.date?.toISOString() ?? null,
      ratePerUnit: t.ratePerUnit?.toString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      invoiceId: t.invoiceId,
      photoUrl: t.photoUrl,
      scannedTons: t.scannedTons,
      scannedYards: t.scannedYards,
      scannedTicketNumber: t.scannedTicketNumber,
      scannedDate: t.scannedDate,
      scannedAt: t.scannedAt?.toISOString() ?? null,
    })),
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href="/jobs" className="text-sm text-steel-500 hover:text-steel-700">
        ← Back to Jobs
      </Link>
      <div className="mt-3">
        <JobDetail job={serialized} invoiced={invoiced} />
      </div>
      {!invoiced && (
        <div className="mt-6 max-w-5xl mx-auto">
          <JobPhotoUpload jobId={id} currentPhotoUrl={jobPhotoUrl} />
        </div>
      )}
    </div>
  );
  } catch (err: any) {
    console.error('[JobDetailPage] Server component error:', err);
    return (
      <div className="p-4 md:p-6 max-w-5xl mx-auto">
        <Link href="/jobs" className="text-sm text-steel-500 hover:text-steel-700">
          ← Back to Jobs
        </Link>
        <h1 className="text-2xl font-bold text-red-700 mt-1 mb-4">Error Loading Job</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm font-mono whitespace-pre-wrap">{err.message || 'Unknown error'}</p>
          <p className="text-red-600 text-xs mt-2 font-mono whitespace-pre-wrap">{err.stack?.slice(0, 500)}</p>
        </div>
      </div>
    );
  }
}
