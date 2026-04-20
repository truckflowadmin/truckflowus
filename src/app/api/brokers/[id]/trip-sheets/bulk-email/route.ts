import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { generateBrokerInvoicePdf } from '@/lib/pdf';
import { getTruckOverrides } from '@/lib/truck-overrides';
import { sendEmail } from '@/lib/email';
import { format } from 'date-fns';

/**
 * POST /api/brokers/[id]/trip-sheets/bulk-email
 *
 * Accepts JSON body: { to: string, entries: [{ sheetId: string, trucks: string[] }, ...] }
 * Generates one combined PDF and sends it in a single email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await requireSession();
  const body = await req.json();
  const { to, customBody } = body;
  const entries: { sheetId: string; trucks: string[] }[] = body.entries ?? [];

  if (!to) {
    return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
  }
  if (entries.length === 0) {
    return NextResponse.json({ error: 'No entries provided' }, { status: 400 });
  }

  const sheetIds = [...new Set(entries.map((e) => e.sheetId))];

  const sheets = await prisma.tripSheet.findMany({
    where: { id: { in: sheetIds }, brokerId: params.id, companyId: session.companyId },
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

  if (sheets.length === 0) {
    return NextResponse.json({ error: 'No trip sheets found' }, { status: 404 });
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });
  const broker = sheets[0].broker;

  // Build truck filter lookup
  const truckFilter = new Map<string, Set<string> | null>();
  for (const entry of entries) {
    if (entry.trucks.length === 0) {
      truckFilter.set(entry.sheetId, null);
    } else {
      const existing = truckFilter.get(entry.sheetId);
      if (existing === null) continue;
      if (!existing) {
        truckFilter.set(entry.sheetId, new Set(entry.trucks));
      } else {
        for (const t of entry.trucks) existing.add(t);
      }
    }
  }

  // Collect matching tickets
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

  const latestWeekEnding = sheets.reduce(
    (latest, s) => (s.weekEnding > latest ? s.weekEnding : latest),
    sheets[0].weekEnding,
  );

  const totalDue = allTickets.reduce((sum, t) => {
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

  const weekStr = format(latestWeekEnding, 'MMM d, yyyy');
  const filename = `TripSheets-${broker.name.replace(/\s+/g, '_')}-${sheets.length}-sheets.pdf`;

  const defaultText = [
    `Hello ${(Array.isArray(broker.contacts) && (broker.contacts as any[])[0]?.name) || broker.name},`,
    '',
    `Please find attached the combined trip sheet${sheets.length !== 1 ? 's' : ''} through week ending ${weekStr}.`,
    '',
    `Tickets: ${allTickets.length}`,
    `Total Due: $${totalDue.toFixed(2)}`,
    '',
    'Thank you,',
    company.name,
    [company.phone, company.email].filter(Boolean).join(' • '),
  ].join('\n');

  const result = await sendEmail({
    to,
    subject: `Trip Sheets from ${company.name} — ${sheets.length} sheet${sheets.length !== 1 ? 's' : ''} through ${weekStr}`,
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

  // Auto-advance DRAFT sheets to SENT
  const draftSheetIds = sheets.filter((s) => s.status === 'DRAFT').map((s) => s.id);
  if (draftSheetIds.length > 0) {
    await prisma.tripSheet.updateMany({
      where: { id: { in: draftSheetIds } },
      data: { status: 'SENT' },
    });
  }

  return NextResponse.json({ success: true });
}
