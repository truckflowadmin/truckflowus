export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang } from '@/lib/i18n';
import QuarryDirectory from './QuarryDirectory';

export default async function QuarriesPage() {
  const session = await requireSession();
  const lang = getServerLang();

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { address: true, city: true, state: true, zip: true },
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">
          {lang === 'es' ? 'Directorio' : 'Directory'}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          {lang === 'es' ? 'Minas y Canteras' : 'Mines & Quarries'}
        </h1>
        <p className="text-sm text-steel-500 mt-1">
          {lang === 'es'
            ? 'Directorio de canteras y minas cercanas. Contacta para precios actualizados.'
            : 'Directory of nearby quarries and mines. Contact for current pricing.'}
        </p>
      </header>

      <QuarryDirectory
        companyCity={company?.city ?? null}
        companyState={company?.state ?? null}
      />
    </div>
  );
}
