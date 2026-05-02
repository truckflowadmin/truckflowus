import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import type { BrokerContact } from '@/lib/broker-types';
import BrokerHistory from './BrokerHistory';

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

  const jobs = await prisma.job.findMany({
    where: { brokerId: broker.id, deletedAt: null },
    include: {
      customer: true,
      assignments: { include: { driver: true } },
    },
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
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="mb-6">
        <Link href="/brokers" className="text-sm text-steel-500 hover:text-steel-800">← Brokers</Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <div className="panel p-4">
          <div className="text-xs text-steel-500 uppercase tracking-wider">Total Jobs</div>
          <div className="text-2xl font-bold tabular-nums">{jobs.length}</div>
        </div>
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

      <BrokerHistory
        tickets={JSON.parse(JSON.stringify(tickets))}
        jobs={JSON.parse(JSON.stringify(jobs))}
        commissionPct={commissionPct}
      />
    </div>
  );
}
