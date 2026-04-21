import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

function getBaseUrl(req: NextRequest): string {
  // Use x-forwarded-host (Vercel sets this) or host header to build correct origin
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  clearSessionCookie();
  const base = getBaseUrl(req);
  return NextResponse.redirect(new URL('/login?signedout=1', base));
}

export async function GET(req: NextRequest) {
  clearSessionCookie();
  const base = getBaseUrl(req);
  return NextResponse.redirect(new URL('/login?signedout=1', base));
}
