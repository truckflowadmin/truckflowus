import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { sendFax } from '@/lib/fax';

/**
 * POST /api/fax/send
 * Send a fax from the SMS & Fax hub.
 * Body: { faxNumber: string, mediaUrl: string, driverId?: string, brokerId?: string }
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();
  const { faxNumber, mediaUrl, driverId, brokerId } = body;

  if (!faxNumber || !mediaUrl) {
    return NextResponse.json({ error: 'Fax number and media URL are required' }, { status: 400 });
  }

  // Normalize fax number to E.164
  let normalized = faxNumber.replace(/[^\d+]/g, '');
  if (normalized.length === 10) normalized = '+1' + normalized;
  else if (normalized.length === 11 && normalized.startsWith('1')) normalized = '+' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+' + normalized;

  const appUrl = process.env.APP_URL || 'https://truckflowus.com';
  const result = await sendFax({
    faxNumber: normalized,
    mediaUrl,
    companyId: session.companyId,
    driverId: driverId || undefined,
    brokerId: brokerId || undefined,
    statusCallback: `${appUrl}/api/fax/webhook`,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send fax' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sid: result.twilioSid });
}
