import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us — Dump Truck Dispatch Software Support',
  description: 'Get in touch with the TruckFlowUS team. Questions about dump truck dispatch software, digital load tickets, fleet management, or invoicing? We\'re here to help.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    title: 'Contact TruckFlowUS — Dump Truck Software Support',
    description: 'Get in touch with the TruckFlowUS team for questions about dispatch, ticketing, and fleet management.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
