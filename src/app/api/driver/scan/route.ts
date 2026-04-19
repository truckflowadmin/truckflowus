import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { FEATURES, loadCompanyFeatures } from '@/lib/features';
import { extractTicketDataLite } from '@/lib/ai-extract';
import { validateFileSize } from '@/lib/upload-limits';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads-private', 'tickets');

/**
 * POST /api/driver/scan
 * Driver-accessible scan endpoint — uses access token instead of session.
 * Saves the photo and runs AI extraction, returns extracted data for review.
 * Does NOT create a ticket — that happens on submit after the driver reviews.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = formData.get('token') as string | null;
    const file = formData.get('file') as File | null;

    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate driver
    const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
    if (!driver || !driver.active) {
      return NextResponse.json({ error: 'Invalid driver link' }, { status: 401 });
    }

    // Feature gate
    const hasFn = await loadCompanyFeatures(driver.companyId);
    if (!hasFn(FEATURES.DRIVER_PHOTO_UPLOAD)) {
      return NextResponse.json({ error: 'Photo upload not available' }, { status: 403 });
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
    const photoUrl = `/api/uploads/tickets/${filename}`;

    // Run AI extraction if available — lightweight mode (quantity + ticket # only)
    // All other fields (hauledFrom, hauledTo, customer, material, etc.) come from the job
    let extracted: Record<string, string | null> = {};
    const canAiExtract = hasFn(FEATURES.DRIVER_AI_EXTRACTION);
    if (canAiExtract) {
      try {
        const base64 = buffer.toString('base64');
        const result = await extractTicketDataLite(base64, file.type);
        extracted = {
          tons: result.tons ?? null,
          yards: result.yards ?? null,
          ticketNumber: result.ticketNumber ?? null,
          rawText: result.rawText ?? null,
        };
      } catch (err) {
        console.error('AI extraction failed:', err);
        extracted = { _error: 'AI extraction failed — fill fields manually' };
      }
    }

    return NextResponse.json({
      success: true,
      photoUrl,
      extracted,
      aiEnabled: canAiExtract,
    });
  } catch (err: any) {
    console.error('Driver scan error:', err);
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
