import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/blog';
import { getServerLang } from '@/lib/i18n';
import BlogContent from '@/components/BlogContent';

export const metadata: Metadata = {
  title: 'Dump Truck Business Blog — Dispatch, Ticketing & Fleet Management Tips',
  description:
    'Expert tips and guides for dump truck operators, dispatchers, and hauling company owners. Learn how to streamline dispatch, go paperless with digital load tickets, speed up invoicing, and grow your trucking business.',
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    title: 'TruckFlowUS Blog — Dump Truck Business Tips & Guides',
    description: 'Expert tips for dump truck operators and hauling companies. Dispatch, ticketing, invoicing, and fleet management guides.',
    siteName: 'TruckFlowUS',
  },
};

export default function BlogIndex() {
  const lang = getServerLang();
  // Try to get posts in the user's language, fall back to English
  let posts = getAllPosts(lang);
  if (posts.length === 0 && lang === 'es') {
    posts = getAllPosts('en');
  }

  // Pass serializable data to the client component
  const postSummaries = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    date: p.date,
    tags: p.tags,
  }));

  return <BlogContent posts={postSummaries} />;
}
