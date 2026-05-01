export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang } from '@/lib/i18n';
import QuarryDirectory from './QuarryDirectory';

/* ── Server-side geocoding ────────────────────────────── */
async function geocodeOnServer(
  address: string | null,
  city: string | null,
  state: string | null,
  zip: string | null
): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state, zip].filter(Boolean).join(', ');
  if (!query.trim()) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'us');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TruckFlowUS/1.0 (dispatch@truckflowus.com)' },
      next: { revalidate: 86400 }, // cache for 24h — address rarely changes
    });

    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* ignore */ }
  return null;
}

export default async function QuarriesPage() {
  const session = await requireSession();
  const lang = getServerLang();

  const company = await prisma.company.findUnique({
    where: { id: session.companyId },
    select: { address: true, city: true, state: true, zip: true },
  });

  // Geocode company address server-side for reliable "You" marker
  const coords = await geocodeOnServer(
    company?.address ?? null,
    company?.city ?? null,
    company?.state ?? null,
    company?.zip ?? null
  );

  // Fetch quarries from DB
  const quarries = await prisma.quarry.findMany({
    where: { companyId: session.companyId, active: true },
    orderBy: { name: 'asc' },
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
            ? 'Encuentra canteras y minas cercanas. Busca sugerencias o agrega manualmente.'
            : 'Find nearby quarries and mines. Search for suggestions or add manually.'}
        </p>
      </header>

      <QuarryDirectory
        quarries={quarries as any}
        companyCity={company?.city ?? null}
        companyState={company?.state ?? null}
        companyAddress={company?.address ?? null}
        companyZip={company?.zip ?? null}
        companyLat={coords?.lat ?? null}
        companyLng={coords?.lng ?? null}
      />
    </div>
  );
}
