import { NextRequest, NextResponse } from 'next/server';

/**
 * GET/POST /api/driver/ping — simple connectivity test for mobile app.
 * No auth, no database — just echoes back to verify the request reached the server.
 */
export async function GET() {
  return NextResponse.json({ ok: true, method: 'GET', ts: Date.now() });
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }
  return NextResponse.json({
    ok: true,
    method: 'POST',
    ts: Date.now(),
    echo: body,
  });
}
