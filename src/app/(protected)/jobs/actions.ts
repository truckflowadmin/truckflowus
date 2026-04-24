'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { Prisma } from '@prisma/client';
import type { QuantityType } from '@prisma/client';
import { sendSms } from '@/lib/sms';
import { notifyDriverJobAssignment, notifyDriverJobStatusChange, notifyDriversNewJobAvailable } from '@/lib/sms-notify';
import { enforceTicketLimit } from '@/lib/features';

/* ── Helper: check if a job has any invoiced tickets ── */
async function jobHasInvoicedTickets(jobId: string): Promise<boolean> {
  const count = await prisma.ticket.count({
    where: { jobId, invoiceId: { not: null } },
  });
  return count > 0;
}

/* ── Helper: validate a driver for job assignment ── */
async function validateDriverForJob(
  driverId: string,
  requiredTruckType: string | null,
  companyId: string,
): Promise<{ truckNumber: string | null }> {
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId },
    select: {
      name: true,
      assignedTruckId: true,
      assignedTruck: { select: { truckNumber: true, truckType: true, status: true } },
    },
  });
  if (!driver) {
    throw new Error('Driver not found or does not belong to your company');
  }
  if (!driver.assignedTruckId) {
    throw new Error(
      `Cannot assign ${driver?.name || 'driver'} — no truck assigned to their profile. Assign a truck in the driver's profile first.`,
    );
  }
  const truckStatus = (driver.assignedTruck as any)?.status;
  if (truckStatus === 'OUT_OF_SERVICE') {
    throw new Error(
      `Cannot assign ${driver?.name || 'driver'} — their truck (${driver.assignedTruck?.truckNumber || 'unknown'}) is currently out of service.`,
    );
  }
  if (truckStatus === 'SOLD') {
    throw new Error(
      `Cannot assign ${driver?.name || 'driver'} — their truck (${driver.assignedTruck?.truckNumber || 'unknown'}) has been marked as sold. Assign a different truck first.`,
    );
  }
  if (requiredTruckType && driver.assignedTruck?.truckType !== requiredTruckType) {
    throw new Error(
      `Cannot assign ${driver?.name || 'driver'} — their truck type does not match the required ${requiredTruckType}`,
    );
  }
  return { truckNumber: driver.assignedTruck?.truckNumber ?? null };
}

/* ── Create Job ── */
export async function createJobAction(formData: FormData) {
  const session = await requireSession();
  const companyId = session.companyId;

  const name = (formData.get('name') as string)?.trim();
  const hauledFrom = (formData.get('hauledFrom') as string)?.trim();
  const hauledTo = (formData.get('hauledTo') as string)?.trim();
  if (!name || !hauledFrom || !hauledTo) throw new Error('Name, Hauled From, and Hauled To are required');

  let customerId = (formData.get('customerId') as string) || null;
  const brokerId = (formData.get('brokerId') as string) || null;
  const material = (formData.get('material') as string)?.trim() || null;
  const quantityType = (formData.get('quantityType') as QuantityType) || 'LOADS';
  const totalLoadsRaw = formData.get('totalLoads') as string;
  const totalLoads = totalLoadsRaw ? (parseInt(totalLoadsRaw) || 0) : 0;
  const rateRaw = formData.get('ratePerUnit') as string;
  const ratePerUnit = rateRaw ? parseFloat(rateRaw) : null;
  const dateRaw = formData.get('date') as string;
  const date = dateRaw ? new Date(dateRaw) : null;
  const hauledFromAddress = (formData.get('hauledFromAddress') as string)?.trim() || null;
  const hauledToAddress = (formData.get('hauledToAddress') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const openForDrivers = formData.get('openForDrivers') === 'true';
  const requiredTruckType = (formData.get('requiredTruckType') as string)?.trim() || null;
  const requiredTruckCountRaw = formData.get('requiredTruckCount') as string;
  const requiredTruckCount = Math.max(1, parseInt(requiredTruckCountRaw) || 1);

  // Parse driver IDs (JSON array from multi-select)
  const driverIdsRaw = (formData.get('driverIds') as string) || '[]';
  let driverIds: string[] = [];
  try { driverIds = JSON.parse(driverIdsRaw); } catch { /* empty */ }
  driverIds = driverIds.filter(Boolean);

  if (driverIds.length > requiredTruckCount) {
    throw new Error(`Cannot assign ${driverIds.length} drivers — only ${requiredTruckCount} truck(s) needed`);
  }

  // Broker OR customer required
  if (!brokerId && !customerId) throw new Error('Either a broker or a customer must be selected');

  // When broker is selected and no customer chosen, auto-match job name to customer
  if (brokerId && !customerId && name) {
    const existing = await prisma.customer.findFirst({
      where: { companyId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await prisma.customer.create({
        data: { companyId, name },
      });
      customerId = created.id;
    }
  }

  // Validate all assigned drivers (with tenant isolation)
  const driverTrucks: { driverId: string; truckNumber: string | null }[] = [];
  for (const did of driverIds) {
    const { truckNumber } = await validateDriverForJob(did, requiredTruckType, companyId);
    driverTrucks.push({ driverId: did, truckNumber });
  }

  // First assigned driver becomes the legacy driverId / truckNumber
  const primaryDriverId = driverIds[0] || null;
  const primaryTruckNumber = driverTrucks[0]?.truckNumber ?? null;

  // Auto-increment job number per company
  const last = await prisma.job.findFirst({
    where: { companyId },
    orderBy: { jobNumber: 'desc' },
    select: { jobNumber: true },
  });
  const jobNumber = (last?.jobNumber ?? 0) + 1;

  const hasDrivers = driverIds.length > 0;
  const allSlotsFilled = driverIds.length >= requiredTruckCount;
  const status = allSlotsFilled ? 'ASSIGNED' : hasDrivers ? 'CREATED' : 'CREATED';

  const job = await prisma.job.create({
    data: {
      companyId,
      jobNumber,
      name,
      customerId,
      brokerId,
      driverId: primaryDriverId,
      status: status as any,
      hauledFrom,
      hauledFromAddress,
      hauledTo,
      hauledToAddress,
      material,
      truckNumber: primaryTruckNumber,
      requiredTruckType: requiredTruckType as any,
      requiredTruckCount,
      quantityType,
      totalLoads,
      ratePerUnit,
      date,
      notes,
      openForDrivers,
      assignedAt: hasDrivers ? new Date() : null,
    },
  });

  // Create JobAssignment records for all assigned drivers
  if (driverTrucks.length > 0) {
    await prisma.jobAssignment.createMany({
      data: driverTrucks.map((dt) => ({
        jobId: job.id,
        driverId: dt.driverId,
        truckNumber: dt.truckNumber,
      })),
    });
  }

  // Save material for future reuse
  if (material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId, name: material } },
      update: {},
      create: { companyId, name: material },
    });
  }

  // Notify assigned drivers (respects preferences) — must await before redirect
  await Promise.all(
    driverTrucks.map((dt) =>
      notifyDriverJobAssignment({
        driverId: dt.driverId,
        jobNumber,
        material,
        quantity: totalLoads,
        quantityType,
        hauledFrom,
        hauledTo,
      }).catch((err) => console.error('[sms-notify] createJob driver notify error:', err))
    )
  );

  // Notify opted-in drivers that a new job is available (if open for self-assign)
  if (openForDrivers) {
    await notifyDriversNewJobAvailable({
      companyId,
      jobNumber,
      material,
      hauledFrom,
      hauledTo,
      requiredTruckType,
    }).catch((err) => console.error('[sms-notify] newJobAvailable notify error:', err));
  }

  revalidatePath('/jobs');
  redirect(`/jobs/${job.id}`);
}

/* ── Update Job ── */
export async function updateJobAction(jobId: string, formData: FormData) {
  const session = await requireSession();

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: session.companyId },
    include: { assignments: true },
  });
  if (!job) throw new Error('Job not found');

  if (await jobHasInvoicedTickets(jobId)) {
    throw new Error('This job has invoiced tickets and cannot be modified');
  }

  const name = (formData.get('name') as string)?.trim();
  const hauledFrom = (formData.get('hauledFrom') as string)?.trim();
  const hauledTo = (formData.get('hauledTo') as string)?.trim();
  if (!name || !hauledFrom || !hauledTo) throw new Error('Name, Hauled From, and Hauled To are required');

  let customerId = (formData.get('customerId') as string) || null;
  const brokerId = (formData.get('brokerId') as string) || null;
  const material = (formData.get('material') as string)?.trim() || null;
  const quantityType = (formData.get('quantityType') as QuantityType) || 'LOADS';
  const totalLoadsRaw = formData.get('totalLoads') as string;
  const totalLoads = totalLoadsRaw ? (parseInt(totalLoadsRaw) || 0) : 0;
  const rateRaw = formData.get('ratePerUnit') as string;
  const ratePerUnit = rateRaw ? parseFloat(rateRaw) : null;
  const dateRaw = formData.get('date') as string;
  const date = dateRaw ? new Date(dateRaw) : null;
  const hauledFromAddress = (formData.get('hauledFromAddress') as string)?.trim() || null;
  const hauledToAddress = (formData.get('hauledToAddress') as string)?.trim() || null;
  const notes = (formData.get('notes') as string)?.trim() || null;
  const openForDrivers = formData.get('openForDrivers') === 'true';
  const requiredTruckType = (formData.get('requiredTruckType') as string)?.trim() || null;
  const requiredTruckCountRaw = formData.get('requiredTruckCount') as string;
  const requiredTruckCount = Math.max(1, parseInt(requiredTruckCountRaw) || 1);

  // Parse driver IDs (JSON array from multi-select)
  const driverIdsRaw = (formData.get('driverIds') as string) || '[]';
  let driverIds: string[] = [];
  try { driverIds = JSON.parse(driverIdsRaw); } catch { /* empty */ }
  driverIds = driverIds.filter(Boolean);

  if (driverIds.length > requiredTruckCount) {
    throw new Error(`Cannot assign ${driverIds.length} drivers — only ${requiredTruckCount} truck(s) needed`);
  }

  if (!brokerId && !customerId) throw new Error('Either a broker or a customer must be selected');

  // When broker is selected and no customer chosen, auto-match job name to customer
  if (brokerId && !customerId && name) {
    const existing = await prisma.customer.findFirst({
      where: { companyId: session.companyId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await prisma.customer.create({
        data: { companyId: session.companyId, name },
      });
      customerId = created.id;
    }
  }

  // Validate all assigned drivers (with tenant isolation)
  const driverTrucks: { driverId: string; truckNumber: string | null }[] = [];
  for (const did of driverIds) {
    const { truckNumber } = await validateDriverForJob(did, requiredTruckType, session.companyId);
    driverTrucks.push({ driverId: did, truckNumber });
  }

  const primaryDriverId = driverIds[0] || null;
  const primaryTruckNumber = driverTrucks[0]?.truckNumber ?? null;

  const hadDrivers = job.assignments.length > 0 || !!job.driverId;
  const hasDrivers = driverIds.length > 0;
  const allSlotsFilled = driverIds.length >= requiredTruckCount;

  const formStatus = (formData.get('status') as string) || '';
  const validStatuses = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  let status: string = validStatuses.includes(formStatus) ? formStatus : job.status;
  // Auto-promote to ASSIGNED if all slots filled and status wasn't manually changed
  if (!formStatus && allSlotsFilled && status === 'CREATED') {
    status = 'ASSIGNED';
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      name,
      customerId,
      brokerId,
      driverId: primaryDriverId,
      status: status as any,
      hauledFrom,
      hauledFromAddress,
      hauledTo,
      hauledToAddress,
      material,
      truckNumber: primaryTruckNumber,
      requiredTruckType: requiredTruckType as any,
      requiredTruckCount,
      quantityType,
      totalLoads,
      ratePerUnit,
      date,
      notes,
      openForDrivers,
      assignedAt: !hadDrivers && hasDrivers ? new Date() : job.assignedAt,
    },
  });

  // Reconcile JobAssignment records: delete removed, add new
  const existingAssignments = job.assignments.map((a) => a.driverId);
  const toRemove = existingAssignments.filter((id) => !driverIds.includes(id));
  const toAdd = driverTrucks.filter((dt) => !existingAssignments.includes(dt.driverId));

  if (toRemove.length > 0) {
    await prisma.jobAssignment.deleteMany({
      where: { jobId, driverId: { in: toRemove } },
    });
  }
  if (toAdd.length > 0) {
    await prisma.jobAssignment.createMany({
      data: toAdd.map((dt) => ({
        jobId,
        driverId: dt.driverId,
        truckNumber: dt.truckNumber,
      })),
    });
  }

  if (material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId: session.companyId, name: material } },
      update: {},
      create: { companyId: session.companyId, name: material },
    });
  }

  // Sync key fields to all non-invoiced tickets on this job so they stay in sync
  await prisma.ticket.updateMany({
    where: { jobId, invoiceId: null, tripSheetId: null },
    data: {
      customerId,
      brokerId,
      material,
      hauledFrom,
      hauledTo,
      ratePerUnit,
      quantityType,
    },
  });

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/tickets');
  redirect(`/jobs/${jobId}`);
}

const VALID_STATUSES = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'];

/* ── Update Job Status ── */
export async function updateJobStatusAction(jobId: string, newStatus: string, assignmentId?: string) {
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error('Invalid status');
  }

  const session = await requireSession();

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: session.companyId },
  });
  if (!job) throw new Error('Job not found');

  if (await jobHasInvoicedTickets(jobId)) {
    throw new Error('This job has invoiced tickets and cannot be modified');
  }

  // Fetch assignments via raw SQL (generated client doesn't know new columns)
  const allAssignments: any[] = await prisma.$queryRaw`
    SELECT id, "jobId", "driverId", status, "startedAt", "completedAt",
           "driverTimeSeconds", "lastResumedAt"
    FROM "JobAssignment"
    WHERE "jobId" = ${jobId}
  `;

  const now = new Date();

  if (assignmentId) {
    // ── Per-driver status change (dispatcher adjusting one driver's status) ──
    const assignment = allAssignments.find((a: any) => a.id === assignmentId);
    if (!assignment) throw new Error('Assignment not found');

    // Build raw SQL update for the assignment
    if (newStatus === 'IN_PROGRESS' && !assignment.startedAt) {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${newStatus}, "startedAt" = ${now}, "lastResumedAt" = ${now} WHERE id = ${assignmentId}`;
    } else if (newStatus === 'COMPLETED' && !assignment.completedAt) {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${newStatus}, "completedAt" = ${now}, "lastResumedAt" = NULL WHERE id = ${assignmentId}`;
    } else if (newStatus === 'ASSIGNED') {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${newStatus}, "lastResumedAt" = NULL WHERE id = ${assignmentId}`;
    } else {
      await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${newStatus} WHERE id = ${assignmentId}`;
    }

    // Derive job-level status from all assignments
    const allStatuses = allAssignments.map((a: any) =>
      a.id === assignmentId ? newStatus : a.status
    );

    let jobStatus = job.status;
    if (allStatuses.every((s: string) => s === 'COMPLETED')) {
      jobStatus = 'COMPLETED';
    } else if (allStatuses.every((s: string) => s === 'CANCELLED')) {
      jobStatus = 'CANCELLED';
    } else if (allStatuses.some((s: string) => s === 'COMPLETED')) {
      // Some completed but not all → partially completed
      jobStatus = 'PARTIALLY_COMPLETED';
    } else if (allStatuses.some((s: string) => s === 'IN_PROGRESS')) {
      jobStatus = 'IN_PROGRESS';
    } else if (allStatuses.some((s: string) => s === 'ASSIGNED')) {
      jobStatus = 'ASSIGNED';
    }

    if (jobStatus !== job.status) {
      // Use raw SQL because PARTIALLY_COMPLETED may not be in generated Prisma client
      const statusEnum = Prisma.raw(`'${jobStatus}'::"JobStatus"`);
      if (jobStatus === 'COMPLETED' && !job.completedAt) {
        await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "completedAt" = ${now} WHERE id = ${jobId}`;
      } else if (jobStatus === 'IN_PROGRESS' && !job.startedAt) {
        await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "startedAt" = ${now} WHERE id = ${jobId}`;
      } else {
        await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum} WHERE id = ${jobId}`;
      }
    }
  } else {
    // ── Bulk status change (all drivers at once) ──
    // Use raw SQL to support PARTIALLY_COMPLETED (not in generated Prisma client)
    const bulkStatusEnum = Prisma.raw(`'${newStatus}'::"JobStatus"`);
    if (newStatus === 'COMPLETED' && !job.completedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${bulkStatusEnum}, "completedAt" = ${now} WHERE id = ${jobId}`;
    } else if (newStatus === 'IN_PROGRESS' && !job.startedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${bulkStatusEnum}, "startedAt" = ${now} WHERE id = ${jobId}`;
    } else {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${bulkStatusEnum} WHERE id = ${jobId}`;
    }

    // Cascade to all assignments via raw SQL
    if (allAssignments.length > 0) {
      if (newStatus === 'IN_PROGRESS') {
        await prisma.$executeRaw`
          UPDATE "JobAssignment" SET status = ${newStatus}, "startedAt" = ${now}, "lastResumedAt" = ${now}
          WHERE "jobId" = ${jobId}
        `;
      } else if (newStatus === 'COMPLETED') {
        await prisma.$executeRaw`
          UPDATE "JobAssignment" SET status = ${newStatus}, "completedAt" = ${now}, "lastResumedAt" = NULL
          WHERE "jobId" = ${jobId}
        `;
      } else {
        await prisma.$executeRaw`
          UPDATE "JobAssignment" SET status = ${newStatus}
          WHERE "jobId" = ${jobId}
        `;
      }
    }
  }

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);

  // Notify assigned drivers via SMS when job status changes (respects preferences)
  if (['CANCELLED', 'COMPLETED', 'IN_PROGRESS'].includes(newStatus) && allAssignments.length > 0) {
    await Promise.all(
      allAssignments.map((a) =>
        notifyDriverJobStatusChange({
          driverId: a.driverId,
          jobNumber: job.jobNumber || 0,
          newStatus,
          jobName: job.name || undefined,
        }).catch((err) => console.error('[sms-notify] statusChange notify error:', err))
      )
    );
  }

  return { ok: true };
}

/* ── Delete a cancelled job ── */
export async function deleteJobAction(jobId: string) {
  const session = await requireSession();

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: session.companyId },
  });
  if (!job) throw new Error('Job not found');
  if (job.status !== 'CANCELLED') throw new Error('Only cancelled jobs can be deleted');

  if (await jobHasInvoicedTickets(jobId)) {
    throw new Error('This job has invoiced tickets and cannot be deleted');
  }

  // Soft-delete: mark job and its tickets as deleted (assignments stay for audit)
  const now = new Date();
  await prisma.ticket.updateMany({ where: { jobId, deletedAt: null }, data: { deletedAt: now } });
  await prisma.job.update({ where: { id: jobId }, data: { deletedAt: now } });

  revalidatePath('/jobs');
  redirect('/jobs');
}

/* ── Record a completed load → create a ticket ── */
export async function recordLoadAction(jobId: string) {
  const session = await requireSession();
  const companyId = session.companyId;

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId },
    include: {
      customer: true,
      driver: { include: { assignedTruck: { select: { truckNumber: true } } } },
      broker: true,
    },
  });
  if (!job) throw new Error('Job not found');
  if (await jobHasInvoicedTickets(jobId)) {
    throw new Error('This job has invoiced tickets and cannot be modified');
  }
  if (job.totalLoads > 0 && job.completedLoads >= job.totalLoads) throw new Error('All loads already completed');

  // Get next ticket number
  const lastTicket = await prisma.ticket.findFirst({
    where: { companyId },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });
  const ticketNumber = (lastTicket?.ticketNumber ?? 1000) + 1;

  // Truck number: only use driver's assigned truck
  const driverTruck = job.driver?.assignedTruck?.truckNumber ?? null;
  const truckNumber = driverTruck || null;

  // Create ticket for this load
  await enforceTicketLimit(companyId);
  const ticket = await prisma.ticket.create({
    data: {
      companyId,
      ticketNumber,
      jobId: job.id,
      customerId: job.customerId,
      driverId: job.driverId,
      brokerId: job.brokerId,
      material: job.material,
      truckNumber,
      quantityType: job.quantityType,
      quantity: 1,
      hauledFrom: job.hauledFrom,
      hauledTo: job.hauledTo,
      date: new Date(),
      ratePerUnit: job.ratePerUnit,
      status: 'COMPLETED',
      dispatchedAt: job.assignedAt,
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  // Sync completedLoads with actual ticket count for this job
  const totalTicketCount = await prisma.ticket.count({ where: { jobId: job.id } });
  const newCompletedLoads = totalTicketCount;
  const allLoadsDone = job.totalLoads > 0 && newCompletedLoads >= job.totalLoads;

  // Determine new job status — respect per-driver assignments
  let newStatus = job.status;
  if (job.status === 'ASSIGNED' || job.status === 'CREATED') {
    newStatus = 'IN_PROGRESS';
  }
  // Only auto-complete if all loads done AND all drivers are completed (or no assignments)
  if (allLoadsDone) {
    const assignments: any[] = await prisma.$queryRaw`
      SELECT status FROM "JobAssignment" WHERE "jobId" = ${jobId}
    `;
    if (assignments.length === 0 || assignments.every((a: any) => a.status === 'COMPLETED')) {
      newStatus = 'COMPLETED';
    } else if (assignments.some((a: any) => a.status === 'COMPLETED')) {
      newStatus = 'PARTIALLY_COMPLETED';
    }
  }

  // Defense-in-depth: validate derived status before Prisma.raw()
  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error('Invalid derived status');
  }

  // Use raw SQL for status update to support PARTIALLY_COMPLETED
  const now = new Date();
  const ticketStatusEnum = Prisma.raw(`'${newStatus}'::"JobStatus"`);
  if (newStatus === 'COMPLETED') {
    await prisma.$executeRaw`UPDATE "Job" SET "completedLoads" = ${newCompletedLoads}, status = ${ticketStatusEnum}, "startedAt" = COALESCE("startedAt", ${now}), "completedAt" = COALESCE("completedAt", ${now}) WHERE id = ${jobId}`;
  } else {
    await prisma.$executeRaw`UPDATE "Job" SET "completedLoads" = ${newCompletedLoads}, status = ${ticketStatusEnum}, "startedAt" = COALESCE("startedAt", ${now}) WHERE id = ${jobId}`;
  }

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath('/tickets');
  return { ticketNumber, completedLoads: newCompletedLoads, jobDone: newStatus === 'COMPLETED', newStatus };
}

/* ── Assign driver to job (for driver self-assign or dispatcher add) ── */
export async function assignDriverToJobAction(jobId: string, driverId: string) {
  const session = await requireSession();

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: session.companyId },
    include: { assignments: true },
  });
  if (!job) throw new Error('Job not found');
  if (await jobHasInvoicedTickets(jobId)) {
    throw new Error('This job has invoiced tickets and cannot be modified');
  }

  // Check if all slots are filled
  const currentCount = job.assignments.length;
  const maxSlots = job.requiredTruckCount || 1;
  if (currentCount >= maxSlots) {
    throw new Error(`Job already has ${currentCount}/${maxSlots} driver(s) assigned — no slots available`);
  }

  // Check if driver is already assigned
  if (job.assignments.some((a) => a.driverId === driverId)) {
    throw new Error('This driver is already assigned to this job');
  }

  // Validate driver has truck and matches required type (with tenant isolation)
  const { truckNumber } = await validateDriverForJob(driverId, job.requiredTruckType, session.companyId);

  // Create the assignment
  await prisma.jobAssignment.create({
    data: {
      jobId,
      driverId,
      truckNumber,
    },
  });

  // Update legacy driverId if this is the first driver
  const updatedCount = currentCount + 1;
  const allSlotsFilled = updatedCount >= maxSlots;

  const updateData: Record<string, unknown> = {};
  if (!job.driverId) {
    updateData.driverId = driverId;
    updateData.truckNumber = truckNumber;
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

  // Send SMS notification to the assigned driver (respects preferences)
  await notifyDriverJobAssignment({
    driverId,
    jobNumber: job.jobNumber || 0,
    material: job.material,
    quantity: Number(job.totalLoads || 0),
    quantityType: job.quantityType || 'LOADS',
    hauledFrom: job.hauledFrom,
    hauledTo: job.hauledTo,
  });

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, slotsRemaining: maxSlots - updatedCount };
}

/* ── Remove a driver assignment from a job ── */
export async function removeDriverFromJobAction(jobId: string, driverId: string) {
  const session = await requireSession();

  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId: session.companyId },
    include: { assignments: true },
  });
  if (!job) throw new Error('Job not found');
  if (await jobHasInvoicedTickets(jobId)) {
    throw new Error('This job has invoiced tickets and cannot be modified');
  }

  // Delete the assignment
  await prisma.jobAssignment.deleteMany({
    where: { jobId, driverId },
  });

  // Update legacy driverId
  const remaining = job.assignments.filter((a) => a.driverId !== driverId);
  const newPrimary = remaining[0] || null;

  await prisma.job.update({
    where: { id: jobId },
    data: {
      driverId: newPrimary?.driverId ?? null,
      truckNumber: newPrimary?.truckNumber ?? null,
      status: remaining.length === 0 ? 'CREATED' : job.status,
    },
  });

  revalidatePath('/jobs');
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}
