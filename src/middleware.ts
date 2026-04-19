import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Edge-compatible JWT verification (Web Crypto API — no Node.js deps)
// ---------------------------------------------------------------------------
async function verifyJwtEdge(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sig = Uint8Array.from(atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const data = enc.encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) return false;

    // Check expiry
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Date.now() / 1000) return false;
    return true;
  } catch {
    return false;
  }
}

function getJwtSecretForMiddleware(): string {
  return process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
}

// Tenant-scoped dispatcher/admin routes.
const TENANT_PROTECTED = [
  '/dashboard',
  '/tickets',
  '/drivers',
  '/customers',
  '/invoices',
  '/reports',
  '/settings',
  '/sms',
  '/locked',
  '/subscribe',
  '/jobs',
  '/fleet',
  '/expenses',
];

// Platform-level superadmin routes.
const SUPERADMIN_PROTECTED = ['/sa'];

function needsAuth(pathname: string) {
  return (
    TENANT_PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    SUPERADMIN_PROTECTED.some((p) => pathname === p || pathname.startsWith(p + '/'))
  );
}

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com", // Next.js + Google Maps
    "style-src 'self' 'unsafe-inline'", // Tailwind
    "img-src 'self' data: blob: https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://*.googleapis.com https://*.gstatic.com https://*.ggpht.com",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://*.blob.vercel-storage.com https://*.public.blob.vercel-storage.com https://maps.googleapis.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

// ---------------------------------------------------------------------------
// CSRF protection — block cross-origin state-changing requests to /api/*
// ---------------------------------------------------------------------------
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function isCsrfSafe(req: NextRequest): boolean {
  // Only check state-changing requests to API routes
  if (!STATE_CHANGING_METHODS.has(req.method)) return true;
  if (!req.nextUrl.pathname.startsWith('/api/')) return true;

  // Allow webhook endpoints (they use their own auth — signature validation)
  if (req.nextUrl.pathname.startsWith('/api/sms/webhook')) return true;

  const origin = req.headers.get('origin');
  const host = req.headers.get('host');

  // If there's no origin header (same-origin form posts, server actions),
  // fall back to the referer header
  if (!origin) {
    const referer = req.headers.get('referer');
    if (!referer) {
      // No origin or referer — could be a server-to-server call or non-browser.
      // Block it for API routes to be safe.
      return false;
    }
    try {
      const refererHost = new URL(referer).host;
      return refererHost === host;
    } catch {
      return false;
    }
  }

  // Origin present — compare hostname
  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // CSRF check on API routes
  if (pathname.startsWith('/api/') && !isCsrfSafe(req)) {
    return new NextResponse(JSON.stringify({ error: 'CSRF validation failed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', ...SECURITY_HEADERS },
    });
  }

  // Auth check on protected routes — verify JWT, not just cookie presence
  if (needsAuth(pathname)) {
    const token = req.cookies.get('tf_session')?.value;
    if (!token) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
    const jwtValid = await verifyJwtEdge(token, getJwtSecretForMiddleware());
    if (!jwtValid) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', pathname);
      const res = NextResponse.redirect(url);
      // Clear the invalid cookie
      res.cookies.delete('tf_session');
      return res;
    }
  }

  // Attach security headers to all responses
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: [
    // Protected routes (auth check)
    '/dashboard/:path*',
    '/tickets/:path*',
    '/drivers/:path*',
    '/customers/:path*',
    '/invoices/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/sms/:path*',
    '/sa/:path*',
    '/locked/:path*',
    '/subscribe/:path*',
    '/jobs/:path*',
    '/fleet/:path*',
    '/expenses/:path*',
    // API routes (CSRF + headers)
    '/api/:path*',
    // Public pages (headers only)
    '/login',
    '/signup',
    '/forgot-password/:path*',
    '/reset-password/:path*',
    '/d/:path*',
  ],
};
