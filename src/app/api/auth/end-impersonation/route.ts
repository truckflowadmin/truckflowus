import { NextResponse } from 'next/server';
import { restoreSuperadminSession } from '@/lib/auth';

/**
 * POST /api/auth/end-impersonation
 * Restores the superadmin's original session from the backup cookie.
 */
export async function POST() {
  const restored = restoreSuperadminSession();
  if (!restored) {
    return NextResponse.json({ error: 'No impersonation session to end' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, redirect: '/sa/overview' });
}
