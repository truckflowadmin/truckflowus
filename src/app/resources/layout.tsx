import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Free Guides — Dump Truck Dispatch & Driver Training Resources',
  description: 'Download free dispatcher and driver training guides for TruckFlowUS. Step-by-step walkthroughs for dump truck dispatch software, load ticketing, and fleet management. Available in English and Spanish.',
  alternates: { canonical: '/resources' },
  openGraph: {
    type: 'website',
    title: 'Free Dump Truck Dispatch Training Guides — TruckFlowUS',
    description: 'Download free dispatcher and driver training guides. Available in English and Spanish.',
  },
};

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
