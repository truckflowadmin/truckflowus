export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import InvoiceDashboard from './InvoiceDashboard';

export default async function InvoicesPage() {
  const session = await requireSession();
  const lang = getServerLang();
  const [invoices, customers, brokers] = await Promise.all([
    prisma.invoice.findMany({
      where: { companyId: session.companyId },
      include: { customer: true, broker: true, _count: { select: { tickets: { where: { deletedAt: null } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.customer.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.broker.findMany({ where: { companyId: session.companyId, active: true }, orderBy: { name: 'asc' } }),
  ]);

  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  // ── Compute invoice stats from already-fetched data ──
  const now = new Date();
  const invoiceStats = {
    draft: invoices.filter(inv => inv.status === 'DRAFT').length,
    sent: invoices.filter(inv => inv.status === 'SENT').length,
    overdue: invoices.filter(inv => inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < now).length,
    openARTotal: invoices
      .filter(inv => ['DRAFT', 'SENT'].includes(inv.status))
      .reduce((sum, inv) => sum + Number(inv.total), 0),
    openARCount: invoices.filter(inv => ['DRAFT', 'SENT'].includes(inv.status)).length,
  };

  const serializedInvoices = invoices.map((inv) => {
    const isBroker = inv.invoiceType === 'BROKER';
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType,
      status: inv.status,
      billedTo: isBroker ? inv.broker?.name ?? '—' : inv.customer?.name ?? '—',
      customerName: inv.customer?.name ?? null,
      brokerName: inv.broker?.name ?? null,
      periodStart: format(inv.periodStart, 'MMM d'),
      periodEnd: format(inv.periodEnd, 'MMM d, yyyy'),
      periodStartRaw: format(inv.periodStart, 'yyyy-MM-dd'),
      periodEndRaw: format(inv.periodEnd, 'yyyy-MM-dd'),
      ticketCount: inv._count.tickets,
      total: Number(inv.total),
      dueDate: inv.dueDate ? format(inv.dueDate, 'yyyy-MM-dd') : null,
    };
  });

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('invoices.billing', lang)}</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('invoices.title', lang)}</h1>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Borradores' : 'Draft'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{invoiceStats.draft}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Enviadas' : 'Sent'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{invoiceStats.sent}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Vencidas' : 'Overdue'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums text-red-600">{invoiceStats.overdue}</div>
        </div>
        <div className="panel p-4 ring-2 ring-safety">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{lang === 'es' ? 'Cuentas por Cobrar' : 'Open A/R'}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">${invoiceStats.openARTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-steel-500 mt-0.5">{invoiceStats.openARCount} {invoiceStats.openARCount === 1 ? (lang === 'es' ? 'factura' : 'invoice') : (lang === 'es' ? 'facturas' : 'invoices')}</div>
        </div>
      </section>

      <InvoiceDashboard
        invoices={serializedInvoices}
        customers={customers.map(c => ({ id: c.id, name: c.name }))}
        brokers={brokers.map(b => ({ id: b.id, name: b.name }))}
        defaultPeriodStart={format(lastWeekStart, 'yyyy-MM-dd')}
        defaultPeriodEnd={format(lastWeekEnd, 'yyyy-MM-dd')}
      />
    </div>
  );
}
