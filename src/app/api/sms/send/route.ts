import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { sendSms } from '@/lib/sms';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/sms/send
 * Send a manual SMS message from the SMS & Fax hub.
 * Body: { phone: string, message: string, driverId?: string, brokerId?: string }
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();
  const { phone, message, driverId, brokerId } = body;

  if (!phone || !message) {
    return NextResponse.json({ error: 'Phone and message are required' }, { status: 400 });
  }

  // Normalize phone to E.164
  let normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.length === 10) normalized = '+1' + normalized;
  else if (normalized.length === 11 && normalized.startsWith('1')) normalized = '+' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+' + normalized;

  // If driverId provided, verify it belongs to this company
  if (driverId) {
    const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId: session.companyId } });
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  // If brokerId provided, verify it belongs to this company
  if (brokerId) {
    const broker = await prisma.broker.findFirst({ where: { id: brokerId, companyId: session.companyId } });
    if (!broker) return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
  }

  const result = await sendSms({
    phone: normalized,
    message,
    companyId: session.companyId,
    driverId: driverId || undefined,
    brokerId: brokerId || undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sid: result.twilioSid });
}
