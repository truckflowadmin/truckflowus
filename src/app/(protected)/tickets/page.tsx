export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import TicketDashboard from './TicketDashboard';
import BillableTicketsTable from './BillableTicketsTable';

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string };
}) {
  const session = await requireSession();
  const status = searchParams.status;
  const q = searchParams.q?.trim();
  const isBillable = status === 'BILLABLE';
  const lang = getServerLang();

  // ── Billable mode: completed + reviewed + not yet on invoice/trip sheet ──
  if (isBillable) {
    const billableTickets = await prisma.ticket.findMany({
      where: {
        companyId: session.companyId,
        status: 'COMPLETED',
        dispatcherReviewedAt: { not: null },
        invoiceId: null,
        tripSheetId: null,
        ...(q
          ? {
              OR: [
                { material: { contains: q, mode: 'insensitive' as const } },
                { hauledFrom: { contains: q, mode: 'insensitive' as const } },
                { hauledTo: { contains: q, mode: 'insensitive' as const } },
                { customer: { name: { contains: q, mode: 'insensitive' as const } } },
                { driver: { name: { contains: q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: { driver: true, customer: true, broker: true },
      orderBy: [{ date: 'desc' }, { completedAt: 'desc' }],
    });

    // Fetch existing DRAFT trip sheets and invoices for "add to existing" feature
    const [draftTripSheets, draftInvoices] = await Promise.all([
      prisma.tripSheet.findMany({
        where: { companyId: session.companyId, status: 'DRAFT' },
        include: { broker: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.findMany({
        where: { companyId: session.companyId, status: 'DRAFT' },
        include: { customer: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const serialized = billableTickets.map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      date: t.date?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      customer: t.customer?.name ?? null,
      customerId: t.customerId,
      driver: t.driver?.name ?? null,
      broker: t.broker?.name ?? null,
      brokerId: t.brokerId,
      material: t.material,
      quantity: Number(t.quantity),
      quantityType: t.quantityType,
      hauledFrom: t.hauledFrom,
      hauledTo: t.hauledTo,
      ratePerUnit: t.ratePerUnit ? Number(t.ratePerUnit).toFixed(2) : null,
      ticketRef: t.ticketRef,
    }));

    const existingTripSheets = draftTripSheets.map((s) => ({
      id: s.id,
      brokerId: s.brokerId,
      brokerName: s.broker.name,
      weekEnding: s.weekEnding.toISOString(),
      totalDue: s.totalDue ? Number(s.totalDue) : 0,
    }));

    const existingInvoices = draftInvoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      customerId: inv.customerId,
      customerName: inv.customer?.name ?? 'Unknown',
      total: Number(inv.total),
    }));

    const statuses = ['PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED'];

    return (
      <div className="p-4 md:p-8 max-w-7xl">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('tickets.operations', lang)}</div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('tickets.title', lang)}</h1>
            <p className="text-sm text-steel-500 mt-0.5">{billableTickets.length} ready to bill</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/tickets/scan" className="btn-ghost text-sm">{t('tickets.bulkScan', lang)}</Link>
            <Link href="/tickets/bulk" className="btn-ghost text-sm">{t('tickets.bulkCreate', lang)}</Link>
            <Link href="/tickets/new" className="btn-accent">{t('tickets.newTicket', lang)}</Link>
          </div>
        </header>

        <div className="panel mb-4 p-4 flex flex-wrap items-center gap-3">
          <form className="flex gap-2 flex-1 min-w-[200px]">
            <input type="hidden" name="status" value="BILLABLE" />
            <input
              name="q"
              defaultValue={q ?? ''}
              placeholder={t('tickets.searchPlaceholder', lang)}
              className="input"
            />
            <button className="btn-primary" type="submit">{t('common.search', lang)}</button>
          </form>
          <div className="flex gap-1 flex-wrap">
            <Link
              href="/tickets"
              className="badge border bg-white border-steel-300 text-steel-700"
            >
              {t('tickets.all', lang)}
            </Link>
            {statuses.map((s) => (
              <Link
                key={s}
                href={`/tickets?status=${s}`}
                className="badge border bg-white border-steel-300 text-steel-700"
              >
                {s.replace('_', ' ')}
              </Link>
            ))}
            <Link
              href="/tickets?status=BILLABLE"
              className="badge border bg-green-700 text-white border-green-700"
            >
              {t('tickets.readyToBill', lang)}
            </Link>
          </div>
        </div>

        <BillableTicketsTable
          tickets={serialized}
          existingTripSheets={existingTripSheets}
          existingInvoices={existingInvoices}
        />
      </div>
    );
  }

  // ── Main dashboard view ──
  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  const [allTickets, customersList, driversList, brokersList] = await Promise.all([
    prisma.ticket.findMany({
      where: { companyId: session.companyId },
      include: { driver: true, customer: true, broker: true },
      orderBy: [{ createdAt: 'desc' }],
    }),
    prisma.customer.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.driver.findMany({ where: { companyId: session.companyId, active: true }, orderBy: { name: 'asc' } }),
    prisma.broker.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
  ]);

  const serializedTickets = allTickets.map((t) => {
    const rate = t.ratePerUnit ? Number(t.ratePerUnit) : null;
    const qty = Number(t.quantity);
    return {
      id: t.id,
      ticketNumber: t.ticketNumber,
      status: t.status,
      date: t.date ? format(t.date, 'MMM d, yyyy') : null,
      dateRaw: t.date ? format(t.date, 'yyyy-MM-dd') : null,
      customerName: t.customer?.name ?? null,
      driverName: t.driver?.name ?? null,
      brokerName: t.broker?.name ?? null,
      truckNumber: t.truckNumber ?? null,
      material: t.material ?? null,
      quantity: qty,
      quantityType: t.quantityType,
      ratePerUnit: rate,
      amount: rate != null ? rate * qty : 0,
      reviewed: !!t.dispatcherReviewedAt,
      hasPhoto: !!t.photoUrl,
      hauledFrom: t.hauledFrom ?? null,
      hauledTo: t.hauledTo ?? null,
      ticketRef: t.ticketRef ?? null,
      invoiced: !!t.invoiceId,
    };
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('tickets.operations', lang)}</div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('tickets.title', lang)}</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/tickets?status=BILLABLE"
            className="badge border bg-green-100 text-green-800 border-green-300 hover:bg-green-200 text-sm px-3 py-1.5"
          >
            {t('tickets.readyToBill', lang)}
          </Link>
        </div>
      </header>

      <TicketDashboard
        tickets={serializedTickets}
        customers={customersList.map(c => ({ id: c.id, name: c.name }))}
        drivers={driversList.map(d => ({ id: d.id, name: d.name }))}
        brokers={brokersList.map(b => ({ id: b.id, name: b.name }))}
        defaultPeriodStart={format(lastWeekStart, 'yyyy-MM-dd')}
        defaultPeriodEnd={format(lastWeekEnd, 'yyyy-MM-dd')}
      />
    </div>
  );
}
