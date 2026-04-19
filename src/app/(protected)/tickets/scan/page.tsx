import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import BulkScanForm from './BulkScanForm';

export const dynamic = 'force-dynamic';

export default async function BulkScanPage() {
  const session = await requireSession();

  const [customers, drivers, materials, brokers, company] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.driver.findMany({
      where: { companyId: session.companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.material.findMany({
      where: { companyId: session.companyId },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
    prisma.broker.findMany({
      where: { companyId: session.companyId, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.company.findUnique({
      where: { id: session.companyId },
      select: { name: true },
    }),
  ]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <BulkScanForm
        customers={customers}
        drivers={drivers}
        materials={materials.map((m) => m.name)}
        brokers={brokers}
        companyName={company?.name ?? ''}
      />
    </div>
  );
}
