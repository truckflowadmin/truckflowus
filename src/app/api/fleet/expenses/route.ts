import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { validateFileSize } from '@/lib/upload-limits';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads-private', 'receipts');
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

const VALID_CATEGORIES = [
  'FUEL', 'MAINTENANCE', 'INSURANCE', 'REGISTRATION', 'TOLLS',
  'TIRES', 'PARTS', 'LEASE', 'LOAN', 'WASH', 'PERMITS', 'OTHER',
];

/**
 * GET /api/fleet/expenses — list expenses with optional filters
 */
export async function GET(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const truckId = sp.get('truckId');
  const category = sp.get('category');
  const from = sp.get('from');
  const to = sp.get('to');
  const recurring = sp.get('recurring');

  const where: any = { companyId: session.companyId };
  if (truckId) where.truckId = truckId;
  if (category && VALID_CATEGORIES.includes(category)) where.category = category;
  if (recurring === 'true') where.isRecurring = true;
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(from);
    if (to) where.date.lte = new Date(to);
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: { truck: { select: { id: true, truckNumber: true } } },
    orderBy: { date: 'desc' },
    take: 200,
  });

  return NextResponse.json({
    expenses: expenses.map((e) => ({
      id: e.id,
      truckId: e.truckId,
      truckNumber: e.truck?.truckNumber ?? null,
      date: e.date.toISOString(),
      amount: Number(e.amount),
      category: e.category,
      description: e.description,
      vendor: e.vendor,
      receiptUrl: e.receiptUrl,
      isRecurring: e.isRecurring,
      recurringDay: e.recurringDay,
      recurringEnd: e.recurringEnd?.toISOString() ?? null,
      notes: e.notes,
    })),
  });
}

/**
 * POST /api/fleet/expenses — create an expense (supports receipt upload via FormData or JSON)
 */
export async function POST(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let date: string, amount: string, category: string;
    let truckId: string | null = null;
    let description: string | null = null;
    let vendor: string | null = null;
    let notes: string | null = null;
    let isRecurring = false;
    let recurringDay: number | null = null;
    let recurringEnd: string | null = null;
    let receiptUrl: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      date = formData.get('date') as string;
      amount = formData.get('amount') as string;
      category = formData.get('category') as string;
      truckId = (formData.get('truckId') as string) || null;
      description = (formData.get('description') as string)?.trim() || null;
      vendor = (formData.get('vendor') as string)?.trim() || null;
      notes = (formData.get('notes') as string)?.trim() || null;
      isRecurring = formData.get('isRecurring') === 'true';
      recurringDay = formData.get('recurringDay') ? parseInt(formData.get('recurringDay') as string) : null;
      recurringEnd = (formData.get('recurringEnd') as string) || null;

      const file = formData.get('receipt') as File | null;
      if (file && file.size > 0) {
        if (!VALID_TYPES.includes(file.type)) {
          return NextResponse.json({ error: 'Invalid receipt file type' }, { status: 400 });
        }
        const sizeError = validateFileSize(file, 'RECEIPT');
        if (sizeError) {
          return NextResponse.json({ error: sizeError }, { status: 400 });
        }
        await mkdir(UPLOAD_DIR, { recursive: true });
        const ext = file.type === 'image/png' ? '.png'
          : file.type === 'image/webp' ? '.webp'
          : file.type === 'application/pdf' ? '.pdf'
          : '.jpg';
        const filename = `receipt-${randomUUID().slice(0, 8)}${ext}`;
        const filePath = path.join(UPLOAD_DIR, filename);
        const bytes = await file.arrayBuffer();
        await writeFile(filePath, Buffer.from(bytes));
        receiptUrl = `/api/uploads/receipts/${filename}`;
      }
    } else {
      const body = await req.json();
      date = body.date;
      amount = body.amount;
      category = body.category;
      truckId = body.truckId || null;
      description = body.description?.trim() || null;
      vendor = body.vendor?.trim() || null;
      notes = body.notes?.trim() || null;
      isRecurring = body.isRecurring || false;
      recurringDay = body.recurringDay || null;
      recurringEnd = body.recurringEnd || null;
    }

    if (!date || !amount || !category) {
      return NextResponse.json({ error: 'Date, amount, and category are required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    // Validate truck belongs to company if provided
    if (truckId) {
      const truck = await prisma.truck.findFirst({ where: { id: truckId, companyId: session.companyId } });
      if (!truck) return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        companyId: session.companyId,
        truckId,
        date: new Date(date),
        amount: parseFloat(amount),
        category: category as any,
        description,
        vendor,
        receiptUrl,
        isRecurring,
        recurringDay,
        recurringEnd: recurringEnd ? new Date(recurringEnd) : null,
        notes,
      },
    });

    return NextResponse.json({ ok: true, expense: { ...expense, amount: Number(expense.amount) } });
  } catch (err: any) {
    console.error('Expense create error:', err);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}

/**
 * PATCH /api/fleet/expenses — update an expense
 */
export async function PATCH(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return NextResponse.json({ error: 'Expense id required' }, { status: 400 });

  const expense = await prisma.expense.findFirst({ where: { id, companyId: session.companyId } });
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  const data: any = {};
  if (fields.date !== undefined) data.date = new Date(fields.date);
  if (fields.amount !== undefined) data.amount = parseFloat(fields.amount);
  if (fields.category !== undefined) data.category = fields.category;
  if (fields.truckId !== undefined) data.truckId = fields.truckId || null;
  if (fields.description !== undefined) data.description = fields.description?.trim() || null;
  if (fields.vendor !== undefined) data.vendor = fields.vendor?.trim() || null;
  if (fields.notes !== undefined) data.notes = fields.notes?.trim() || null;
  if (fields.isRecurring !== undefined) data.isRecurring = fields.isRecurring;
  if (fields.recurringDay !== undefined) data.recurringDay = fields.recurringDay;
  if (fields.recurringEnd !== undefined) data.recurringEnd = fields.recurringEnd ? new Date(fields.recurringEnd) : null;

  const updated = await prisma.expense.update({ where: { id }, data });
  return NextResponse.json({ ok: true, expense: { ...updated, amount: Number(updated.amount) } });
}

/**
 * DELETE /api/fleet/expenses?id=xxx — delete an expense
 */
export async function DELETE(req: NextRequest) {
  let session;
  try { session = await requireSession(); } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Expense id required' }, { status: 400 });

  const expense = await prisma.expense.findFirst({ where: { id, companyId: session.companyId } });
  if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

  await prisma.expense.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
