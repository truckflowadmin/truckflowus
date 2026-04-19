import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { uploadBlob } from '@/lib/blob-storage';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * POST /api/jobs/photo
 * Body: FormData with `file` (image) and `jobId` (string)
 * Uploads/replaces a job's photo (work order, dispatch sheet, etc.).
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const jobId = formData.get('jobId') as string;
    const file = formData.get('file') as File | null;

    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.` },
        { status: 400 },
      );
    }

    const sizeError = validateFileSize(file, 'IMAGE');
    if (sizeError) {
      return NextResponse.json({ error: sizeError }, { status: 400 });
    }

    // Verify job belongs to this company
    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: session.companyId },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Upload to Vercel Blob
    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${jobId}-${randomUUID().slice(0, 8)}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const blob = await uploadBlob({
      pathname: `jobs/${filename}`,
      body: buffer,
      contentType: file.type,
    });
    const photoUrl = blob.url;

    // Update job with new photo URL (use raw SQL since generated client may not know the column yet)
    await prisma.$executeRaw`UPDATE "Job" SET "photoUrl" = ${photoUrl}, "updatedAt" = NOW() WHERE id = ${jobId}`;

    return NextResponse.json({
      success: true,
      photoUrl,
    });
  } catch (err: any) {
    console.error('Job photo upload error:', err);
    return NextResponse.json({ error: 'Photo upload failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/photo?jobId=xxx
 * Remove a job's photo.
 */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) {
      return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });
    }

    const job = await prisma.job.findFirst({
      where: { id: jobId, companyId: session.companyId },
    });
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    await prisma.$executeRaw`UPDATE "Job" SET "photoUrl" = NULL, "updatedAt" = NOW() WHERE id = ${jobId}`;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Job photo delete error:', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
