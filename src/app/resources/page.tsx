'use client';

import Link from 'next/link';
import { usePublicLang } from '@/lib/usePublicLang';
import PublicLanguageToggle from '@/components/PublicLanguageToggle';

const DISPATCHER_ICON = (
  <svg className="w-8 h-8 text-safety" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
  </svg>
);

const DRIVER_ICON = (
  <svg className="w-8 h-8 text-safety" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h3.75L8.25 9h6l1.125 5.25h3.75M21 14.25V9.75a1.125 1.125 0 00-1.125-1.125h-2.25L16.5 3.75H12" />
  </svg>
);

const DOWNLOAD_ICON = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

interface GuideData {
  titleKey: string;
  descKey: string;
  fileEn: string;
  fileEs: string;
  icon: React.ReactNode;
  slides: number;
  audienceKey: string;
}

const GUIDES: GuideData[] = [
  {
    titleKey: 'pub.resources.dispatcherGuide',
    descKey: 'pub.resources.dispatcherDesc',
    fileEn: '/TruckFlowUS-Dispatcher-Guide.pptx',
    fileEs: '/TruckFlowUS-Guia-Despachador.pptx',
    icon: DISPATCHER_ICON,
    slides: 10,
    audienceKey: 'pub.resources.dispatchersAdmins',
  },
  {
    titleKey: 'pub.resources.driverGuide',
    descKey: 'pub.resources.driverDesc',
    fileEn: '/TruckFlowUS-Driver-Guide.pptx',
    fileEs: '/TruckFlowUS-Guia-Conductor.pptx',
    icon: DRIVER_ICON,
    slides: 9,
    audienceKey: 'pub.resources.drivers',
  },
];

export default function ResourcesPage() {
  const { t } = usePublicLang();

  return (
    <div className="min-h-screen bg-diesel text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-steel-800 bg-diesel/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-6 py-4">
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
            <Link
              href="/contact"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              {t('pub.nav.contact')}
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
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
          {t('pub.resources.title')} <span className="text-safety">{t('pub.resources.titleAccent')}</span>
        </h1>
        <p className="text-steel-400 text-lg leading-relaxed max-w-2xl">
          {t('pub.resources.subtitle')}
        </p>
      </div>

      {/* Guides */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="space-y-8">
          {GUIDES.map((guide) => (
            <div
              key={guide.titleKey}
              className="bg-steel-900/60 border border-steel-800 rounded-xl p-6 sm:p-8"
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 bg-steel-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  {guide.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{t(guide.titleKey)}</h2>
                  <p className="text-sm text-steel-500 mt-0.5">
                    {guide.slides} {t('pub.resources.slides')} &middot; {t('pub.resources.for')} {t(guide.audienceKey)}
                  </p>
                </div>
              </div>

              <p className="text-steel-400 text-sm leading-relaxed mb-6">
                {t(guide.descKey)}
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* English */}
                <a
                  href={guide.fileEn}
                  download
                  className="inline-flex items-center justify-center gap-2 bg-safety text-diesel font-bold text-sm px-6 py-3 rounded-lg hover:bg-safety-dark transition-colors"
                >
                  {DOWNLOAD_ICON}
                  {t('pub.resources.downloadEn')}
                </a>

                {/* Spanish */}
                <a
                  href={guide.fileEs}
                  download
                  className="inline-flex items-center justify-center gap-2 bg-steel-800 text-white font-bold text-sm px-6 py-3 rounded-lg hover:bg-steel-700 transition-colors border border-steel-700"
                >
                  {DOWNLOAD_ICON}
                  {t('pub.resources.downloadEs')}
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-steel-900/40 border border-steel-800 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold mb-2">{t('pub.resources.needHelp')}</h3>
          <p className="text-steel-400 mb-6">
            {t('pub.resources.needHelpDesc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="text-sm font-semibold bg-steel-800 text-white px-5 py-2.5 rounded-lg hover:bg-steel-700 transition-colors"
            >
              {t('pub.footer.contactUs')}
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-safety text-diesel px-5 py-2.5 rounded-lg hover:bg-safety-dark transition-colors"
            >
              {t('pub.nav.startTrial')}
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-steel-800">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-steel-500">
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
