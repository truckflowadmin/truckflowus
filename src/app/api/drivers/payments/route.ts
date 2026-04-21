import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/drivers/payments?driverId=X&status=PAID&from=2026-01-01&to=2026-04-17
 * Returns payment history for a driver with optional filters.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const driverId = searchParams.get('driverId');
  if (!driverId) {
    return NextResponse.json({ error: 'driverId required' }, { status: 400 });
  }

  const where: any = { companyId: session.companyId, driverId };

  const status = searchParams.get('status');
  if (status) where.status = status;

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (from || to) {
    where.periodStart = {};
    if (from) where.periodStart.gte = new Date(from);
    if (to) where.periodEnd = { lte: new Date(to + 'T23:59:59.999Z') };
  }

  const payments = await prisma.driverPayment.findMany({
    where,
    orderBy: { periodStart: 'desc' },
  });

  return NextResponse.json({ payments });
}

/**
 * POST /api/drivers/payments
 * Create a new payment record.
 * Body: { driverId, periodStart, periodEnd, hoursWorked, jobsCompleted, ticketsCompleted,
 *         payType, payRate, calculatedAmount, adjustedAmount?, finalAmount, notes?, status? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { driverId, periodStart, periodEnd, hoursWorked, jobsCompleted, ticketsCompleted,
          payType, payRate, calculatedAmount, adjustedAmount, finalAmount, notes, status } = body;

  if (!driverId || !periodStart || !periodEnd) {
    return NextResponse.json({ error: 'driverId, periodStart, periodEnd required' }, { status: 400 });
  }

  // Verify driver belongs to this company
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId: session.companyId },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  // Get next check number for this company (max of both DriverPayment and ManualCheck)
  const [maxDriverPay, maxManualCheck] = await Promise.all([
    prisma.driverPayment.findFirst({
      where: { companyId: session.companyId },
      orderBy: { checkNumber: 'desc' },
      select: { checkNumber: true },
    }),
    prisma.manualCheck.findFirst({
      where: { companyId: session.companyId },
      orderBy: { checkNumber: 'desc' },
      select: { checkNumber: true },
    }).catch(() => null), // table may not exist yet during migration
  ]);
  const maxNum = Math.max(
    (maxDriverPay as any)?.checkNumber ?? 0,
    (maxManualCheck as any)?.checkNumber ?? 0,
  );
  const nextCheckNumber = maxNum + 1;

  const payment = await prisma.driverPayment.create({
    data: {
      companyId: session.companyId,
      driverId,
      checkNumber: nextCheckNumber,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      hoursWorked: hoursWorked ?? 0,
      jobsCompleted: jobsCompleted ?? 0,
      ticketsCompleted: ticketsCompleted ?? 0,
      payType: payType ?? driver.payType,
      payRate: payRate ?? driver.payRate ?? 0,
      calculatedAmount: calculatedAmount ?? 0,
      adjustedAmount: adjustedAmount ?? null,
      finalAmount: finalAmount ?? calculatedAmount ?? 0,
      notes: notes ?? null,
      status: status === 'PAID' ? 'PAID' : 'PENDING',
      paidAt: status === 'PAID' ? new Date() : null,
    } as any,
  });

  return NextResponse.json({ payment }, { status: 201 });
}

/**
 * PATCH /api/drivers/payments
 * Update a payment record (mark as paid, void, adjust amount).
 * Body: { paymentId, status?, adjustedAmount?, finalAmount?, notes? }
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { paymentId, status, adjustedAmount, finalAmount, notes } = body;

  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
  }

  const existing = await prisma.driverPayment.findFirst({
    where: { id: paymentId, companyId: session.companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const data: any = {};
  if (status) {
    data.status = status;
    if (status === 'PAID') data.paidAt = new Date();
    if (status === 'VOID') data.paidAt = null;
  }
  if (adjustedAmount !== undefined) data.adjustedAmount = adjustedAmount;
  if (finalAmount !== undefined) data.finalAmount = finalAmount;
  if (notes !== undefined) data.notes = notes;

  const payment = await prisma.driverPayment.update({
    where: { id: paymentId },
    data,
  });

  return NextResponse.json({ payment });
}
