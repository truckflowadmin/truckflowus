'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export async function createTripSheetAction(formData: FormData) {
  const session = await requireSession();
  const brokerId = String(formData.get('brokerId') || '');
  const weekEnding = String(formData.get('weekEnding') || '');
  const ticketIds = formData.getAll('ticketIds').map(String).filter(Boolean);

  if (!brokerId || !weekEnding) throw new Error('Broker and week ending are required');

  const broker = await prisma.broker.findFirst({
    where: { id: brokerId, companyId: session.companyId },
  });
  if (!broker) throw new Error('Broker not found');

  // Calculate total from selected tickets
  const tickets = ticketIds.length > 0
    ? await prisma.ticket.findMany({
        where: { id: { in: ticketIds }, companyId: session.companyId, status: 'COMPLETED' },
      })
    : [];

  const totalDue = tickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  const sheet = await prisma.tripSheet.create({
    data: {
      companyId: session.companyId,
      brokerId,
      weekEnding: new Date(weekEnding + 'T23:59:59.999'),
      totalDue,
    },
  });

  // Link selected tickets to this trip sheet + assign broker
  if (ticketIds.length > 0) {
    await prisma.ticket.updateMany({
      where: { id: { in: ticketIds }, companyId: session.companyId },
      data: { tripSheetId: sheet.id, brokerId },
    });
  }

  revalidatePath(`/brokers/${brokerId}/trip-sheets`);
  redirect(`/brokers/${brokerId}/trip-sheets`);
}

export async function addTicketsToSheetAction(formData: FormData) {
  const session = await requireSession();
  const sheetId = String(formData.get('sheetId') || '');
  const ticketIds = formData.getAll('ticketIds').map(String).filter(Boolean);

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: sheetId, companyId: session.companyId },
  });
  if (!sheet) throw new Error('Trip sheet not found');
  if (sheet.status !== 'DRAFT') throw new Error('Can only edit DRAFT trip sheets');

  if (ticketIds.length > 0) {
    await prisma.ticket.updateMany({
      where: { id: { in: ticketIds }, companyId: session.companyId },
      data: { tripSheetId: sheetId, brokerId: sheet.brokerId },
    });
  }

  // Recalculate total
  await recalcTotal(sheetId);

  revalidatePath(`/brokers/${sheet.brokerId}/trip-sheets`);
}

export async function removeTicketFromSheetAction(formData: FormData) {
  const session = await requireSession();
  const sheetId = String(formData.get('sheetId') || '');
  const ticketId = String(formData.get('ticketId') || '');

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: sheetId, companyId: session.companyId },
  });
  if (!sheet) throw new Error('Trip sheet not found');
  if (sheet.status !== 'DRAFT') throw new Error('Can only edit DRAFT trip sheets');

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { tripSheetId: null },
  });

  await recalcTotal(sheetId);

  revalidatePath(`/brokers/${sheet.brokerId}/trip-sheets`);
}

export async function updateTripSheetStatusAction(formData: FormData) {
  const session = await requireSession();
  const sheetId = String(formData.get('sheetId') || '');
  const status = String(formData.get('status') || '') as 'DRAFT' | 'SENT' | 'PAID';

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: sheetId, companyId: session.companyId },
  });
  if (!sheet) throw new Error('Trip sheet not found');

  await prisma.tripSheet.update({
    where: { id: sheetId },
    data: { status },
  });

  revalidatePath(`/brokers/${sheet.brokerId}/trip-sheets`);
}

export async function deleteTripSheetAction(formData: FormData) {
  const session = await requireSession();
  const sheetId = String(formData.get('sheetId') || '');

  const sheet = await prisma.tripSheet.findFirst({
    where: { id: sheetId, companyId: session.companyId },
  });
  if (!sheet) throw new Error('Trip sheet not found');

  // Unlink tickets
  await prisma.ticket.updateMany({
    where: { tripSheetId: sheetId },
    data: { tripSheetId: null },
  });

  await prisma.tripSheet.delete({ where: { id: sheetId } });

  revalidatePath(`/brokers/${sheet.brokerId}/trip-sheets`);
  redirect(`/brokers/${sheet.brokerId}/trip-sheets`);
}

export async function bulkUpdateTripSheetStatusAction(formData: FormData) {
  const session = await requireSession();
  const sheetIds = formData.getAll('sheetIds').map(String).filter(Boolean);
  const status = String(formData.get('status') || '') as 'DRAFT' | 'SENT' | 'PAID';

  if (sheetIds.length === 0 || !status) throw new Error('Sheet IDs and status are required');

  // Verify all sheets belong to this company
  const sheets = await prisma.tripSheet.findMany({
    where: { id: { in: sheetIds }, companyId: session.companyId },
    select: { id: true, brokerId: true },
  });
  if (sheets.length === 0) throw new Error('No trip sheets found');

  await prisma.tripSheet.updateMany({
    where: { id: { in: sheets.map((s) => s.id) } },
    data: { status },
  });

  // Revalidate all related broker paths
  const brokerIds = [...new Set(sheets.map((s) => s.brokerId))];
  for (const bid of brokerIds) {
    revalidatePath(`/brokers/${bid}/trip-sheets`);
  }
}

async function recalcTotal(sheetId: string) {
  const tickets = await prisma.ticket.findMany({
    where: { tripSheetId: sheetId },
  });
  const totalDue = tickets.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);
  await prisma.tripSheet.update({
    where: { id: sheetId },
    data: { totalDue },
  });
}
