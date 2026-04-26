import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest, verifyDriverSession } from '@/lib/driver-auth';
import jwt from 'jsonwebtoken';

/**
 * GET /api/driver/jobs
 * Returns the driver's assigned jobs and available (open) jobs.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  const platform = req.headers.get('X-Platform');

  // --- TEMPORARY DEBUG: inline JWT diagnosis ---
  let debugInfo: any = { authHeader: authHeader ? `${authHeader.slice(0, 30)}...` : 'NONE', platform };
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const decoded = jwt.decode(token, { complete: true });
      debugInfo.decoded = decoded ? { header: decoded.header, aud: (decoded.payload as any)?.aud, exp: (decoded.payload as any)?.exp, driverId: (decoded.payload as any)?.driverId } : 'DECODE_FAILED';
    } catch (e: any) {
      debugInfo.decodeErr = e.message;
    }
    // Try verify without audience to see if the signature is OK
    try {
      const secret = process.env.JWT_SECRET;
      debugInfo.hasSecret = !!secret;
      debugInfo.secretLen = secret?.length;
      const verified = jwt.verify(token, secret!, { audience: 'driver' });
      debugInfo.verified = 'OK';
    } catch (e: any) {
      debugInfo.verifyErr = e.message;
    }
  }
  console.log(`[jobs] DEBUG:`, JSON.stringify(debugInfo));
  // --- END TEMPORARY DEBUG ---

  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized', _debug: debugInfo }, { status: 401 });
  }

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
