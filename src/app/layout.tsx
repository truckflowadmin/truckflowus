import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

const siteUrl = process.env.APP_URL || 'https://truckflowus.com';

/* ── JSON-LD Structured Data ── */
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'TruckFlowUS',
  url: siteUrl,
  logo: `${siteUrl}/icon-192.png`,
  description:
    'All-in-one dump truck dispatch software for hauling companies. Digital load tickets, invoicing, fleet management, and driver mobile portal.',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'admin@truckflowus.com',
    contactType: 'customer service',
  },
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TruckFlowUS',
  url: siteUrl,
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Dump Truck Dispatch Software',
  operatingSystem: 'Web',
  description:
    'All-in-one dump truck dispatch software for hauling companies. Manage digital load tickets, real-time dispatch, automated invoicing, fleet tracking, and driver mobile portal from one platform.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free trial — no credit card required',
  },
  featureList: [
    'Digital load ticket management',
    'Real-time dump truck dispatch',
    'Automated PDF invoicing',
    'Driver mobile portal — no app download',
    'AI-powered ticket scanning',
    'Broker trip sheet generation',
    'Fleet and maintenance tracking',
    'Multi-driver job assignment',
    'GPS-verified load tracking',
    'Customer and material management',
    'Payroll and driver settlements',
    'Spanish language support',
  ],
  screenshot: `${siteUrl}/og-image.png`,
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    ratingCount: '24',
    bestRating: '5',
  },
};

const localBusinessJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  '@id': `${siteUrl}/#business`,
  name: 'TruckFlowUS',
  url: siteUrl,
  logo: `${siteUrl}/icon-192.png`,
  image: `${siteUrl}/og-image.png`,
  description: 'Dump truck dispatch software for hauling companies. Digital load tickets, invoicing, fleet tracking, and driver mobile app.',
  telephone: '',
  email: 'admin@truckflowus.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Cape Coral',
    addressRegion: 'FL',
    addressCountry: 'US',
  },
  areaServed: {
    '@type': 'Country',
    name: 'United States',
  },
  priceRange: 'Free–$$',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    opens: '08:00',
    closes: '18:00',
  },
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TruckFlowUS — Dump Truck Dispatch Software | Ticketing & Invoicing',
    template: '%s | TruckFlowUS',
  },
  description:
    'All-in-one dump truck dispatch software for hauling companies. Digital load tickets, real-time fleet tracking, automated invoicing, and driver mobile portal. Replace paper tickets and spreadsheets. Free trial.',
  keywords: [
    'dump truck software',
    'dump truck dispatch software',
    'dump truck ticketing software',
    'hauling company software',
    'load ticket management',
    'digital load tickets',
    'dump truck invoicing',
    'fleet management software',
    'dump truck dispatch',
    'trucking dispatch software',
    'hauling invoicing software',
    'driver mobile portal',
    'trip sheet generator',
    'dump truck business software',
    'aggregate hauling software',
    'e-ticketing dump truck',
    'dump truck fleet management',
    'material hauling dispatch',
    'construction trucking software',
    'dump truck billing software',
    'trip sheet software',
    'load ticket app',
    'truck dispatching app',
    'hauling business software',
    'small trucking company software',
    'dump truck payroll software',
    'driver settlement software',
    'dump truck GPS tracking',
    'construction hauling dispatch',
    'material hauling software',
    'dump truck broker management',
    'dump truck compliance software',
    'dump truck app',
    'trucking software for small business',
    'hauling company management',
    'dump truck accounting software',
    'digital ticket system trucking',
    'dump truck route tracking',
    'construction material hauling app',
    'fleet dispatch software free trial',
  ],
  verification: {
    google: '9fdabdbe40dcc10b',
  },
  authors: [{ name: 'TruckFlowUS' }],
  creator: 'TruckFlowUS',
  publisher: 'TruckFlowUS',
  alternates: {
    canonical: '/',
    languages: {
      'en-US': '/',
      'es': '/?lang=es',
      'x-default': '/',
    },
  },
  openGraph: {
    type: 'website',
    siteName: 'TruckFlowUS',
    title: 'TruckFlowUS — Dump Truck Dispatch Software | Ticketing & Invoicing',
    description:
      'All-in-one dump truck dispatch software for hauling companies. Digital load tickets, real-time fleet tracking, automated invoicing, and driver mobile portal. Free trial.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TruckFlowUS — Dump Truck Ticketing and Dispatch' }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruckFlowUS — Dump Truck Dispatch Software | Ticketing & Invoicing',
    description:
      'All-in-one dump truck dispatch software for hauling companies. Digital load tickets, automated invoicing, and driver mobile portal.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Performance hints — preconnect to critical external origins */}
        <link rel="dns-prefetch" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
