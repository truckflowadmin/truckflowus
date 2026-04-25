import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { notifyDriverJobAssignment } from '@/lib/sms-notify';
import { enforceTicketLimit } from '@/lib/features';

async function bulkCreateAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const customerId = String(formData.get('customerId') || '') || null;
  const driverId = String(formData.get('driverId') || '') || null;
  const material = String(formData.get('material') || '') || null;
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  const rateStr = String(formData.get('ratePerUnit') || '').trim();
  const ratePerUnit = rateStr ? Number(rateStr) : null;
  const count = Math.max(1, Math.min(50, parseInt(String(formData.get('count') || '1'), 10) || 1));
  const quantityPerTicket = Math.max(0.01, parseFloat(String(formData.get('quantityPerTicket') || '1')) || 1);

  if (!hauledFrom || !hauledTo) throw new Error('Hauled From and Hauled To are required');

  // Get next ticket number — use raw SQL to bypass soft-delete middleware
  const ticketNumRows = await prisma.$queryRaw<[{ maxNum: number | null }]>`
    SELECT MAX("ticketNumber") AS "maxNum" FROM "Ticket" WHERE "companyId" = ${session.companyId}
  `;
  let nextNum = (ticketNumRows[0]?.maxNum ?? 1000) + 1;

  const driver = driverId
    ? await prisma.driver.findFirst({
        where: { id: driverId, companyId: session.companyId },
        include: { assignedTruck: { select: { truckNumber: true } } },
      })
    : null;
  const driverTruckNum = driver?.assignedTruck?.truckNumber ?? null;

  const tickets = [];
  for (let i = 0; i < count; i++) {
    tickets.push({
      companyId: session.companyId,
      ticketNumber: nextNum + i,
      customerId: customerId || undefined,
      driverId: driverId || undefined,
      material,
      truckNumber: driverTruckNum,
      quantity: quantityPerTicket,
      hauledFrom,
      hauledTo,
      ratePerUnit: ratePerUnit !== null && !isNaN(ratePerUnit) ? ratePerUnit : undefined,
      status: driverId ? 'DISPATCHED' as const : 'PENDING' as const,
      dispatchedAt: driverId ? new Date() : undefined,
    });
  }

  await enforceTicketLimit(session.companyId, tickets.length);
  await prisma.ticket.createMany({ data: tickets });

  // If assigned to a driver, send notification (respects preferences)
  if (driver) {
    await notifyDriverJobAssignment({
      driverId: driver.id,
      jobNumber: nextNum, // first ticket number
      material: material || undefined,
      quantity: quantityPerTicket * count,
      quantityType: 'LOADS',
      hauledFrom,
      hauledTo,
    });
  }

  revalidatePath('/tickets');
  revalidatePath('/dashboard');
  redirect('/tickets');
}

export default async function BulkCreatePage() {
  const session = await requireSession();
  const [drivers, customers, company] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.companyId, active: true },
      include: { assignedTruck: { select: { truckNumber: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.company.findUnique({ where: { id: session.companyId } }),
  ]);

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/tickets" className="text-sm text-steel-500 hover:text-steel-800">← Tickets</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Bulk Create Tickets</h1>
        <p className="text-sm text-steel-500 mt-1">Create multiple identical tickets at once — useful for multi-trip jobs.</p>
      </header>

      <form action={bulkCreateAction} className="panel p-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-safety/10 border border-safety/30 rounded-lg">
          <div>
            <label className="label">Number of Tickets *</label>
            <input name="count" type="number" min="1" max="50" defaultValue={5} required className="input" />
            <p className="text-[10px] text-steel-500 mt-1">Max 50 at once</p>
          </div>
          <div>
            <label className="label">Qty Per Ticket</label>
            <input name="quantityPerTicket" type="number" min="1" defaultValue={1} className="input" />
          </div>
          <div>
            <label className="label">Rate per Unit ($)</label>
            <input
              name="ratePerUnit" type="number" step="0.01" min="0"
              defaultValue={company?.defaultRate ? Number(company.defaultRate).toFixed(2) : ''}
              className="input"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Customer</label>
            <select name="customerId" className="input">
              <option value="">— Select customer —</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Assign Driver</label>
            <select name="driverId" className="input">
              <option value="">— Leave unassigned —</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <p className="text-xs text-steel-500 mt-1">If assigned, driver gets one summary SMS for all tickets.</p>
          </div>
        </div>

        <div>
          <label className="label">Material</label>
          <input name="material" className="input" placeholder="e.g. Fill Dirt, Crushed Stone #57" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Hauled From *</label>
            <input name="hauledFrom" required className="input" placeholder="Pit, quarry, yard…" />
          </div>
          <div>
            <label className="label">Hauled To *</label>
            <input name="hauledTo" required className="input" placeholder="Job site, address…" />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-steel-200">
          <button type="submit" className="btn-accent">Create Tickets</button>
          <Link href="/tickets" className="btn-ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
