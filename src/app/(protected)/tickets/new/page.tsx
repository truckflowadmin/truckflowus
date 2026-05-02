import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { FEATURES, hasFeature } from '@/lib/features';
import { NewTicketForm } from './NewTicketForm';

export default async function NewTicketPage() {
  const session = await requireSession();
  const [drivers, customers, materials, brokers, company] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.companyId, active: true },
      include: { assignedTruck: { select: { truckNumber: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.customer.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.material.findMany({ where: { companyId: session.companyId }, orderBy: { name: 'asc' } }),
    prisma.broker.findMany({ where: { companyId: session.companyId, active: true }, orderBy: { name: 'asc' } }),
    prisma.company.findUnique({ where: { id: session.companyId } }),
  ]);

  const showBrokers = await hasFeature(session.companyId, FEATURES.VIEW_BROKERS);

  return (
    <div className="p-4 md:p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/tickets" className="text-sm text-steel-500 hover:text-steel-800">← Tickets</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">New Ticket</h1>
      </header>

      <NewTicketForm
        drivers={drivers.map((d) => ({ id: d.id, name: d.name, truckNumber: (d as any).assignedTruck?.truckNumber ?? null }))}
        customers={customers.map((c) => ({ id: c.id, name: c.name }))}
        materials={materials.map((m) => m.name)}
        brokers={showBrokers ? brokers.map((b) => ({ id: b.id, name: b.name })) : []}
        defaultRate={company?.defaultRate ? Number(company.defaultRate).toFixed(2) : ''}
      />
    </div>
  );
}
