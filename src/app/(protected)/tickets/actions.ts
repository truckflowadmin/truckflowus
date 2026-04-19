'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { sendSms, composeAssignmentSms } from '@/lib/sms';
import type { TicketStatus, QuantityType } from '@prisma/client';

function appUrl() {
  return process.env.APP_URL || 'http://localhost:3000';
}

async function nextTicketNumber(companyId: string): Promise<number> {
  const last = await prisma.ticket.findFirst({
    where: { companyId },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });
  return (last?.ticketNumber ?? 1000) + 1;
}

/* ---------- Inline creation helpers ---------- */

export async function createCustomerInlineAction(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Customer name is required');

  const customer = await prisma.customer.create({
    data: { companyId: session.companyId, name },
  });
  return { id: customer.id, name: customer.name };
}

export async function createMaterialInlineAction(formData: FormData) {
  const session = await requireSession();
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Material name is required');

  // Upsert so duplicates don't crash
  const material = await prisma.material.upsert({
    where: { companyId_name: { companyId: session.companyId, name } },
    update: {},
    create: { companyId: session.companyId, name },
  });
  return { name: material.name };
}

/* ---------- Ticket CRUD ---------- */

export async function createTicketAction(formData: FormData) {
  const session = await requireSession();
  const customerId = String(formData.get('customerId') || '') || null;
  const driverId = String(formData.get('driverId') || '') || null;
  const brokerId = String(formData.get('brokerId') || '') || null;
  const material = String(formData.get('material') || '') || null;
  const quantityType = (String(formData.get('quantityType') || 'LOADS')) as QuantityType;
  const quantity = Math.max(0.01, parseFloat(String(formData.get('quantity') || '1')) || 1);
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  const ticketRef = String(formData.get('ticketRef') || '').trim() || null;
  const dateStr = String(formData.get('date') || '').trim();
  const date = dateStr ? new Date(dateStr) : null;
  const truckNumber = String(formData.get('truckNumber') || '').trim() || null;
  const rateStr = String(formData.get('ratePerUnit') || '').trim();
  const ratePerUnit = rateStr ? Number(rateStr) : null;

  if (!hauledFrom || !hauledTo) {
    throw new Error('Hauled From and Hauled To are required');
  }

  // Also save the material to the materials list for future reuse
  if (material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId: session.companyId, name: material } },
      update: {},
      create: { companyId: session.companyId, name: material },
    });
  }

  // Auto-fill truck number from driver's assigned truck if not provided
  let resolvedTruckNumber = truckNumber;
  if (!resolvedTruckNumber && driverId) {
    const assignedDriver = await prisma.driver.findUnique({ where: { id: driverId }, select: { assignedTruck: { select: { truckNumber: true } } } });
    if (assignedDriver?.assignedTruck?.truckNumber) resolvedTruckNumber = assignedDriver.assignedTruck.truckNumber;
  }

  const ticketNumber = await nextTicketNumber(session.companyId);
  const ticket = await prisma.ticket.create({
    data: {
      companyId: session.companyId,
      ticketNumber,
      customerId: customerId || undefined,
      driverId: driverId || undefined,
      brokerId: brokerId || undefined,
      material,
      quantityType,
      quantity,
      hauledFrom,
      hauledTo,
      truckNumber: resolvedTruckNumber,
      ticketRef: ticketRef || undefined,
      date: date ?? undefined,
      ratePerUnit: ratePerUnit !== null && !isNaN(ratePerUnit) ? ratePerUnit : undefined,
      status: driverId ? 'DISPATCHED' : 'PENDING',
      dispatchedAt: driverId ? new Date() : undefined,
    },
    include: { driver: true },
  });

  if (driverId && ticket.driver) {
    const mobileUrl = `${appUrl()}/d/${ticket.driver.accessToken}`;
    const message = composeAssignmentSms({
      ticketNumber: ticket.ticketNumber,
      material: ticket.material,
      quantity: Number(ticket.quantity),
      quantityType: ticket.quantityType,
      hauledFrom: ticket.hauledFrom,
      hauledTo: ticket.hauledTo,
      mobileUrl,
    });
    await sendSms({
      phone: ticket.driver.phone,
      message,
      driverId: ticket.driver.id,
      ticketId: ticket.id,
      replyWebhookUrl: `${appUrl()}/api/sms/webhook`,
    });
  }

  revalidatePath('/tickets');
  revalidatePath('/dashboard');
  redirect(`/tickets/${ticket.id}`);
}

export async function assignDriverAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  const driverId = String(formData.get('driverId') || '');
  if (!ticketId || !driverId) throw new Error('Missing ticketId or driverId');

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: session.companyId },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  const driver = await prisma.driver.findFirst({
    where: { id: driverId, companyId: session.companyId },
    include: { assignedTruck: { select: { truckNumber: true } } },
  });
  if (!driver) throw new Error('Driver not found');

  const driverTruckNum = (driver as any).assignedTruck?.truckNumber ?? null;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      driverId: driver.id,
      truckNumber: ticket.truckNumber || driverTruckNum || null,
      status: ticket.status === 'PENDING' ? 'DISPATCHED' : ticket.status,
      dispatchedAt: ticket.dispatchedAt ?? new Date(),
    },
  });

  const mobileUrl = `${appUrl()}/d/${driver.accessToken}`;
  const message = composeAssignmentSms({
    ticketNumber: ticket.ticketNumber,
    material: ticket.material,
    quantity: ticket.quantity,
    quantityType: ticket.quantityType,
    hauledFrom: ticket.hauledFrom,
    hauledTo: ticket.hauledTo,
    mobileUrl,
  });
  await sendSms({
    phone: driver.phone,
    message,
    driverId: driver.id,
    ticketId: ticket.id,
    replyWebhookUrl: `${appUrl()}/api/sms/webhook`,
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}

export async function updateStatusAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  const status = String(formData.get('status') || '') as TicketStatus;
  if (!ticketId || !status) throw new Error('Missing fields');

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: session.companyId },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  // Validate required fields before allowing COMPLETED
  if (status === 'COMPLETED') {
    const missing: string[] = [];
    if (!ticket.customerId) missing.push('Customer');
    if (!ticket.driverId) missing.push('Driver');
    if (!ticket.material) missing.push('Material');
    if (!ticket.quantity || Number(ticket.quantity) <= 0) missing.push('Quantity');
    if (!ticket.hauledFrom) missing.push('Hauled From');
    if (!ticket.hauledTo) missing.push('Hauled To');
    if (!ticket.ratePerUnit) missing.push('Rate');
    if (!ticket.date) missing.push('Date');
    if (!ticket.truckNumber) missing.push('Truck #');
    if (!ticket.photoUrl) missing.push('Photo');
    if (missing.length > 0) {
      throw new Error(`Cannot complete ticket — missing: ${missing.join(', ')}`);
    }
  }

  const patch: any = { status };
  const now = new Date();
  if (status === 'IN_PROGRESS' && !ticket.startedAt) patch.startedAt = now;
  if (status === 'COMPLETED' && !ticket.completedAt) {
    patch.completedAt = now;
    if (!ticket.startedAt) patch.startedAt = now;
  }
  if (status === 'DISPATCHED' && !ticket.dispatchedAt) patch.dispatchedAt = now;

  await prisma.ticket.update({ where: { id: ticketId }, data: patch });
  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  revalidatePath('/dashboard');
}

export async function deleteTicketAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: session.companyId },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('Cannot delete ticket on an invoice');
  await prisma.ticket.delete({ where: { id: ticketId } });
  revalidatePath('/tickets');
  redirect('/tickets');
}

export async function duplicateTicketAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  const source = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: session.companyId },
  });
  if (!source) throw new Error('Ticket not found');

  const last = await prisma.ticket.findFirst({
    where: { companyId: session.companyId },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });
  const ticketNumber = (last?.ticketNumber ?? 1000) + 1;

  const dup = await prisma.ticket.create({
    data: {
      companyId: session.companyId,
      ticketNumber,
      customerId: source.customerId,
      brokerId: source.brokerId,
      material: source.material,
      quantityType: source.quantityType,
      quantity: source.quantity,
      hauledFrom: source.hauledFrom,
      hauledTo: source.hauledTo,
      ticketRef: source.ticketRef,
      date: source.date,
      ratePerUnit: source.ratePerUnit,
      status: 'PENDING',
    },
  });

  revalidatePath('/tickets');
  redirect(`/tickets/${dup.id}`);
}

export async function markTicketReviewedAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  if (!ticketId) throw new Error('Missing ticket ID');

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: session.companyId },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      dispatcherReviewedAt: new Date(),
      dispatcherReviewedBy: session.userId,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}

export async function unmarkTicketReviewedAction(formData: FormData) {
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  if (!ticketId) throw new Error('Missing ticket ID');

  const ticket = await prisma.ticket.findFirst({
    where: { id: ticketId, companyId: session.companyId },
  });
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      dispatcherReviewedAt: null,
      dispatcherReviewedBy: null,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
}
