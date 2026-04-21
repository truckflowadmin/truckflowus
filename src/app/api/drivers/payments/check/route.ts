import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/drivers/payments/check?paymentId=X
 * Returns payment details + company bank info for rendering a printable check.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const paymentId = req.nextUrl.searchParams.get('paymentId');
  if (!paymentId) {
    return NextResponse.json({ error: 'paymentId required' }, { status: 400 });
  }

  const payment = await prisma.driverPayment.findFirst({
    where: { id: paymentId, companyId: session.companyId },
    include: {
      driver: { select: { name: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
  });

  return NextResponse.json({
    payment: {
      id: payment.id,
      checkNumber: (payment as any).checkNumber ?? 0,
      periodStart: payment.periodStart,
      periodEnd: payment.periodEnd,
      payType: payment.payType,
      payRate: Number(payment.payRate),
      hoursWorked: Number(payment.hoursWorked),
      jobsCompleted: payment.jobsCompleted,
      ticketsCompleted: payment.ticketsCompleted,
      calculatedAmount: Number(payment.calculatedAmount),
      adjustedAmount: payment.adjustedAmount ? Number(payment.adjustedAmount) : null,
      finalAmount: Number(payment.finalAmount),
      notes: payment.notes,
      status: payment.status,
      paidAt: payment.paidAt,
      createdAt: payment.createdAt,
    },
    driverName: payment.driver?.name ?? 'Unknown',
    company: {
      name: company?.name ?? '',
      address: company?.address ?? '',
      city: company?.city ?? '',
      state: company?.state ?? '',
      zip: company?.zip ?? '',
      phone: company?.phone ?? '',
      logoUrl: company?.logoUrl ?? null,
      checkRoutingNumber: (company as any)?.checkRoutingNumber ?? '',
      checkAccountNumber: (company as any)?.checkAccountNumber ?? '',
    },
  });
}
