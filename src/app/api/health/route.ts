import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', db: 'connected', ts: new Date().toISOString() });
  } catch (err: any) {
    return NextResponse.json(
      { status: 'error', db: 'unreachable', error: err?.message },
      { status: 503 },
    );
  }
}
