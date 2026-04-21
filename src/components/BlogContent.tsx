'use client';

import Link from 'next/link';
import { usePublicLang } from '@/lib/usePublicLang';
import PublicLanguageToggle from '@/components/PublicLanguageToggle';

interface PostSummary {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
}

export default function BlogContent({ posts }: { posts: PostSummary[] }) {
  const { lang, t } = usePublicLang();

  return (
    <div className="min-h-screen bg-diesel text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-steel-800 bg-diesel/95 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-safety rounded flex items-center justify-center font-black text-diesel text-lg">
              TF
            </div>
            <span className="text-xl font-bold tracking-tight">TruckFlowUS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="text-sm font-medium text-safety px-3 py-2"
            >
              {t('pub.nav.blog')}
            </Link>
            <PublicLanguageToggle />
            <Link
              href="/signup"
              className="text-sm font-semibold bg-safety text-diesel px-4 py-2 rounded-md hover:bg-safety-dark transition-colors"
            >
              {t('pub.nav.startTrial')}
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <header className="max-w-4xl mx-auto px-6 pt-16 pb-12">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          {t('pub.blog.title')} <span className="text-safety">{t('pub.blog.titleAccent')}</span>
        </h1>
        <p className="mt-4 text-lg text-steel-400 max-w-2xl">
          {t('pub.blog.subtitle')}
        </p>
      </header>

      {/* Posts */}
      <main className="max-w-4xl mx-auto px-6 pb-20">
        {posts.length === 0 ? (
          <p className="text-steel-500">{t('pub.blog.noPosts')}</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="bg-steel-900/50 border border-steel-800 rounded-xl p-6 hover:border-steel-700 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs text-steel-500 mb-3">
                  <time dateTime={post.date}>
                    {new Date(post.date + 'T00:00:00').toLocaleDateString(
                      lang === 'es' ? 'es-US' : 'en-US',
                      { year: 'numeric', month: 'long', day: 'numeric' },
                    )}
                  </time>
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-safety/10 text-safety px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <Link href={`/blog/${post.slug}`} className="group">
                  <h2 className="text-xl font-bold group-hover:text-safety transition-colors mb-2">
                    {post.title}
                  </h2>
                </Link>
                <p className="text-steel-400 text-sm leading-relaxed mb-4">
                  {post.description}
                </p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="text-sm font-medium text-safety hover:text-safety-dark transition-colors"
                >
                  {t('pub.blog.readMore')}
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-steel-800">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-steel-500">
          <Link href="/" className="hover:text-steel-300 transition-colors">
            {t('pub.nav.backHome')}
          </Link>
          <p className="text-xs text-steel-600">
            &copy; {new Date().getFullYear()} TruckFlowUS. {t('pub.nav.allRights')}
          </p>
        </div>
      </footer>
    </div>
  );
}
