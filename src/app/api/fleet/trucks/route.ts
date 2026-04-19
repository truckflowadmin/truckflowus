import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/fleet/trucks — list trucks for the company
 */
export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get('status');
  const where: any = { companyId: session.companyId };
  if (status) where.status = status;

  const trucks = await prisma.truck.findMany({
    where,
    include: { photos: { orderBy: { createdAt: 'desc' } }, filters: true, _count: { select: { expenses: true } } },
    orderBy: { truckNumber: 'asc' },
  });

  return NextResponse.json({
    trucks: trucks.map((t) => ({
      id: t.id,
      truckNumber: t.truckNumber,
      vin: t.vin,
      year: t.year,
      make: t.make,
      model: t.model,
      licensePlate: t.licensePlate,
      registrationExpiry: t.registrationExpiry?.toISOString() ?? null,
      insuranceExpiry: t.insuranceExpiry?.toISOString() ?? null,
      inspectionExpiry: t.inspectionExpiry?.toISOString() ?? null,
      status: t.status,
      truckType: t.truckType,
      notes: t.notes,
      engineMake: t.engineMake,
      engineModel: t.engineModel,
      engineSerial: t.engineSerial,
      transmissionMake: t.transmissionMake,
      transmissionModel: t.transmissionModel,
      transmissionSerial: t.transmissionSerial,
      rearEndMake: t.rearEndMake,
      rearEndModel: t.rearEndModel,
      rearEndRatio: t.rearEndRatio,
      rearEndSerial: t.rearEndSerial,
      oilType: t.oilType,
      oilBrand: t.oilBrand,
      payToName: t.payToName,
      dispatcherName: t.dispatcherName,
      filters: (t as any).filters?.map((f: any) => ({
        id: f.id,
        filterType: f.filterType,
        partNumber: f.partNumber,
        lastReplacedAt: f.lastReplacedAt?.toISOString() ?? null,
        nextDueAt: f.nextDueAt?.toISOString() ?? null,
        mileage: f.mileage,
        nextDueMileage: f.nextDueMileage,
        notes: f.notes,
      })) ?? [],
      photos: t.photos.map((p) => ({ id: p.id, docType: p.docType, label: p.label, fileUrl: p.fileUrl })),
      expenseCount: t._count.expenses,
      createdAt: t.createdAt.toISOString(),
    })),
  });
}

/**
 * POST /api/fleet/trucks — create a new truck
 */
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { truckNumber, vin, year, make, model, licensePlate, registrationExpiry, insuranceExpiry, inspectionExpiry, status, truckType, notes } = body;

    if (!truckNumber?.trim()) {
      return NextResponse.json({ error: 'Truck number is required' }, { status: 400 });
    }

    const truck = await prisma.truck.create({
      data: {
        companyId: session.companyId,
        truckNumber: truckNumber.trim(),
        vin: vin?.trim() || null,
        year: year ? parseInt(year) : null,
        make: make?.trim() || null,
        model: model?.trim() || null,
        licensePlate: licensePlate?.trim() || null,
        registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        inspectionExpiry: inspectionExpiry ? new Date(inspectionExpiry) : null,
        status: status || 'ACTIVE',
        truckType: truckType || null,
        notes: notes?.trim() || null,
      },
    });

    return NextResponse.json({ ok: true, truck });
  } catch (err: any) {
    console.error('Truck create error:', err);
    return NextResponse.json({ error: 'Failed to create truck' }, { status: 500 });
  }
}

/**
 * PATCH /api/fleet/trucks — update a truck
 */
export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, ...fields } = body;

    if (!id) return NextResponse.json({ error: 'Truck id required' }, { status: 400 });

    const truck = await prisma.truck.findFirst({ where: { id, companyId: session.companyId } });
    if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });

    const data: any = {};
    if (fields.truckNumber !== undefined) data.truckNumber = fields.truckNumber.trim();
    if (fields.vin !== undefined) data.vin = fields.vin?.trim() || null;
    if (fields.year !== undefined) data.year = fields.year ? parseInt(fields.year) : null;
    if (fields.make !== undefined) data.make = fields.make?.trim() || null;
    if (fields.model !== undefined) data.model = fields.model?.trim() || null;
    if (fields.licensePlate !== undefined) data.licensePlate = fields.licensePlate?.trim() || null;
    if (fields.registrationExpiry !== undefined) data.registrationExpiry = fields.registrationExpiry ? new Date(fields.registrationExpiry) : null;
    if (fields.insuranceExpiry !== undefined) data.insuranceExpiry = fields.insuranceExpiry ? new Date(fields.insuranceExpiry) : null;
    if (fields.inspectionExpiry !== undefined) data.inspectionExpiry = fields.inspectionExpiry ? new Date(fields.inspectionExpiry) : null;
    if (fields.status !== undefined) data.status = fields.status;
    if (fields.truckType !== undefined) data.truckType = fields.truckType || null;
    if (fields.notes !== undefined) data.notes = fields.notes?.trim() || null;
    // Drivetrain detail fields
    if (fields.engineMake !== undefined) data.engineMake = fields.engineMake?.trim() || null;
    if (fields.engineModel !== undefined) data.engineModel = fields.engineModel?.trim() || null;
    if (fields.engineSerial !== undefined) data.engineSerial = fields.engineSerial?.trim() || null;
    if (fields.transmissionMake !== undefined) data.transmissionMake = fields.transmissionMake?.trim() || null;
    if (fields.transmissionModel !== undefined) data.transmissionModel = fields.transmissionModel?.trim() || null;
    if (fields.transmissionSerial !== undefined) data.transmissionSerial = fields.transmissionSerial?.trim() || null;
    if (fields.rearEndMake !== undefined) data.rearEndMake = fields.rearEndMake?.trim() || null;
    if (fields.rearEndModel !== undefined) data.rearEndModel = fields.rearEndModel?.trim() || null;
    if (fields.rearEndRatio !== undefined) data.rearEndRatio = fields.rearEndRatio?.trim() || null;
    if (fields.rearEndSerial !== undefined) data.rearEndSerial = fields.rearEndSerial?.trim() || null;
    if (fields.oilType !== undefined) data.oilType = fields.oilType?.trim() || null;
    if (fields.oilBrand !== undefined) data.oilBrand = fields.oilBrand?.trim() || null;
    if (fields.payToName !== undefined) data.payToName = fields.payToName?.trim() || null;
    if (fields.dispatcherName !== undefined) data.dispatcherName = fields.dispatcherName?.trim() || null;

    const updated = await prisma.truck.update({ where: { id }, data });

    // If truckNumber changed, sync it to any drivers assigned to this truck
    if (data.truckNumber && data.truckNumber !== truck.truckNumber) {
      await prisma.driver.updateMany({
        where: { assignedTruckId: id },
        data: { truckNumber: data.truckNumber },
      });
    }

    return NextResponse.json({ ok: true, truck: updated });
  } catch (err: any) {
    console.error('Truck update error:', err);
    return NextResponse.json({ error: 'Failed to update truck' }, { status: 500 });
  }
}

/**
 * DELETE /api/fleet/trucks?id=xxx — delete a truck
 */
export async function DELETE(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Truck id required' }, { status: 400 });

  const truck = await prisma.truck.findFirst({ where: { id, companyId: session.companyId } });
  if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });

  // Clear truckNumber on any drivers assigned to this truck before deleting
  await prisma.driver.updateMany({
    where: { assignedTruckId: id },
    data: { truckNumber: null },
  });

  await prisma.truck.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
