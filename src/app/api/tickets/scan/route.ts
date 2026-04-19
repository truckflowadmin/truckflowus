import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { extractTicketData, extractTicketDataLite } from '@/lib/ai-extract';
import { validateFileSize } from '@/lib/upload-limits';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads-private', 'scans');

/**
 * POST /api/tickets/scan
 * Accepts a single image, saves it, runs AI extraction, and returns the result.
 * Called once per image from the bulk upload UI.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.companyId) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
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

    // Save the image to disk
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = file.type === 'image/png' ? '.png' : file.type === 'image/webp' ? '.webp' : '.jpg';
    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    // Run AI extraction — use lightweight mode for job-context scans
    const base64 = buffer.toString('base64');
    const jobContext = req.nextUrl.searchParams.get('jobContext') === 'true';
    const extracted = jobContext
      ? await extractTicketDataLite(base64, file.type)
      : await extractTicketData(base64, file.type);

    return NextResponse.json({
      success: true,
      filename,
      photoUrl: `/api/uploads/scans/${filename}`,
      extracted,
    });
  } catch (err: any) {
    console.error('Ticket scan error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
