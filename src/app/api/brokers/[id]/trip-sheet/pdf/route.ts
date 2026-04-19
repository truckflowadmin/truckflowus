import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await requireSession();
  const { searchParams } = req.nextUrl;
  const weekStart = searchParams.get('weekStart');
  const weekEnd = searchParams.get('weekEnd');

  if (!weekStart || !weekEnd) {
    return NextResponse.json({ error: 'weekStart and weekEnd are required' }, { status: 400 });
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
      OR: [
        { date: { gte: startDate, lte: endDate } },
        { date: null, createdAt: { gte: startDate, lte: endDate } },
      ],
    },
    include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
    orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
  });

  const truckOverrides = await getTruckOverrides(session.companyId, tickets.map((t) => t.truckNumber ?? ''));

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

  const filename = `TripSheet-${broker.name.replace(/\s+/g, '_')}-${weekStart}.pdf`;

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
