import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://truckflowus.com'),
  title: {
    default: 'TruckFlowUS — Dump Truck Ticketing and Dispatch',
    template: '%s | TruckFlowUS',
  },
  description:
    'Ticketing, dispatch, and invoicing software for dump truck operators. Manage jobs, drivers, customers, and billing from one platform.',
  openGraph: {
    type: 'website',
    siteName: 'TruckFlowUS',
    title: 'TruckFlowUS — Dump Truck Ticketing and Dispatch',
    description:
      'Ticketing, dispatch, and invoicing software for dump truck operators. Manage jobs, drivers, customers, and billing from one platform.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'TruckFlowUS' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TruckFlowUS — Dump Truck Ticketing and Dispatch',
    description:
      'Ticketing, dispatch, and invoicing software for dump truck operators.',
    images: ['/og-image.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
