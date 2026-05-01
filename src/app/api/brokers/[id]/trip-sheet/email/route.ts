import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';
import { sendEmail } from '@/lib/email';
import { format } from 'date-fns';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const body = await req.json();
  const { weekStart, weekEnd, to, customBody } = body;

  if (!weekStart || !weekEnd || !to) {
    return NextResponse.json({ error: 'weekStart, weekEnd, and to are required' }, { status: 400 });
  }

  const broker = await prisma.broker.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!broker) {
    return NextResponse.json({ error: 'Broker not found' }, { status: 404 });
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });

  const startDate = new Date(weekStart + 'T00:00:00');
  const endDate = new Date(weekEnd + 'T23:59:59.999');

  const tickets = await prisma.ticket.findMany({
    where: {
      brokerId: broker.id,
      companyId: session.companyId,
      deletedAt: null,
      OR: [
        { date: { gte: startDate, lte: endDate } },
        { date: null, createdAt: { gte: startDate, lte: endDate } },
      ],
    },
    include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
    orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
  });

  const truckOverrides = await getTruckOverrides(session.companyId, tickets.map((t) => t.truckNumber ?? ''));

  const commPct = Number(broker.commissionPct);
  const totalRevenue = tickets
    .filter((t) => t.status === 'COMPLETED' && t.ratePerUnit)
    .reduce((sum, t) => sum + Number(t.ratePerUnit) * Number(t.quantity), 0);
  const totalCommission = totalRevenue * (commPct / 100);

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
      commissionPct: commPct,
      tripSheetForm: broker.tripSheetForm,
      logoFile: broker.logoFile,
    },
    periodEnd: endDate,
    tickets: tickets.map((t) => ({
      ticketNumber: t.ticketNumber,
      ticketRef: t.ticketRef,
      date: t.date,
      completedAt: t.completedAt,
      customer: t.customer?.name ?? null,
      driver: t.driver?.name ?? null,
      truckNumber: (t.driver as any)?.assignedTruck?.truckNumber ?? null,
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

  const periodLabel = `${format(startDate, 'MMM d')} – ${format(endDate, 'MMM d, yyyy')}`;
  const filename = `TripSheet-${broker.name.replace(/\s+/g, '_')}-${weekStart}.pdf`;

  const defaultText = [
    `Hello ${(Array.isArray(broker.contacts) && (broker.contacts as any[])[0]?.name) || broker.name},`,
    '',
    `Please find attached the trip sheet for ${periodLabel}.`,
    '',
    `Tickets: ${tickets.length}`,
    `Completed revenue: $${totalRevenue.toFixed(2)}`,
    `Commission owed (${commPct}%): $${totalCommission.toFixed(2)}`,
    '',
    'Thank you,',
    company.name,
    [company.phone, company.email].filter(Boolean).join(' • '),
  ].join('\n');

  const result = await sendEmail({
    to,
    subject: `Trip Sheet from ${company.name} — ${periodLabel}`,
    text: typeof customBody === 'string' && customBody.trim() ? customBody : defaultText,
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
