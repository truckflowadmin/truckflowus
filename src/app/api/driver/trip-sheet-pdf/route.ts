import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSession } from '@/lib/driver-auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';
import { format } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sheetId = req.nextUrl.searchParams.get('sheetId');
  if (!sheetId) {
    return NextResponse.json({ error: 'Missing sheetId' }, { status: 400 });
  }

  // Fetch trip sheet — only if it contains tickets belonging to this driver
  const sheet = await prisma.tripSheet.findFirst({
    where: {
      id: sheetId,
      companyId: session.companyId,
      tickets: { some: { driverId: session.driverId, deletedAt: null } },
    },
    include: {
      broker: true,
      tickets: {
        where: { deletedAt: null },
        include: {
          customer: true,
          driver: {
            include: { assignedTruck: { select: { truckNumber: true } } },
          },
        },
        orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
      },
    },
  });

  if (!sheet) {
    return NextResponse.json({ error: 'Trip sheet not found' }, { status: 404 });
  }

  const company = await prisma.company.findUniqueOrThrow({
    where: { id: session.companyId },
  });

  // Filter to only this driver's tickets — matches per-truck PDF the dispatcher generates
  const driverTickets = sheet.tickets.filter((t) => t.driverId === session.driverId);

  if (driverTickets.length === 0) {
    return NextResponse.json({ error: 'No tickets found for this driver' }, { status: 404 });
  }

  const truckOverrides = await getTruckOverrides(
    session.companyId,
    driverTickets.map((t) => t.truckNumber ?? ''),
  );

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
      contacts: Array.isArray(sheet.broker.contacts)
        ? (sheet.broker.contacts as any[])
        : [],
      email: sheet.broker.email,
      mailingAddress: sheet.broker.mailingAddress,
      commissionPct: Number(sheet.broker.commissionPct),
      tripSheetForm: sheet.broker.tripSheetForm,
      logoFile: sheet.broker.logoFile,
    },
    periodEnd: sheet.weekEnding,
    tickets: driverTickets.map((t) => ({
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
      dispatcherName:
        truckOverrides.get(t.truckNumber ?? '')?.dispatcherName ?? null,
    })),
  });

  // Use the driver's truck number in the filename (matches dispatcher per-truck PDF)
  const driverTruck = driverTickets[0]?.driver?.assignedTruck?.truckNumber
    ?? driverTickets[0]?.truckNumber
    ?? 'driver';
  const weekStr = format(sheet.weekEnding, 'yyyy-MM-dd');
  const filename = `TripSheet-${sheet.broker.name.replace(/\s+/g, '_')}-${driverTruck}-${weekStr}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
