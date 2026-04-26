import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';
import { getMobileBody } from '@/lib/mobile-body';
import { createNotification, NOTIFICATION_TYPES } from '@/lib/notifications';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const VALID_JOB_STATUSES = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'];
const VALID_ACTIONS = ['start', 'resume', 'pause', 'complete', 'cancel', 'report_issue', 'assign'] as const;

/**
 * POST /api/driver/jobs/status
 * Body: { jobId, action, assignmentId?, note? }
 *
 * Actions: start, resume, pause, complete, cancel, report_issue, assign (self-claim)
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await getMobileBody(req);
  const { jobId, action, note } = body;

  if (!jobId || !action) {
    return NextResponse.json({ error: 'Missing jobId or action' }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: { id: true, active: true, companyId: true, name: true, assignedTruckId: true },
  });
  if (!driver || !driver.active) {
    return NextResponse.json({ error: 'Driver not found or inactive' }, { status: 404 });
  }

  // Handle self-assignment
  if (action === 'assign') {
    return handleSelfAssign(driver, jobId);
  }

  // Fetch the job
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      companyId: driver.companyId,
      deletedAt: null,
      OR: [
        { driverId: driver.id },
        { assignments: { some: { driverId: driver.id } } },
      ],
    },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Fetch all assignments
  const allAssignments: any[] = await prisma.$queryRaw`
    SELECT id, "jobId", "driverId", status, "startedAt", "completedAt",
           "driverTimeSeconds", "lastResumedAt"
    FROM "JobAssignment"
    WHERE "jobId" = ${jobId}
  `;

  // Find this driver's assignment
  let assignment = allAssignments.find((a: any) => a.driverId === driver.id);

  // Legacy fallback
  if (!assignment && job.driverId === driver.id) {
    await prisma.$executeRaw`
      INSERT INTO "JobAssignment" (id, "jobId", "driverId", status, "startedAt", "completedAt", "driverTimeSeconds", "lastResumedAt", "assignedAt")
      VALUES (${randomUUID()}, ${jobId}, ${driver.id}, ${job.status}, ${job.startedAt}, ${job.completedAt}, ${job.driverTimeSeconds || 0}, ${job.lastResumedAt}, NOW())
    `;
    const created: any[] = await prisma.$queryRaw`
      SELECT id, "jobId", "driverId", status, "startedAt", "completedAt",
             "driverTimeSeconds", "lastResumedAt"
      FROM "JobAssignment"
      WHERE "jobId" = ${jobId} AND "driverId" = ${driver.id}
      LIMIT 1
    `;
    assignment = created[0];
    allAssignments.push(assignment);
  }
  if (!assignment) {
    return NextResponse.json({ error: 'You are not assigned to this job' }, { status: 400 });
  }

  // Block if job has invoiced tickets
  const invoicedTickets = await prisma.ticket.count({
    where: { jobId, driverId: driver.id, invoiceId: { not: null } },
  });
  if (invoicedTickets > 0) {
    return NextResponse.json({ error: 'This job has invoiced tickets and cannot be modified' }, { status: 400 });
  }

  const now = new Date();
  const assignmentPatch: any = {};

  // Calculate elapsed seconds
  const elapsedSec = assignment.lastResumedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(assignment.lastResumedAt).getTime()) / 1000))
    : 0;

  if (action === 'start') {
    if (assignment.status !== 'ASSIGNED') {
      return NextResponse.json({ error: 'Your assignment must be ASSIGNED to start' }, { status: 400 });
    }
    if (!driver.assignedTruckId) {
      return NextResponse.json({ error: 'You must have a truck assigned. Contact your dispatcher.' }, { status: 400 });
    }
    assignmentPatch.status = 'IN_PROGRESS';
    if (!assignment.startedAt) assignmentPatch.startedAt = now;
    assignmentPatch.lastResumedAt = now;
  } else if (action === 'resume') {
    if (assignment.status !== 'ASSIGNED') {
      return NextResponse.json({ error: 'Your assignment must be paused to resume' }, { status: 400 });
    }
    assignmentPatch.status = 'IN_PROGRESS';
    assignmentPatch.lastResumedAt = now;
  } else if (action === 'pause') {
    if (assignment.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Your assignment must be IN_PROGRESS to pause' }, { status: 400 });
    }
    assignmentPatch.status = 'ASSIGNED';
    assignmentPatch.driverTimeSeconds = (assignment.driverTimeSeconds || 0) + elapsedSec;
    assignmentPatch.lastResumedAt = null;
  } else if (action === 'complete') {
    if (assignment.status !== 'IN_PROGRESS') {
      return NextResponse.json({ error: 'Your assignment must be IN_PROGRESS to complete' }, { status: 400 });
    }
    assignmentPatch.status = 'COMPLETED';
    assignmentPatch.completedAt = now;
    if (!assignment.startedAt) assignmentPatch.startedAt = now;
    assignmentPatch.driverTimeSeconds = (assignment.driverTimeSeconds || 0) + elapsedSec;
    assignmentPatch.lastResumedAt = null;
  } else if (action === 'cancel') {
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(assignment.status)) {
      return NextResponse.json({ error: 'Cannot cancel — wrong status' }, { status: 400 });
    }
    assignmentPatch.status = 'CANCELLED';
    if (assignment.lastResumedAt) {
      assignmentPatch.driverTimeSeconds = (assignment.driverTimeSeconds || 0) + elapsedSec;
      assignmentPatch.lastResumedAt = null;
    }
  } else if (action === 'report_issue') {
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(assignment.status)) {
      return NextResponse.json({ error: 'Your assignment must be active to report an issue' }, { status: 400 });
    }
    // No status change — just notification
  }

  // Update the driver's assignment
  if (Object.keys(assignmentPatch).length > 0) {
    const aId = assignment.id;
    if (action === 'start') {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${assignmentPatch.status}, "startedAt" = ${assignmentPatch.startedAt ?? now}, "lastResumedAt" = ${assignmentPatch.lastResumedAt ?? now} WHERE id = ${aId}`;
    } else if (action === 'resume') {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${assignmentPatch.status}, "lastResumedAt" = ${assignmentPatch.lastResumedAt ?? now} WHERE id = ${aId}`;
    } else if (action === 'pause') {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${assignmentPatch.status}, "driverTimeSeconds" = ${assignmentPatch.driverTimeSeconds ?? 0}, "lastResumedAt" = NULL WHERE id = ${aId}`;
    } else if (action === 'complete') {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${assignmentPatch.status}, "completedAt" = ${assignmentPatch.completedAt ?? now}, "startedAt" = COALESCE("startedAt", ${assignmentPatch.startedAt ?? now}), "driverTimeSeconds" = ${assignmentPatch.driverTimeSeconds ?? 0}, "lastResumedAt" = NULL WHERE id = ${aId}`;
    } else if (action === 'cancel') {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${assignmentPatch.status}, "driverTimeSeconds" = ${assignmentPatch.driverTimeSeconds ?? 0}, "lastResumedAt" = NULL WHERE id = ${aId}`;
    }
  }

  // Derive job-level status from all assignments
  const allStatuses = allAssignments.map((a: any) =>
    a.id === assignment!.id ? (assignmentPatch.status ?? a.status) : a.status
  );

  const jobPatch: any = {};
  if (allStatuses.every((s: string) => s === 'COMPLETED')) {
    jobPatch.status = 'COMPLETED';
    jobPatch.completedAt = now;
  } else if (allStatuses.every((s: string) => s === 'CANCELLED')) {
    jobPatch.status = 'CANCELLED';
  } else if (allStatuses.some((s: string) => s === 'COMPLETED')) {
    jobPatch.status = 'PARTIALLY_COMPLETED';
  } else if (allStatuses.some((s: string) => s === 'IN_PROGRESS')) {
    jobPatch.status = 'IN_PROGRESS';
    if (!job.startedAt) jobPatch.startedAt = now;
  } else if (allStatuses.some((s: string) => s === 'ASSIGNED')) {
    jobPatch.status = 'ASSIGNED';
  }

  if (Object.keys(jobPatch).length > 0 && jobPatch.status !== job.status) {
    if (!VALID_JOB_STATUSES.includes(jobPatch.status)) {
      return NextResponse.json({ error: 'Invalid derived job status' }, { status: 500 });
    }
    const jobStatusEnum = Prisma.raw(`'${jobPatch.status}'::"JobStatus"`);
    if (jobPatch.completedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${jobStatusEnum}, "completedAt" = ${jobPatch.completedAt} WHERE id = ${jobId}`;
    } else if (jobPatch.startedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${jobStatusEnum}, "startedAt" = ${jobPatch.startedAt} WHERE id = ${jobId}`;
    } else {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${jobStatusEnum} WHERE id = ${jobId}`;
    }
  }

  // Notify dispatcher
  const issueNote = (note || '').trim();
  const notifMap: Record<string, { type: string; verb: string }> = {
    start: { type: NOTIFICATION_TYPES.JOB_STARTED, verb: 'started' },
    pause: { type: NOTIFICATION_TYPES.JOB_PAUSED, verb: 'paused' },
    complete: { type: NOTIFICATION_TYPES.JOB_COMPLETED, verb: 'completed' },
    cancel: { type: NOTIFICATION_TYPES.JOB_CANCELLED, verb: 'cancelled' },
    report_issue: { type: NOTIFICATION_TYPES.JOB_ISSUE, verb: 'reported an issue on' },
  };
  const n = notifMap[action];
  if (n) {
    createNotification({
      companyId: driver.companyId,
      type: n.type as any,
      title: `${driver.name} ${n.verb} Job #${job.jobNumber} — ${job.name}`,
      body: action === 'report_issue' && issueNote ? issueNote : undefined,
      link: `/jobs/${jobId}`,
    });
  }

  const finalStatus = assignmentPatch.status ?? assignment.status;
  const finalTime = assignmentPatch.driverTimeSeconds ?? assignment.driverTimeSeconds ?? 0;
  const finalResumed = assignmentPatch.lastResumedAt !== undefined
    ? (assignmentPatch.lastResumedAt ? assignmentPatch.lastResumedAt.toISOString() : null)
    : (assignment.lastResumedAt ? new Date(assignment.lastResumedAt).toISOString() : null);

  return NextResponse.json({
    success: true,
    jobId,
    action,
    newStatus: finalStatus,
    driverTimeSeconds: finalTime,
    lastResumedAt: finalResumed,
  });
}

/**
 * Handle self-assignment for open jobs
 */
async function handleSelfAssign(
  driver: { id: string; companyId: string; name: string; assignedTruckId: string | null },
  jobId: string,
) {
  if (!driver.assignedTruckId) {
    return NextResponse.json({
      error: 'You must have a truck assigned. Contact your dispatcher.',
    }, { status: 400 });
  }

  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      companyId: driver.companyId,
      openForDrivers: true,
      deletedAt: null,
      status: { in: ['CREATED', 'ASSIGNED'] },
    },
    include: {
      assignments: { select: { id: true } },
    },
  });

  if (!job) {
    return NextResponse.json({ error: 'Job not available for claiming' }, { status: 400 });
  }

  // Check truck count
  const requiredCount = job.requiredTruckCount || 1;
  if (job.assignments.length >= requiredCount) {
    return NextResponse.json({ error: 'This job is already fully staffed' }, { status: 400 });
  }

  // Check not already assigned
  const existing = await prisma.jobAssignment.findFirst({
    where: { jobId, driverId: driver.id },
  });
  if (existing) {
    return NextResponse.json({ error: 'You are already assigned to this job' }, { status: 400 });
  }

  // Create assignment
  await prisma.jobAssignment.create({
    data: {
      jobId,
      driverId: driver.id,
      status: 'ASSIGNED',
    },
  });

  // Update job status to ASSIGNED if still CREATED
  if (job.status === 'CREATED') {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'ASSIGNED' },
    });
  }

  createNotification({
    companyId: driver.companyId,
    type: NOTIFICATION_TYPES.JOB_CLAIMED as any,
    title: `${driver.name} claimed Job #${job.jobNumber} — ${job.name}`,
    link: `/jobs/${jobId}`,
  });

  return NextResponse.json({ success: true, jobId, action: 'assign' });
}
