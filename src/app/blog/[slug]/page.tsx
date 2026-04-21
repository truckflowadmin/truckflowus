import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { getServerLang } from '@/lib/i18n';
import BlogPostContent from '@/components/BlogPostContent';

export function generateStaticParams() {
  // Generate params for both EN and ES posts
  const enPosts = getAllPosts('en').map((post) => ({ slug: post.slug }));
  const esPosts = getAllPosts('es').map((post) => ({ slug: post.slug }));
  const slugs = new Set([...enPosts.map(p => p.slug), ...esPosts.map(p => p.slug)]);
  return Array.from(slugs).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const lang = getServerLang();
  const post = getPostBySlug(params.slug, lang) || getPostBySlug(params.slug, 'en');
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
    },
  };
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const lang = getServerLang();
  const post = getPostBySlug(params.slug, lang) || getPostBySlug(params.slug, 'en');
  if (!post) notFound();

  const allPosts = getAllPosts(lang).length > 0 ? getAllPosts(lang) : getAllPosts('en');
  const currentIdx = allPosts.findIndex((p) => p.slug === post.slug);
  const nextPost = allPosts[currentIdx + 1] ?? null;
  const prevPost = allPosts[currentIdx - 1] ?? null;

  // Article JSON-LD — kept in English for SEO
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { '@type': 'Organization', name: 'TruckFlowUS' },
    publisher: {
      '@type': 'Organization',
      name: 'TruckFlowUS',
      logo: { '@type': 'ImageObject', url: 'https://truckflowus.com/icon-192.png' },
    },
    mainEntityOfPage: `https://truckflowus.com/blog/${post.slug}`,
  };

  return (
    <>
      {/* Article JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <BlogPostContent
        post={{
          slug: post.slug,
          title: post.title,
          description: post.description,
          date: post.date,
          tags: post.tags,
          html: post.html,
        }}
        prevPost={prevPost ? { slug: prevPost.slug, title: prevPost.title } : null}
        nextPost={nextPost ? { slug: nextPost.slug, title: nextPost.title } : null}
      />
    </>
  );
}
