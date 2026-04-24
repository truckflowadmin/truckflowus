/**
 * Server-side error helpers for page-level error handling.
 *
 * Usage in server components:
 *   const data = await safeQuery(() => prisma.user.findMany(...), 'Failed to load users');
 *
 * This ensures meaningful error messages survive Next.js production stripping
 * by throwing a custom error that the error boundary can display.
 */

/**
 * Wraps an async database query with try/catch.
 * On failure, throws a user-friendly error (with a class that error boundaries can detect)
 * and logs the real error to the server.
 */
export async function safeQuery<T>(
  queryFn: () => Promise<T>,
  friendlyMessage: string,
): Promise<T> {
  try {
    return await queryFn();
  } catch (err) {
    console.error(`[safeQuery] ${friendlyMessage}:`, err);
    throw new PageError(friendlyMessage);
  }
}

/**
 * A custom error class for page-level errors.
 * The error boundary can check `instanceof PageError` if needed.
 */
export class PageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageError';
  }
}

/**
 * Wraps an entire server component's data-fetching logic.
 * Returns the data on success, or throws a friendly PageError on failure.
 *
 * Usage:
 *   const { drivers, jobs } = await safePage(
 *     async () => ({
 *       drivers: await prisma.driver.findMany(...),
 *       jobs: await prisma.job.findMany(...),
 *     }),
 *     'Unable to load the drivers page'
 *   );
 */
export async function safePage<T>(
  dataFn: () => Promise<T>,
  friendlyMessage: string,
): Promise<T> {
  try {
    return await dataFn();
  } catch (err) {
    // If it's already a PageError (from a nested safeQuery), re-throw as-is
    if (err instanceof PageError) throw err;

    // If it's a redirect, re-throw (Next.js uses error throwing for redirects)
    if (err instanceof Error && 'digest' in err) {
      const digest = (err as any).digest;
      if (typeof digest === 'string' && digest.includes('NEXT_REDIRECT')) {
        throw err;
      }
    }

    console.error(`[safePage] ${friendlyMessage}:`, err);
    throw new PageError(friendlyMessage);
  }
}
