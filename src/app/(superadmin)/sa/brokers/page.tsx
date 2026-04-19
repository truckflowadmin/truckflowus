import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import BrokerContactsEditor from '@/components/BrokerContactsEditor';
import type { BrokerContact } from '@/lib/broker-types';

async function createBrokerAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Name required');

  let contacts: BrokerContact[] = [];
  try {
    contacts = JSON.parse(String(formData.get('contacts') || '[]'));
  } catch { /* empty */ }

  await prisma.broker.create({
    data: {
      name,
      contacts: contacts as any,
      email: String(formData.get('email') || '').trim() || null,
      commissionPct: Number(formData.get('commissionPct') || '0') || 0,
    },
  });
  revalidatePath('/sa/brokers');
}

async function deleteBrokerAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const brokerId = String(formData.get('brokerId') || '');
  if (!brokerId) throw new Error('Broker ID required');

  // Unlink any tickets referencing this broker
  await prisma.ticket.updateMany({ where: { brokerId }, data: { brokerId: null } });
  // Delete any trip sheets for this broker
  await prisma.tripSheet.deleteMany({ where: { brokerId } });
  // Delete the broker
  await prisma.broker.delete({ where: { id: brokerId } });
  revalidatePath('/sa/brokers');
}

function getContacts(broker: { contacts: unknown }): BrokerContact[] {
  if (Array.isArray(broker.contacts)) return broker.contacts as unknown as BrokerContact[];
  return [];
}

function primaryContact(broker: { contacts: unknown }): BrokerContact | null {
  const c = getContacts(broker);
  return c.length > 0 ? c[0] : null;
}

export default async function SuperadminBrokersPage() {
  await requireSuperadmin();

  const brokers = await prisma.broker.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      company: { select: { name: true, id: true } },
      _count: { select: { tickets: true } },
    },
  });

  const assigned = brokers.filter((b) => b.companyId);
  const unassigned = brokers.filter((b) => !b.companyId);

  const byCompany = new Map<string, { companyName: string; companyId: string; brokers: typeof brokers }>();
  for (const b of assigned) {
    const key = b.companyId!;
    if (!byCompany.has(key)) {
      byCompany.set(key, { companyName: b.company!.name, companyId: key, brokers: [] });
    }
    byCompany.get(key)!.brokers.push(b);
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-purple-400 font-semibold">Platform</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">Brokers</h1>
        <p className="text-sm text-purple-300 mt-1">{brokers.length} brokers total — {unassigned.length} unassigned, {assigned.length} assigned across {byCompany.size} tenants</p>
      </header>

      {/* Create new broker */}
      <form action={createBrokerAction} className="panel-sa p-5 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="label-sa">Broker Name *</label>
            <input name="name" required className="input-sa" />
          </div>
          <div>
            <label className="label-sa">Primary Email</label>
            <input name="email" type="email" className="input-sa" />
          </div>
          <div>
            <label className="label-sa">Commission %</label>
            <input name="commissionPct" type="number" step="0.01" min="0" max="100" defaultValue="0" className="input-sa" />
          </div>
        </div>
        <BrokerContactsEditor />
        <button className="btn-purple" type="submit">+ Add Broker</button>
      </form>

      {/* Unassigned brokers */}
      {unassigned.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">Unassigned Brokers</h2>
          <div className="panel-sa overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-white min-w-[700px]">
              <thead className="text-xs uppercase tracking-wide text-purple-300 border-b border-purple-500/30">
                <tr>
                  <th className="text-left px-5 py-2">Name</th>
                  <th className="text-left px-5 py-2">Primary Contact</th>
                  <th className="text-left px-5 py-2">Job Title</th>
                  <th className="text-left px-5 py-2">Phone</th>
                  <th className="text-right px-5 py-2">Commission %</th>
                  <th className="text-right px-5 py-2">Contacts</th>
                  <th className="text-left px-5 py-2">Status</th>
                  <th className="text-right px-5 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map((b) => {
                  const pc = primaryContact(b);
                  const total = getContacts(b).length;
                  return (
                    <tr key={b.id} className="border-b border-purple-500/20 hover:bg-purple-500/10">
                      <td className="px-5 py-3 font-medium text-white">{b.name}</td>
                      <td className="px-5 py-3 text-purple-100">{pc?.name ?? <span className="text-purple-400">—</span>}</td>
                      <td className="px-5 py-3 text-purple-100">{pc?.jobTitle ?? <span className="text-purple-400">—</span>}</td>
                      <td className="px-5 py-3 text-purple-100">{pc?.phone ?? <span className="text-purple-400">—</span>}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-purple-100">{Number(b.commissionPct).toFixed(1)}%</td>
                      <td className="px-5 py-3 text-right tabular-nums text-purple-100">{total}</td>
                      <td className="px-5 py-3">
                        <span className="badge bg-yellow-500/20 text-yellow-300">Unassigned</span>
                      </td>
                      <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                        <Link href={`/sa/brokers/${b.id}/edit`} className="text-xs text-purple-400 hover:text-purple-200">
                          Edit
                        </Link>
                        <form action={deleteBrokerAction}>
                          <input type="hidden" name="brokerId" value={b.id} />
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
          </div>
        </div>
      )}

      {/* Assigned brokers grouped by company */}
      {brokers.length === 0 ? (
        <div className="panel-sa p-10 text-center text-purple-300">No brokers have been created yet. Add one above.</div>
      ) : (
        Array.from(byCompany.values()).map(({ companyName, companyId, brokers: companyBrokers }) => (
          <div key={companyId} className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-white">{companyName}</h2>
              <Link href={`/sa/tenants/${companyId}/brokers`} className="text-xs text-purple-400 hover:text-purple-200">
                Manage →
              </Link>
            </div>
            <div className="panel-sa overflow-hidden">
              <table className="w-full text-sm text-white">
                <thead className="text-xs uppercase tracking-wide text-purple-300 border-b border-purple-500/30">
                  <tr>
                    <th className="text-left px-5 py-2">Name</th>
                    <th className="text-left px-5 py-2">Primary Contact</th>
                    <th className="text-left px-5 py-2">Job Title</th>
                    <th className="text-left px-5 py-2">Phone</th>
                    <th className="text-right px-5 py-2">Commission %</th>
                    <th className="text-right px-5 py-2">Tickets</th>
                    <th className="text-left px-5 py-2">Status</th>
                    <th className="text-right px-5 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {companyBrokers.map((b) => {
                    const pc = primaryContact(b);
                    return (
                      <tr key={b.id} className="border-b border-purple-500/20 hover:bg-purple-500/10">
                        <td className="px-5 py-3 font-medium text-white">{b.name}</td>
                        <td className="px-5 py-3 text-purple-100">{pc?.name ?? <span className="text-purple-400">—</span>}</td>
                        <td className="px-5 py-3 text-purple-100">{pc?.jobTitle ?? <span className="text-purple-400">—</span>}</td>
                        <td className="px-5 py-3 text-purple-100">{pc?.phone ?? <span className="text-purple-400">—</span>}</td>
                        <td className="px-5 py-3 text-right tabular-nums text-purple-100">{Number(b.commissionPct).toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right tabular-nums text-purple-100">{b._count.tickets}</td>
                        <td className="px-5 py-3">
                          <span className={`badge ${b.active ? 'bg-green-500/20 text-green-300' : 'bg-steel-500/20 text-steel-400'}`}>
                            {b.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right flex items-center justify-end gap-3">
                          <Link href={`/sa/tenants/${companyId}/brokers/${b.id}/edit`} className="text-xs text-purple-400 hover:text-purple-200">
                            Edit
                          </Link>
                          <form action={deleteBrokerAction}>
                            <input type="hidden" name="brokerId" value={b.id} />
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
            </div>
          </div>
        ))
      )}
    </div>
  );
}
