import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { uploadBlob } from '@/lib/blob-storage';

/** Max fax document size: 10 MB */
const MAX_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  'application/pdf',
  'image/tiff',
  'image/png',
  'image/jpeg',
];

/**
 * POST /api/fax/upload
 * Upload a document (PDF, TIFF, PNG, JPEG) for faxing.
 * Accepts multipart/form-data with a single "file" field.
 * Returns { url: string } — a publicly accessible blob URL.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();

  const formData = await req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large. Maximum size is 10 MB.' },
      { status: 400 },
    );
  }

  const contentType = file.type || 'application/pdf';
  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: 'Invalid file type. Allowed: PDF, TIFF, PNG, JPEG.' },
      { status: 400 },
    );
  }

  // Determine extension from MIME type
  const extMap: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/tiff': 'tiff',
    'image/png': 'png',
    'image/jpeg': 'jpg',
  };
  const ext = extMap[contentType] || 'pdf';
  const timestamp = Date.now();
  const pathname = `fax-uploads/${session.companyId}/${timestamp}.${ext}`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadBlob({
      pathname,
      body: buffer,
      contentType,
    });

    return NextResponse.json({ url: result.url });
  } catch (err: any) {
    console.error('[fax/upload] Upload failed:', err);
    return NextResponse.json(
      { error: 'Upload failed. Please try again.' },
      { status: 500 },
    );
  }
}
