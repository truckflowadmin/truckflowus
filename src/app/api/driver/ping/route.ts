import { NextRequest, NextResponse } from 'next/server';

/**
 * GET/POST /api/driver/ping — simple connectivity test for mobile app.
 * No auth, no database — just echoes back to verify the request reached the server.
 */
export async function GET() {
  return NextResponse.json({ ok: true, method: 'GET', ts: Date.now() });
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || 'none';
  let body: any = null;
  try {
    // Try to parse body as JSON regardless of content-type
    const text = await req.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // not JSON, that's fine
  }
  return NextResponse.json({
    ok: true,
    method: 'POST',
    ts: Date.now(),
    contentType: ct,
    echo: body,
  });
}
