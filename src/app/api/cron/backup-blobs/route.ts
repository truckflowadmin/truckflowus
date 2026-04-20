import { NextRequest, NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { getGcsBucket } from '@/lib/gcs';

/**
 * GET /api/cron/backup-blobs
 *
 * Syncs all Vercel Blob files to Google Cloud Storage.
 * Only uploads files that don't already exist in GCS (incremental backup).
 *
 * Protected by CRON_SECRET header — Vercel Cron sends this automatically.
 * Can also be triggered manually with the correct secret.
 */
export const maxDuration = 300; // 5 minutes max (for large blob stores)

export async function GET(req: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check GCS is configured
  if (!process.env.GCS_PROJECT_ID || !process.env.GCS_BUCKET_NAME) {
    return NextResponse.json({ error: 'GCS not configured' }, { status: 500 });
  }

  const bucket = getGcsBucket();
  let synced = 0;
  let skipped = 0;
  let errors = 0;
  let cursor: string | undefined = undefined;

  try {
    // Iterate through all Vercel Blob files using pagination
    do {
      const listing: { blobs: { pathname: string; url: string; contentType?: string; uploadedAt?: Date; size: number }[]; cursor?: string; hasMore: boolean } = await list({ cursor, limit: 100 });
      cursor = listing.cursor || undefined;

      for (const blob of listing.blobs) {
        try {
          // Use the blob pathname as the GCS object name
          const gcsPath = blob.pathname;
          const file = bucket.file(gcsPath);

          // Check if file already exists in GCS (skip if so)
          const [exists] = await file.exists();
          if (exists) {
            skipped++;
            continue;
          }

          // Download from Vercel Blob and upload to GCS
          const response = await fetch(blob.url);
          if (!response.ok) {
            errors++;
            continue;
          }

          const buffer = Buffer.from(await response.arrayBuffer());

          await file.save(buffer, {
            contentType: blob.contentType || 'application/octet-stream',
            metadata: {
              sourceUrl: blob.url,
              uploadedAt: blob.uploadedAt?.toString() || new Date().toISOString(),
              originalSize: String(blob.size),
            },
          });

          synced++;
        } catch (err) {
          errors++;
          console.error(`[backup-blobs] Failed to sync ${blob.pathname}:`, err);
        }
      }

      // If no cursor, we've reached the end
      if (!listing.hasMore) break;
    } while (cursor);

    const summary = { synced, skipped, errors, timestamp: new Date().toISOString() };
    console.log('[backup-blobs] Backup complete:', summary);

    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[backup-blobs] Backup failed:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
