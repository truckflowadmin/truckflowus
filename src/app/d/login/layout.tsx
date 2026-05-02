import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Driver Login — TruckFlowUS Driver Portal',
  description:
    'Log in to your TruckFlowUS driver portal. View assigned jobs, submit load tickets, upload photos, and manage your deliveries from your phone — no app download required.',
  alternates: { canonical: '/d/login' },
  openGraph: {
    type: 'website',
    title: 'Driver Login — TruckFlowUS',
    description: 'Access your dump truck driver portal. View jobs, submit tickets, and track loads from your phone.',
  },
};

export default function DriverLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
