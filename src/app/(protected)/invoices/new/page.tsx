export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import InvoiceGenerateForm from '../InvoiceGenerateForm';

export default async function NewInvoicePage() {
  const session = await requireSession();
  const [customers, brokers] = await Promise.all([
    prisma.customer.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.broker.findMany({ where: { companyId: session.companyId, active: true }, orderBy: { name: 'asc' } }),
  ]);

  const lastWeekStart = startOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });
  const lastWeekEnd = endOfWeek(subWeeks(new Date(), 1), { weekStartsOn: 1 });

  return (
    <div className="p-8 max-w-4xl">
      <header className="mb-6">
        <Link href="/invoices" className="text-sm text-steel-500 hover:text-steel-800">&#8592; Invoices</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">New Invoice</h1>
      </header>

      <InvoiceGenerateForm
        customers={customers.map(c => ({ id: c.id, name: c.name }))}
        brokers={brokers.map(b => ({ id: b.id, name: b.name }))}
        defaultPeriodStart={format(lastWeekStart, 'yyyy-MM-dd')}
        defaultPeriodEnd={format(lastWeekEnd, 'yyyy-MM-dd')}
      />
    </div>
  );
}
