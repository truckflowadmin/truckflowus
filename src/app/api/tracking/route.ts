import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/tracking
 * Returns the latest location for each active driver (in-progress jobs).
 * Used by the dispatcher live map view.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = session;
  if (!companyId) {
    return NextResponse.json({ error: 'Company context required' }, { status: 403 });
  }

  const jobId = req.nextUrl.searchParams.get('jobId');

  // If a specific jobId is requested, return locations for that job
  if (jobId) {
    const locations = await prisma.driverLocation.findMany({
      where: { jobId, companyId },
      orderBy: { recordedAt: 'desc' },
      take: 500,
      select: {
        id: true,
        driverId: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        recordedAt: true,
        driver: { select: { name: true } },
      },
    });

    return NextResponse.json({ locations });
  }

  // Otherwise, get the latest location for each driver with an active job
  // First get all in-progress assignments for this company
  const activeAssignments = await prisma.jobAssignment.findMany({
    where: {
      status: 'IN_PROGRESS',
      job: { companyId, deletedAt: null },
    },
    select: {
      id: true,
      driverId: true,
      jobId: true,
      driver: { select: { name: true, truckNumber: true } },
      job: { select: { jobNumber: true, name: true, hauledTo: true } },
    },
  });

  // For each active driver, get their latest location ping
  const driverLocations = await Promise.all(
    activeAssignments.map(async (assignment) => {
      const latestPing = await prisma.driverLocation.findFirst({
        where: {
          driverId: assignment.driverId,
          jobId: assignment.jobId,
        },
        orderBy: { recordedAt: 'desc' },
        select: {
          latitude: true,
          longitude: true,
          speed: true,
          heading: true,
          recordedAt: true,
        },
      });

      return {
        driverId: assignment.driverId,
        driverName: assignment.driver.name,
        truckNumber: assignment.driver.truckNumber,
        jobId: assignment.jobId,
        jobNumber: assignment.job.jobNumber,
        jobName: assignment.job.name,
        destination: assignment.job.hauledTo,
        latitude: latestPing?.latitude ?? 0,
        longitude: latestPing?.longitude ?? 0,
        speed: latestPing?.speed ?? null,
        heading: latestPing?.heading ?? null,
        lastUpdate: latestPing?.recordedAt ?? new Date(),
        hasLocation: !!latestPing,
      };
    }),
  );

  return NextResponse.json({
    drivers: driverLocations,
  });
}
