import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    await requireSuperadmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { companyId, overrides, disabled } = body as {
    companyId: string;
    overrides: string[];
    disabled: string[];
  };

  if (!companyId || !Array.isArray(overrides) || !Array.isArray(disabled)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // Verify company exists
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  await prisma.company.update({
    where: { id: companyId },
    data: { featureOverrides: overrides, disabledFeatures: disabled },
  });

  await audit({
    companyId,
    entityType: 'company',
    entityId: companyId,
    action: 'feature_override',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Updated feature overrides: +${overrides.length} added, -${disabled.length} disabled`,
    details: { overrides, disabled },
  });

  revalidatePath(`/sa/tenants/${companyId}`);
  revalidatePath('/', 'layout');

  return NextResponse.json({ ok: true, overrides: overrides.length, disabled: disabled.length });
}
