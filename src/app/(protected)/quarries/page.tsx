export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import QuarryDashboard from './QuarryDashboard';

export default async function QuarriesPage() {
  const session = await requireSession();
  const lang = getServerLang();

  const quarries = await prisma.quarry.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: 'asc' },
  });

  const serialized = quarries.map((q: any) => ({
    id: q.id,
    name: q.name,
    phone: q.phone,
    email: q.email,
    contactPerson: q.contactPerson,
    website: q.website,
    pricingUrl: q.pricingUrl,
    address: q.address,
    city: q.city,
    state: q.state,
    zip: q.zip,
    lat: q.lat,
    lng: q.lng,
    hoursOfOp: q.hoursOfOp,
    materials: q.materials as { name: string; pricePerUnit: number | null; unit: string; notes: string }[],
    notes: q.notes,
    active: q.active,
  }));

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">
            {lang === 'es' ? 'Directorio' : 'Directory'}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {lang === 'es' ? 'Minas y Canteras' : 'Mines & Quarries'}
          </h1>
        </div>
      </header>

      <QuarryDashboard quarries={serialized} />
    </div>
  );
}
