import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fleet/trucks/filters?truckId=xxx — list filters for a truck
 */
export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const truckId = req.nextUrl.searchParams.get('truckId');
  if (!truckId) return NextResponse.json({ error: 'truckId required' }, { status: 400 });

  // Verify truck belongs to company
  const truck = await prisma.truck.findFirst({ where: { id: truckId, companyId: session.companyId } });
  if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });

  const filters = await prisma.truckFilter.findMany({
    where: { truckId },
    orderBy: { filterType: 'asc' },
  });

  return NextResponse.json({
    filters: filters.map((f) => ({
      id: f.id,
      truckId: f.truckId,
      filterType: f.filterType,
      partNumber: f.partNumber,
      lastReplacedAt: f.lastReplacedAt?.toISOString() ?? null,
      nextDueAt: f.nextDueAt?.toISOString() ?? null,
      mileage: f.mileage,
      nextDueMileage: f.nextDueMileage,
      notes: f.notes,
    })),
  });
}

/**
 * POST /api/fleet/trucks/filters — create or upsert a filter record
 */
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { truckId, filterType, partNumber, lastReplacedAt, nextDueAt, mileage, nextDueMileage, notes } = body;

    if (!truckId || !filterType) {
      return NextResponse.json({ error: 'truckId and filterType are required' }, { status: 400 });
    }

    const validTypes = ['DIESEL', 'OIL', 'AIR_CABIN', 'AIR_ENGINE', 'TIRES', 'BRAKES'];
    if (!validTypes.includes(filterType)) {
      return NextResponse.json({ error: `Invalid filterType. Must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Verify truck belongs to company
    const truck = await prisma.truck.findFirst({ where: { id: truckId, companyId: session.companyId } });
    if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });

    // Upsert: one filter per type per truck
    const filter = await prisma.truckFilter.upsert({
      where: { truckId_filterType: { truckId, filterType } },
      create: {
        truckId,
        filterType,
        partNumber: partNumber?.trim() || null,
        lastReplacedAt: lastReplacedAt ? new Date(lastReplacedAt) : null,
        nextDueAt: nextDueAt ? new Date(nextDueAt) : null,
        mileage: mileage ? parseInt(mileage) : null,
        nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : null,
        notes: notes?.trim() || null,
      },
      update: {
        partNumber: partNumber?.trim() || null,
        lastReplacedAt: lastReplacedAt ? new Date(lastReplacedAt) : null,
        nextDueAt: nextDueAt ? new Date(nextDueAt) : null,
        mileage: mileage ? parseInt(mileage) : null,
        nextDueMileage: nextDueMileage ? parseInt(nextDueMileage) : null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, filter });
  } catch (err: any) {
    console.error('Filter create/update error:', err);
    return NextResponse.json({ error: 'Failed to save filter' }, { status: 500 });
  }
}

/**
 * DELETE /api/fleet/trucks/filters?id=xxx — delete a filter record
 */
export async function DELETE(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Filter id required' }, { status: 400 });

  // Verify filter's truck belongs to company
  const filter = await prisma.truckFilter.findUnique({ where: { id }, include: { truck: { select: { companyId: true } } } });
  if (!filter || filter.truck.companyId !== session.companyId) {
    return NextResponse.json({ error: 'Filter not found' }, { status: 404 });
  }

  await prisma.truckFilter.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
