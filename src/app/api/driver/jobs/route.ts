import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';

/**
 * GET /api/driver/jobs
 * Returns the driver's assigned jobs and available (open) jobs.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const platform = req.headers.get('X-Platform');
  console.log(`[jobs] GET | Auth=${authHeader ? authHeader.slice(0, 25) + '...' : 'NONE'} | Platform=${platform}`);
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    console.log('[jobs] getDriverSessionFromRequest returned null — 401');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  console.log(`[jobs] Session OK: driver=${session.driverId}, company=${session.companyId}`);

  const { driverId, companyId } = session;

  // Get jobs assigned to this driver via JobAssignment
  const assignments = await prisma.jobAssignment.findMany({
    where: { driverId },
    include: {
      job: {
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
          deletedAt: true,
          customer: { select: { name: true } },
          broker: { select: { name: true } },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  });

  const jobs = assignments
    .filter((a) => !a.job.deletedAt)
    .map((a) => ({
      id: a.job.id,
      jobNumber: a.job.jobNumber,
      name: a.job.name,
      hauledFrom: a.job.hauledFrom,
      hauledTo: a.job.hauledTo,
      material: a.job.material,
      status: a.job.status,
      assignmentStatus: a.status,
      assignmentId: a.id,
      date: a.job.date,
      totalLoads: a.job.totalLoads,
      completedLoads: a.job.completedLoads,
      openForDrivers: a.job.openForDrivers,
    }));

  // Get open jobs available for self-assignment
  const availableJobs = await prisma.job.findMany({
    where: {
      companyId,
      openForDrivers: true,
      deletedAt: null,
      status: { in: ['CREATED', 'ASSIGNED'] },
      // Exclude jobs already assigned to this driver
      NOT: {
        assignments: { some: { driverId } },
      },
    },
    select: {
      id: true,
      jobNumber: true,
      name: true,
      hauledFrom: true,
      hauledTo: true,
      material: true,
      status: true,
      date: true,
      totalLoads: true,
      completedLoads: true,
      openForDrivers: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    jobs,
    availableJobs: availableJobs.map((j) => ({
      ...j,
      assignmentStatus: null,
      assignmentId: null,
    })),
  });
}
