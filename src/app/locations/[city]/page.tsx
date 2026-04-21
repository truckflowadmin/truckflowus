import type { Metadata } from 'next';
import Link from 'next/link';

/* ── City data ── */

interface CityData {
  slug: string;
  city: string;
  state: string;
  stateCode: string;
  description: string;
  materials: string[];
}

const CITIES: CityData[] = [
  {
    slug: 'cape-coral-fl',
    city: 'Cape Coral',
    state: 'Florida',
    stateCode: 'FL',
    description:
      'Cape Coral and the greater Southwest Florida region are experiencing rapid residential and commercial growth, driving consistent demand for fill dirt, shell rock, and crushed concrete. New subdivision build-outs, canal-side lot preparation, and hurricane recovery projects keep dump truck operators busy year-round. Haulers here navigate tight residential streets, seasonal rain delays, and a steady pipeline of land-clearing and grading work.',
    materials: ['Fill dirt', 'Shell rock', 'Crushed concrete', 'Sand', 'Top soil', 'Rip-rap'],
  },
  {
    slug: 'miami-fl',
    city: 'Miami',
    state: 'Florida',
    stateCode: 'FL',
    description:
      'Miami-Dade County is one of the largest construction markets in the Southeast, fueled by high-rise condos, highway widening projects, and massive infrastructure investments like the Signature Bridge. Dump truck fleets haul limerock, asphalt millings, and concrete rubble across congested urban corridors daily. Port Miami expansion and sea-level-resilience projects add additional demand for aggregate and fill material hauling.',
    materials: ['Limerock', 'Asphalt millings', 'Concrete rubble', 'Fill dirt', 'Sand', 'Rip-rap'],
  },
  {
    slug: 'houston-tx',
    city: 'Houston',
    state: 'Texas',
    stateCode: 'TX',
    description:
      'Houston is the fastest-growing metro in the US by population, generating enormous demand for dump truck hauling across residential subdivisions, commercial pads, and TxDOT highway projects. The flat Gulf Coast terrain means massive earthwork for drainage and detention ponds on nearly every job site. Energy-sector facilities, petrochemical plant construction, and flood-control infrastructure keep haulers running six or seven days a week.',
    materials: ['Select fill', 'Crushed limestone', 'Sand', 'Clay', 'Flex base', 'Concrete rubble'],
  },
  {
    slug: 'dallas-tx',
    city: 'Dallas',
    state: 'Texas',
    stateCode: 'TX',
    description:
      'The Dallas-Fort Worth Metroplex is one of the hottest construction corridors in the country, with sprawling master-planned communities, warehouse parks, and major highway expansions like I-35 and the LBJ Express. Dump truck operators haul thousands of tons of crushed stone, select fill, and asphalt daily across the region. Long haul distances between quarries and job sites make efficient dispatching and ticket tracking critical for profitability.',
    materials: ['Crushed stone', 'Select fill', 'Flex base', 'Asphalt', 'Sand', 'Top soil'],
  },
  {
    slug: 'atlanta-ga',
    city: 'Atlanta',
    state: 'Georgia',
    stateCode: 'GA',
    description:
      'Atlanta is a booming Southeast hub for mixed-use development, data center construction, and GDOT infrastructure projects. The hilly red-clay terrain creates significant earthwork requirements on almost every grading job, and haulers regularly move granite aggregate, GAB base, and topsoil across the metro. Film studio construction, Hartsfield-Jackson airport expansion, and new transit corridors provide a deep backlog of hauling work.',
    materials: ['Red clay', 'Granite aggregate', 'GAB base', 'Top soil', 'Concrete rubble', 'Rip-rap'],
  },
  {
    slug: 'charlotte-nc',
    city: 'Charlotte',
    state: 'North Carolina',
    stateCode: 'NC',
    description:
      'Charlotte is one of the fastest-growing cities on the East Coast, with explosive residential construction, light-rail expansion, and a surge of warehouse and distribution center projects. Dump truck operators service quarries throughout the Piedmont region, hauling crushed granite, ABC stone, and red clay to job sites across Mecklenburg and surrounding counties. NCDOT road-widening projects on I-77 and I-485 drive additional steady demand.',
    materials: ['Crushed granite', 'ABC stone', 'Red clay', 'Sand', 'Top soil', 'Asphalt millings'],
  },
  {
    slug: 'phoenix-az',
    city: 'Phoenix',
    state: 'Arizona',
    stateCode: 'AZ',
    description:
      'The Phoenix metro area leads the nation in single-family housing permits, creating relentless demand for dump truck hauling of aggregate, decomposed granite, and select fill. Desert terrain requires extensive site preparation and grading before any vertical construction can begin. ADOT freeway loop expansions, semiconductor fab site prep, and massive master-planned communities in the West Valley ensure hauling volume stays high year-round.',
    materials: ['Aggregate', 'Decomposed granite', 'Select fill', 'Sand', 'Rip-rap', 'Asphalt'],
  },
  {
    slug: 'los-angeles-ca',
    city: 'Los Angeles',
    state: 'California',
    stateCode: 'CA',
    description:
      'Los Angeles County is the largest construction market in the western US, with a constant pipeline of commercial, residential, and public-works projects. Dump truck operators navigate strict emissions regulations, heavy traffic corridors, and complex permitting while hauling aggregate, DG, and import/export soil. Metro rail expansion, wildfire debris removal, and hillside grading projects create specialized hauling needs unique to the LA basin.',
    materials: ['Aggregate base', 'Decomposed granite', 'Import/export soil', 'Sand', 'Asphalt', 'Concrete rubble'],
  },
];

const CITY_MAP = new Map(CITIES.map((c) => [c.slug, c]));

/* ── Static params ── */

export function generateStaticParams() {
  return CITIES.map((c) => ({ city: c.slug }));
}

/* ── Metadata ── */

export function generateMetadata({ params }: { params: { city: string } }): Metadata {
  const data = CITY_MAP.get(params.city);
  if (!data) {
    return { title: 'Location Not Found' };
  }

  const title = `Dump Truck Dispatch Software in ${data.city}, ${data.stateCode} — TruckFlowUS`;
  const description = `TruckFlowUS helps dump truck hauling companies in ${data.city}, ${data.state} manage dispatch, digital load tickets, invoicing, and fleet tracking. Start your free trial today.`;

  return {
    title,
    description,
    alternates: { canonical: `/locations/${data.slug}` },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'TruckFlowUS',
    },
  };
}

/* ── Features ── */

const FEATURES = [
  {
    name: 'Real-Time Dispatch',
    desc: 'Assign drivers to jobs, track load counts, and manage your fleet from one dashboard.',
    icon: '\u{1F4CB}',
  },
  {
    name: 'Digital Load Tickets',
    desc: 'Replace paper tickets with digital entries. Scan, photograph, and auto-extract ticket data with AI.',
    icon: '\u{1F4F1}',
  },
  {
    name: 'Automated Invoicing',
    desc: 'Generate PDF invoices from approved tickets in one click. Track payments and aging.',
    icon: '\u{1F4B0}',
  },
  {
    name: 'Driver Mobile Portal',
    desc: 'Drivers accept jobs, upload ticket photos, and view schedules from any phone — no app download.',
    icon: '\u{1F69A}',
  },
];

/* ── Page component ── */

export default function CityPage({ params }: { params: { city: string } }) {
  const data = CITY_MAP.get(params.city);

  if (!data) {
    return (
      <div className="min-h-screen bg-diesel text-white flex items-center justify-center">
        <p>City not found.</p>
      </div>
    );
  }

  const siteUrl = process.env.APP_URL || 'https://truckflowus.com';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${siteUrl}/locations/${data.slug}#business`,
    name: 'TruckFlowUS',
    url: `${siteUrl}/locations/${data.slug}`,
    logo: `${siteUrl}/icon-192.png`,
    image: `${siteUrl}/og-image.png`,
    description: `Dump truck dispatch software for hauling companies in ${data.city}, ${data.stateCode}. Digital load tickets, invoicing, fleet tracking, and driver mobile portal.`,
    email: 'admin@truckflowus.com',
    address: {
      '@type': 'PostalAddress',
      addressLocality: data.city,
      addressRegion: data.stateCode,
      addressCountry: 'US',
    },
    areaServed: {
      '@type': 'City',
      name: data.city,
      containedInPlace: {
        '@type': 'State',
        name: data.state,
      },
    },
    priceRange: 'Free\u2013$$',
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: '08:00',
      closes: '18:00',
    },
  };

  return (
    <div className="min-h-screen bg-diesel text-white">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-steel-800 bg-diesel/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-safety rounded flex items-center justify-center font-black text-diesel text-lg">
              TF
            </div>
            <span className="text-xl font-bold tracking-tight">TruckFlowUS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              Blog
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              Contact
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-safety text-diesel px-4 py-2 rounded-md hover:bg-safety-dark transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <Link
          href="/locations"
          className="text-sm text-safety hover:underline mb-6 inline-block"
        >
          &larr; All Service Areas
        </Link>

        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-8">
          Dump Truck Dispatch Software in{' '}
          <span className="text-safety">{data.city}, {data.stateCode}</span>
        </h1>

        {/* City-specific content */}
        <section className="space-y-5 text-steel-300 text-lg leading-relaxed mb-16">
          <p>{data.description}</p>

          <p>
            Common materials hauled in the {data.city} market include{' '}
            <strong className="text-white">{data.materials.join(', ')}</strong>. Whether
            you&apos;re running five trucks or fifty, keeping track of every load, every ticket,
            and every invoice is the difference between profit and lost revenue.
          </p>

          <p>
            TruckFlowUS gives {data.city} dump truck operators a single platform to dispatch
            drivers, capture digital load tickets, generate invoices, and manage their fleet —
            all from a browser, with no app download required for drivers. Replace the clipboard,
            the spreadsheet, and the shoebox of paper tickets with one system built specifically
            for hauling companies.
          </p>
        </section>

        {/* Features */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8">
            Everything Your {data.city} Hauling Company Needs
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <div
                key={f.name}
                className="border border-steel-800 rounded-lg p-6 hover:border-safety/40 transition-colors"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-bold mb-2">{f.name}</h3>
                <p className="text-sm text-steel-400">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="text-center bg-steel-900/50 border border-steel-800 rounded-xl p-10">
          <h2 className="text-2xl font-bold mb-3">
            Ready to Streamline Your {data.city} Hauling Operation?
          </h2>
          <p className="text-steel-400 mb-6 max-w-lg mx-auto">
            Join hauling companies across {data.state} who use TruckFlowUS to dispatch faster,
            eliminate paper tickets, and get paid sooner. Free trial — no credit card required.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-safety text-diesel font-bold px-8 py-3 rounded-lg text-lg hover:bg-safety-dark transition-colors"
          >
            Start Your Free Trial
          </Link>
        </section>

        {/* Back link */}
        <div className="mt-12 text-center">
          <Link href="/" className="text-sm text-steel-400 hover:text-white transition-colors">
            &larr; Back to TruckFlowUS Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-steel-800 mt-16">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center text-sm text-steel-500">
          &copy; {new Date().getFullYear()} TruckFlowUS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
