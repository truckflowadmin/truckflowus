import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'TruckFlowUS — My Jobs',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
