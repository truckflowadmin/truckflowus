'use client';

import Link from 'next/link';

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

const GUIDES = [
  {
    title: 'Dispatcher Guide',
    titleEs: 'Guía del Despachador',
    description:
      'A 10-slide walkthrough covering everything a dispatcher needs — from logging in and navigating the dashboard to creating jobs, managing tickets, generating invoices, and running reports.',
    descriptionEs:
      'Una guía de 10 diapositivas que cubre todo lo que un despachador necesita — desde iniciar sesión y navegar el panel hasta crear trabajos, gestionar tickets, generar facturas e informes.',
    fileEn: '/TruckFlowUS-Dispatcher-Guide.pptx',
    fileEs: '/TruckFlowUS-Guia-Despachador.pptx',
    icon: DISPATCHER_ICON,
    slides: 10,
    audience: 'Dispatchers & Admins',
    audienceEs: 'Despachadores y Administradores',
  },
  {
    title: 'Driver Guide',
    titleEs: 'Guía del Conductor',
    description:
      'A 9-slide walkthrough for drivers — how to log in via your unique link, view and accept jobs, submit load tickets, upload photos, manage your profile, and track pay history.',
    descriptionEs:
      'Una guía de 9 diapositivas para conductores — cómo iniciar sesión con su enlace único, ver y aceptar trabajos, enviar tickets de carga, subir fotos, y ver historial de pagos.',
    fileEn: '/TruckFlowUS-Driver-Guide.pptx',
    fileEs: '/TruckFlowUS-Guia-Conductor.pptx',
    icon: DRIVER_ICON,
    slides: 9,
    audience: 'Drivers',
    audienceEs: 'Conductores',
  },
];

export default function ResourcesPage() {
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
              Blog
            </Link>
            <Link
              href="/contact"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              Contact
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-safety text-diesel px-4 py-2 rounded-md hover:bg-safety-dark transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-16 pb-12">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">
          Resources & <span className="text-safety">Guides</span>
        </h1>
        <p className="text-steel-400 text-lg leading-relaxed max-w-2xl">
          Download our step-by-step guides to get your team up and running fast. Available in English and Spanish. Share these with your dispatchers and drivers so everyone knows exactly how to use TruckFlowUS.
        </p>
      </div>

      {/* Guides */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="space-y-8">
          {GUIDES.map((guide) => (
            <div
              key={guide.title}
              className="bg-steel-900/60 border border-steel-800 rounded-xl p-6 sm:p-8"
            >
              <div className="flex items-start gap-4 mb-5">
                <div className="w-14 h-14 bg-steel-800 rounded-lg flex items-center justify-center flex-shrink-0">
                  {guide.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold">{guide.title}</h2>
                  <p className="text-sm text-steel-500 mt-0.5">
                    {guide.slides} slides &middot; For {guide.audience}
                  </p>
                </div>
              </div>

              <p className="text-steel-400 text-sm leading-relaxed mb-6">
                {guide.description}
              </p>

              <div className="grid sm:grid-cols-2 gap-3">
                {/* English */}
                <a
                  href={guide.fileEn}
                  download
                  className="inline-flex items-center justify-center gap-2 bg-safety text-diesel font-bold text-sm px-6 py-3 rounded-lg hover:bg-safety-dark transition-colors"
                >
                  {DOWNLOAD_ICON}
                  Download — English
                </a>

                {/* Spanish */}
                <a
                  href={guide.fileEs}
                  download
                  className="inline-flex items-center justify-center gap-2 bg-steel-800 text-white font-bold text-sm px-6 py-3 rounded-lg hover:bg-steel-700 transition-colors border border-steel-700"
                >
                  {DOWNLOAD_ICON}
                  Descargar — Español
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-steel-900/40 border border-steel-800 rounded-xl p-8 text-center">
          <h3 className="text-xl font-bold mb-2">Need more help getting started?</h3>
          <p className="text-steel-400 mb-1">
            Our team is here to help you set up your account and train your crew.
          </p>
          <p className="text-steel-500 text-sm mb-6">
            Nuestro equipo está aquí para ayudarle a configurar su cuenta y capacitar a su equipo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/contact"
              className="text-sm font-semibold bg-steel-800 text-white px-5 py-2.5 rounded-lg hover:bg-steel-700 transition-colors"
            >
              Contact Us
            </Link>
            <Link
              href="/signup"
              className="text-sm font-semibold bg-safety text-diesel px-5 py-2.5 rounded-lg hover:bg-safety-dark transition-colors"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-steel-800">
        <div className="max-w-5xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-steel-500">
          <Link href="/" className="hover:text-steel-300 transition-colors">
            &larr; Back to TruckFlowUS
          </Link>
          <p className="text-xs text-steel-600">
            &copy; {new Date().getFullYear()} TruckFlowUS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
