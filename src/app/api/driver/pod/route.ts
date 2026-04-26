import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';
import { put } from '@vercel/blob';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/driver/pod
 * Upload proof of delivery (photo or signature) for a job.
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { driverId, companyId } = session;

  const formData = await req.formData();
  const jobId = formData.get('jobId') as string;
  const type = (formData.get('type') as string) || 'photo'; // 'photo' or 'signature'
  const ticketRef = formData.get('ticketRef') as string | null;

  if (!jobId) {
    return NextResponse.json({ error: 'jobId required' }, { status: 400 });
  }

  // Validate job belongs to this company
  const job = await prisma.job.findFirst({
    where: { id: jobId, companyId },
    select: { id: true },
  });
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // Get the uploaded file
  const file = formData.get('photo') || formData.get('signature');
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'File required' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File too large (max 10 MB)' }, { status: 400 });
  }

  // Upload to Vercel Blob
  const ext = type === 'signature' ? 'png' : 'jpg';
  const filename = `pod/${companyId}/${jobId}/${type}_${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: 'public',
    contentType: type === 'signature' ? 'image/png' : 'image/jpeg',
  });

  // Save to database
  const pod = await prisma.proofOfDelivery.create({
    data: {
      companyId,
      jobId,
      driverId,
      type,
      fileUrl: blob.url,
      ticketRef: ticketRef || null,
    },
  });

  return NextResponse.json({
    ok: true,
    id: pod.id,
    fileUrl: blob.url,
    type,
  });
}

/**
 * GET /api/driver/pod?jobId=xxx
 * List all proof of delivery files for a job.
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

  const pods = await prisma.proofOfDelivery.findMany({
    where: { jobId, companyId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      fileUrl: true,
      ticketRef: true,
      createdAt: true,
      driver: { select: { name: true } },
    },
  });

  return NextResponse.json({ pods });
}
