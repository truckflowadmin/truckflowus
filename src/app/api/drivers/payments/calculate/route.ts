import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/drivers/payments/calculate?driverId=X&from=2026-04-01&to=2026-04-15
 * Calculates suggested payment for a driver in a given period.
 * Only counts tickets that have been reviewed by the dispatcher (dispatcherReviewedAt is set).
 * Uses the ticket date field for period filtering.
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

  // Get dispatcher-reviewed tickets in the period (using ticket date)
  const reviewedTickets = await prisma.ticket.findMany({
    where: {
      companyId: session.companyId,
      driverId,
      dispatcherReviewedAt: { not: null }, // Only dispatcher-reviewed tickets
      date: { gte: periodStart, lte: periodEnd },
    },
    select: {
      id: true,
      quantity: true,
      ratePerUnit: true,
      jobId: true,
    },
  });

  const ticketCount = reviewedTickets.length;

  // Get unique job IDs from the reviewed tickets
  const jobIds = [...new Set(reviewedTickets.map((t) => t.jobId).filter(Boolean))] as string[];

  // Get completed jobs that have reviewed tickets to sum driver time
  const jobs = await prisma.job.findMany({
    where: {
      id: { in: jobIds },
      companyId: session.companyId,
    },
    select: { id: true, driverTimeSeconds: true },
  });

  // Calculate totals
  const totalSeconds = jobs.reduce((sum, j) => sum + (j.driverTimeSeconds || 0), 0);
  const hoursWorked = Math.round((totalSeconds / 3600) * 100) / 100;
  const jobsCompleted = jobIds.length;
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
    // Percentage of revenue from dispatcher-reviewed tickets
    const totalRevenue = reviewedTickets.reduce((sum, t) => {
      const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
      return sum + rate * Number(t.quantity);
    }, 0);
    calculatedAmount = (totalRevenue * payRate) / 100;
  }

  calculatedAmount = Math.round(calculatedAmount * 100) / 100;

  // Also return the total revenue for percentage pay so the check can show it
  const totalRevenue = reviewedTickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

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
    totalRevenue: Math.round(totalRevenue * 100) / 100,
  });
}
