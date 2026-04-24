import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';

/**
 * POST /api/brokers/[id]/trip-sheets/bulk-pdf
 *
 * Accepts JSON body: { entries: [{ sheetId: string, trucks: string[] }, ...] }
 * Generates a single combined PDF with all matching tickets across entries.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireSession();
  const body = await req.json();
  const entries: { sheetId: string; trucks: string[] }[] = body.entries ?? [];

  if (entries.length === 0) {
    return NextResponse.json({ error: 'No entries provided' }, { status: 400 });
  }

  const sheetIds = [...new Set(entries.map((e) => e.sheetId))];

  const sheets = await prisma.tripSheet.findMany({
    where: { id: { in: sheetIds }, brokerId: params.id, companyId: session.companyId },
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

  if (sheets.length === 0) {
    return NextResponse.json({ error: 'No trip sheets found' }, { status: 404 });
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });
  const broker = sheets[0].broker;

  // Build a lookup: sheetId → set of trucks (empty means all trucks)
  const truckFilter = new Map<string, Set<string> | null>();
  for (const entry of entries) {
    if (entry.trucks.length === 0) {
      truckFilter.set(entry.sheetId, null); // all trucks
    } else {
      const existing = truckFilter.get(entry.sheetId);
      if (existing === null) continue; // already "all"
      if (!existing) {
        truckFilter.set(entry.sheetId, new Set(entry.trucks));
      } else {
        for (const t of entry.trucks) existing.add(t);
      }
    }
  }

  // Collect all matching tickets across sheets
  const allTickets: typeof sheets[0]['tickets'] = [];
  for (const sheet of sheets) {
    const filter = truckFilter.get(sheet.id);
    for (const t of sheet.tickets) {
      if (filter === null || filter === undefined) {
        allTickets.push(t);
      } else {
        const truckNum = (t.driver as any)?.assignedTruck?.truckNumber ?? t.truckNumber ?? '';
        if (filter.has(truckNum)) allTickets.push(t);
      }
    }
  }

  if (allTickets.length === 0) {
    return NextResponse.json({ error: 'No tickets match the selection' }, { status: 404 });
  }

  const truckOverrides = await getTruckOverrides(
    session.companyId,
    allTickets.map((t) => t.truckNumber ?? ''),
  );

  // Use the latest weekEnding as the period end
  const latestWeekEnding = sheets.reduce(
    (latest, s) => (s.weekEnding > latest ? s.weekEnding : latest),
    sheets[0].weekEnding,
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
      name: broker.name,
      contacts: Array.isArray(broker.contacts) ? (broker.contacts as any[]) : [],
      email: broker.email,
      mailingAddress: broker.mailingAddress,
      commissionPct: Number(broker.commissionPct),
      tripSheetForm: broker.tripSheetForm,
      logoFile: broker.logoFile,
    },
    periodEnd: latestWeekEnding,
    tickets: allTickets.map((t) => ({
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

  const filename = `TripSheets-${broker.name.replace(/\s+/g, '_')}-${sheets.length}-sheets.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  });
}
