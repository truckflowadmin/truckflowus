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
  return <HomeContent />;
}
