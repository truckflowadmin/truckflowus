import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { sendSms } from '@/lib/sms';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/sms/send
 * Send a manual SMS message from the SMS hub.
 * Body: { phone: string, message: string, driverId?: string, customerId?: string }
 * Note: Sending SMS to brokers is not permitted from the dispatcher side.
 */
export async function POST(req: NextRequest) {
  const session = await requireSession();
  const body = await req.json();
  const { phone, message, driverId, customerId } = body;

  if (!phone || !message) {
    return NextResponse.json({ error: 'Phone and message are required' }, { status: 400 });
  }

  // Require a contact ID — only drivers and customers are allowed
  if (!driverId && !customerId) {
    return NextResponse.json({ error: 'You must select a driver or customer to send SMS to' }, { status: 400 });
  }

  // Normalize phone to E.164
  let normalized = phone.replace(/[^\d+]/g, '');
  if (normalized.length === 10) normalized = '+1' + normalized;
  else if (normalized.length === 11 && normalized.startsWith('1')) normalized = '+' + normalized;
  else if (!normalized.startsWith('+')) normalized = '+' + normalized;

  // Verify the contact belongs to this company
  if (driverId) {
    const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId: session.companyId } });
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  if (customerId) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId: session.companyId } });
    if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const result = await sendSms({
    phone: normalized,
    message,
    companyId: session.companyId,
    driverId: driverId || undefined,
    customerId: customerId || undefined,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send SMS' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sid: result.twilioSid });
}
