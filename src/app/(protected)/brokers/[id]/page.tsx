import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';
import { fmtQty, qtyUnit } from '@/lib/format';
import type { BrokerContact } from '@/lib/broker-types';

export default async function BrokerDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const broker = await prisma.broker.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!broker) notFound();

  const tickets = await prisma.ticket.findMany({
    where: { brokerId: broker.id },
    include: { customer: true, driver: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const completedTickets = tickets.filter((t) => t.status === 'COMPLETED' && t.ratePerUnit);
  const totalRevenue = completedTickets.reduce(
    (sum, t) => sum + Number(t.ratePerUnit) * Number(t.quantity),
    0
  );
  const commissionPct = Number(broker.commissionPct);
  const totalCommission = totalRevenue * (commissionPct / 100);

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <Link href="/brokers" className="text-sm text-steel-500 hover:text-steel-800">← Brokers</Link>
        <div className="flex items-center justify-between mt-1">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{broker.name}</h1>
            <div className="text-sm text-steel-500 mt-0.5">
              {(() => {
                const contacts = Array.isArray(broker.contacts) ? (broker.contacts as unknown as BrokerContact[]) : [];
                const pc = contacts[0];
                return pc ? <>{pc.name}{pc.jobTitle ? ` (${pc.jobTitle})` : ''} · {pc.phone} · </> : null;
              })()}
              {broker.email && <>{broker.email} · </>}
              {broker.phone && <>{broker.phone} · </>}
              {commissionPct}% commission · Due: {
                broker.dueDateRule === 'NEXT_FRIDAY' ? 'Next Friday' :
                broker.dueDateRule === 'CUSTOM' ? `${broker.dueDateDays ?? 30} days` :
                broker.dueDateRule.replace('NET_', 'Net ')
              }
            </div>
          </div>
          <div className="flex gap-2">
            <Link href={`/brokers/${broker.id}/trip-sheets`} className="btn-accent">Trip Sheets</Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Total Tickets</div>
          <div className="text-2xl font-bold tabular-nums">{tickets.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Completed</div>
          <div className="text-2xl font-bold tabular-nums">{completedTickets.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Revenue</div>
          <div className="text-2xl font-bold tabular-nums">${totalRevenue.toFixed(2)}</div>
        </div>
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Commission Owed</div>
          <div className="text-2xl font-bold tabular-nums text-red-700">${totalCommission.toFixed(2)}</div>
        </div>
      </div>

      {broker.notes && (
        <div className="panel p-5 mb-6">
          <h2 className="font-semibold mb-2">Notes</h2>
          <pre className="whitespace-pre-wrap text-sm text-steel-700">{broker.notes}</pre>
        </div>
      )}

      {/* Ticket History */}
      <div className="panel overflow-hidden">
        <div className="px-5 py-3 border-b border-steel-200 bg-steel-50">
          <h2 className="font-semibold text-sm">Ticket History</h2>
        </div>
        {tickets.length === 0 ? (
          <div className="p-10 text-center text-steel-500">No tickets linked to this broker yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200">
              <tr>
                <th className="text-left px-5 py-2">#</th>
                <th className="text-left px-5 py-2">Date</th>
                <th className="text-left px-5 py-2">Customer</th>
                <th className="text-left px-5 py-2">Material</th>
                <th className="text-right px-5 py-2">Qty</th>
                <th className="text-right px-5 py-2">Revenue</th>
                <th className="text-right px-5 py-2">Commission</th>
                <th className="text-left px-5 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
                const qty = Number(t.quantity);
                const lineTotal = rate * qty;
                const lineComm = lineTotal * (commissionPct / 100);
                return (
                  <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                    <td className="px-5 py-3 font-mono">
                      <Link href={`/tickets/${t.id}`} className="hover:text-safety-dark">
                        #{String(t.ticketNumber).padStart(4, '0')}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-steel-600">
                      {t.date ? format(t.date, 'MMM d, yyyy') : format(t.createdAt, 'MMM d')}
                    </td>
                    <td className="px-5 py-3">{t.customer?.name ?? '—'}</td>
                    <td className="px-5 py-3">{t.material ?? '—'}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtQty(t.quantity, t.quantityType)} {qtyUnit(t.quantityType)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">${lineTotal.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-red-700">${lineComm.toFixed(2)}</td>
                    <td className="px-5 py-3">
                      <span className={`badge ${
                        t.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        t.status === 'IN_PROGRESS' ? 'bg-safety text-diesel' :
                        'bg-steel-200 text-steel-700'
                      }`}>
                        {t.status.replace('_', ' ')}
                      </span>
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
