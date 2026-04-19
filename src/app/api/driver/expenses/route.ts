import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDriverSession } from '@/lib/driver-auth';
import { createNotification, NOTIFICATION_TYPES } from '@/lib/notifications';
import { validateFileSize } from '@/lib/upload-limits';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads-private', 'receipts');
const VALID_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

// Simplified categories for drivers
const DRIVER_CATEGORIES = ['FUEL', 'PARTS', 'OTHER'] as const;

/**
 * GET /api/driver/expenses — list the authenticated driver's expenses
 */
export async function GET() {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const expenses = await prisma.expense.findMany({
    where: { driverId: session.driverId },
    include: { truck: { select: { truckNumber: true } } },
    orderBy: { date: 'desc' },
    take: 100,
  });

  return NextResponse.json({
    expenses: expenses.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      amount: Number(e.amount),
      category: e.category,
      description: e.description,
      vendor: e.vendor,
      receiptUrl: e.receiptUrl,
      notes: e.notes,
      truckNumber: e.truck?.truckNumber ?? null,
    })),
  });
}

/**
 * POST /api/driver/expenses — driver submits a new expense with optional receipt photo
 * Body: FormData with date, amount, category, optional description/vendor/notes/receipt
 */
export async function POST(req: NextRequest) {
  const session = await getDriverSession();
  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const date = formData.get('date') as string;
    const amount = formData.get('amount') as string;
    const category = formData.get('category') as string;
    const description = (formData.get('description') as string)?.trim() || null;
    const vendor = (formData.get('vendor') as string)?.trim() || null;
    const notes = (formData.get('notes') as string)?.trim() || null;

    if (!date || !amount || !category) {
      return NextResponse.json({ error: 'Date, amount, and category are required' }, { status: 400 });
    }
    if (!DRIVER_CATEGORIES.includes(category as any)) {
      return NextResponse.json({ error: 'Invalid category. Use FUEL, PARTS, or OTHER.' }, { status: 400 });
    }

    // Get driver's company and assigned truck
    const driver = await prisma.driver.findUnique({
      where: { id: session.driverId },
      select: { companyId: true, assignedTruckId: true, name: true },
    });
    if (!driver) {
      return NextResponse.json({ error: 'Driver not found' }, { status: 404 });
    }
    if (!driver.assignedTruckId) {
      return NextResponse.json({ error: 'No truck assigned. Ask your dispatcher to assign a truck to your profile.' }, { status: 400 });
    }

    // Handle receipt photo upload
    let receiptUrl: string | null = null;
    const file = formData.get('receipt') as File | null;
    if (file && file.size > 0) {
      if (!VALID_TYPES.includes(file.type)) {
        return NextResponse.json({ error: 'Invalid receipt file type. Use JPG, PNG, WebP, or PDF.' }, { status: 400 });
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
      const filename = `receipt-driver-${randomUUID().slice(0, 8)}${ext}`;
      const filePath = path.join(UPLOAD_DIR, filename);
      const bytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));
      receiptUrl = `/api/uploads/receipts/${filename}`;
    }

    const expense = await prisma.expense.create({
      data: {
        companyId: driver.companyId,
        driverId: session.driverId,
        truckId: driver.assignedTruckId, // auto-assign to driver's assigned truck
        date: new Date(date),
        amount: parseFloat(amount),
        category: category as any,
        description,
        vendor,
        receiptUrl,
        notes,
      },
    });

    // Notify dispatcher (fire-and-forget)
    const amt = parseFloat(amount).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
    createNotification({
      companyId: driver.companyId,
      type: NOTIFICATION_TYPES.EXPENSE_SUBMITTED,
      title: `${driver.name} submitted a ${category.toLowerCase()} expense (${amt})`,
      body: description || vendor ? `${vendor ? vendor + ' — ' : ''}${description || ''}`.trim() : undefined,
      link: '/fleet?tab=expenses',
    });

    return NextResponse.json({
      ok: true,
      expense: {
        id: expense.id,
        date: expense.date.toISOString(),
        amount: Number(expense.amount),
        category: expense.category,
        description: expense.description,
        vendor: expense.vendor,
        receiptUrl: expense.receiptUrl,
        notes: expense.notes,
      },
    });
  } catch (err: any) {
    console.error('Driver expense create error:', err);
    return NextResponse.json({ error: 'Failed to submit expense' }, { status: 500 });
  }
}
