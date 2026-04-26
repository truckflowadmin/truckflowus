import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';

// Prevent Vercel/Next.js edge caching — always fetch fresh data
export const dynamic = 'force-dynamic';

/**
 * GET /api/driver/jobs/:id
 * Returns full job detail for the driver, including their assignment status.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { driverId } = session;
  const jobId = params.id;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      jobNumber: true,
      name: true,
      hauledFrom: true,
      hauledFromAddress: true,
      hauledTo: true,
      hauledToAddress: true,
      material: true,
      status: true,
      date: true,
      totalLoads: true,
      completedLoads: true,
      notes: true,
      truckNumber: true,
      openForDrivers: true,
      driverTimeSeconds: true,
      customer: { select: { name: true } },
      broker: { select: { name: true } },
      assignments: {
        where: { driverId },
        select: {
          id: true,
          status: true,
          driverTimeSeconds: true,
          startedAt: true,
          completedAt: true,
        },
      },
      proofOfDelivery: {
        where: { driverId },
        select: {
          id: true,
          type: true,
          fileUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const assignment = job.assignments[0] || null;

  return NextResponse.json({
    id: job.id,
    jobNumber: job.jobNumber,
    name: job.name,
    hauledFrom: job.hauledFrom,
    hauledFromAddress: job.hauledFromAddress,
    hauledTo: job.hauledTo,
    hauledToAddress: job.hauledToAddress,
    material: job.material,
    status: job.status,
    assignmentStatus: assignment?.status || null,
    assignmentId: assignment?.id || null,
    date: job.date,
    totalLoads: job.totalLoads,
    completedLoads: job.completedLoads,
    notes: job.notes,
    truckNumber: job.truckNumber,
    customerName: job.customer?.name || null,
    brokerName: job.broker?.name || null,
    driverTimeSeconds: assignment?.driverTimeSeconds || job.driverTimeSeconds,
    openForDrivers: job.openForDrivers,
    proofOfDelivery: job.proofOfDelivery,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
