import { NextRequest, NextResponse } from 'next/server';

/**
 * GET/POST /api/driver/ping — connectivity test for mobile app.
 * No auth, no database — echoes back to verify request reached server.
 * Supports multiple data delivery methods for debugging.
 */
export async function GET(req: NextRequest) {
  // Check for query-string encoded data
  const d = req.nextUrl.searchParams.get('d');
  let queryData: any = null;
  if (d) {
    try { queryData = JSON.parse(decodeURIComponent(d)); } catch {}
  }
  return NextResponse.json({ ok: true, method: 'GET', ts: Date.now(), queryData });
}

export async function POST(req: NextRequest) {
  const ct = req.headers.get('content-type') || 'none';

  // Try X-Body header (base64-encoded JSON)
  const xBody = req.headers.get('x-body');
  if (xBody) {
    try {
      const decoded = JSON.parse(atob(xBody));
      return NextResponse.json({ ok: true, method: 'POST', ts: Date.now(), source: 'x-body', contentType: ct, echo: decoded });
    } catch {}
  }

  // Try regular body
  let body: any = null;
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {}

  return NextResponse.json({ ok: true, method: 'POST', ts: Date.now(), source: 'body', contentType: ct, echo: body });
}
