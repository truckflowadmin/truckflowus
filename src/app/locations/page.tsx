import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Dump Truck Dispatch Software — Service Areas',
  description:
    'TruckFlowUS serves dump truck hauling companies across the United States. Find dispatch, digital ticketing, and invoicing software tailored for your city.',
  alternates: { canonical: '/locations' },
};

const CITIES = [
  { slug: 'cape-coral-fl', city: 'Cape Coral', stateCode: 'FL' },
  { slug: 'miami-fl', city: 'Miami', stateCode: 'FL' },
  { slug: 'houston-tx', city: 'Houston', stateCode: 'TX' },
  { slug: 'dallas-tx', city: 'Dallas', stateCode: 'TX' },
  { slug: 'atlanta-ga', city: 'Atlanta', stateCode: 'GA' },
  { slug: 'charlotte-nc', city: 'Charlotte', stateCode: 'NC' },
  { slug: 'phoenix-az', city: 'Phoenix', stateCode: 'AZ' },
  { slug: 'los-angeles-ca', city: 'Los Angeles', stateCode: 'CA' },
];

export default function LocationsIndex() {
  return (
    <div className="min-h-screen bg-diesel text-white">
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

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">
          Dump Truck Dispatch Software — Service Areas
        </h1>
        <p className="text-steel-300 text-lg mb-12 max-w-2xl">
          TruckFlowUS powers dump truck hauling companies across the country. Whether you haul
          fill dirt in Florida or aggregate in Arizona, our dispatch, ticketing, and invoicing
          platform is built for your market.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {CITIES.map((c) => (
            <Link
              key={c.slug}
              href={`/locations/${c.slug}`}
              className="block border border-steel-800 rounded-lg p-6 hover:border-safety/60 hover:bg-steel-900/40 transition-colors"
            >
              <h2 className="text-xl font-bold mb-1">
                {c.city}, {c.stateCode}
              </h2>
              <p className="text-sm text-steel-400">
                Dump truck dispatch software for {c.city} hauling companies
              </p>
            </Link>
          ))}
        </div>

        <div className="mt-16 text-center">
          <p className="text-steel-400 mb-6">
            Don&apos;t see your city? TruckFlowUS works anywhere in the US.
          </p>
          <Link
            href="/signup"
            className="inline-block bg-safety text-diesel font-bold px-8 py-3 rounded-lg hover:bg-safety-dark transition-colors"
          >
            Start Your Free Trial
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
