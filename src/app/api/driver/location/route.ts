import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';

/**
 * POST /api/driver/location
 * Receives batch GPS pings from the native driver app.
 * Called by expo-location background task every ~30 seconds.
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { driverId, companyId } = session;
  const body = await req.json();
  const { jobId, assignmentId, locations } = body;

  if (!jobId || !Array.isArray(locations) || locations.length === 0) {
    return NextResponse.json({ error: 'jobId and locations[] required' }, { status: 400 });
  }

  // Validate the job belongs to this driver's company
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Validate max batch size (prevent abuse)
  const batch = locations.slice(0, 100);

  // Insert all location pings
  await prisma.driverLocation.createMany({
    data: batch.map((loc: any) => ({
      companyId,
      driverId,
      jobId,
      assignmentId: assignmentId || null,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      accuracy: loc.accuracy != null ? Number(loc.accuracy) : null,
      speed: loc.speed != null ? Number(loc.speed) : null,
      heading: loc.heading != null ? Number(loc.heading) : null,
      altitude: loc.altitude != null ? Number(loc.altitude) : null,
      recordedAt: new Date(loc.timestamp),
    })),
  });

  return NextResponse.json({ ok: true, count: batch.length });
}

/**
 * GET /api/driver/location?jobId=xxx
 * Returns the latest location pings for a job (used by dispatcher map view).
 * Supports both driver session (mobile) and dispatcher session (web).
 */
export async function GET(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = session;
  const jobId = req.nextUrl.searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  // Get latest location per driver for this job
  const validJobId: string = jobId;
  const locations = await prisma.driverLocation.findMany({
    where: { jobId: validJobId, companyId },
    orderBy: { recordedAt: 'desc' },
    take: 200,
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
