import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST() {
  clearSessionCookie();
  return NextResponse.redirect(new URL('/login?signedout=1', process.env.APP_URL || 'http://localhost:3000'));
}

export async function GET() {
  clearSessionCookie();
  return NextResponse.redirect(new URL('/login?signedout=1', process.env.APP_URL || 'http://localhost:3000'));
}
