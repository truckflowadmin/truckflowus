import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import type { BrokerContact } from '@/lib/broker-types';

export default async function BrokersPage() {
  const session = await requireSession();
  const brokers = await prisma.broker.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  // Calculate total commissions per broker from completed tickets
  const brokerStats = await Promise.all(
    brokers.map(async (b) => {
      const tickets = await prisma.ticket.findMany({
        where: { brokerId: b.id, status: 'COMPLETED', ratePerUnit: { not: null } },
        select: { ratePerUnit: true, quantity: true },
      });
      const revenue = tickets.reduce((sum, t) => sum + (Number(t.ratePerUnit) * Number(t.quantity)), 0);
      const commission = revenue * (Number(b.commissionPct) / 100);
      return { id: b.id, revenue, commission };
    })
  );
  const statsMap = Object.fromEntries(brokerStats.map((s) => [s.id, s]));

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Partners</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Brokers</h1>
      </header>

      <div className="panel overflow-hidden">
        {brokers.length === 0 ? (
          <div className="p-10 text-center text-steel-500">No brokers yet. Contact your administrator to add brokers.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-3 md:px-5 py-2">Name</th>
                <th className="text-left px-3 md:px-5 py-2">Primary Contact</th>
                <th className="text-left px-3 md:px-5 py-2">Job Title</th>
                <th className="text-left px-3 md:px-5 py-2">Phone</th>
                <th className="text-right px-3 md:px-5 py-2">Commission %</th>
                <th className="text-right px-3 md:px-5 py-2">Tickets</th>
                <th className="text-right px-3 md:px-5 py-2">Revenue</th>
                <th className="text-right px-3 md:px-5 py-2">Commission Owed</th>
                <th className="text-left px-3 md:px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {brokers.map((b) => {
                const s = statsMap[b.id];
                const contacts = Array.isArray(b.contacts) ? (b.contacts as unknown as BrokerContact[]) : [];
                const pc = contacts[0] ?? null;
                return (
                  <tr key={b.id} className="border-b border-steel-100 hover:bg-steel-50">
                    <td className="px-3 md:px-5 py-3 font-medium">
                      <Link href={`/brokers/${b.id}`} className="hover:text-safety-dark">{b.name}</Link>
                    </td>
                    <td className="px-3 md:px-5 py-3">{pc?.name ?? '—'}</td>
                    <td className="px-3 md:px-5 py-3">{pc?.jobTitle ?? '—'}</td>
                    <td className="px-3 md:px-5 py-3">{pc?.phone ?? '—'}</td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums">{Number(b.commissionPct).toFixed(1)}%</td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums">{b._count.tickets}</td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums">${s?.revenue.toFixed(2) ?? '0.00'}</td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums font-medium text-red-700">${s?.commission.toFixed(2) ?? '0.00'}</td>
                    <td className="px-3 md:px-5 py-3">
                      <span className={`badge ${b.active ? 'bg-green-100 text-green-800' : 'bg-steel-200 text-steel-600'}`}>
                        {b.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
