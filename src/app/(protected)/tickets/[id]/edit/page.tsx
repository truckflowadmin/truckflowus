import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { FEATURES, hasFeature } from '@/lib/features';
import { EditTicketForm } from './EditTicketForm';

async function updateTicketAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const ticketId = String(formData.get('ticketId') || '');
  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, companyId: session.companyId } });
  if (!ticket) throw new Error('Not found');
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  const customerId = String(formData.get('customerId') || '') || null;
  const brokerId = String(formData.get('brokerId') || '') || null;
  const material = String(formData.get('material') || '') || null;
  const quantityType = (String(formData.get('quantityType') || 'LOADS')) as any;
  const quantity = Math.max(0.01, parseFloat(String(formData.get('quantity') || '1')) || 1);
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  const ticketRef = String(formData.get('ticketRef') || '').trim() || null;
  const dateStr = String(formData.get('date') || '').trim();
  const date = dateStr ? new Date(dateStr) : null;
  const truckNumber = String(formData.get('truckNumber') || '').trim() || null;
  const rateStr = String(formData.get('ratePerUnit') || '').trim();
  const ratePerUnit = rateStr ? Number(rateStr) : null;

  if (!hauledFrom || !hauledTo) throw new Error('Hauled From and Hauled To are required');

  // Also save the material for reuse
  if (material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId: session.companyId, name: material } },
      update: {},
      create: { companyId: session.companyId, name: material },
    });
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      customerId: customerId || null,
      brokerId: brokerId || null,
      material,
      quantityType,
      quantity,
      hauledFrom,
      hauledTo,
      truckNumber,
      ticketRef,
      date,
      ratePerUnit: ratePerUnit !== null && !isNaN(ratePerUnit) ? ratePerUnit : null,
    },
  });

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath('/tickets');
  redirect(`/tickets/${ticketId}`);
}

export default async function EditTicketPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!ticket) notFound();
  if (ticket.invoiceId) redirect(`/tickets/${params.id}`);

  const [customers, materials, brokers, showBrokers] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.broker.findMany({ where: { companyId: session.companyId, active: true }, orderBy: { name: 'asc' } }),
    hasFeature(session.companyId, FEATURES.VIEW_BROKERS),
  ]);

  const num = String(ticket.ticketNumber).padStart(4, '0');
  const dateVal = ticket.date
    ? new Date(ticket.date.getTime() - ticket.date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 10)
    : '';

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <Link href={`/tickets/${ticket.id}`} className="text-sm text-steel-500 hover:text-steel-800">← Back to #{num}</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Edit Ticket #{num}</h1>
      </header>

      <EditTicketForm
        action={updateTicketAction}
        ticket={{
          id: ticket.id,
          customerId: ticket.customerId,
          brokerId: ticket.brokerId,
          material: ticket.material,
          quantityType: ticket.quantityType,
          quantity: Number(ticket.quantity),
          hauledFrom: ticket.hauledFrom,
          hauledTo: ticket.hauledTo,
          truckNumber: ticket.truckNumber,
          ticketRef: ticket.ticketRef,
          date: dateVal,
          ratePerUnit: ticket.ratePerUnit ? Number(ticket.ratePerUnit).toFixed(2) : '',
        }}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        materials={materials.map((m) => m.name)}
        brokers={showBrokers ? brokers.map((b) => ({ id: b.id, name: b.name })) : []}
      />
    </div>
  );
}
