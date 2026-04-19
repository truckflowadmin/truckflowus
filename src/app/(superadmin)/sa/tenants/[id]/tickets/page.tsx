import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { audit } from '@/lib/audit';
import TenantNav from '@/components/TenantNav';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import ConfirmButton from '@/components/ConfirmButton';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------
async function createTicket(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const companyId = String(formData.get('companyId') || '');
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  if (!hauledFrom || !hauledTo) throw new Error('Hauled From and Hauled To are required');

  const customerId = String(formData.get('customerId') || '') || null;
  const driverId = String(formData.get('driverId') || '') || null;
  const brokerId = String(formData.get('brokerId') || '') || null;
  const material = String(formData.get('material') || '').trim() || null;
  const quantityType = (String(formData.get('quantityType') || '') || 'LOADS') as any;
  const quantity = parseFloat(String(formData.get('quantity') || '1')) || 1;
  const ticketRef = String(formData.get('ticketRef') || '').trim() || null;
  const truckNumberRaw = String(formData.get('truckNumber') || '').trim() || null;
  const dateRaw = String(formData.get('date') || '');
  const date = dateRaw ? new Date(dateRaw) : null;
  const rateRaw = String(formData.get('ratePerUnit') || '');
  const ratePerUnit = rateRaw ? parseFloat(rateRaw) : null;

  // Auto-fill truck number from driver profile if not specified
  let truckNumber = truckNumberRaw;
  if (!truckNumber && driverId) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { truckNumber: true } });
    truckNumber = driver?.truckNumber || null;
  }

  const last = await prisma.ticket.findFirst({
    where: { companyId },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  });
  const ticketNumber2 = (last?.ticketNumber ?? 1000) + 1;

  const ticket = await prisma.ticket.create({
    data: {
      companyId,
      ticketNumber: ticketNumber2,
      hauledFrom,
      hauledTo,
      customerId,
      driverId,
      brokerId,
      material,
      quantityType,
      quantity,
      ticketRef,
      truckNumber,
      date,
      ratePerUnit,
      status: driverId ? 'DISPATCHED' : 'PENDING',
      dispatchedAt: driverId ? new Date() : null,
    },
  });

  if (material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId, name: material } },
      update: {},
      create: { companyId, name: material },
    });
  }

  await audit({
    companyId,
    entityType: 'ticket',
    entityId: ticket.id,
    action: 'create',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Created ticket #${String(ticketNumber2).padStart(4, '0')} (${hauledFrom} → ${hauledTo})`,
    details: { ticketNumber: ticketNumber2, hauledFrom, hauledTo, material, quantity },
  });
  revalidatePath(`/sa/tenants/${companyId}/tickets`);
}

async function updateTicket(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const ticketId = String(formData.get('ticketId') || '');
  const companyId = String(formData.get('companyId') || '');

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
  if (!ticket) return;
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');

  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  const customerId = String(formData.get('customerId') || '') || null;
  const driverId = String(formData.get('driverId') || '') || null;
  const brokerId = String(formData.get('brokerId') || '') || null;
  const material = String(formData.get('material') || '').trim() || null;
  const quantityType = (String(formData.get('quantityType') || '') || 'LOADS') as any;
  const quantity = parseFloat(String(formData.get('quantity') || '1')) || 1;
  const ticketRef = String(formData.get('ticketRef') || '').trim() || null;
  const truckNumber = String(formData.get('truckNumber') || '').trim() || null;
  const dateRaw = String(formData.get('date') || '');
  const date = dateRaw ? new Date(dateRaw) : null;
  const rateRaw = String(formData.get('ratePerUnit') || '');
  const ratePerUnit = rateRaw ? parseFloat(rateRaw) : null;

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { hauledFrom, hauledTo, customerId, driverId, brokerId, material, quantityType, quantity, ticketRef, truckNumber, date, ratePerUnit },
  });
  await audit({
    companyId,
    entityType: 'ticket',
    entityId: ticketId,
    action: 'update',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Updated ticket #${String(ticket.ticketNumber).padStart(4, '0')}`,
    details: { hauledFrom, hauledTo, material, quantity },
  });
  revalidatePath(`/sa/tenants/${companyId}/tickets`);
}

async function updateTicketStatus(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const ticketId = String(formData.get('ticketId') || '');
  const companyId = String(formData.get('companyId') || '');
  const status = String(formData.get('status') || '');
  if (!ticketId || !status) return;

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
  if (!ticket) return;
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be modified');
  const oldStatus = ticket.status;

  const patch: any = { status };
  const now = new Date();
  if (status === 'COMPLETED' && !ticket.completedAt) {
    patch.completedAt = now;
    if (!ticket.startedAt) patch.startedAt = now;
  }
  if (status === 'IN_PROGRESS' && !ticket.startedAt) patch.startedAt = now;
  if (status === 'DISPATCHED' && !ticket.dispatchedAt) patch.dispatchedAt = now;

  await prisma.ticket.update({ where: { id: ticketId }, data: patch });
  await audit({
    companyId,
    entityType: 'ticket',
    entityId: ticketId,
    action: 'status_change',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Changed ticket #${String(ticket.ticketNumber).padStart(4, '0')} status from ${oldStatus} to ${status}`,
    details: { oldStatus, newStatus: status },
  });
  revalidatePath(`/sa/tenants/${companyId}/tickets`);
}

async function deleteTicket(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const ticketId = String(formData.get('ticketId') || '');
  const companyId = String(formData.get('companyId') || '');

  const ticket = await prisma.ticket.findFirst({ where: { id: ticketId, companyId } });
  if (!ticket) return;
  if (ticket.invoiceId) throw new Error('This ticket is on an invoice and cannot be deleted');

  await prisma.ticket.delete({ where: { id: ticketId } });
  await audit({
    companyId,
    entityType: 'ticket',
    entityId: ticketId,
    action: 'delete',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Deleted ticket #${String(ticket.ticketNumber).padStart(4, '0')} (${ticket.status})`,
    details: { ticketNumber: ticket.ticketNumber, status: ticket.status },
  });
  revalidatePath(`/sa/tenants/${companyId}/tickets`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function TenantTicketsPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const [tickets, drivers, customers, brokers, materials] = await Promise.all([
    prisma.ticket.findMany({
      where: { companyId: params.id },
      include: { driver: true, customer: true, broker: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.driver.findMany({
      where: { companyId: params.id, active: true },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({
      where: { companyId: params.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.broker.findMany({
      where: { companyId: params.id, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.material.findMany({
      where: { companyId: params.id },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  tickets.forEach((t) => {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">
          Tickets <span className="text-purple-400 font-normal">({tickets.length})</span>
        </h1>
        <div className="flex gap-2 text-xs">
          {Object.entries(statusCounts).map(([s, c]) => (
            <span key={s} className="badge bg-purple-900/60 text-purple-200">
              {s.replace('_', ' ')} {c}
            </span>
          ))}
        </div>
      </div>

      {/* Create ticket */}
      <details className="panel-sa mb-4">
        <summary className="text-sm font-medium text-purple-300 cursor-pointer py-2 px-1">
          + Create Ticket
        </summary>
        <form action={createTicket} className="mt-3 space-y-3">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label-sa">Hauled From *</label>
              <input name="hauledFrom" required className="input-sa" placeholder="Pickup location" />
            </div>
            <div>
              <label className="label-sa">Hauled To *</label>
              <input name="hauledTo" required className="input-sa" placeholder="Delivery location" />
            </div>
            <div>
              <label className="label-sa">Material</label>
              <input name="material" className="input-sa" list="sa-materials" placeholder="e.g. Fill dirt" />
              <datalist id="sa-materials">{materials.map((m) => <option key={m.name} value={m.name} />)}</datalist>
            </div>
            <div>
              <label className="label-sa">Truck #</label>
              <input name="truckNumber" className="input-sa" placeholder="Truck number" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label-sa">Customer</label>
              <select name="customerId" className="input-sa">
                <option value="">— None —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-sa">Driver</label>
              <select name="driverId" className="input-sa">
                <option value="">— None —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-sa">Broker</label>
              <select name="brokerId" className="input-sa">
                <option value="">— None —</option>
                {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-sa">Date</label>
              <input name="date" type="date" className="input-sa" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="label-sa">Quantity</label>
              <input name="quantity" type="number" min="1" defaultValue="1" className="input-sa" />
            </div>
            <div>
              <label className="label-sa">Qty Type</label>
              <select name="quantityType" className="input-sa">
                <option value="LOADS">Loads</option>
                <option value="TONS">Tons</option>
                <option value="YARDS">Yards</option>
              </select>
            </div>
            <div>
              <label className="label-sa">Rate/Unit</label>
              <input name="ratePerUnit" type="number" min="0" step="0.01" className="input-sa" placeholder="0.00" />
            </div>
            <div>
              <label className="label-sa">Ticket Ref</label>
              <input name="ticketRef" className="input-sa" placeholder="Reference #" />
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-purple w-full">Create Ticket</button>
            </div>
          </div>
        </form>
      </details>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
            <tr>
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Customer</th>
              <th className="text-left py-2 px-2">Driver</th>
              <th className="text-left py-2 px-2">Route</th>
              <th className="text-left py-2 px-2">Material</th>
              <th className="text-left py-2 px-2">Truck</th>
              <th className="text-left py-2 px-2">Qty</th>
              <th className="text-left py-2 px-2">Rate</th>
              <th className="text-left py-2 px-2">Created</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-900/30">
            {tickets.map((t) => {
              const num = String(t.ticketNumber).padStart(4, '0');
              const dateVal = t.date ? format(t.date, 'yyyy-MM-dd') : '';
              return (
                <tr key={t.id} className="hover:bg-purple-900/20">
                  <td className="py-2 px-2 font-mono font-bold text-white">#{num}</td>
                  <td className="py-2 px-2">
                    <form action={updateTicketStatus} className="inline">
                      <input type="hidden" name="ticketId" value={t.id} />
                      <input type="hidden" name="companyId" value={company.id} />
                      <AutoSubmitSelect
                        name="status"
                        defaultValue={t.status}
                        className="bg-transparent text-xs border border-purple-700 rounded px-1.5 py-1 text-purple-200"
                      >
                        {(['PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED'] as const).map(
                          (s) => (
                            <option key={s} value={s}>
                              {s.replace('_', ' ')}
                            </option>
                          ),
                        )}
                      </AutoSubmitSelect>
                    </form>
                  </td>
                  <td className="py-2 px-2 text-purple-200 text-xs">{t.customer?.name ?? '—'}</td>
                  <td className="py-2 px-2 text-purple-200 text-xs">{t.driver?.name ?? '—'}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs max-w-[160px] truncate">
                    {t.hauledFrom} → {t.hauledTo}
                  </td>
                  <td className="py-2 px-2 text-purple-300 text-xs">{t.material ?? '—'}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs">{t.truckNumber ?? '—'}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs">{t.quantityType === 'TONS' ? Number(t.quantity) : Math.round(Number(t.quantity))}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs">{t.ratePerUnit ? `$${t.ratePerUnit}` : '—'}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs">
                    {format(t.createdAt, 'MMM d, yyyy')}
                  </td>
                  <td className="py-2 px-2 text-right space-x-2">
                    {/* Edit popup */}
                    <details className="inline-block relative">
                      <summary className="text-xs text-purple-400 hover:text-purple-200 cursor-pointer">
                        Edit
                      </summary>
                      <div className="absolute right-0 top-6 z-20 bg-[#1a0a2e] border border-purple-800 rounded-lg p-4 shadow-xl w-96">
                        <form action={updateTicket} className="space-y-2">
                          <input type="hidden" name="ticketId" value={t.id} />
                          <input type="hidden" name="companyId" value={company.id} />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Hauled From</label>
                              <input name="hauledFrom" defaultValue={t.hauledFrom} required className="input-sa text-xs" />
                            </div>
                            <div>
                              <label className="label-sa text-xs">Hauled To</label>
                              <input name="hauledTo" defaultValue={t.hauledTo} required className="input-sa text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Customer</label>
                              <select name="customerId" defaultValue={t.customerId ?? ''} className="input-sa text-xs">
                                <option value="">— None —</option>
                                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label-sa text-xs">Driver</label>
                              <select name="driverId" defaultValue={t.driverId ?? ''} className="input-sa text-xs">
                                <option value="">— None —</option>
                                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Broker</label>
                              <select name="brokerId" defaultValue={t.brokerId ?? ''} className="input-sa text-xs">
                                <option value="">— None —</option>
                                {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label-sa text-xs">Material</label>
                              <input name="material" defaultValue={t.material ?? ''} className="input-sa text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="label-sa text-xs">Qty</label>
                              <input name="quantity" type="number" min="0.01" step="0.01" defaultValue={Number(t.quantity)} className="input-sa text-xs" />
                            </div>
                            <div>
                              <label className="label-sa text-xs">Type</label>
                              <select name="quantityType" defaultValue={t.quantityType} className="input-sa text-xs">
                                <option value="LOADS">Loads</option>
                                <option value="TONS">Tons</option>
                                <option value="YARDS">Yards</option>
                              </select>
                            </div>
                            <div>
                              <label className="label-sa text-xs">Rate</label>
                              <input name="ratePerUnit" type="number" min="0" step="0.01" defaultValue={t.ratePerUnit?.toString() ?? ''} className="input-sa text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="label-sa text-xs">Truck #</label>
                              <input name="truckNumber" defaultValue={t.truckNumber ?? ''} className="input-sa text-xs" />
                            </div>
                            <div>
                              <label className="label-sa text-xs">Date</label>
                              <input name="date" type="date" defaultValue={dateVal} className="input-sa text-xs" />
                            </div>
                            <div>
                              <label className="label-sa text-xs">Ticket Ref</label>
                              <input name="ticketRef" defaultValue={t.ticketRef ?? ''} className="input-sa text-xs" />
                            </div>
                          </div>
                          <button type="submit" className="btn-purple text-xs w-full">Save</button>
                        </form>
                      </div>
                    </details>
                    {/* Delete */}
                    <form action={deleteTicket} className="inline">
                      <input type="hidden" name="ticketId" value={t.id} />
                      <input type="hidden" name="companyId" value={company.id} />
                      <ConfirmButton message="Delete this ticket permanently?" className="text-xs text-red-400 hover:text-red-200">
                        Delete
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {tickets.length === 0 && (
          <p className="text-center text-purple-400 py-8 text-sm">No tickets for this tenant.</p>
        )}
      </div>
    </div>
  );
}
