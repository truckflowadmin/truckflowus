/**
 * Vercel Blob storage helper.
 *
 * Replaces local filesystem writes with Vercel Blob for production.
 * All upload routes should use `uploadBlob()` instead of `writeFile()`.
 *
 * Requires BLOB_READ_WRITE_TOKEN environment variable in Vercel project settings.
 * Get it from: Vercel Dashboard → Storage → Create Blob Store → Connect.
 */

import { put, del } from '@vercel/blob';

interface UploadOptions {
  /** Desired path/filename, e.g. "documents/driver-abc-LICENSE.jpg" */
  pathname: string;
  /** The file content as a Buffer, ArrayBuffer, or Blob */
  body: Buffer | ArrayBuffer | Blob;
  /** MIME type, e.g. "image/jpeg" */
  contentType: string;
  /** Whether the file should be publicly accessible (default: true) */
  access?: 'public';
}

interface UploadResult {
  /** The public URL of the uploaded file */
  url: string;
  /** The pathname in the blob store */
  pathname: string;
}

/**
 * Upload a file to Vercel Blob storage.
 * Returns the public URL that can be stored in the database.
 */
export async function uploadBlob(opts: UploadOptions): Promise<UploadResult> {
  const blob = await put(opts.pathname, opts.body, {
    access: opts.access ?? 'public',
    contentType: opts.contentType,
    // Don't add random suffix — we control uniqueness via the pathname
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Delete a file from Vercel Blob storage.
 * Pass the full blob URL (as stored in the database).
 */
export async function deleteBlob(url: string): Promise<void> {
  try {
    await del(url);
  } catch (err) {
    console.error('[blob] Failed to delete:', url, err);
  }
}

/**
 * Check if a URL is a Vercel Blob URL (vs a legacy local file path).
 */
export function isBlobUrl(url: string): boolean {
  return url.startsWith('https://') && url.includes('.blob.');
}
