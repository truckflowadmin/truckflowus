import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSessionFromRequest } from '@/lib/driver-auth';
import { getMobileBody } from '@/lib/mobile-body';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

/**
 * GET /api/driver/time-off — list the driver's time-off requests (last 90 days)
 */
export async function GET(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);

  const requests = await prisma.timeOffRequest.findMany({
    where: {
      driverId: session.driverId,
      status: { not: 'CANCELLED' },
      createdAt: { gte: cutoff },
    },
    orderBy: { startDate: 'desc' },
    take: 50,
  });

  return NextResponse.json({
    requests: requests.map((r) => ({
      id: r.id,
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  }, {
    headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
  });
}

/**
 * POST /api/driver/time-off — create a new time-off request
 * Body: { startDate, endDate, reason? }
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await getMobileBody(req);
  const { startDate, endDate, reason } = body;

  if (!startDate || !endDate) {
    return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
  }

  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return NextResponse.json({ error: 'Invalid dates' }, { status: 400 });
  }
  if (end < start) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: { name: true, companyId: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  const timeOff = await prisma.timeOffRequest.create({
    data: {
      companyId: driver.companyId,
      driverId: session.driverId,
      startDate: start,
      endDate: end,
      reason: reason?.trim() || null,
    },
  });

  // Notify dispatcher
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const range = start.getTime() === end.getTime()
    ? fmt(start)
    : `${fmt(start)} – ${fmt(end)}`;
  createNotification({
    companyId: driver.companyId,
    type: 'TIME_OFF_REQUEST' as any,
    title: `${driver.name} requested time off: ${range}`,
    body: reason?.trim() || undefined,
    link: '/drivers?tab=timeoff',
  });

  return NextResponse.json({
    ok: true,
    request: {
      id: timeOff.id,
      startDate: timeOff.startDate.toISOString(),
      endDate: timeOff.endDate.toISOString(),
      reason: timeOff.reason,
      status: timeOff.status,
      createdAt: timeOff.createdAt.toISOString(),
    },
  });
}

/**
 * DELETE /api/driver/time-off — cancel a pending/approved time-off request
 * Body: { requestId }
 */
export async function DELETE(req: NextRequest) {
  const session = await getDriverSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await getMobileBody(req);
  const { requestId } = body;

  if (!requestId) {
    return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: { name: true, companyId: true },
  });
  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  const existing = await prisma.timeOffRequest.findFirst({
    where: {
      id: requestId,
      driverId: session.driverId,
      status: { in: ['PENDING', 'APPROVED'] },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: 'Request not found or cannot be cancelled' }, { status: 404 });
  }

  await prisma.timeOffRequest.update({
    where: { id: requestId },
    data: { status: 'CANCELLED' },
  });

  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const range = existing.startDate.getTime() === existing.endDate.getTime()
    ? fmt(existing.startDate)
    : `${fmt(existing.startDate)} – ${fmt(existing.endDate)}`;
  createNotification({
    companyId: driver.companyId,
    type: 'TIME_OFF_CANCELLED' as any,
    title: `${driver.name} cancelled time off: ${range}`,
    link: '/drivers?tab=timeoff',
  });

  return NextResponse.json({ ok: true });
}
