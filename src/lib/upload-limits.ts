/**
 * Centralized file upload size limits.
 * Import and call validateFileSize() before processing any uploaded file.
 */

/** Maximum file sizes in bytes */
export const MAX_FILE_SIZES = {
  /** Images: ticket scans, photos, logos — 10 MB */
  IMAGE: 10 * 1024 * 1024,
  /** Documents: PDFs, driver documents — 15 MB */
  DOCUMENT: 15 * 1024 * 1024,
  /** Receipts: expense receipts — 10 MB */
  RECEIPT: 10 * 1024 * 1024,
} as const;

export type FileSizeCategory = keyof typeof MAX_FILE_SIZES;

/**
 * Returns null if valid, or an error message string if the file exceeds the limit.
 */
export function validateFileSize(
  file: File,
  category: FileSizeCategory = 'IMAGE',
): string | null {
  const limit = MAX_FILE_SIZES[category];
  if (file.size > limit) {
    const limitMB = Math.round(limit / (1024 * 1024));
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return `File too large (${fileMB} MB). Maximum allowed: ${limitMB} MB.`;
  }
  return null;
}
