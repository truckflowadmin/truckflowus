import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import TenantNav from '@/components/TenantNav';
import type { BrokerContact } from '@/lib/broker-types';

async function assignBrokerAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const sourceBrokerId = String(formData.get('brokerId') || '');
  const companyId = String(formData.get('companyId') || '');
  if (!sourceBrokerId || !companyId) throw new Error('Broker and company required');

  const source = await prisma.broker.findUnique({ where: { id: sourceBrokerId } });
  if (!source) throw new Error('Broker not found');

  // Allow assigning even if a broker with the same name exists (they may be different brokers)

  await prisma.broker.create({
    data: {
      companyId,
      name: source.name,
      contacts: source.contacts ?? [],
      email: source.email,
      commissionPct: source.commissionPct,
      mailingAddress: source.mailingAddress,
      notes: source.notes,
    },
  });

  revalidatePath(`/sa/tenants/${companyId}/brokers`);
  revalidatePath('/sa/brokers');
}

async function createBrokerForTenantAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const companyId = String(formData.get('companyId') || '');
  const name = String(formData.get('name') || '').trim();
  if (!companyId || !name) throw new Error('Company and broker name required');

  await prisma.broker.create({
    data: {
      companyId,
      name,
      email: String(formData.get('email') || '').trim() || null,
      commissionPct: Number(formData.get('commissionPct') || '0') || 0,
      contacts: [],
    },
  });

  revalidatePath(`/sa/tenants/${companyId}/brokers`);
  revalidatePath('/sa/brokers');
}

async function deleteBrokerAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const brokerId = String(formData.get('brokerId') || '');
  const companyId = String(formData.get('companyId') || '');
  if (!brokerId) throw new Error('Broker ID required');

  await prisma.ticket.updateMany({
    where: { brokerId },
    data: { brokerId: null },
  });
  const sheets = await prisma.tripSheet.findMany({ where: { brokerId }, select: { id: true } });
  for (const s of sheets) {
    await prisma.ticket.updateMany({ where: { tripSheetId: s.id }, data: { tripSheetId: null } });
  }
  await prisma.tripSheet.deleteMany({ where: { brokerId } });
  await prisma.broker.delete({ where: { id: brokerId } });

  revalidatePath(`/sa/tenants/${companyId}/brokers`);
  revalidatePath('/sa/brokers');
}

export default async function TenantBrokersPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();
  const company = await prisma.company.findUnique({ where: { id: params.id }, select: { id: true, name: true } });
  if (!company) notFound();

  const brokers = await prisma.broker.findMany({
    where: { companyId: company.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { tickets: { where: { deletedAt: null } }, tripSheets: true } } },
  });

  // All brokers available to assign: unassigned (null companyId) + other companies
  const tenantBrokerIds = new Set(brokers.map((b) => b.id));
  const allOtherBrokers = await prisma.broker.findMany({
    where: {
      OR: [
        { companyId: null },
        { companyId: { not: company.id } },
      ],
    },
    orderBy: { name: 'asc' },
    include: { company: { select: { name: true } } },
  });
  const filteredAvailable = allOtherBrokers.filter((b) => !tenantBrokerIds.has(b.id));

  return (
    <div className="p-8 max-w-5xl">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <h2 className="text-xl font-bold text-white mb-4">Brokers ({brokers.length})</h2>

      {/* Add broker from global list */}
      <div className="panel-sa p-5 mb-6">
        {filteredAvailable.length > 0 ? (
          <form action={assignBrokerAction} className="flex items-end gap-3">
            <input type="hidden" name="companyId" value={company.id} />
            <div className="flex-1">
              <label className="label-sa">Add Broker from Global List</label>
              <select name="brokerId" required className="input-sa">
                <option value="">Select a broker…</option>
                {filteredAvailable.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}{b.company ? ` (from ${b.company.name})` : ' (unassigned)'}
                  </option>
                ))}
              </select>
            </div>
            <button className="btn-purple whitespace-nowrap" type="submit">+ Add Broker</button>
          </form>
        ) : (
          <p className="text-sm text-purple-300">
            All brokers have been assigned.{' '}
            <Link href="/sa/brokers" className="text-purple-400 hover:text-purple-200">
              Create new brokers in the Brokers tab →
            </Link>
          </p>
        )}

        {/* Quick-create a broker directly for this tenant */}
        <details className="mt-4">
          <summary className="text-sm text-purple-400 hover:text-purple-200 cursor-pointer">
            + Create a new broker for this tenant
          </summary>
          <form action={createBrokerForTenantAction} className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="hidden" name="companyId" value={company.id} />
            <div>
              <label className="label-sa">Broker Name *</label>
              <input name="name" required className="input-sa" placeholder="Broker name" />
            </div>
            <div>
              <label className="label-sa">Primary Email</label>
              <input name="email" type="email" className="input-sa" placeholder="email@example.com" />
            </div>
            <div>
              <label className="label-sa">Commission %</label>
              <input name="commissionPct" type="number" step="0.01" min="0" max="100" defaultValue="0" className="input-sa" />
            </div>
            <div className="md:col-span-3">
              <button className="btn-purple text-sm" type="submit">Create Broker</button>
            </div>
          </form>
        </details>
      </div>

      <div className="panel-sa overflow-hidden">
        {brokers.length === 0 ? (
          <div className="p-10 text-center text-purple-300">
            This tenant has no brokers.{' '}
            {filteredAvailable.length > 0
              ? 'Select one from the dropdown above.'
              : 'Create brokers in the Brokers tab first.'}
          </div>
        ) : (
          <table className="w-full text-sm text-white">
            <thead className="text-xs uppercase tracking-wide text-purple-300 border-b border-purple-500/30">
              <tr>
                <th className="text-left px-5 py-2">Name</th>
                <th className="text-left px-5 py-2">Primary Contact</th>
                <th className="text-left px-5 py-2">Job Title</th>
                <th className="text-left px-5 py-2">Phone</th>
                <th className="text-right px-5 py-2">Commission %</th>
                <th className="text-right px-5 py-2">Tickets</th>
                <th className="text-left px-5 py-2">Form</th>
                <th className="text-left px-5 py-2">Status</th>
                <th className="text-right px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => {
                const contacts = Array.isArray(b.contacts) ? (b.contacts as unknown as BrokerContact[]) : [];
                const pc = contacts[0] ?? null;
                return (
                <tr key={b.id} className="border-b border-purple-500/20 hover:bg-purple-500/10">
                  <td className="px-5 py-3 font-medium text-white">{b.name}</td>
                  <td className="px-5 py-3 text-purple-100">{pc?.name ?? <span className="text-purple-400">—</span>}</td>
                  <td className="px-5 py-3 text-purple-100">{pc?.jobTitle ?? <span className="text-purple-400">—</span>}</td>
                  <td className="px-5 py-3 text-purple-100">{pc?.phone ?? <span className="text-purple-400">—</span>}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-purple-100">{Number(b.commissionPct).toFixed(1)}%</td>
                  <td className="px-5 py-3 text-right tabular-nums text-purple-100">{b._count.tickets}</td>
                  <td className="px-5 py-3">
                    {b.tripSheetForm ? (
                      <span className="badge bg-blue-500/20 text-blue-300">PDF</span>
                    ) : (
                      <span className="text-purple-500 text-xs">None</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`badge ${b.active ? 'bg-green-500/20 text-green-300' : 'bg-steel-500/20 text-steel-400'}`}>
                      {b.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                    <Link href={`/sa/tenants/${company.id}/brokers/${b.id}/edit`} className="text-xs text-purple-400 hover:text-purple-200">
                      Edit
                    </Link>
                    <form action={deleteBrokerAction}>
                      <input type="hidden" name="brokerId" value={b.id} />
                      <input type="hidden" name="companyId" value={company.id} />
                      <button type="submit" className="text-xs text-red-400 hover:text-red-300">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
