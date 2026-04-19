import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fleet/inspection-alerts — trucks with inspection expiring within 30 days or already expired
 */
export async function GET() {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const trucks = await prisma.truck.findMany({
    where: {
      companyId: session.companyId,
      status: 'ACTIVE',
      inspectionExpiry: { not: null, lte: thirtyDaysFromNow },
    },
    select: {
      id: true,
      truckNumber: true,
      inspectionExpiry: true,
    },
    orderBy: { inspectionExpiry: 'asc' },
  });

  return NextResponse.json({
    alerts: trucks.map((t) => ({
      truckId: t.id,
      truckNumber: t.truckNumber,
      inspectionExpiry: t.inspectionExpiry!.toISOString(),
      expired: t.inspectionExpiry! < new Date(),
    })),
  });
}

/**
 * POST /api/fleet/inspection-alerts — acknowledge an alert (creates a notification record so it's tracked)
 * Body: { truckId }
 */
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { truckId } = await req.json();
  if (!truckId) return NextResponse.json({ error: 'truckId required' }, { status: 400 });

  const truck = await prisma.truck.findFirst({
    where: { id: truckId, companyId: session.companyId },
    select: { truckNumber: true },
  });
  if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });

  // Create a read notification to record acknowledgement
  await prisma.notification.create({
    data: {
      companyId: session.companyId,
      type: 'INSPECTION_ACK',
      title: `Inspection alert acknowledged for Truck ${truck.truckNumber}`,
      link: '/fleet',
      read: true,
    },
  });

  return NextResponse.json({ ok: true });
}
