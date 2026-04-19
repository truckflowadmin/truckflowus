import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/drivers/payments/calculate?driverId=X&from=2026-04-01&to=2026-04-15
 * Calculates suggested payment for a driver in a given period.
 * Returns: hours, jobs, tickets, rate, suggested amount — dispatcher can then adjust & confirm.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const driverId = searchParams.get('driverId');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!driverId || !from || !to) {
    return NextResponse.json({ error: 'driverId, from, to required' }, { status: 400 });
  }

  const periodStart = new Date(from);
  const periodEnd = new Date(to + 'T23:59:59.999Z');

  // Verify driver belongs to this company
  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId: session.companyId },
    select: { id: true, name: true, payType: true, payRate: true, workerType: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  // Get completed jobs in the period
  const jobs = await prisma.job.findMany({
    where: {
      companyId: session.companyId,
      driverId,
      completedAt: { gte: periodStart, lte: periodEnd },
    },
    select: { id: true, driverTimeSeconds: true },
  });

  // Get completed tickets in the period
  const ticketCount = await prisma.ticket.count({
    where: {
      companyId: session.companyId,
      driverId,
      status: 'COMPLETED',
      completedAt: { gte: periodStart, lte: periodEnd },
    },
  });

  // Sum ticket revenue for percentage-based pay
  const ticketRevenue = await prisma.ticket.aggregate({
    where: {
      companyId: session.companyId,
      driverId,
      status: 'COMPLETED',
      completedAt: { gte: periodStart, lte: periodEnd },
      ratePerUnit: { not: null },
    },
    _sum: { quantity: true },
  });

  // Calculate totals
  const totalSeconds = jobs.reduce((sum, j) => sum + (j.driverTimeSeconds || 0), 0);
  const hoursWorked = Math.round((totalSeconds / 3600) * 100) / 100;
  const jobsCompleted = jobs.length;
  const payRate = Number(driver.payRate ?? 0);

  // Calculate suggested amount based on pay type
  let calculatedAmount = 0;
  if (driver.payType === 'HOURLY') {
    calculatedAmount = hoursWorked * payRate;
  } else if (driver.payType === 'SALARY') {
    // Salary: pro-rate based on period days vs 30-day month
    const periodDays = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)));
    calculatedAmount = (payRate / 30) * periodDays;
  } else if (driver.payType === 'PERCENTAGE') {
    // Percentage of revenue generated
    // We need to calculate actual revenue from individual tickets
    const tickets = await prisma.ticket.findMany({
      where: {
        companyId: session.companyId,
        driverId,
        status: 'COMPLETED',
        completedAt: { gte: periodStart, lte: periodEnd },
      },
      select: { quantity: true, ratePerUnit: true },
    });
    const totalRevenue = tickets.reduce((sum, t) => {
      const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
      return sum + rate * Number(t.quantity);
    }, 0);
    calculatedAmount = (totalRevenue * payRate) / 100;
  }

  calculatedAmount = Math.round(calculatedAmount * 100) / 100;

  return NextResponse.json({
    driverId: driver.id,
    driverName: driver.name,
    workerType: driver.workerType,
    payType: driver.payType,
    payRate,
    periodStart: from,
    periodEnd: to,
    hoursWorked,
    jobsCompleted,
    ticketsCompleted: ticketCount,
    calculatedAmount,
  });
}
