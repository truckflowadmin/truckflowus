import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/checks — list manual checks for the company
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks = await (prisma as any).manualCheck.findMany({
    where: { companyId: session.companyId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ checks });
}

/**
 * POST /api/checks — create a manual check
 * Body: { payee, amount, memo?, category? }
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { payee, amount, memo, category, markAsPaid } = body;

  if (!payee || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Payee and amount are required' }, { status: 400 });
  }

  // Get next check number (max of both tables)
  const [maxDriverPay, maxManualCheck] = await Promise.all([
    prisma.driverPayment.findFirst({
      where: { companyId: session.companyId },
      orderBy: { checkNumber: 'desc' },
      select: { checkNumber: true },
    }).catch(() => null),
    (prisma as any).manualCheck.findFirst({
      where: { companyId: session.companyId },
      orderBy: { checkNumber: 'desc' },
      select: { checkNumber: true },
    }).catch(() => null),
  ]);
  const maxNum = Math.max(
    (maxDriverPay as any)?.checkNumber ?? 0,
    (maxManualCheck as any)?.checkNumber ?? 0,
  );
  const nextCheckNumber = maxNum + 1;

  const check = await (prisma as any).manualCheck.create({
    data: {
      companyId: session.companyId,
      checkNumber: nextCheckNumber,
      payee,
      amount,
      memo: memo || null,
      category: category || null,
      status: markAsPaid ? 'PAID' : 'PENDING',
      paidAt: markAsPaid ? new Date() : null,
    },
  });

  return NextResponse.json({ check }, { status: 201 });
}

/**
 * PATCH /api/checks — update a manual check status
 * Body: { checkId, status }
 */
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { checkId, status } = body;

  if (!checkId) {
    return NextResponse.json({ error: 'checkId required' }, { status: 400 });
  }

  const existing = await (prisma as any).manualCheck.findFirst({
    where: { id: checkId, companyId: session.companyId },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Check not found' }, { status: 404 });
  }

  const data: any = {};
  if (status) {
    data.status = status;
    if (status === 'PAID') data.paidAt = new Date();
    if (status === 'VOID') data.paidAt = null;
  }

  const check = await (prisma as any).manualCheck.update({
    where: { id: checkId },
    data,
  });

  return NextResponse.json({ check });
}
