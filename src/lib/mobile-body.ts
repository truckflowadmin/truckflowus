import { NextRequest } from 'next/server';

/**
 * Extract request body from either the X-Body header (base64-encoded JSON,
 * used by React Native mobile apps that can't send POST bodies to Vercel)
 * or from the standard request body.
 *
 * React Native on iOS + Vercel edge has a bug where POST requests with a
 * body hang indefinitely. The mobile app works around this by encoding the
 * JSON payload as a base64 string in the X-Body header instead.
 */
export async function getMobileBody<T = any>(req: NextRequest): Promise<T> {
  // Check for X-Body header first (mobile workaround)
  const xBody = req.headers.get('x-body');
  if (xBody) {
    try {
      return JSON.parse(Buffer.from(xBody, 'base64').toString('utf-8'));
    } catch {
      throw new Error('Invalid X-Body header');
    }
  }

  // Fall back to standard request body (web/non-mobile clients)
  return req.json();
}
