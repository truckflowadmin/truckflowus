/**
 * Twilio inbound SMS webhook.
 *
 * Twilio POSTs form-urlencoded data with fields including:
 *   From, To, Body, MessageSid, AccountSid, NumMedia, etc.
 *
 * Authentication: Twilio signs each request with X-Twilio-Signature header.
 * We validate it using HMAC-SHA1 of the full URL + sorted POST params.
 *
 * Flow:
 *   1. Validate Twilio signature
 *   2. Try to match the sender to a Driver by phone → handle ticket commands
 *   3. Try to match the sender to a Broker by phone → handle job requests
 *   4. Log the message even if no match
 *   5. Return TwiML (empty <Response/>) to acknowledge receipt
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSms, validateTwilioSignature } from '@/lib/sms';
import { parseJobSms } from '@/lib/sms-job-parser';

// Twilio expects TwiML responses
function twimlResponse(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return new NextResponse(body, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Normalize US-style numbers to E.164 +1XXXXXXXXXX for lookup.
function normalizePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, '');
  const variants = new Set<string>();
  variants.add(raw);
  if (digits.length === 10) variants.add(`+1${digits}`);
  if (digits.length === 11 && digits.startsWith('1')) variants.add(`+${digits}`);
  if (digits.length > 0) variants.add(`+${digits}`);
  return Array.from(variants);
}

// Parse form-urlencoded body into a plain object
async function parseFormBody(req: NextRequest): Promise<Record<string, string>> {
  const text = await req.text();
  const params: Record<string, string> = {};
  for (const pair of text.split('&')) {
    const [key, val] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(val || '');
  }
  return params;
}

export async function POST(req: NextRequest) {
  // ── Parse the form body ────────────────────────────────────────
  const params = await parseFormBody(req);

  // ── Webhook authentication via Twilio signature ────────────────
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error('[sms-webhook] TWILIO_AUTH_TOKEN not set — rejecting request');
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = req.headers.get('x-twilio-signature') || '';
  // Build the full webhook URL from request headers
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const webhookUrl = `${proto}://${host}/api/sms/webhook`;

  const valid = await validateTwilioSignature(webhookUrl, params, signature);
  if (!valid) {
    console.warn('[sms-webhook] Rejected: invalid Twilio signature');
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  // ── Extract Twilio fields ──────────────────────────────────────
  const fromNumber: string = params.From || '';
  const text: string = (params.Body || '').substring(0, 2000); // Truncate
  const messageSid: string | undefined = params.MessageSid || undefined;

  if (!fromNumber || !text) {
    return twimlResponse(); // Empty response, nothing to process
  }

  const candidates = normalizePhone(fromNumber);

  // ─── Try matching a Driver first ─────────────────────────────
  const driver = await prisma.driver.findFirst({
    where: { phone: { in: candidates } },
  });

  if (driver) {
    return handleDriverSms(driver, fromNumber, text, messageSid);
  }

  // ─── Try matching a Broker ──────────────────────────────────
  const broker = await prisma.broker.findFirst({
    where: { phone: { in: candidates }, active: true },
    include: { company: { select: { id: true } } },
  });

  if (broker && broker.companyId) {
    return handleBrokerJobSms(broker, fromNumber, text, messageSid);
  }

  // ─── No match — log it anyway ──────────────────────────────
  await prisma.smsLog.create({
    data: {
      direction: 'INBOUND',
      phone: fromNumber,
      message: text,
      textbeltId: messageSid, // reusing column for Twilio MessageSid
      success: true,
    },
  });

  return twimlResponse();
}

/* ── Driver SMS handler ──────────────────────────────────────── */

async function handleDriverSms(
  driver: { id: string },
  fromNumber: string,
  text: string,
  messageSid?: string,
) {
  // Find their active ticket (most recently dispatched, not yet completed)
  const ticket = await prisma.ticket.findFirst({
    where: {
      driverId: driver.id,
      status: { in: ['DISPATCHED', 'IN_PROGRESS'] },
    },
    orderBy: { dispatchedAt: 'desc' },
  });

  // Always log the inbound
  await prisma.smsLog.create({
    data: {
      direction: 'INBOUND',
      phone: fromNumber,
      message: text,
      driverId: driver.id,
      ticketId: ticket?.id,
      textbeltId: messageSid,
      success: true,
    },
  });

  if (!ticket) {
    return twimlResponse();
  }

  // Block changes on invoiced tickets
  if (ticket.invoiceId) {
    return twimlResponse();
  }

  const normalized = text.trim().toUpperCase();
  const now = new Date();

  if (normalized.startsWith('DONE')) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        startedAt: ticket.startedAt ?? now,
        driverNotes: ticket.driverNotes
          ? `${ticket.driverNotes}\n[SMS] ${text}`
          : `[SMS] ${text}`,
      },
    });
    return twimlResponse();
  }

  if (normalized.startsWith('ISSUE')) {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'ISSUE',
        driverNotes: ticket.driverNotes
          ? `${ticket.driverNotes}\n[SMS ISSUE] ${text}`
          : `[SMS ISSUE] ${text}`,
      },
    });
    return twimlResponse();
  }

  // Free-text reply — append as a note
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      driverNotes: ticket.driverNotes
        ? `${ticket.driverNotes}\n[SMS] ${text}`
        : `[SMS] ${text}`,
    },
  });

  return twimlResponse();
}

/* ── Broker SMS handler — create a job ────────────────────────── */

async function handleBrokerJobSms(
  broker: { id: string; companyId: string | null; name: string; phone: string | null },
  fromNumber: string,
  text: string,
  messageSid?: string,
) {
  const companyId = broker.companyId!;

  // Parse the SMS into job fields
  const parsed = await parseJobSms(text);

  console.log(`[sms-webhook] Broker "${broker.name}" SMS parsed (${parsed.parseMethod}):`, JSON.stringify(parsed));

  // Log inbound
  await prisma.smsLog.create({
    data: {
      direction: 'INBOUND',
      phone: fromNumber,
      message: text,
      brokerId: broker.id,
      textbeltId: messageSid,
      success: true,
    },
  });

  // If parsing completely failed (no from/to), log and reply with help
  if (!parsed.hauledFrom && !parsed.hauledTo && parsed.parseMethod === 'failed') {
    const helpMsg =
      `Could not parse your job request. Try this format:\n` +
      `JOB Customer / From / To / Material / 10 loads\n\n` +
      `Or just text the details naturally and we'll figure it out.`;

    await sendSms({ phone: fromNumber, message: helpMsg });
    return twimlResponse();
  }

  // Auto-match or create the customer by name
  let customerId: string | null = null;
  if (parsed.customer) {
    const existing = await prisma.customer.findFirst({
      where: { companyId, name: { equals: parsed.customer, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existing) {
      customerId = existing.id;
    } else {
      const created = await prisma.customer.create({
        data: { companyId, name: parsed.customer },
      });
      customerId = created.id;
    }
  }

  // Auto-increment job number
  const last = await prisma.job.findFirst({
    where: { companyId },
    orderBy: { jobNumber: 'desc' },
    select: { jobNumber: true },
  });
  const jobNumber = (last?.jobNumber ?? 0) + 1;

  // Build notes with parse context
  const jobNotes = [
    `[SMS from ${broker.name}] ${text}`,
    parsed.notes ? `AI notes: ${parsed.notes}` : null,
    parsed.parseMethod === 'ai' ? '(Parsed by AI — please verify details)' : null,
  ].filter(Boolean).join('\n');

  const job = await prisma.job.create({
    data: {
      companyId,
      jobNumber,
      name: parsed.customer || `SMS Job from ${broker.name}`,
      customerId,
      brokerId: broker.id,
      status: 'CREATED',
      hauledFrom: parsed.hauledFrom || 'TBD',
      hauledTo: parsed.hauledTo || 'TBD',
      material: parsed.material,
      quantityType: parsed.quantityType || 'LOADS',
      totalLoads: parsed.quantity || 0,
      ratePerUnit: parsed.ratePerUnit,
      notes: jobNotes,
    },
  });

  // Save material for reuse
  if (parsed.material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId, name: parsed.material } },
      update: {},
      create: { companyId, name: parsed.material },
    });
  }

  // Update the SMS log with the job ID
  await prisma.smsLog.updateMany({
    where: {
      brokerId: broker.id,
      phone: fromNumber,
      direction: 'INBOUND',
      jobId: null,
    },
    data: { jobId: job.id },
  });

  // ─── Send confirmation SMS back to broker ───────────────────
  const qtyStr = parsed.quantity
    ? `${parsed.quantity} ${(parsed.quantityType || 'LOADS').toLowerCase()}`
    : 'qty TBD';
  const matStr = parsed.material ? `${parsed.material}, ` : '';
  const confirmMsg =
    `Job #${String(jobNumber).padStart(4, '0')} received!\n` +
    `${matStr}${qtyStr}\n` +
    `From: ${parsed.hauledFrom || 'TBD'}\n` +
    `To: ${parsed.hauledTo || 'TBD'}\n` +
    `We'll confirm when a driver is assigned.`;

  await sendSms({
    phone: fromNumber,
    message: confirmMsg,
  });

  return twimlResponse();
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST Twilio inbound SMS webhooks here' });
}
