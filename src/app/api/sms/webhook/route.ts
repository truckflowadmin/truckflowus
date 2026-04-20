/**
 * Textbelt inbound reply webhook.
 * Textbelt POSTs JSON: { textId, fromNumber, text }
 *
 * Flow:
 *   1. Try to match the sender to a Driver by phone → handle ticket commands
 *   2. Try to match the sender to a Broker by phone → handle job requests
 *   3. Log the message even if no match
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendSms } from '@/lib/sms';
import { parseJobSms } from '@/lib/sms-job-parser';

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

export async function POST(req: NextRequest) {
  // ── Webhook authentication (fail closed in ALL environments) ────────────────────
  const webhookSecret = process.env.TEXTBELT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[sms-webhook] TEXTBELT_WEBHOOK_SECRET not set — rejecting request');
    return NextResponse.json({ ok: false, error: 'Webhook not configured' }, { status: 503 });
  }
  // Only accept secret via header — query strings leak in logs
  const provided = req.headers.get('x-webhook-secret');
  if (provided !== webhookSecret) {
    console.warn('[sms-webhook] Rejected: invalid or missing webhook secret');
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const fromNumber: string = body.fromNumber || '';
  const text: string = (body.text || '').toString().substring(0, 2000); // Truncate
  const textbeltId: string | undefined = body.textId ? String(body.textId) : undefined;

  if (!fromNumber || !text) {
    return NextResponse.json({ ok: false, error: 'Missing fromNumber or text' }, { status: 400 });
  }

  const candidates = normalizePhone(fromNumber);

  // ─── Try matching a Driver first ─────────────────────────────
  const driver = await prisma.driver.findFirst({
    where: { phone: { in: candidates } },
  });

  if (driver) {
    return handleDriverSms(driver, fromNumber, text, textbeltId);
  }

  // ─── Try matching a Broker ──────────────────────────────────
  const broker = await prisma.broker.findFirst({
    where: { phone: { in: candidates }, active: true },
    include: { company: { select: { id: true } } },
  });

  if (broker && broker.companyId) {
    return handleBrokerJobSms(broker, fromNumber, text, textbeltId);
  }

  // ─── No match — log it anyway ──────────────────────────────
  await prisma.smsLog.create({
    data: {
      direction: 'INBOUND',
      phone: fromNumber,
      message: text,
      textbeltId,
      success: true,
    },
  });

  return NextResponse.json({ ok: true, matched: false });
}

/* ── Driver SMS handler (existing logic) ──────────────────────── */

async function handleDriverSms(
  driver: { id: string },
  fromNumber: string,
  text: string,
  textbeltId?: string,
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
      textbeltId,
      success: true,
    },
  });

  if (!ticket) {
    return NextResponse.json({ ok: true, matched: true, ticketUpdated: false });
  }

  // Block changes on invoiced tickets
  if (ticket.invoiceId) {
    return NextResponse.json({ ok: true, matched: true, ticketUpdated: false, reason: 'invoiced' });
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
    return NextResponse.json({ ok: true, matched: true, action: 'completed' });
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
    return NextResponse.json({ ok: true, matched: true, action: 'issue' });
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

  return NextResponse.json({ ok: true, matched: true, action: 'note' });
}

/* ── Broker SMS handler — create a job ────────────────────────── */

async function handleBrokerJobSms(
  broker: { id: string; companyId: string | null; name: string; phone: string | null },
  fromNumber: string,
  text: string,
  textbeltId?: string,
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
      textbeltId,
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
    return NextResponse.json({ ok: true, matched: true, action: 'parse_failed' });
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
  // (find the most recent inbound from this broker)
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

  return NextResponse.json({
    ok: true,
    matched: true,
    action: 'job_created',
    jobId: job.id,
    jobNumber,
    parseMethod: parsed.parseMethod,
  });
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST Textbelt reply payloads here' });
}
