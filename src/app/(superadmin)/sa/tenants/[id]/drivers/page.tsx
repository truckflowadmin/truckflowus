import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { audit } from '@/lib/audit';
import TenantNav from '@/components/TenantNav';
import ConfirmButton from '@/components/ConfirmButton';
import { format } from 'date-fns';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------
async function toggleDriverActive(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');
  const active = formData.get('active') === 'true';

  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!driver) return;

  await prisma.driver.update({ where: { id: driverId }, data: { active } });
  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'update',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `${active ? 'Activated' : 'Deactivated'} driver "${driver.name}"`,
    details: { driverId, active },
  });
  revalidatePath(`/sa/tenants/${companyId}/drivers`);
}

async function createDriver(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const companyId = String(formData.get('companyId') || '');
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const truckNumber = String(formData.get('truckNumber') || '').trim() || null;

  if (!companyId || !name || !phone) throw new Error('Name and phone are required');

  const driver = await prisma.driver.create({
    data: {
      companyId, name, phone, truckNumber,
      accessToken: randomBytes(24).toString('hex'),
      accessTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  await audit({
    companyId,
    entityType: 'driver',
    entityId: driver.id,
    action: 'create',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Created driver "${name}" (${phone})`,
    details: { name, phone, truckNumber },
  });
  revalidatePath(`/sa/tenants/${companyId}/drivers`);
}

async function updateDriver(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const truckNumber = String(formData.get('truckNumber') || '').trim() || null;

  if (!name || !phone) throw new Error('Name and phone required');

  const old = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!old) return;

  await prisma.driver.update({
    where: { id: driverId },
    data: { name, phone, truckNumber },
  });
  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'update',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Updated driver "${old.name}" → "${name}"`,
    details: { old: { name: old.name, phone: old.phone, truckNumber: old.truckNumber }, new: { name, phone, truckNumber } },
  });
  revalidatePath(`/sa/tenants/${companyId}/drivers`);
}

async function deleteDriver(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');

  const driver = await prisma.driver.findFirst({ where: { id: driverId, companyId } });
  if (!driver) return;

  // Check for assigned tickets
  const assignedCount = await prisma.ticket.count({
    where: { driverId, status: { in: ['DISPATCHED', 'IN_PROGRESS'] } },
  });
  if (assignedCount > 0) {
    throw new Error(`Cannot delete — driver has ${assignedCount} active ticket(s). Reassign them first.`);
  }

  await prisma.driver.delete({ where: { id: driverId } });
  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'delete',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Deleted driver "${driver.name}" (${driver.phone})`,
    details: { name: driver.name, phone: driver.phone },
  });
  revalidatePath(`/sa/tenants/${companyId}/drivers`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function TenantDriversPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const drivers = await prisma.driver.findMany({
    where: { companyId: params.id },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
  });

  // Ticket counts per driver
  const ticketCounts = await prisma.ticket.groupBy({
    by: ['driverId'],
    where: { companyId: params.id, driverId: { not: null } },
    _count: { id: true },
  });
  const countMap: Record<string, number> = {};
  ticketCounts.forEach((tc) => {
    if (tc.driverId) countMap[tc.driverId] = tc._count.id;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">
          Drivers <span className="text-purple-400 font-normal">({drivers.length})</span>
        </h1>
      </div>

      {/* Create driver */}
      <details className="panel-sa mb-4">
        <summary className="text-sm font-medium text-purple-300 cursor-pointer py-2 px-1">
          + Add Driver
        </summary>
        <form action={createDriver} className="mt-3 space-y-3">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label-sa">Name</label>
              <input name="name" required className="input-sa" placeholder="John Doe" />
            </div>
            <div>
              <label className="label-sa">Phone (E.164)</label>
              <input name="phone" required className="input-sa" placeholder="+12395551234" />
            </div>
            <div>
              <label className="label-sa">Truck #</label>
              <input name="truckNumber" className="input-sa" placeholder="Optional" />
            </div>
          </div>
          <button type="submit" className="btn-purple">Create Driver</button>
        </form>
      </details>

      {/* Drivers table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
            <tr>
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Phone</th>
              <th className="text-left py-2 px-2">Truck</th>
              <th className="text-left py-2 px-2">Tickets</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Created</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-900/30">
            {drivers.map((d) => (
              <tr key={d.id} className="hover:bg-purple-900/20">
                <td className="py-2 px-2 text-white font-medium">{d.name}</td>
                <td className="py-2 px-2 text-purple-300 font-mono text-xs">{d.phone}</td>
                <td className="py-2 px-2 text-purple-300">{d.truckNumber ?? '—'}</td>
                <td className="py-2 px-2 text-purple-300">{countMap[d.id] ?? 0}</td>
                <td className="py-2 px-2">
                  <form action={toggleDriverActive} className="inline">
                    <input type="hidden" name="driverId" value={d.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <input type="hidden" name="active" value={(!d.active).toString()} />
                    <button
                      type="submit"
                      className={`text-xs rounded-full px-2.5 py-1 font-medium ${
                        d.active
                          ? 'bg-emerald-900/60 text-emerald-200 hover:bg-emerald-800'
                          : 'bg-red-900/60 text-red-200 hover:bg-red-800'
                      }`}
                    >
                      {d.active ? 'Active' : 'Inactive'}
                    </button>
                  </form>
                </td>
                <td className="py-2 px-2 text-purple-300 text-xs">
                  {format(d.createdAt, 'MMM d, yyyy')}
                </td>
                <td className="py-2 px-2 text-right space-x-2">
                  <details className="inline-block relative">
                    <summary className="text-xs text-purple-400 hover:text-purple-200 cursor-pointer">
                      Edit
                    </summary>
                    <div className="absolute right-0 top-6 z-20 bg-[#1a0a2e] border border-purple-800 rounded-lg p-4 shadow-xl w-72">
                      <form action={updateDriver} className="space-y-2">
                        <input type="hidden" name="driverId" value={d.id} />
                        <input type="hidden" name="companyId" value={company.id} />
                        <div>
                          <label className="label-sa text-xs">Name</label>
                          <input name="name" defaultValue={d.name} required className="input-sa text-xs" />
                        </div>
                        <div>
                          <label className="label-sa text-xs">Phone</label>
                          <input name="phone" defaultValue={d.phone} required className="input-sa text-xs" />
                        </div>
                        <div>
                          <label className="label-sa text-xs">Truck #</label>
                          <input name="truckNumber" defaultValue={d.truckNumber ?? ''} className="input-sa text-xs" />
                        </div>
                        <button type="submit" className="btn-purple text-xs w-full">Save</button>
                      </form>
                    </div>
                  </details>
                  <form action={deleteDriver} className="inline">
                    <input type="hidden" name="driverId" value={d.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <ConfirmButton message="Delete this driver permanently?" className="text-xs text-red-400 hover:text-red-200">
                      Delete
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {drivers.length === 0 && (
          <p className="text-center text-purple-400 py-8 text-sm">No drivers for this tenant.</p>
        )}
      </div>
    </div>
  );
}
