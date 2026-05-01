import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/drivers/[id]/tracking?from=...&to=...&jobId=...&limit=2000
 * Returns location history for a driver within a date range.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { companyId } = session;
  if (!companyId) return NextResponse.json({ error: 'Company context required' }, { status: 403 });

  // Verify driver belongs to this company
  const driver = await prisma.driver.findFirst({
    where: { id: params.id, companyId },
    select: { id: true, name: true, truckNumber: true },
  });
  if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const jobId = searchParams.get('jobId');
  const limitParam = searchParams.get('limit');
  const limit = Math.min(parseInt(limitParam || '2000', 10) || 2000, 5000);

  // Build where clause for locations
  const where: any = {
    driverId: params.id,
    companyId,
  };
  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from + 'T00:00:00');
    if (to) where.recordedAt.lte = new Date(to + 'T23:59:59.999');
  }
  if (jobId) where.jobId = jobId;

  // Get location pings via raw SQL (DriverLocation not in generated client)
  let locations: any[];
  if (jobId && from && to) {
    locations = await prisma.$queryRaw`
      SELECT dl.id, dl."jobId", dl.latitude, dl.longitude, dl.speed, dl.heading,
             dl.accuracy, dl."recordedAt",
             j."jobNumber", j.name AS "jobName"
      FROM "DriverLocation" dl
      LEFT JOIN "Job" j ON j.id = dl."jobId"
      WHERE dl."driverId" = ${params.id}
        AND dl."companyId" = ${companyId}
        AND dl."recordedAt" >= ${new Date(from + 'T00:00:00')}
        AND dl."recordedAt" <= ${new Date(to + 'T23:59:59.999')}
        AND dl."jobId" = ${jobId}
      ORDER BY dl."recordedAt" DESC
      LIMIT ${limit}
    `;
  } else if (from && to) {
    locations = await prisma.$queryRaw`
      SELECT dl.id, dl."jobId", dl.latitude, dl.longitude, dl.speed, dl.heading,
             dl.accuracy, dl."recordedAt",
             j."jobNumber", j.name AS "jobName"
      FROM "DriverLocation" dl
      LEFT JOIN "Job" j ON j.id = dl."jobId"
      WHERE dl."driverId" = ${params.id}
        AND dl."companyId" = ${companyId}
        AND dl."recordedAt" >= ${new Date(from + 'T00:00:00')}
        AND dl."recordedAt" <= ${new Date(to + 'T23:59:59.999')}
      ORDER BY dl."recordedAt" DESC
      LIMIT ${limit}
    `;
  } else if (jobId) {
    locations = await prisma.$queryRaw`
      SELECT dl.id, dl."jobId", dl.latitude, dl.longitude, dl.speed, dl.heading,
             dl.accuracy, dl."recordedAt",
             j."jobNumber", j.name AS "jobName"
      FROM "DriverLocation" dl
      LEFT JOIN "Job" j ON j.id = dl."jobId"
      WHERE dl."driverId" = ${params.id}
        AND dl."companyId" = ${companyId}
        AND dl."jobId" = ${jobId}
      ORDER BY dl."recordedAt" DESC
      LIMIT ${limit}
    `;
  } else {
    // Default: last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    locations = await prisma.$queryRaw`
      SELECT dl.id, dl."jobId", dl.latitude, dl.longitude, dl.speed, dl.heading,
             dl.accuracy, dl."recordedAt",
             j."jobNumber", j.name AS "jobName"
      FROM "DriverLocation" dl
      LEFT JOIN "Job" j ON j.id = dl."jobId"
      WHERE dl."driverId" = ${params.id}
        AND dl."companyId" = ${companyId}
        AND dl."recordedAt" >= ${weekAgo}
      ORDER BY dl."recordedAt" DESC
      LIMIT ${limit}
    `;
  }

  // Get all jobs for this driver (for filter dropdown)
  const jobs: any[] = await prisma.$queryRaw`
    SELECT DISTINCT j.id, j."jobNumber", j.name
    FROM "DriverLocation" dl
    JOIN "Job" j ON j.id = dl."jobId"
    WHERE dl."driverId" = ${params.id} AND dl."companyId" = ${companyId}
    ORDER BY j."jobNumber" DESC
    LIMIT 100
  `;

  return NextResponse.json({
    driver: { id: driver.id, name: driver.name, truckNumber: driver.truckNumber },
    locations: locations.map((l) => ({
      id: l.id,
      jobId: l.jobId,
      jobNumber: l.jobNumber,
      jobName: l.jobName,
      latitude: Number(l.latitude),
      longitude: Number(l.longitude),
      speed: l.speed != null ? Number(l.speed) : null,
      heading: l.heading != null ? Number(l.heading) : null,
      accuracy: l.accuracy != null ? Number(l.accuracy) : null,
      recordedAt: l.recordedAt instanceof Date ? l.recordedAt.toISOString() : String(l.recordedAt),
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      jobNumber: j.jobNumber,
      name: j.name,
    })),
  });
}
