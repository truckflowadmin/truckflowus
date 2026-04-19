import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CANCELLED'];

/**
 * POST /api/jobs/bulk
 * Body (JSON): { ids: string[], action: 'status', status?: string }
 */
export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const ids: string[] = body.ids;
    const action: string = body.action;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'No jobs selected' }, { status: 400 });
    }

    const jobs = await prisma.job.findMany({
      where: { id: { in: ids }, companyId: session.companyId },
      select: { id: true, assignedAt: true, startedAt: true, completedAt: true },
    });
    const validIds = jobs.map(j => j.id);
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid jobs found' }, { status: 404 });
    }

    // Block changes on any invoiced jobs
    const invoicedJobs = await prisma.ticket.groupBy({
      by: ['jobId'],
      where: { jobId: { in: validIds }, invoiceId: { not: null } },
    });
    if (invoicedJobs.length > 0) {
      const blockedIds = invoicedJobs.map(g => g.jobId).filter(Boolean);
      return NextResponse.json(
        { error: `${blockedIds.length} job(s) have invoiced tickets and cannot be modified` },
        { status: 403 },
      );
    }

    if (action === 'status') {
      const status = body.status as string;
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }

      const now = new Date();
      const statusEnum = Prisma.raw(`'${status}'::"JobStatus"`);

      for (const j of jobs) {
        if (status === 'COMPLETED' && !j.completedAt) {
          await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "completedAt" = ${now} WHERE id = ${j.id}`;
        } else if (status === 'IN_PROGRESS' && !j.startedAt) {
          await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "startedAt" = ${now} WHERE id = ${j.id}`;
        } else if (status === 'ASSIGNED' && !j.assignedAt) {
          await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum}, "assignedAt" = ${now} WHERE id = ${j.id}`;
        } else {
          await prisma.$executeRaw`UPDATE "Job" SET status = ${statusEnum} WHERE id = ${j.id}`;
        }

        // Cascade to assignments (skip for PARTIALLY_COMPLETED — that's per-driver)
        if (status !== 'PARTIALLY_COMPLETED') {
          const hasAssignments = await prisma.jobAssignment.count({ where: { jobId: j.id } });
          if (hasAssignments > 0) {
            if (status === 'IN_PROGRESS') {
              await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${status}, "startedAt" = ${now}, "lastResumedAt" = ${now} WHERE "jobId" = ${j.id}`;
            } else if (status === 'COMPLETED') {
              await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${status}, "completedAt" = ${now}, "lastResumedAt" = NULL WHERE "jobId" = ${j.id}`;
            } else {
              await prisma.$executeRaw`UPDATE "JobAssignment" SET status = ${status} WHERE "jobId" = ${j.id}`;
            }
          }
        }
      }

      revalidatePath('/jobs');
      revalidatePath('/dashboard');
      return NextResponse.json({ success: true, updated: validIds.length });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Bulk action failed' }, { status: 500 });
  }
}
