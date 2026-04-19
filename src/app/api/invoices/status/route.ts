import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import type { InvoiceStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

const VALID_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];

export async function POST(req: Request) {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const id = String(formData.get('id') || '');
    const status = String(formData.get('status') || '') as InvoiceStatus;

    if (!id || !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 });
    }

    const inv = await prisma.invoice.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!inv) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    await prisma.invoice.update({ where: { id }, data: { status } });

    revalidatePath('/invoices');
    revalidatePath(`/invoices/${id}`);

    return NextResponse.json({ success: true, id, status });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Update failed' }, { status: 500 });
  }
}
