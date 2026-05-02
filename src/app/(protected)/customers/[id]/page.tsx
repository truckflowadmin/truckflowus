import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';
import { format } from 'date-fns';
import { fmtQty, qtyUnit } from '@/lib/format';

export default async function CustomerDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const customer = await prisma.customer.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!customer) notFound();

  const [tickets, invoices, stats] = await Promise.all([
    prisma.ticket.findMany({
      where: { customerId: customer.id },
      include: { driver: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.invoice.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.ticket.aggregate({
      where: { customerId: customer.id, status: 'COMPLETED', ratePerUnit: { not: null } },
      _count: true,
      _sum: { quantity: true },
    }),
  ]);

  // Calculate total revenue from completed tickets
  const completedWithRate = await prisma.ticket.findMany({
    where: { customerId: customer.id, status: 'COMPLETED' },
    select: { quantity: true, ratePerUnit: true },
  });
  const totalRevenue = completedWithRate.reduce((sum, t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
    return sum + rate * Number(t.quantity);
  }, 0);

  const openInvoiceTotal = invoices
    .filter((i) => i.status === 'SENT' || i.status === 'OVERDUE')
    .reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <header className="mb-6">
        <Link href="/customers" className="text-sm text-steel-500 hover:text-steel-800">← Customers</Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-1">
          <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
          <Link href={`/customers/${customer.id}/edit`} className="btn-ghost">Edit</Link>
        </div>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-steel-600">
          {customer.contact && <span>{customer.contact}</span>}
          {customer.phone && <span>{customer.phone}</span>}
          {customer.email && <span>{customer.email}</span>}
          {customer.address && <span>{customer.address}</span>}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Total Tickets</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{tickets.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Completed Qty</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{Number(stats._sum.quantity ?? 0)}</div>
        </div>
        <div className="panel p-4 ring-2 ring-safety">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Total Revenue</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Open A/R</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            ${openInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tickets */}
        <div className="lg:col-span-2 panel">
          <div className="flex items-center justify-between px-5 py-3 border-b border-steel-200">
            <h2 className="font-semibold">Recent Tickets</h2>
            <Link
              href={`/tickets?q=${encodeURIComponent(customer.name)}`}
              className="text-xs text-steel-600 hover:text-steel-900"
            >
              View all →
            </Link>
          </div>
          {tickets.length === 0 ? (
            <div className="p-8 text-center text-steel-500">No tickets yet.</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                <tr>
                  <th className="text-left px-5 py-2">#</th>
                  <th className="text-left px-5 py-2">Date</th>
                  <th className="text-left px-5 py-2">Driver</th>
                  <th className="text-left px-5 py-2">Material</th>
                  <th className="text-right px-5 py-2">Qty</th>
                  <th className="text-left px-5 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((t) => (
                  <tr key={t.id} className="border-b border-steel-100 hover:bg-steel-50">
                    <td className="px-5 py-2 font-mono">
                      <Link href={`/tickets/${t.id}`} className="hover:text-safety-dark">
                        #{String(t.ticketNumber).padStart(4, '0')}
                      </Link>
                    </td>
                    <td className="px-5 py-2 text-steel-600 text-xs">{format(t.createdAt, 'MMM d')}</td>
                    <td className="px-5 py-2">{t.driver?.name ?? <span className="text-steel-400">—</span>}</td>
                    <td className="px-5 py-2">{t.material ?? '—'}</td>
                    <td className="px-5 py-2 text-right tabular-nums">{fmtQty(t.quantity, t.quantityType)} {qtyUnit(t.quantityType)}</td>
                    <td className="px-5 py-2"><StatusBadge status={t.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>

        {/* Invoices */}
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-steel-200">
            <h2 className="font-semibold">Invoices</h2>
          </div>
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-steel-500 text-sm">No invoices yet.</div>
          ) : (
            <ul className="divide-y divide-steel-100">
              {invoices.map((inv) => {
                const statusColor =
                  inv.status === 'PAID' ? 'text-green-700' :
                  inv.status === 'OVERDUE' ? 'text-red-700' :
                  inv.status === 'SENT' ? 'text-blue-700' : 'text-steel-600';
                return (
                  <li key={inv.id} className="px-5 py-3 hover:bg-steel-50">
                    <Link href={`/invoices/${inv.id}`} className="flex items-center justify-between">
                      <div>
                        <span className="font-mono text-sm">INV-{String(inv.invoiceNumber).padStart(4, '0')}</span>
                        <span className="text-xs text-steel-500 ml-2">{format(inv.createdAt, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold tabular-nums">${Number(inv.total).toFixed(2)}</div>
                        <div className={`text-[10px] uppercase font-bold ${statusColor}`}>{inv.status}</div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
