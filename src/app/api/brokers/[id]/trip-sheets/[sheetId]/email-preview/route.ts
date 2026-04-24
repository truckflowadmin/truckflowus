import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';

/**
 * POST /api/brokers/[id]/trip-sheets/[sheetId]/email-preview
 * Returns the email subject and default body text so the dispatcher can preview/edit before sending.
 * Body: { trucks?: string[] }  — if provided, scopes to those trucks; otherwise full sheet.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; sheetId: string } },
) {
  const session = await requireSession();
  const body = await req.json().catch(() => ({}));
  const trucks: string[] | undefined = body.trucks;

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: params.sheetId, brokerId: params.id, companyId: session.companyId },
    include: {
      broker: true,
      tickets: {
        where: { deletedAt: null },
        include: { customer: true, driver: { include: { assignedTruck: { select: { truckNumber: true } } } } },
        orderBy: [{ driverId: 'asc' }, { date: 'asc' }],
      },
    },
  });
  if (!sheet) {
    return NextResponse.json({ error: 'Trip sheet not found' }, { status: 404 });
  }

  const company = await prisma.company.findUniqueOrThrow({ where: { id: session.companyId } });
  const broker = sheet.broker;

  // Filter tickets if trucks specified
  const relevantTickets = trucks && trucks.length > 0
    ? sheet.tickets.filter((t) => {
        const truckNum = (t.driver as any)?.assignedTruck?.truckNumber ?? t.truckNumber ?? '';
        return trucks.includes(truckNum);
      })
    : sheet.tickets;

  const totalDue = relevantTickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  const contactName = (Array.isArray(broker.contacts) && (broker.contacts as any[])[0]?.name) || broker.name;
  const truckLabel = trucks && trucks.length > 0
    ? (trucks.length === 1 ? trucks[0] : `${trucks.length} trucks`)
    : null;
  const weekStr = format(sheet.weekEnding, 'MMM d, yyyy');

  const subject = truckLabel
    ? `Trip Sheet from ${company.name} — ${truckLabel} — Week Ending ${weekStr}`
    : `Trip Sheet from ${company.name} — Week Ending ${weekStr}`;

  const text = [
    `Hello ${contactName},`,
    '',
    truckLabel
      ? `Please find attached the trip sheet for ${truckLabel} for week ending ${weekStr}.`
      : `Please find attached the trip sheet for week ending ${weekStr}.`,
    '',
    `Tickets: ${relevantTickets.length}`,
    `Total Due: $${totalDue.toFixed(2)}`,
    '',
    'Thank you,',
    company.name,
    [company.phone, company.email].filter(Boolean).join(' • '),
  ].join('\n');

  return NextResponse.json({ subject, text });
}
