/**
 * API route error handling utilities.
 *
 * Wraps API route handlers to catch unhandled errors and return
 * structured JSON responses instead of generic 500s.
 *
 * Usage:
 *   import { withErrorHandler, ApiError } from '@/lib/api-error';
 *
 *   export const GET = withErrorHandler(async (req) => {
 *     // ... your logic
 *     if (!found) throw new ApiError('Record not found', 404);
 *     return NextResponse.json({ data });
 *   });
 */

import { NextResponse } from 'next/server';

/**
 * Custom error class for API routes.
 * Throw this to return a specific HTTP status code and message.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type RouteHandler = (
  req: Request,
  context?: { params?: Record<string, string> },
) => Promise<Response>;

/**
 * Wraps an API route handler with try/catch error handling.
 *
 * - ApiError instances return their message + status code
 * - Other errors return a generic 500 with a safe message
 * - All errors are logged server-side with full details
 */
export function withErrorHandler(handler: RouteHandler): RouteHandler {
  return async (req: Request, context?: { params?: Record<string, string> }) => {
    try {
      return await handler(req, context);
    } catch (err) {
      if (err instanceof ApiError) {
        console.error(`[API ${req.method} ${new URL(req.url).pathname}] ${err.message}`);
        return NextResponse.json(
          { error: err.message },
          { status: err.status },
        );
      }

      // Unexpected error — log full details, return safe message
      const pathname = new URL(req.url).pathname;
      console.error(`[API ${req.method} ${pathname}] Unhandled error:`, err);

      return NextResponse.json(
        {
          error: 'An unexpected error occurred. Please try again.',
          ...(process.env.NODE_ENV !== 'production' && err instanceof Error
            ? { detail: err.message }
            : {}),
        },
        { status: 500 },
      );
    }
  };
}
