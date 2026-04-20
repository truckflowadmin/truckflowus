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
    'Ticketing, dispatch, and invoicing software for dump truck operators.',
  sameAs: [],
};

const softwareJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TruckFlowUS',
  url: siteUrl,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'All-in-one ticketing, dispatch, invoicing, and fleet management platform for dump truck operators and hauling companies.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free trial — no credit card required',
  },
  featureList: [
    'Load ticket management',
    'Job dispatch and tracking',
    'Driver mobile portal',
    'PDF invoicing',
    'Trip sheet generation',
    'Fleet and maintenance tracking',
    'AI-powered ticket scanning',
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'TruckFlowUS — Dump Truck Ticketing and Dispatch',
    template: '%s | TruckFlowUS',
  },
  description:
    'Ticketing, dispatch, and invoicing software for dump truck operators. Manage jobs, drivers, customers, and billing from one platform.',
  keywords: [
    'dump truck software',
    'trucking dispatch software',
    'load ticket management',
    'hauling invoicing',
    'fleet management',
    'dump truck dispatch',
    'trucking company software',
    'driver mobile portal',
    'trip sheet generator',
    'dump truck ticketing',
  ],
  authors: [{ name: 'TruckFlowUS' }],
  creator: 'TruckFlowUS',
  publisher: 'TruckFlowUS',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'TruckFlowUS',
    title: 'TruckFlowUS — Dump Truck Ticketing and Dispatch',
    description:
      'Ticketing, dispatch, and invoicing software for dump truck operators. Manage jobs, drivers, customers, and billing from one platform.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TruckFlowUS — Dump Truck Ticketing and Dispatch' }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruckFlowUS — Dump Truck Ticketing and Dispatch',
    description:
      'Ticketing, dispatch, and invoicing software for dump truck operators.',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
