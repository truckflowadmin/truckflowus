import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import NewJobForm from './NewJobForm';

export const dynamic = 'force-dynamic';

export default async function NewJobPage() {
  const session = await requireSession();
  const companyId = session.companyId;

  const [customers, drivers, materials, brokers] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.driver.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, assignedTruck: { select: { truckType: true, truckNumber: true } } },
    }),
    prisma.material.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
    prisma.broker.findMany({
      where: { companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link href="/jobs" className="text-sm text-steel-500 hover:text-steel-700">
        ← Back to Jobs
      </Link>
      <h1 className="text-2xl font-bold text-steel-900 mt-1 mb-6">New Job</h1>
      <div className="panel p-6">
        <NewJobForm
          customers={customers}
          drivers={drivers.map((d) => ({ id: d.id, name: d.name, truckType: d.assignedTruck?.truckType ?? null, truckNumber: d.assignedTruck?.truckNumber ?? null }))}
          materials={materials.map((m) => m.name)}
          brokers={brokers}
        />
      </div>
    </div>
  );
}
