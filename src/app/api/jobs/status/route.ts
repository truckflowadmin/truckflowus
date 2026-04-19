import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'];

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const id: string = body.id;
    const status = body.status as string;

    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Block changes on invoiced jobs
    const invoicedCount = await prisma.ticket.count({
      where: { jobId: id, invoiceId: { not: null } },
    });
    if (invoicedCount > 0) {
      return NextResponse.json(
        { error: 'This job has invoiced tickets and cannot be modified' },
        { status: 403 },
      );
    }

    const now = new Date();
    const statusEnum = Prisma.raw(`'${status}'::"JobStatus"`);

    // Use raw SQL to support PARTIALLY_COMPLETED (may not be in generated Prisma client)
    if (status === 'COMPLETED' && !job.completedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "completedAt" = ${now} WHERE id = ${id}`;
    } else if (status === 'IN_PROGRESS' && !job.startedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "startedAt" = ${now} WHERE id = ${id}`;
    } else if (status === 'ASSIGNED' && !job.assignedAt) {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "assignedAt" = ${now} WHERE id = ${id}`;
    } else {
      await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum} WHERE id = ${id}`;
    }

    // Cascade to assignments for bulk status changes
    const assignmentCount = await prisma.jobAssignment.count({ where: { jobId: id } });
    if (assignmentCount > 0 && status !== 'PARTIALLY_COMPLETED') {
      if (status === 'IN_PROGRESS') {
        await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${status}, "startedAt" = ${now}, "lastResumedAt" = ${now} WHERE "jobId" = ${id}`;
      } else if (status === 'COMPLETED') {
        await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${status}, "completedAt" = ${now}, "lastResumedAt" = NULL WHERE "jobId" = ${id}`;
      } else {
        await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${status} WHERE "jobId" = ${id}`;
      }
    }

    revalidatePath('/jobs');
    revalidatePath(`/jobs/${id}`);
    revalidatePath('/dashboard');

    return NextResponse.json({ success: true, id, status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 });
  }
}
