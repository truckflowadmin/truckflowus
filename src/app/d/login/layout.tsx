import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Driver Login',
  description:
    'Log in to your TruckFlowUS driver portal. View assigned jobs, submit tickets, and manage your loads from your phone.',
};

export default function DriverLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
