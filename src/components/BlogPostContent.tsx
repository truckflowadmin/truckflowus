'use client';

import Link from 'next/link';
import { usePublicLang } from '@/lib/usePublicLang';
import PublicLanguageToggle from '@/components/PublicLanguageToggle';

interface PostData {
  slug: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  html: string;
}

interface NavPost {
  slug: string;
  title: string;
}

interface RelatedPost {
  slug: string;
  title: string;
  description: string;
  date: string;
}

export default function BlogPostContent({
  post,
  prevPost,
  nextPost,
  relatedPosts = [],
}: {
  post: PostData;
  prevPost: NavPost | null;
  nextPost: NavPost | null;
  relatedPosts?: RelatedPost[];
}) {
  const { lang, t } = usePublicLang();

  return (
    <div className="min-h-screen bg-diesel text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-steel-800 bg-diesel/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-safety rounded flex items-center justify-center font-black text-diesel text-lg">
              TF
            </div>
            <span className="text-xl font-bold tracking-tight">TruckFlowUS</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/blog"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
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

      {/* Article */}
      <article className="max-w-3xl mx-auto px-6 pt-16 pb-20">
        <div className="mb-8">
          <Link
            href="/blog"
            className="text-sm text-steel-500 hover:text-steel-300 transition-colors"
          >
            {t('pub.blog.backToBlog')}
          </Link>
        </div>

        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-3 text-xs text-steel-500 mb-4">
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
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            {post.title}
          </h1>
        </header>

        {/* Rendered markdown */}
        <div
          className="prose prose-invert prose-steel max-w-none
            [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-white
            [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-white
            [&_p]:text-steel-300 [&_p]:leading-relaxed [&_p]:mb-4
            [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-steel-300
            [&_li]:mb-2
            [&_strong]:text-white
            [&_a]:text-safety [&_a]:underline [&_a:hover]:text-safety-dark
            [&_pre]:bg-steel-900 [&_pre]:border [&_pre]:border-steel-800 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:mb-4
            [&_code]:text-sm [&_code]:text-steel-300
            [&_hr]:border-steel-800 [&_hr]:my-8"
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        {/* CTA */}
        <div className="mt-16 bg-steel-900/60 border border-steel-800 rounded-xl p-8 text-center">
          <h2 className="text-xl font-bold mb-2">
            {lang === 'en'
              ? 'Ready to streamline your dump truck operation?'
              : '¿Listo para optimizar su operación de camiones?'}
          </h2>
          <p className="text-steel-400 text-sm mb-6">
            {lang === 'en'
              ? 'Try TruckFlowUS free — no credit card required.'
              : 'Pruebe TruckFlowUS gratis — sin tarjeta de crédito.'}
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center justify-center bg-safety text-diesel font-bold text-sm px-8 py-3 rounded-lg hover:bg-safety-dark transition-colors"
          >
            {lang === 'en' ? 'Get Started Free' : 'Empiece Gratis'}
          </Link>
        </div>

        {/* Related Articles */}
        {relatedPosts.length > 0 && (
          <div className="mt-14">
            <h3 className="text-lg font-bold mb-5">
              {lang === 'en' ? 'Related Articles' : 'Artículos Relacionados'}
            </h3>
            <div className="grid sm:grid-cols-3 gap-4">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  className="bg-steel-900/40 border border-steel-800 rounded-lg p-4 hover:border-safety/40 transition-colors group"
                >
                  <time className="text-xs text-steel-600" dateTime={rp.date}>
                    {new Date(rp.date + 'T00:00:00').toLocaleDateString(
                      lang === 'es' ? 'es-US' : 'en-US',
                      { month: 'short', day: 'numeric', year: 'numeric' },
                    )}
                  </time>
                  <p className="text-sm font-semibold mt-1.5 group-hover:text-safety transition-colors leading-snug">
                    {rp.title}
                  </p>
                  <p className="text-xs text-steel-500 mt-1.5 line-clamp-2">{rp.description}</p>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Prev / Next */}
        {(prevPost || nextPost) && (
          <div className="mt-12 grid sm:grid-cols-2 gap-4">
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="bg-steel-900/30 border border-steel-800 rounded-lg p-4 hover:border-steel-700 transition-colors"
              >
                <span className="text-xs text-steel-500">
                  {lang === 'en' ? '← Newer' : '← Más reciente'}
                </span>
                <p className="text-sm font-medium mt-1">{prevPost.title}</p>
              </Link>
            ) : (
              <div />
            )}
            {nextPost && (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="bg-steel-900/30 border border-steel-800 rounded-lg p-4 hover:border-steel-700 transition-colors text-right"
              >
                <span className="text-xs text-steel-500">
                  {lang === 'en' ? 'Older →' : 'Anterior →'}
                </span>
                <p className="text-sm font-medium mt-1">{nextPost.title}</p>
              </Link>
            )}
          </div>
        )}
      </article>

      {/* Footer */}
      <footer className="border-t border-steel-800">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-steel-500">
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
