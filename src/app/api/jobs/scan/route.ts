import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { extractJobData } from '@/lib/ai-extract-job';
import { resolveGoogleMapsUrl, isGoogleMapsShortUrl } from '@/lib/resolve-maps-url';

/**
 * POST /api/jobs/scan
 *
 * Accepts a multipart form with an image file, runs AI extraction,
 * and returns structured job fields for form prefill.
 * If Google Maps URLs are found, resolves them to extract street addresses.
 */
export async function POST(req: NextRequest) {
  await requireSession();

  const formData = await req.formData();
  const file = formData.get('image') as File | null;

  if (!file || !file.size) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid image type. Use JPEG, PNG, or WebP.' }, { status: 400 });
  }

  // Max 10MB
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image too large. Max 10MB.' }, { status: 400 });
  }

  // Convert to base64
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString('base64');

  const result = await extractJobData(base64, file.type);

  if (result._error) {
    console.warn('[jobs/scan] Extraction warning:', result._error);
  }

  // Resolve Google Maps URLs to fill in missing addresses
  const resolvePromises: Promise<void>[] = [];

  if (result.hauledFromMapUrl && isGoogleMapsShortUrl(result.hauledFromMapUrl)) {
    resolvePromises.push(
      resolveGoogleMapsUrl(result.hauledFromMapUrl).then((resolved) => {
        if (resolved) {
          if (!result.hauledFromAddress && resolved.address) {
            result.hauledFromAddress = resolved.address;
            console.log('[jobs/scan] Resolved hauledFrom address from Maps URL:', resolved.address);
          }
          if (!result.hauledFromName && resolved.placeName) {
            result.hauledFromName = resolved.placeName;
            console.log('[jobs/scan] Resolved hauledFrom name from Maps URL:', resolved.placeName);
          }
        }
      }).catch((err) => {
        console.warn('[jobs/scan] Failed to resolve hauledFrom map URL:', err.message);
      })
    );
  }

  if (result.hauledToMapUrl && isGoogleMapsShortUrl(result.hauledToMapUrl)) {
    resolvePromises.push(
      resolveGoogleMapsUrl(result.hauledToMapUrl).then((resolved) => {
        if (resolved) {
          if (!result.hauledToAddress && resolved.address) {
            result.hauledToAddress = resolved.address;
            console.log('[jobs/scan] Resolved hauledTo address from Maps URL:', resolved.address);
          }
          if (!result.hauledToName && resolved.placeName) {
            result.hauledToName = resolved.placeName;
            console.log('[jobs/scan] Resolved hauledTo name from Maps URL:', resolved.placeName);
          }
        }
      }).catch((err) => {
        console.warn('[jobs/scan] Failed to resolve hauledTo map URL:', err.message);
      })
    );
  }

  // Resolve both URLs in parallel (don't block on failure)
  if (resolvePromises.length > 0) {
    await Promise.allSettled(resolvePromises);
  }

  return NextResponse.json(result);
}
