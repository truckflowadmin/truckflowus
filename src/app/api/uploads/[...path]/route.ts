import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getDriverSession } from '@/lib/driver-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/uploads/[...path]
 *
 * Legacy backward-compatibility route for files uploaded before the Vercel Blob
 * migration. All new uploads store full Blob URLs in the database and are served
 * directly — they never hit this route.
 *
 * On Vercel (serverless), there is no persistent local filesystem, so old
 * filename-only records will 404. In local dev, this falls back to reading from
 * the `uploads-private/` directory if it exists.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  // Require authentication (dispatcher or driver)
  const dispatcherSession = await getSession();
  const driverSession = !dispatcherSession ? await getDriverSession() : null;

  if (!dispatcherSession && !driverSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const segments = params.path;
  if (!segments || segments.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Block path traversal
  for (const seg of segments) {
    if (seg === '..' || seg.includes('..') || seg.startsWith('.')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
  }

  // ── Local dev fallback: serve from uploads-private/ if the file exists ──
  try {
    const { readFile, stat } = await import('fs/promises');
    const path = await import('path');

    const UPLOADS_ROOT = path.join(process.cwd(), 'uploads-private');
    const filePath = path.join(UPLOADS_ROOT, ...segments);
    const resolved = path.resolve(filePath);

    // Ensure resolved path is still under UPLOADS_ROOT
    if (!resolved.startsWith(path.resolve(UPLOADS_ROOT))) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    const fileStat = await stat(resolved);
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const buffer = await readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const MIME_MAP: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.pdf': 'application/pdf',
    };
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    // File doesn't exist on disk (expected on Vercel) — return 404
    return NextResponse.json(
      { error: 'File not found. Uploads are now served via Vercel Blob storage.' },
      { status: 404 },
    );
  }
}
