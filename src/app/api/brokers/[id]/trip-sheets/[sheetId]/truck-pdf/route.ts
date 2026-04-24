import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';
import { format } from 'date-fns';

/**
 * GET /api/brokers/[id]/trip-sheets/[sheetId]/truck-pdf?trucks=T-101,T-102
 *
 * Generates a PDF containing only the specified truck numbers' tickets.
 * Each truck gets its own page in the PDF (same as the full trip sheet layout).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; sheetId: string } },
) {
  const session = await requireSession();
  const trucksParam = req.nextUrl.searchParams.get('trucks') || '';
  const truckNumbers = trucksParam.split(',').map((s) => s.trim()).filter(Boolean);

  if (truckNumbers.length === 0) {
    return NextResponse.json({ error: 'trucks query parameter is required' }, { status: 400 });
  }

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: params.sheetId, brokerId: params.id, companyId: session.companyId },
    include: {
      broker: true,
      tickets: {
        where: { deletedAt: null },
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

  const truckOverrides = await getTruckOverrides(session.companyId, sheet.tickets.map((t) => t.truckNumber ?? ''));

  // Filter tickets to only the specified truck numbers
  const filteredTickets = sheet.tickets.filter((t) => {
    const truckNum = (t.driver as any)?.assignedTruck?.truckNumber ?? t.truckNumber ?? '';
    return truckNumbers.includes(truckNum);
  });

  if (filteredTickets.length === 0) {
    return NextResponse.json({ error: 'No tickets found for the specified truck(s)' }, { status: 404 });
  }

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
      name: sheet.broker.name,
      contacts: Array.isArray(sheet.broker.contacts) ? (sheet.broker.contacts as any[]) : [],
      email: sheet.broker.email,
      mailingAddress: sheet.broker.mailingAddress,
      commissionPct: Number(sheet.broker.commissionPct),
      tripSheetForm: sheet.broker.tripSheetForm,
      logoFile: sheet.broker.logoFile,
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

  const truckLabel = truckNumbers.length === 1 ? truckNumbers[0] : `${truckNumbers.length}-trucks`;
  const weekStr = format(sheet.weekEnding, 'yyyy-MM-dd');
  const filename = `TripSheet-${sheet.broker.name.replace(/\s+/g, '_')}-${truckLabel}-${weekStr}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
