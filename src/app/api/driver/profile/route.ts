import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSession } from '@/lib/driver-auth';

/**
 * GET /api/driver/profile — fetch the authenticated driver's profile
 */
export async function GET() {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const driver = await prisma.driver.findUnique({
    where: { id: session.driverId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      truckNumber: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  });

  if (!driver) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
  }

  return NextResponse.json({ driver });
}

/**
 * POST /api/driver/profile — update the authenticated driver's profile fields
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json();
  const {
    email,
    phone,
    address,
    city,
    state,
    zip,
    emergencyContactName,
    emergencyContactPhone,
  } = body;

  // Build partial update — only include fields that were sent
  const data: Record<string, any> = {};

  if (email !== undefined) data.email = email?.trim() || null;

  if (phone !== undefined) {
    const raw = (phone || '').trim();
    if (!raw) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) data.phone = `+1${digits}`;
    else if (digits.length === 11 && digits.startsWith('1')) data.phone = `+${digits}`;
    else if (!raw.startsWith('+')) data.phone = `+${digits}`;
    else data.phone = raw;
  }

  if (address !== undefined) data.address = address?.trim() || null;
  if (city !== undefined) data.city = city?.trim() || null;
  if (state !== undefined) data.state = state?.trim() || null;
  if (zip !== undefined) data.zip = zip?.trim() || null;
  if (emergencyContactName !== undefined) data.emergencyContactName = emergencyContactName?.trim() || null;
  if (emergencyContactPhone !== undefined) data.emergencyContactPhone = emergencyContactPhone?.trim() || null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const updated = await prisma.driver.update({
    where: { id: session.driverId },
    data,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      truckNumber: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
    },
  });

  return NextResponse.json({ ok: true, driver: updated });
}
