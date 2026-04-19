import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';
import { sendEmail } from '@/lib/email';
import { format } from 'date-fns';

/**
 * POST /api/brokers/[id]/trip-sheets/[sheetId]/truck-email
 * Body: { to: string, trucks: string[] }
 *
 * Emails a PDF containing only the specified truck numbers' tickets.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sheetId: string } },
) {
  const session = await requireSession();
  const body = await req.json();
  const { to, trucks } = body;

  if (!to || !Array.isArray(trucks) || trucks.length === 0) {
    return NextResponse.json({ error: 'to and trucks[] are required' }, { status: 400 });
  }

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: params.sheetId, brokerId: params.id, companyId: session.companyId },
    include: {
      broker: true,
      tickets: {
        include: {
          customer: true,
          driver: { include: { assignedTruck: { select: { truckNumber: true } } } },
        },
        orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
      },
    },
  });
  if (!sheet) {
    return NextResponse.json({ error: 'Trip sheet not found' }, { status: 404 });
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });
  const broker = sheet.broker;

  const truckOverrides = await getTruckOverrides(session.companyId, sheet.tickets.map((t) => t.truckNumber ?? ''));

  // Filter tickets to specified truck numbers
  const filteredTickets = sheet.tickets.filter((t) => {
    const truckNum = (t.driver as any)?.assignedTruck?.truckNumber ?? t.truckNumber ?? '';
    return trucks.includes(truckNum);
  });

  if (filteredTickets.length === 0) {
    return NextResponse.json({ error: 'No tickets found for the specified truck(s)' }, { status: 404 });
  }

  const totalDue = filteredTickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  const pdfBuffer = await generateBrokerInvoicePdf({
    company: {
      name: company.name,
      address: company.address,
      city: company.city,
      state: company.state,
      zip: company.zip,
      phone: company.phone,
      email: company.email,
    },
    broker: {
      name: broker.name,
      contacts: Array.isArray(broker.contacts) ? (broker.contacts as any[]) : [],
      email: broker.email,
      mailingAddress: broker.mailingAddress,
      commissionPct: Number(broker.commissionPct),
      tripSheetForm: broker.tripSheetForm,
      logoFile: broker.logoFile,
    },
    periodEnd: sheet.weekEnding,
    tickets: filteredTickets.map((t) => ({
      ticketNumber: t.ticketNumber,
      ticketRef: t.ticketRef,
      date: t.date,
      completedAt: t.completedAt,
      customer: t.customer?.name ?? null,
      driver: t.driver?.name ?? null,
      truckNumber: (t.driver as any)?.assignedTruck?.truckNumber ?? t.truckNumber ?? null,
      material: t.material,
      quantityType: t.quantityType,
      quantity: Number(t.quantity),
      hauledFrom: t.hauledFrom,
      hauledTo: t.hauledTo,
      ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit) : 0,
      status: t.status,
      payToName: truckOverrides.get(t.truckNumber ?? '')?.payToName ?? null,
      dispatcherName: truckOverrides.get(t.truckNumber ?? '')?.dispatcherName ?? null,
    })),
  });

  const truckLabel = trucks.length === 1 ? trucks[0] : `${trucks.length} trucks`;
  const weekStr = format(sheet.weekEnding, 'MMM d, yyyy');
  const filename = `TripSheet-${broker.name.replace(/\s+/g, '_')}-${trucks.join('_')}-${format(sheet.weekEnding, 'yyyy-MM-dd')}.pdf`;

  const result = await sendEmail({
    to,
    subject: `Trip Sheet from ${company.name} — ${truckLabel} — Week Ending ${weekStr}`,
    text: [
      `Hello ${(Array.isArray(broker.contacts) && (broker.contacts as any[])[0]?.name) || broker.name},`,
      '',
      `Please find attached the trip sheet for ${truckLabel} for week ending ${weekStr}.`,
      '',
      `Tickets: ${filteredTickets.length}`,
      `Total Due: $${totalDue.toFixed(2)}`,
      '',
      'Thank you,',
      company.name,
      [company.phone, company.email].filter(Boolean).join(' \u2022 '),
    ].join('\n'),
    attachments: [{
      filename,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error || 'Failed to send email' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
