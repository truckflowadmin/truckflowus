import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession, landingPathForUser } from '@/lib/auth';
import HomeContent from '@/components/HomeContent';

export const metadata: Metadata = {
  title: 'TruckFlowUS — Dump Truck Dispatch Software | Ticketing, Invoicing & Fleet Management',
  description:
    'Best dump truck dispatch software for hauling companies. Digital load tickets, real-time fleet tracking, automated invoicing, driver mobile app, and AI ticket scanning. Replace paper tickets and spreadsheets. Start free — no credit card required.',
  alternates: { canonical: '/' },
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is dump truck dispatch software?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Dump truck dispatch software is a digital platform that helps hauling companies manage load tickets, dispatch drivers, track fleets in real time, and generate invoices — replacing paper tickets and spreadsheets with a single app.',
      },
    },
    {
      '@type': 'Question',
      name: 'How much does TruckFlowUS cost?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'TruckFlowUS offers a free trial with no credit card required. Paid plans start at affordable monthly rates based on fleet size, with options for small owner-operators up to large hauling companies.',
      },
    },
    {
      '@type': 'Question',
      name: 'Do drivers need to download an app?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. Drivers access TruckFlowUS through a mobile-optimized web portal — no app download required. They can view assigned jobs, submit tickets, upload photos, and track loads directly from their phone browser.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I switch from paper tickets to digital tickets?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. TruckFlowUS includes AI-powered ticket scanning that lets you photograph paper tickets and automatically extract the data. You can run paper and digital tickets side by side while transitioning.',
      },
    },
    {
      '@type': 'Question',
      name: 'Does TruckFlowUS support invoicing and payroll?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. TruckFlowUS automatically generates PDF invoices from completed load tickets, manages broker trip sheets, calculates driver settlements, and prints payroll checks — all from one platform.',
      },
    },
  ],
};

export default async function Home() {
  try {
    const session = await getSession();
    if (session) {
      const landing = await landingPathForUser(session.role, session.companyId);
      redirect(landing);
    }
  } catch (e: any) {
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    console.error('[home] getSession failed, showing landing page:', e.message);
  }
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomeContent />
    </>
  );
}
