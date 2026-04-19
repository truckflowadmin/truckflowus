import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import EditJobForm from './EditJobForm';
import JobPhotoUpload from '@/components/JobPhotoUpload';

export const dynamic = 'force-dynamic';

export default async function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const companyId = session.companyId;
  const { id } = await params;

  const [job, customers, drivers, materials, brokers] = await Promise.all([
    prisma.job.findFirst({
      where: { id, companyId },
      include: { assignments: { select: { driverId: true } } },
    }),
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.driver.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, assignedTruck: { select: { truckType: true } } },
    }),
    prisma.material.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
    prisma.broker.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!job) notFound();

  // Fetch photoUrl via raw SQL (generated client may not know this column yet)
  const photoRows: any[] = await prisma.$queryRaw`SELECT "photoUrl" FROM "Job" WHERE id = ${id}`;
  const jobPhotoUrl: string | null = photoRows[0]?.photoUrl ?? null;

  // Block editing invoiced jobs
  const invoicedCount = await prisma.ticket.count({
    where: { jobId: id, invoiceId: { not: null } },
  });
  if (invoicedCount > 0) redirect(`/jobs/${id}`);

  const serialized = {
    id: job.id,
    jobNumber: job.jobNumber,
    name: job.name,
    status: job.status,
    hauledFrom: job.hauledFrom,
    hauledFromAddress: job.hauledFromAddress,
    hauledTo: job.hauledTo,
    hauledToAddress: job.hauledToAddress,
    material: job.material,
    truckNumber: job.truckNumber,
    requiredTruckType: job.requiredTruckType,
    requiredTruckCount: job.requiredTruckCount,
    assignedDriverIds: job.assignments.map((a: any) => a.driverId),
    quantityType: job.quantityType,
    totalLoads: job.totalLoads,
    ratePerUnit: job.ratePerUnit?.toString() ?? null,
    date: job.date?.toISOString() ?? null,
    notes: job.notes,
    openForDrivers: job.openForDrivers,
    customerId: job.customerId,
    brokerId: job.brokerId,
    driverId: job.driverId,
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href={`/jobs/${id}`} className="text-sm text-steel-500 hover:text-steel-700">
        ← Back to Job #{job.jobNumber}
      </Link>
      <h1 className="text-2xl font-bold text-steel-900 mt-1 mb-6">Edit Job #{job.jobNumber}</h1>
      <div className="panel p-6">
        <EditJobForm
          job={serialized}
          customers={customers}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name, truckType: d.assignedTruck?.truckType ?? null }))}
          materials={materials.map((m) => m.name)}
          brokers={brokers}
        />
      </div>

      <div className="mt-6">
        <JobPhotoUpload jobId={id} currentPhotoUrl={jobPhotoUrl} />
      </div>
    </div>
  );
}
