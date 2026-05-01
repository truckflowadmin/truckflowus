'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { FEATURES, loadCompanyFeatures, enforceTicketLimit } from '@/lib/features';
import { extractTicketDataLite } from '@/lib/ai-extract';
import { Prisma } from '@prisma/client';
import type { TicketStatus } from '@prisma/client';
import { createNotification, NOTIFICATION_TYPES } from '@/lib/notifications';
import { uploadBlob } from '@/lib/blob-storage';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Status update (Start / Complete / Issue)
// ---------------------------------------------------------------------------
export async function driverUpdateStatus(formData: FormData) {
  const token = String(formData.get('token') || '');
  const ticketId = String(formData.get('ticketId') || '');
  const status = String(formData.get('status') || '') as TicketStatus;
  const note = String(formData.get('note') || '').trim();
  if (!token || !ticketId || !status) throw new Error('Missing fields');

  const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  // Gate issue reporting server-side
  if (status === 'ISSUE') {
    const hasFn = await loadCompanyFeatures(driver.companyId);
    if (!hasFn(FEATURES.DRIVER_ISSUE_REPORTING)) {
      throw new Error('Issue reporting is not available on this plan');
    }
  }

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, driverId: driver.id },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  const now = new Date();
  const patch: any = { status };
  if (status === 'IN_PROGRESS' && !ticket.startedAt) patch.startedAt = now;
  if (status === 'COMPLETED' && !ticket.completedAt) {
    patch.completedAt = now;
    if (!ticket.startedAt) patch.startedAt = now;
  }
  if (note) {
    const tag = status === 'ISSUE' ? '[APP ISSUE]' : '[APP]';
    patch.driverNotes = ticket.driverNotes
      ? `${ticket.driverNotes}\n${tag} ${note}`
      : `${tag} ${note}`;
  }
  await prisma.ticket.update({ where: { id: ticketId }, data: patch });

  // Notify dispatcher (non-blocking)
  const ticketNum = String(ticket.ticketNumber).padStart(4, '0');
  if (status === 'IN_PROGRESS') {
    createNotification({
      companyId: driver.companyId,
      type: NOTIFICATION_TYPES.TICKET_STARTED,
      title: `${driver.name} started Ticket #${ticketNum}`,
      link: `/tickets`,
    });
  } else if (status === 'COMPLETED') {
    createNotification({
      companyId: driver.companyId,
      type: NOTIFICATION_TYPES.TICKET_COMPLETED,
      title: `${driver.name} completed Ticket #${ticketNum}`,
      link: `/tickets`,
    });
  } else if (status === 'ISSUE') {
    createNotification({
      companyId: driver.companyId,
      type: NOTIFICATION_TYPES.TICKET_ISSUE,
      title: `${driver.name} reported an issue on Ticket #${ticketNum}`,
      body: note || undefined,
      link: `/tickets`,
    });
  }

  revalidatePath('/d/portal');
  revalidatePath(`/tickets/${ticketId}`);

  return { success: true, ticketId, status };
}

// ---------------------------------------------------------------------------
// Claim an open job (driver self-assign)
// ---------------------------------------------------------------------------
export async function claimJob(formData: FormData) {
  const token = String(formData.get('token') || '');
  const jobId = String(formData.get('jobId') || '');
  if (!token || !jobId) throw new Error('Missing fields');

  const driver = await prisma.driver.findUnique({
    where: { accessToken: token },
    select: { id: true, active: true, companyId: true, name: true, truckNumber: true, assignedTruckId: true, assignedTruck: { select: { truckNumber: true, truckType: true, status: true } } },
  });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  // Must have a truck assigned to claim jobs
  if (!driver.assignedTruckId) {
    throw new Error('You must have a truck assigned before claiming jobs. Contact your dispatcher to assign a truck to your profile.');
  }
  const truckStatus = (driver.assignedTruck as any)?.status;
  if (truckStatus === 'OUT_OF_SERVICE') {
    throw new Error('Your truck is currently out of service and cannot be used for jobs. Contact your dispatcher.');
  }
  if (truckStatus === 'SOLD') {
    throw new Error('Your assigned truck has been marked as sold. Contact your dispatcher to assign you a different truck.');
  }

  // Find the job — must be in the same company, open for drivers, with available slots
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      companyId: driver.companyId,
      openForDrivers: true,
      status: { in: ['CREATED', 'ASSIGNED'] },
    },
    include: { assignments: true },
  });
  if (!job) throw new Error('Job is no longer available');

  // Check if slots are available
  const maxSlots = job.requiredTruckCount || 1;
  const currentCount = job.assignments.length;
  if (currentCount >= maxSlots) throw new Error('Job is full — all truck slots have been claimed');

  // Check if this driver is already assigned
  if (job.assignments.some((a) => a.driverId === driver.id)) {
    throw new Error('You are already assigned to this job');
  }

  // Validate truck type if required
  if (job.requiredTruckType && driver.assignedTruck) {
    const driverTruckType = (driver.assignedTruck as any).truckType;
    if (driverTruckType && driverTruckType !== job.requiredTruckType) {
      throw new Error(`This job requires a ${job.requiredTruckType} truck — your truck doesn't match`);
    }
  }

  // Block if job has invoiced tickets
  const invoicedCount = await prisma.ticket.count({ where: { jobId, invoiceId: { not: null } } });
  if (invoicedCount > 0) throw new Error('This job has invoiced tickets and cannot be modified');

  // Use driver's assigned truck (fresh from profile)
  const driverTruckNum = driver.assignedTruck?.truckNumber ?? null;

  // Create the assignment record
  await prisma.jobAssignment.create({
    data: {
      jobId,
      driverId: driver.id,
      truckNumber: driverTruckNum,
    },
  });

  const updatedCount = currentCount + 1;
  const allSlotsFilled = updatedCount >= maxSlots;

  // Update the job — set legacy driverId if first driver, auto-promote status when full
  const updateData: Record<string, unknown> = {};
  if (!job.driverId) {
    updateData.driverId = driver.id;
    updateData.truckNumber = driverTruckNum;
  }
  if (allSlotsFilled) {
    updateData.status = 'ASSIGNED';
  }
  if (!job.assignedAt) {
    updateData.assignedAt = new Date();
  }

  if (Object.keys(updateData).length > 0) {
    await prisma.job.update({ where: { id: jobId }, data: updateData });
  }

  createNotification({
    companyId: driver.companyId,
    type: NOTIFICATION_TYPES.JOB_CLAIMED,
    title: `${driver.name} claimed Job #${job.jobNumber} — ${job.name}`,
    link: `/jobs/${jobId}`,
  });

  revalidatePath('/d/portal');
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);

  return { success: true, jobId };
}

// ---------------------------------------------------------------------------
// Job status update (Start / Pause / Complete) — from driver portal
// Now operates on the driver's JobAssignment (per-driver status tracking).
// Job-level status auto-derives: IN_PROGRESS when any driver starts,
// COMPLETED only when ALL assignments are completed.
// ---------------------------------------------------------------------------
export async function driverUpdateJobStatus(formData: FormData) {
  const token = String(formData.get('token') || '');
  const jobId = String(formData.get('jobId') || '');
  const action: string = String(formData.get('action') || ''); // 'start' | 'resume' | 'pause' | 'complete' | 'cancel' | 'report_issue'
  if (!token || !jobId || !action) throw new Error('Missing fields');

  const driver = await prisma.driver.findUnique({ where: { accessToken: token }, select: { id: true, active: true, companyId: true, name: true, assignedTruckId: true } });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  // Fetch the job
  const job = await prisma.job.findFirst({
    where: {
      id: jobId,
      OR: [
        { driverId: driver.id },
        { assignments: { some: { driverId: driver.id } } },
      ],
    },
  });
  if (!job) throw new Error('Job not found');

  // Fetch all assignments via raw SQL (generated client doesn't know new columns)
  const allAssignments: any[] = await prisma.$queryRaw`
    SELECT id, "jobId", "driverId", status, "startedAt", "completedAt",
           "driverTimeSeconds", "lastResumedAt"
    FROM "JobAssignment"
    WHERE "jobId" = ${jobId}
  `;

  // Find this driver's assignment
  let assignment = allAssignments.find((a: any) => a.driverId === driver.id);

  // Legacy fallback: if no assignment record but job.driverId matches, create one
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
  if (!assignment) throw new Error('You are not assigned to this job');

  // Block if job has invoiced tickets for this driver
  const invoicedTickets = await prisma.ticket.count({ where: { jobId, driverId: driver.id, invoiceId: { not: null } } });
  if (invoicedTickets > 0) throw new Error('This job has invoiced tickets and cannot be modified');

  const now = new Date();
  const assignmentPatch: any = {};

  // Calculate elapsed seconds for this driver's current active segment
  const elapsedSec = assignment.lastResumedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(assignment.lastResumedAt).getTime()) / 1000))
    : 0;

  if (action === 'start') {
    if (assignment.status !== 'ASSIGNED') throw new Error('Your assignment must be ASSIGNED to start');
    if (!driver.assignedTruckId) throw new Error('You must have a truck assigned before starting a job. Contact your dispatcher.');
    assignmentPatch.status = 'IN_PROGRESS';
    if (!assignment.startedAt) assignmentPatch.startedAt = now;
    assignmentPatch.lastResumedAt = now;
  } else if (action === 'resume') {
    if (assignment.status !== 'ASSIGNED') throw new Error('Your assignment must be paused to resume');
    assignmentPatch.status = 'IN_PROGRESS';
    assignmentPatch.lastResumedAt = now;
  } else if (action === 'pause') {
    if (assignment.status !== 'IN_PROGRESS') throw new Error('Your assignment must be IN_PROGRESS to pause');
    assignmentPatch.status = 'ASSIGNED';
    assignmentPatch.driverTimeSeconds = (assignment.driverTimeSeconds || 0) + elapsedSec;
    assignmentPatch.lastResumedAt = null;
  } else if (action === 'complete') {
    if (assignment.status !== 'IN_PROGRESS') throw new Error('Your assignment must be IN_PROGRESS to complete');
    assignmentPatch.status = 'COMPLETED';
    assignmentPatch.completedAt = now;
    if (!assignment.startedAt) assignmentPatch.startedAt = now;
    assignmentPatch.driverTimeSeconds = (assignment.driverTimeSeconds || 0) + elapsedSec;
    assignmentPatch.lastResumedAt = null;
  } else if (action === 'cancel') {
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(assignment.status)) {
      throw new Error('Your assignment must be ASSIGNED or IN_PROGRESS to cancel');
    }
    assignmentPatch.status = 'CANCELLED';
    if (assignment.lastResumedAt) {
      assignmentPatch.driverTimeSeconds = (assignment.driverTimeSeconds || 0) + elapsedSec;
      assignmentPatch.lastResumedAt = null;
    }
  } else if (action === 'report_issue') {
    if (!['ASSIGNED', 'IN_PROGRESS'].includes(assignment.status)) {
      throw new Error('Your assignment must be active to report an issue');
    }
    // No status change — just send notification
  } else {
    throw new Error('Invalid action');
  }

  // Update the driver's assignment via raw SQL (generated client doesn't know new columns)
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
  // Build the updated list of assignment statuses
  const allStatuses = allAssignments.map((a: any) =>
    a.id === assignment!.id ? (assignmentPatch.status ?? a.status) : a.status
  );

  const jobPatch: any = {};

  if (allStatuses.every((s) => s === 'COMPLETED')) {
    // All drivers completed → job is COMPLETED
    jobPatch.status = 'COMPLETED';
    jobPatch.completedAt = now;
  } else if (allStatuses.every((s) => s === 'CANCELLED')) {
    // All drivers cancelled → job is CANCELLED
    jobPatch.status = 'CANCELLED';
  } else if (allStatuses.some((s) => s === 'COMPLETED')) {
    // Some completed but not all → partially completed
    jobPatch.status = 'PARTIALLY_COMPLETED';
  } else if (allStatuses.some((s) => s === 'IN_PROGRESS')) {
    // At least one driver is working → job is IN_PROGRESS
    jobPatch.status = 'IN_PROGRESS';
    if (!job.startedAt) jobPatch.startedAt = now;
  } else if (allStatuses.some((s) => s === 'ASSIGNED')) {
    // At least one driver still assigned → job is ASSIGNED
    jobPatch.status = 'ASSIGNED';
  }

  const VALID_JOB_STATUSES = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'];
  if (Object.keys(jobPatch).length > 0 && jobPatch.status !== job.status) {
    // Defense-in-depth: validate derived status before Prisma.raw()
    if (!VALID_JOB_STATUSES.includes(jobPatch.status)) {
      throw new Error('Invalid derived job status');
    }
    // Use raw SQL because PARTIALLY_COMPLETED may not be in generated Prisma client
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
  const issueNote = String(formData.get('note') || '').trim();
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

  revalidatePath('/d/portal');
  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);

  const finalStatus = assignmentPatch.status ?? assignment.status;
  const finalTime = assignmentPatch.driverTimeSeconds ?? assignment.driverTimeSeconds ?? 0;
  const finalResumed = assignmentPatch.lastResumedAt !== undefined
    ? (assignmentPatch.lastResumedAt ? assignmentPatch.lastResumedAt.toISOString() : null)
    : (assignment.lastResumedAt ? new Date(assignment.lastResumedAt).toISOString() : null);

  return {
    success: true,
    jobId,
    action,
    newStatus: finalStatus,
    driverTimeSeconds: finalTime,
    lastResumedAt: finalResumed,
  };
}

// ---------------------------------------------------------------------------
// Time-off request (create / cancel)
// ---------------------------------------------------------------------------
export async function requestTimeOff(formData: FormData) {
  const token = String(formData.get('token') || '');
  const startDate = String(formData.get('startDate') || '');
  const endDate = String(formData.get('endDate') || '');
  const reason = String(formData.get('reason') || '').trim();
  if (!token || !startDate || !endDate) throw new Error('Missing fields');

  const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) throw new Error('Invalid dates');
  if (end < start) throw new Error('End date must be on or after start date');

  const req = await prisma.timeOffRequest.create({
    data: {
      companyId: driver.companyId,
      driverId: driver.id,
      startDate: start,
      endDate: end,
      reason: reason || null,
    },
  });

  // Notify dispatcher
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const range = start.getTime() === end.getTime()
    ? fmt(start)
    : `${fmt(start)} – ${fmt(end)}`;
  createNotification({
    companyId: driver.companyId,
    type: 'TIME_OFF_REQUEST' as any,
    title: `${driver.name} requested time off: ${range}`,
    body: reason || undefined,
    link: '/drivers?tab=timeoff',
  });

  revalidatePath('/d/portal');
  return { id: req.id };
}

export async function cancelTimeOff(formData: FormData) {
  const token = String(formData.get('token') || '');
  const requestId = String(formData.get('requestId') || '');
  if (!token || !requestId) throw new Error('Missing fields');

  const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  const req = await prisma.timeOffRequest.findFirst({
    where: { id: requestId, driverId: driver.id, status: { in: ['PENDING', 'APPROVED'] } },
  });
  if (!req) throw new Error('Request not found or cannot be cancelled');

  await prisma.timeOffRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  });

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const range = req.startDate.getTime() === req.endDate.getTime()
    ? fmt(req.startDate)
    : `${fmt(req.startDate)} – ${fmt(req.endDate)}`;
  createNotification({
    companyId: driver.companyId,
    type: 'TIME_OFF_CANCELLED' as any,
    title: `${driver.name} cancelled time off: ${range}`,
    link: '/drivers?tab=timeoff',
  });

  revalidatePath('/d/portal');
  revalidatePath('/drivers');
}

// ---------------------------------------------------------------------------
// Photo upload + AI extraction
// ---------------------------------------------------------------------------
export async function uploadTicketPhoto(formData: FormData) {
  const token = String(formData.get('token') || '');
  const ticketId = String(formData.get('ticketId') || '');
  const file = formData.get('photo') as File | null;

  if (!token || !ticketId || !file || file.size === 0) {
    throw new Error('Missing photo or ticket reference');
  }

  // Validate driver
  const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  // Feature gate
  const hasFn = await loadCompanyFeatures(driver.companyId);
  if (!hasFn(FEATURES.DRIVER_PHOTO_UPLOAD)) {
    throw new Error('Photo upload is not available on this plan');
  }

  // Verify the ticket belongs to this driver
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, driverId: driver.id, status: { in: ['COMPLETED', 'IN_PROGRESS', 'DISPATCHED'] } },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  // Read file into buffer
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const base64 = buffer.toString('base64');

  // Determine MIME type
  const mimeType = file.type || 'image/jpeg';
  const ext = mimeType.includes('png') ? 'png' : 'jpg';

  // Upload to Vercel Blob
  const filename = `${ticketId}.${ext}`;
  const blob = await uploadBlob({
    pathname: `tickets/${filename}`,
    body: buffer,
    contentType: mimeType,
  });
  const photoUrl = blob.url;

  // Run AI extraction if the plan supports it
  let scannedData: {
    scannedTons: string | null;
    scannedYards: string | null;
    scannedTicketNumber: string | null;
    scannedDate: string | null;
    scannedRawText: string | null;
    scannedAt: Date | null;
  } = {
    scannedTons: null,
    scannedYards: null,
    scannedTicketNumber: null,
    scannedDate: null,
    scannedRawText: null,
    scannedAt: null,
  };

  if (hasFn(FEATURES.DRIVER_AI_EXTRACTION)) {
    // Lightweight extraction — only quantity + ticket number; other fields come from the job
    const extracted = await extractTicketDataLite(base64, mimeType);
    scannedData = {
      scannedTons: extracted.tons,
      scannedYards: extracted.yards,
      scannedTicketNumber: extracted.ticketNumber,
      scannedDate: null,
      scannedRawText: extracted.rawText,
      scannedAt: new Date(),
    };
  }

  // If ticket is linked to a job, sync customer/broker from the job
  let jobSyncData: Record<string, unknown> = {};
  if (ticket.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: ticket.jobId },
      select: { customerId: true, brokerId: true },
    });
    if (job) {
      if (job.customerId && ticket.customerId !== job.customerId) {
        jobSyncData.customerId = job.customerId;
      }
      if (job.brokerId && ticket.brokerId !== job.brokerId) {
        jobSyncData.brokerId = job.brokerId;
      }
    }
  }

  // Update ticket
  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      photoUrl,
      ...scannedData,
      ...jobSyncData,
    },
  });

  const num = String(ticket.ticketNumber).padStart(4, '0');
  // Fire-and-forget — don't block the response on notification
  createNotification({
    companyId: driver.companyId,
    type: NOTIFICATION_TYPES.TICKET_PHOTO_UPLOADED,
    title: `${driver.name} uploaded photo for ticket #${num}`,
    body: scannedData.scannedAt
      ? `Photo uploaded and scanned for ticket #${num}`
      : `Photo uploaded for ticket #${num}`,
    link: `/tickets/${ticketId}`,
  }).catch(() => {});

  revalidatePath('/d/portal');
  revalidatePath(`/tickets/${ticketId}`);

  return {
    success: true,
    photoUrl,
    extracted: scannedData.scannedAt !== null,
    data: {
      tons: scannedData.scannedTons,
      yards: scannedData.scannedYards,
      ticketNumber: scannedData.scannedTicketNumber,
      date: scannedData.scannedDate,
    },
  };
}

// ---------------------------------------------------------------------------
// Submit reviewed ticket data for a completed job (driver reviewed/edited)
// ---------------------------------------------------------------------------
export async function driverSubmitReviewedTickets(formData: FormData) {
  const token = String(formData.get('token') || '');
  const jobId = String(formData.get('jobId') || '');
  const itemsJson = String(formData.get('items') || '[]');

  if (!token || !jobId) return { success: false, error: 'Missing fields' };

  // Parse the reviewed items
  let items: {
    photoUrl: string;
    hauledFrom: string;
    hauledTo: string;
    material: string;
    quantity: number;
    quantityType: string;
    ticketRef: string;
    date: string;
    driverNotes: string;
    scannedTons: string | null;
    scannedYards: string | null;
    scannedTicketNumber: string | null;
    scannedDate: string | null;
    scannedRawText: string | null;
  }[];

  try {
    items = JSON.parse(itemsJson);
  } catch {
    return { success: false, error: 'Invalid data' };
  }
  if (!items.length) return { success: false, error: 'No tickets to submit' };

  try {
    // Validate driver — include assigned truck for fresh truck number
    const driver = await prisma.driver.findUnique({
      where: { accessToken: token },
      include: { assignedTruck: { select: { truckNumber: true } } },
    });
    if (!driver || !driver.active) return { success: false, error: 'Invalid driver link' };

    // Feature gate
    const hasFn = await loadCompanyFeatures(driver.companyId);
    if (!hasFn(FEATURES.DRIVER_PHOTO_UPLOAD)) {
      return { success: false, error: 'Photo upload is not available on your plan. Contact your dispatcher.' };
    }

    // Verify the job belongs to this driver
    const job = await prisma.job.findFirst({
      where: {
        id: jobId,
        status: { in: ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED'] },
        OR: [
          { driverId: driver.id },
          { assignments: { some: { driverId: driver.id } } },
        ],
      },
    });
    if (!job) return { success: false, error: 'Job not found. It may have been cancelled or you are no longer assigned.' };

    // Block if job has invoiced tickets
    const invoicedCheck = await prisma.ticket.count({ where: { jobId, invoiceId: { not: null } } });
    if (invoicedCheck > 0) return { success: false, error: 'This job has invoiced tickets and cannot be modified.' };

    // Check ticket limit
    try {
      await enforceTicketLimit(driver.companyId, items.length);
    } catch (limitErr: any) {
      return { success: false, error: limitErr.message || 'Monthly ticket limit reached. Contact your dispatcher.' };
    }

    // Check for duplicate ticketRefs within this job before creating any tickets
    const ticketRefs = items
      .filter(i => i.ticketRef?.trim())
      .map(i => i.ticketRef.trim());

    if (ticketRefs.length > 0) {
      // Check for duplicates within the batch itself
      const seen = new Set<string>();
      for (const ref of ticketRefs) {
        if (seen.has(ref)) {
          return {
            success: false,
            error: `Duplicate ticket # "${ref}" found in your upload batch. Each ticket must have a unique number.`,
            duplicateRef: ref,
          };
        }
        seen.add(ref);
      }

      // Check against existing tickets in the same job
      const existing = await prisma.ticket.findMany({
        where: {
          jobId: job.id,
          ticketRef: { in: ticketRefs },
          deletedAt: null,
        },
        select: { ticketRef: true, ticketNumber: true },
      });

      if (existing.length > 0) {
        const conflicts = existing.map(e =>
          `"${e.ticketRef}" (System #${String(e.ticketNumber).padStart(4, '0')})`
        ).join(', ');
        return {
          success: false,
          error: `Ticket # ${conflicts} already exist${existing.length > 1 ? '' : 's'} on this job.`,
          duplicates: existing.map(e => ({ ticketRef: e.ticketRef, ticketNumber: e.ticketNumber })),
        };
      }
    }

    const results: { ticketId: string; ticketNumber: number; photoUrl: string }[] = [];

    // Use raw SQL to get the true max ticket number — bypasses the soft-delete
    // middleware which adds `deletedAt IS NULL` to Prisma reads. Without this,
    // soft-deleted tickets are invisible to findFirst but their numbers still
    // occupy the unique constraint, causing collisions.
    async function getNextTicketNumber(companyId: string): Promise<number> {
      const rows = await prisma.$queryRaw<[{ maxNum: number | null }]>`
        SELECT MAX("ticketNumber") AS "maxNum"
        FROM "Ticket"
        WHERE "companyId" = ${companyId}
      `;
      return (rows[0]?.maxNum ?? 1000) + 1;
    }

    for (const item of items) {
      if (!item.hauledFrom?.trim() || !item.hauledTo?.trim()) continue;

      // Retry up to 5 times on ticket number collision (concurrent requests)
      let ticket = null;
      for (let attempt = 0; attempt < 5; attempt++) {
        const ticketNumber = await getNextTicketNumber(driver.companyId);
        try {
          ticket = await prisma.ticket.create({
            data: {
              companyId: driver.companyId,
              ticketNumber,
              jobId: job.id,
              driverId: driver.id,
              customerId: job.customerId,
              brokerId: job.brokerId,
              status: 'COMPLETED',
              hauledFrom: item.hauledFrom.trim(),
              hauledTo: item.hauledTo.trim(),
              material: item.material?.trim() || job.material,
              truckNumber: (driver as any).assignedTruck?.truckNumber ?? null,
              quantityType: (item.quantityType as any) || job.quantityType,
              quantity: item.quantity || 1,
              ratePerUnit: job.ratePerUnit,
              date: item.date ? new Date(item.date + 'T00:00:00Z') : job.date,
              ticketRef: item.ticketRef?.trim() || null,
              driverNotes: item.driverNotes?.trim() || null,
              photoUrl: item.photoUrl,
              completedAt: new Date(),
              // Preserve original AI-scanned data (coerce to string for Prisma)
              scannedTons: item.scannedTons != null ? String(item.scannedTons) : null,
              scannedYards: item.scannedYards != null ? String(item.scannedYards) : null,
              scannedTicketNumber: item.scannedTicketNumber != null ? String(item.scannedTicketNumber) : null,
              scannedDate: item.scannedDate != null ? String(item.scannedDate) : null,
              scannedRawText: item.scannedRawText != null ? String(item.scannedRawText) : null,
            },
          });
          results.push({ ticketId: ticket.id, ticketNumber, photoUrl: item.photoUrl });
          break; // success
        } catch (createErr: any) {
          // If unique constraint violation on ticketNumber, retry with fresh number
          const isUniqueViolation =
            createErr?.code === 'P2002' ||
            createErr?.message?.includes('Unique constraint');
          if (isUniqueViolation && attempt < 4) {
            continue; // retry
          }
          throw createErr; // re-throw non-retryable errors
        }
      }
    }

    if (results.length === 0) return { success: false, error: 'No valid tickets to create — fill in Hauled From and Hauled To.' };

    // Update completed loads on the job
    const totalTickets = await prisma.ticket.count({
      where: { jobId: job.id, status: 'COMPLETED' },
    });
    await prisma.job.update({
      where: { id: job.id },
      data: { completedLoads: totalTickets },
    });

    // Notify dispatcher
    createNotification({
      companyId: driver.companyId,
      type: 'TICKET_PHOTOS_UPLOADED' as any,
      title: `${driver.name} submitted ${results.length} ticket${results.length !== 1 ? 's' : ''} for Job #${job.jobNumber}`,
      link: `/jobs/${job.id}`,
    });

    revalidatePath('/d/portal');
    revalidatePath('/tickets');
    revalidatePath(`/jobs/${job.id}`);

    return {
      success: true,
      count: results.length,
      tickets: results,
    };
  } catch (err: any) {
    console.error('[driverSubmitReviewedTickets] Unexpected error:', err);
    return { success: false, error: err.message || 'Something went wrong. Please try again or contact your dispatcher.' };
  }
}

// ---------------------------------------------------------------------------
// Driver edits a submitted ticket (only if dispatcher has NOT reviewed it)
// ---------------------------------------------------------------------------
export async function driverEditTicket(formData: FormData) {
  const token = String(formData.get('token') || '');
  const ticketId = String(formData.get('ticketId') || '');
  if (!token || !ticketId) throw new Error('Missing fields');

  const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
  if (!driver || !driver.active) throw new Error('Invalid driver link');

  // Ticket must belong to this driver and NOT be reviewed by dispatcher
  const ticket = await prisma.ticket.findFirst({
    where: {
      id: ticketId,
      driverId: driver.id,
      dispatcherReviewedAt: null, // only editable if not reviewed
    },
  });
  if (!ticket) throw new Error('Ticket not found or already reviewed by dispatcher');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  // Read editable fields
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  const material = String(formData.get('material') || '').trim();
  const truckNumber = String(formData.get('truckNumber') || '').trim();
  const ticketRef = String(formData.get('ticketRef') || '').trim();
  const quantityRaw = String(formData.get('quantity') || '1');
  const quantityType = String(formData.get('quantityType') || ticket.quantityType);
  const date = String(formData.get('date') || '').trim();
  const driverNotes = String(formData.get('driverNotes') || '').trim();

  if (!hauledFrom || !hauledTo) throw new Error('Hauled From and Hauled To are required');

  const quantity = parseFloat(quantityRaw) || 1;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      hauledFrom,
      hauledTo,
      material: material || null,
      truckNumber: truckNumber || null,
      ticketRef: ticketRef || null,
      quantity,
      quantityType: quantityType as any,
      date: date ? new Date(date + 'T00:00:00Z') : ticket.date,
      driverNotes: driverNotes || null,
    },
  });

  const num = String(ticket.ticketNumber).padStart(4, '0');
  await createNotification({
    companyId: driver.companyId,
    type: NOTIFICATION_TYPES.TICKET_UPDATED,
    title: `${driver.name} updated ticket #${num}`,
    body: `Driver edited details for ticket #${num}`,
    link: `/tickets/${ticketId}`,
  });

  revalidatePath('/d/portal');
  revalidatePath(`/tickets/${ticketId}`);

  return { success: true };
}

// ---------------------------------------------------------------------------
// Browser geolocation ping — called from DriverTabs when a job is active
// ---------------------------------------------------------------------------
export async function sendDriverLocation(formData: FormData) {
  const token = String(formData.get('token') || '');
  const jobId = String(formData.get('jobId') || '');
  const latitude = Number(formData.get('latitude'));
  const longitude = Number(formData.get('longitude'));
  const speed = formData.get('speed') ? Number(formData.get('speed')) : null;
  const heading = formData.get('heading') ? Number(formData.get('heading')) : null;
  const accuracy = formData.get('accuracy') ? Number(formData.get('accuracy')) : null;

  if (!token || !jobId || isNaN(latitude) || isNaN(longitude)) {
    throw new Error('Missing location data');
  }

  const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
  if (!driver || !driver.active) throw new Error('Invalid driver');

  // Find this driver's IN_PROGRESS assignment for the job
  const assignments: any[] = await prisma.$queryRaw`
    SELECT id FROM "JobAssignment"
    WHERE "jobId" = ${jobId} AND "driverId" = ${driver.id} AND status = 'IN_PROGRESS'
    LIMIT 1
  `;
  const assignmentId = assignments[0]?.id || null;

  const now = new Date();
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO "DriverLocation" (id, "companyId", "driverId", "jobId", "assignmentId", latitude, longitude, speed, heading, accuracy, "recordedAt")
    VALUES (${id}, ${driver.companyId}, ${driver.id}, ${jobId}, ${assignmentId}, ${latitude}, ${longitude}, ${speed}, ${heading}, ${accuracy}, ${now})
  `;

  return { ok: true };
}
