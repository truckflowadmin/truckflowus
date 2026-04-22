import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateTwilioSignature } from '@/lib/sms';

/**
 * POST /api/fax/webhook
 * Handles inbound fax and fax status updates from Twilio.
 */
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((v, k) => { params[k] = String(v); });

  // Validate Twilio signature in production
  if (process.env.NODE_ENV === 'production') {
    const sig = req.headers.get('x-twilio-signature') || '';
    const fullUrl = req.url;
    const valid = await validateTwilioSignature(fullUrl, params, sig);
    if (!valid) {
      console.warn('[fax-webhook] Invalid Twilio signature');
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const faxSid = params.FaxSid || params.Sid || '';
  const status = params.FaxStatus || params.Status || '';
  const from = params.From || '';
  const to = params.To || '';
  const numPages = params.NumPages ? parseInt(params.NumPages, 10) : null;
  const mediaUrl = params.MediaUrl || null;
  const errorMessage = params.ErrorMessage || null;

  console.log('[fax-webhook]', { faxSid, status, from, to, numPages });

  // Map Twilio status to our enum
  const statusMap: Record<string, string> = {
    queued: 'QUEUED',
    processing: 'PROCESSING',
    sending: 'SENDING',
    delivered: 'DELIVERED',
    receiving: 'RECEIVING',
    received: 'RECEIVED',
    'no-answer': 'NO_ANSWER',
    busy: 'BUSY',
    failed: 'FAILED',
    canceled: 'CANCELED',
  };
  const mappedStatus = statusMap[status.toLowerCase()] || 'QUEUED';

  // Check if this is a status update for an existing outbound fax
  if (faxSid) {
    const existing = await prisma.faxLog.findFirst({ where: { twilioSid: faxSid } });
    if (existing) {
      // Update existing fax status
      await prisma.faxLog.update({
        where: { id: existing.id },
        data: {
          status: mappedStatus as any,
          pages: numPages ?? existing.pages,
          mediaUrl: mediaUrl ?? existing.mediaUrl,
          error: errorMessage,
        },
      });
      return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
    }
  }

  // New inbound fax — create a log entry
  if (from) {
    await prisma.faxLog.create({
      data: {
        direction: 'INBOUND',
        faxNumber: from,
        pages: numPages,
        mediaUrl,
        twilioSid: faxSid || null,
        status: mappedStatus as any,
        error: errorMessage,
      },
    });
  }

  return new NextResponse('<Response/>', { headers: { 'Content-Type': 'text/xml' } });
}
