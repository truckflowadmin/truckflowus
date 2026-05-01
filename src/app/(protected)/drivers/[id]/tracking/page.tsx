import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import DriverTrackingHistory from '@/components/DriverTrackingHistory';

export default async function DriverTrackingPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const driver = await prisma.driver.findFirst({
    where: { id: params.id, companyId: session.companyId },
    select: { id: true, name: true, truckNumber: true },
  });
  if (!driver) notFound();

  return (
    <div className="p-8 max-w-7xl">
      <header className="mb-6">
        <Link href="/drivers" className="text-sm text-steel-500 hover:text-steel-800">← Drivers</Link>
        <div className="flex items-center gap-4 mt-1">
          <h1 className="text-3xl font-bold tracking-tight">{driver.name}</h1>
          {driver.truckNumber && (
            <span className="text-sm bg-steel-100 text-steel-600 px-2 py-0.5 rounded">{driver.truckNumber}</span>
          )}
        </div>
        {/* Sub-nav: Profile / Tracking */}
        <div className="flex items-center gap-1 mt-4 border-b border-steel-200">
          <Link
            href={`/drivers/${driver.id}/edit`}
            className="px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-steel-500 hover:text-steel-700 hover:border-steel-300 -mb-px"
          >
            Profile
          </Link>
          <span className="px-4 py-2.5 text-sm font-medium border-b-2 border-safety text-steel-900 -mb-px">
            📍 Tracking
          </span>
        </div>
      </header>

      <DriverTrackingHistory driverId={driver.id} />
    </div>
  );
}
