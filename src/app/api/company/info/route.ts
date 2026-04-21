import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

/**
 * GET /api/company/info
 * Returns company info for check printing (name, address, logo, bank details).
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !session.companyId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
  });

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: company.name ?? '',
    address: company.address ?? '',
    city: company.city ?? '',
    state: company.state ?? '',
    zip: company.zip ?? '',
    phone: company.phone ?? '',
    logoUrl: company.logoUrl ?? null,
    checkRoutingNumber: (company as any).checkRoutingNumber ?? '',
    checkAccountNumber: (company as any).checkAccountNumber ?? '',
  });
}
