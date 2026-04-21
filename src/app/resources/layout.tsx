import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Resources & Guides — Dump Truck Dispatch Software',
  description:
    'Download free TruckFlowUS guides for dispatchers and drivers. Step-by-step instructions to get your dump truck fleet running with our dispatch and ticketing software.',
  alternates: { canonical: '/resources' },
};

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
