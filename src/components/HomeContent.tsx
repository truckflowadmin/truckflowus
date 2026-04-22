'use client';

import Link from 'next/link';
import { usePublicLang } from '@/lib/usePublicLang';
import PublicLanguageToggle from '@/components/PublicLanguageToggle';

export default function HomeContent() {
  const { lang, t } = usePublicLang();

  return (
    <div className="min-h-screen bg-diesel text-white">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 border-b border-steel-800 bg-diesel/95 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
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
            <Link
              href="/resources"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              {t('pub.nav.resources')}
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-steel-300 hover:text-white transition-colors px-3 py-2"
            >
              {t('pub.nav.login')}
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

      {/* ── Hero ── */}
      <section className="relative overflow-hidden max-w-6xl mx-auto px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
        {/* Truck silhouette background */}
        <div className="absolute right-[-80px] bottom-[-20px] opacity-[0.04] pointer-events-none select-none" aria-hidden="true">
          <svg width="620" height="320" viewBox="0 0 620 320" fill="currentColor">
            {/* Dump truck with raised bed */}
            <rect x="10" y="120" width="260" height="100" rx="8" />
            <polygon points="10,120 50,40 220,40 270,120" />
            <rect x="280" y="140" width="160" height="80" rx="8" />
            <rect x="300" y="100" width="120" height="40" rx="4" />
            <circle cx="80" cy="240" r="36" />
            <circle cx="200" cy="240" r="36" />
            <circle cx="340" cy="240" r="36" />
            <circle cx="400" cy="240" r="36" />
            <rect x="440" y="180" width="60" height="40" rx="4" />
            {/* Exhaust stack */}
            <rect x="280" y="60" width="14" height="80" rx="4" />
            <rect x="274" y="50" width="26" height="16" rx="4" />
          </svg>
        </div>
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-steel-800/60 border border-steel-700 rounded-full px-3 py-1 text-xs font-medium text-steel-300 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            {lang === 'en'
              ? 'Trusted by hauling companies across the U.S.'
              : 'Confiado por empresas de acarreo en todo EE.UU.'}
          </div>
          {lang === 'en' ? (
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Run your dump truck
              <br />
              operation like a
              <br />
              <span className="text-safety">well-oiled machine.</span>
            </h1>
          ) : (
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
              Maneje su operación
              <br />
              de camiones como una
              <br />
              <span className="text-safety">máquina bien aceitada.</span>
            </h1>
          )}
          <p className="mt-6 text-lg sm:text-xl text-steel-400 max-w-xl leading-relaxed">
            {lang === 'en'
              ? 'Ticketing, dispatch, invoicing, and fleet management — all in one platform. Stop juggling spreadsheets. Start moving dirt.'
              : 'Tickets, despacho, facturación y gestión de flota — todo en una plataforma. Deje las hojas de cálculo. Empiece a mover tierra.'}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-safety text-diesel font-bold text-base px-8 py-3.5 rounded-lg hover:bg-safety-dark transition-colors shadow-lg shadow-safety/20"
            >
              {lang === 'en' ? 'Get Started Free' : 'Empiece Gratis'}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center border border-steel-600 text-steel-300 font-medium text-base px-8 py-3.5 rounded-lg hover:border-steel-400 hover:text-white transition-colors"
            >
              {lang === 'en' ? 'Sign In' : 'Iniciar Sesión'}
            </Link>
          </div>
          <p className="mt-4 text-sm text-steel-500">
            {lang === 'en'
              ? 'No credit card required. Set up in under 5 minutes.'
              : 'Sin tarjeta de crédito. Configure en menos de 5 minutos.'}
          </p>
        </div>
      </section>

      {/* ── Social Proof Bar ── */}
      <section className="border-y border-steel-800 bg-steel-900/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-extrabold text-safety">500+</div>
            <div className="text-sm text-steel-400 mt-1">
              {lang === 'en' ? 'Active Drivers' : 'Conductores Activos'}
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-safety">120K+</div>
            <div className="text-sm text-steel-400 mt-1">{t('pub.social.stat2')}</div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-safety">$8M+</div>
            <div className="text-sm text-steel-400 mt-1">
              {lang === 'en' ? 'Invoiced' : 'Facturado'}
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-safety">99.9%</div>
            <div className="text-sm text-steel-400 mt-1">
              {lang === 'en' ? 'Uptime' : 'Disponibilidad'}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative overflow-hidden max-w-6xl mx-auto px-6 py-20 lg:py-28">
        {/* Construction-grade diagonal stripes */}
        <div className="absolute top-0 right-0 opacity-[0.02] pointer-events-none select-none" aria-hidden="true">
          <svg width="500" height="500" viewBox="0 0 500 500" fill="currentColor">
            {[...Array(12)].map((_, i) => (
              <rect key={i} x={-100 + i * 50} y="-50" width="20" height="700" rx="4" transform="rotate(-45 250 250)" />
            ))}
          </svg>
        </div>
        <div className="relative text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {lang === 'en' ? (
              <>Everything you need to<span className="text-safety"> move and manage</span></>
            ) : (
              <>Todo lo que necesita para<span className="text-safety"> mover y administrar</span></>
            )}
          </h2>
          <p className="mt-4 text-steel-400 text-lg">
            {lang === 'en'
              ? 'Built specifically for dump truck operators, haulers, and material transport companies.'
              : 'Creado específicamente para operadores de camiones, transportistas y empresas de transporte de materiales.'}
          </p>
        </div>
        <div className="relative grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            title={t('pub.feat.tickets.title')}
            desc={t('pub.feat.tickets.desc')}
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            title={t('pub.feat.dispatch.title')}
            desc={t('pub.feat.dispatch.desc')}
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            }
            title={t('pub.feat.driver.title')}
            desc={t('pub.feat.driver.desc')}
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            }
            title={t('pub.feat.invoicing.title')}
            desc={t('pub.feat.invoicing.desc')}
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            }
            title={lang === 'en' ? 'Trip Sheets' : 'Hojas de Viaje'}
            desc={lang === 'en'
              ? "Auto-generate broker trip sheets with your logo and their template. Per-truck breakdowns built in."
              : 'Genere hojas de viaje automáticamente con su logo y plantilla del broker. Desglose por camión incluido.'}
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            }
            title={t('pub.feat.fleet.title')}
            desc={t('pub.feat.fleet.desc')}
          />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative overflow-hidden border-y border-steel-800 bg-steel-900/30">
        {/* Convoy silhouette */}
        <div className="absolute left-0 bottom-0 w-full opacity-[0.03] pointer-events-none select-none" aria-hidden="true">
          <svg width="100%" height="200" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax meet" fill="currentColor">
            {/* Truck 1 */}
            <rect x="50" y="60" width="160" height="70" rx="6" />
            <polygon points="50,60 80,20 180,20 210,60" />
            <rect x="220" y="75" width="100" height="55" rx="6" />
            <circle cx="100" cy="145" r="24" />
            <circle cx="180" cy="145" r="24" />
            <circle cx="270" cy="145" r="24" />
            {/* Truck 2 */}
            <rect x="420" y="60" width="160" height="70" rx="6" />
            <polygon points="420,60 450,20 550,20 580,60" />
            <rect x="590" y="75" width="100" height="55" rx="6" />
            <circle cx="470" cy="145" r="24" />
            <circle cx="550" cy="145" r="24" />
            <circle cx="640" cy="145" r="24" />
            {/* Truck 3 */}
            <rect x="790" y="60" width="160" height="70" rx="6" />
            <polygon points="790,60 820,20 920,20 950,60" />
            <rect x="960" y="75" width="100" height="55" rx="6" />
            <circle cx="840" cy="145" r="24" />
            <circle cx="920" cy="145" r="24" />
            <circle cx="1010" cy="145" r="24" />
            {/* Road line */}
            <rect x="0" y="170" width="1200" height="4" rx="2" opacity="0.5" />
          </svg>
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              {lang === 'en' ? (
                <>Up and running in <span className="text-safety">three steps</span></>
              ) : (
                <>Operando en <span className="text-safety">tres pasos</span></>
              )}
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            <StepCard
              step="1"
              title={lang === 'en' ? 'Create your account' : 'Cree su cuenta'}
              desc={lang === 'en'
                ? 'Sign up, name your company, and invite your dispatchers. Takes about 2 minutes.'
                : 'Regístrese, nombre su empresa e invite a sus despachadores. Toma unos 2 minutos.'}
            />
            <StepCard
              step="2"
              title={lang === 'en' ? 'Add drivers and trucks' : 'Agregue conductores y camiones'}
              desc={lang === 'en'
                ? 'Set up your fleet and send each driver a secure link to their mobile portal.'
                : 'Configure su flota y envíe a cada conductor un enlace seguro a su portal móvil.'}
            />
            <StepCard
              step="3"
              title={lang === 'en' ? 'Start dispatching' : 'Empiece a despachar'}
              desc={lang === 'en'
                ? 'Create jobs, assign drivers, track loads, and invoice customers from one dashboard.'
                : 'Cree trabajos, asigne conductores, rastree cargas y facture clientes desde un solo panel.'}
            />
          </div>
        </div>
      </section>

      {/* ── Dispatcher + Driver Split ── */}
      <section className="relative overflow-hidden max-w-6xl mx-auto px-6 py-20 lg:py-28">
        {/* Tire track pattern */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 opacity-[0.025] pointer-events-none select-none" aria-hidden="true">
          <svg width="400" height="900" viewBox="0 0 400 900" fill="currentColor">
            {/* Two parallel tire tracks */}
            {[...Array(18)].map((_, i) => (
              <g key={i}>
                <rect x="170" y={i * 50} width="20" height="35" rx="3" />
                <rect x="210" y={i * 50} width="20" height="35" rx="3" />
              </g>
            ))}
          </svg>
        </div>
        <div className="relative grid lg:grid-cols-2 gap-12">
          <div className="bg-steel-900/60 border border-steel-800 rounded-xl p-8">
            <div className="text-xs uppercase tracking-widest text-safety font-semibold mb-3">
              {lang === 'en' ? 'For Dispatchers' : 'Para Despachadores'}
            </div>
            <h3 className="text-2xl font-bold mb-4">
              {lang === 'en' ? 'Command center for your operation' : 'Centro de mando para su operación'}
            </h3>
            <ul className="space-y-3 text-steel-300">
              {lang === 'en' ? (
                <>
                  <ListItem>Full dashboard with today&apos;s stats and recent activity</ListItem>
                  <ListItem>Create and manage jobs, tickets, customers, and brokers</ListItem>
                  <ListItem>Generate invoices and trip sheets with one click</ListItem>
                  <ListItem>Reports with revenue, job, and driver performance breakdowns</ListItem>
                  <ListItem>SMS notifications to drivers and brokers</ListItem>
                  <ListItem>AI-powered ticket scanning to eliminate manual data entry</ListItem>
                </>
              ) : (
                <>
                  <ListItem>Panel completo con estadísticas del día y actividad reciente</ListItem>
                  <ListItem>Cree y administre trabajos, tickets, clientes y brokers</ListItem>
                  <ListItem>Genere facturas y hojas de viaje con un clic</ListItem>
                  <ListItem>Reportes con desglose de ingresos, trabajos y rendimiento de conductores</ListItem>
                  <ListItem>Notificaciones SMS a conductores y brokers</ListItem>
                  <ListItem>Escaneo de tickets con IA para eliminar la entrada manual de datos</ListItem>
                </>
              )}
            </ul>
          </div>
          <div className="bg-steel-900/60 border border-steel-800 rounded-xl p-8">
            <div className="text-xs uppercase tracking-widest text-safety font-semibold mb-3">
              {lang === 'en' ? 'For Drivers' : 'Para Conductores'}
            </div>
            <h3 className="text-2xl font-bold mb-4">
              {lang === 'en' ? 'Everything they need on their phone' : 'Todo lo que necesitan en su teléfono'}
            </h3>
            <ul className="space-y-3 text-steel-300">
              {lang === 'en' ? (
                <>
                  <ListItem>Secure mobile portal — no app store download required</ListItem>
                  <ListItem>View assigned jobs with pickup/delivery locations</ListItem>
                  <ListItem>Submit load tickets with photo proof on the spot</ListItem>
                  <ListItem>Update job status from the cab: en route, on site, completed</ListItem>
                  <ListItem>Track expenses and upload receipts</ListItem>
                  <ListItem>Manage documents (CDL, medical card, insurance)</ListItem>
                </>
              ) : (
                <>
                  <ListItem>Portal móvil seguro — sin descarga de app store</ListItem>
                  <ListItem>Vea trabajos asignados con ubicaciones de carga/entrega</ListItem>
                  <ListItem>Envíe tickets de carga con foto de prueba al momento</ListItem>
                  <ListItem>Actualice el estado del trabajo desde la cabina: en camino, en sitio, completado</ListItem>
                  <ListItem>Rastree gastos y suba recibos</ListItem>
                  <ListItem>Administre documentos (CDL, tarjeta médica, seguro)</ListItem>
                </>
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative overflow-hidden border-t border-steel-800 bg-gradient-to-b from-steel-900/60 to-diesel">
        {/* Large centered truck watermark */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none" aria-hidden="true">
          <svg width="800" height="400" viewBox="0 0 800 400" fill="currentColor">
            {/* Front-view dump truck */}
            <rect x="200" y="80" width="400" height="200" rx="16" />
            <rect x="260" y="120" width="120" height="80" rx="8" fill="currentColor" opacity="0.6" />
            <rect x="420" y="120" width="120" height="80" rx="8" fill="currentColor" opacity="0.6" />
            <rect x="160" y="260" width="480" height="60" rx="12" />
            <circle cx="240" cy="340" r="40" />
            <circle cx="560" cy="340" r="40" />
            <rect x="350" y="40" width="100" height="50" rx="8" />
            {/* Side mirrors */}
            <rect x="140" y="130" width="50" height="30" rx="6" />
            <rect x="610" y="130" width="50" height="30" rx="6" />
            {/* Bumper */}
            <rect x="220" y="280" width="360" height="16" rx="4" opacity="0.7" />
          </svg>
        </div>
        <div className="relative max-w-3xl mx-auto px-6 py-20 lg:py-28 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {lang === 'en'
              ? 'Ready to streamline your hauling business?'
              : '¿Listo para optimizar su negocio de acarreo?'}
          </h2>
          <p className="mt-4 text-lg text-steel-400 max-w-xl mx-auto">
            {lang === 'en'
              ? 'Join hauling companies that use TruckFlowUS to save hours every week on paperwork, dispatch, and billing.'
              : 'Únase a las empresas de acarreo que usan TruckFlowUS para ahorrar horas cada semana en papeleo, despacho y facturación.'}
          </p>
          <div className="flex flex-wrap justify-center items-center gap-4 mt-10">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center bg-safety text-diesel font-bold text-lg px-10 py-4 rounded-lg hover:bg-safety-dark transition-colors shadow-lg shadow-safety/20"
            >
              {lang === 'en' ? 'Get Started Free' : 'Empiece Gratis'}
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center border border-steel-600 text-steel-300 font-medium text-lg px-10 py-4 rounded-lg hover:border-steel-400 hover:text-white transition-colors"
            >
              {lang === 'en' ? 'Sign In' : 'Iniciar Sesión'}
            </Link>
          </div>
          <p className="mt-4 text-sm text-steel-500">
            {lang === 'en'
              ? 'No credit card required. Cancel anytime.'
              : 'Sin tarjeta de crédito. Cancele cuando quiera.'}
          </p>
        </div>
      </section>

      {/* ── FAQ Section ── */}
      <section className="max-w-6xl mx-auto px-6 py-20 lg:py-28">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {lang === 'en' ? (
              <>Frequently asked <span className="text-safety">questions</span></>
            ) : (
              <><span className="text-safety">Preguntas</span> frecuentes</>
            )}
          </h2>
        </div>
        <div className="max-w-3xl mx-auto space-y-6">
          <FaqItem
            q={lang === 'en'
              ? 'What types of trucking companies use TruckFlowUS?'
              : '¿Qué tipos de empresas de camiones usan TruckFlowUS?'}
            a={lang === 'en'
              ? 'TruckFlowUS is built for dump truck operators, hauling companies, and material transport businesses. Whether you run 2 trucks or 200, our platform scales to fit your operation with ticketing, dispatch, invoicing, and fleet management.'
              : 'TruckFlowUS está diseñado para operadores de camiones volquete, empresas de acarreo y negocios de transporte de materiales. Ya sea que maneje 2 o 200 camiones, nuestra plataforma se escala para ajustarse a su operación con tickets, despacho, facturación y gestión de flota.'}
          />
          <FaqItem
            q={t('pub.faq.q1')}
            a={t('pub.faq.a1')}
          />
          <FaqItem
            q={lang === 'en'
              ? 'Can I generate invoices and trip sheets automatically?'
              : '¿Puedo generar facturas y hojas de viaje automáticamente?'}
            a={lang === 'en'
              ? 'Yes. TruckFlowUS generates professional PDF invoices from your completed tickets and creates broker trip sheets with per-truck breakdowns. You can email them directly to customers and brokers from the platform.'
              : 'Sí. TruckFlowUS genera facturas PDF profesionales a partir de sus tickets completados y crea hojas de viaje de broker con desglose por camión. Puede enviarlas por correo directamente a clientes y brokers desde la plataforma.'}
          />
          <FaqItem
            q={lang === 'en'
              ? 'How does the AI ticket scanning work?'
              : '¿Cómo funciona el escaneo de tickets con IA?'}
            a={lang === 'en'
              ? 'Simply take a photo of a paper load ticket with your phone. Our AI reads the ticket and auto-fills the data — material, quantity, ticket number, and more. It eliminates manual data entry and reduces errors.'
              : 'Simplemente tome una foto de un ticket de carga de papel con su teléfono. Nuestra IA lee el ticket y auto-llena los datos — material, cantidad, número de ticket y más. Elimina la entrada manual de datos y reduce errores.'}
          />
          <FaqItem
            q={lang === 'en'
              ? 'Is there a free trial?'
              : '¿Hay una prueba gratuita?'}
            a={lang === 'en'
              ? 'Yes. You can sign up and start using TruckFlowUS immediately with no credit card required. Set up your company, add drivers and trucks, and start dispatching in under 5 minutes.'
              : 'Sí. Puede registrarse y empezar a usar TruckFlowUS inmediatamente sin tarjeta de crédito. Configure su empresa, agregue conductores y camiones, y empiece a despachar en menos de 5 minutos.'}
          />
          <FaqItem
            q={lang === 'en'
              ? 'How does TruckFlowUS compare to paper tickets and spreadsheets?'
              : '¿Cómo se compara TruckFlowUS con tickets de papel y hojas de cálculo?'}
            a={lang === 'en'
              ? "Paper tickets get lost, require manual data entry, and delay invoicing by days or weeks. TruckFlowUS replaces that entire workflow — drivers submit digital load tickets from their phones, data syncs instantly, and invoices generate automatically from completed loads. Most companies see billing turnaround cut in half."
              : 'Los tickets de papel se pierden, requieren entrada manual de datos y retrasan la facturación por días o semanas. TruckFlowUS reemplaza todo ese flujo de trabajo — los conductores envían tickets de carga digitales desde sus teléfonos, los datos se sincronizan al instante y las facturas se generan automáticamente. La mayoría de empresas ven el tiempo de facturación reducido a la mitad.'}
          />
          <FaqItem
            q={t('pub.faq.q4')}
            a={t('pub.faq.a4')}
          />
          <FaqItem
            q={t('pub.faq.q5')}
            a={t('pub.faq.a5')}
          />
        </div>
      </section>

      {/* FAQ JSON-LD for Google rich results — kept in English for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: [
              {
                '@type': 'Question',
                name: 'What types of trucking companies use TruckFlowUS?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'TruckFlowUS is built for dump truck operators, hauling companies, and material transport businesses. Whether you run 2 trucks or 200, our platform scales to fit your operation with ticketing, dispatch, invoicing, and fleet management.',
                },
              },
              {
                '@type': 'Question',
                name: 'Do my drivers need to download an app?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: "No. Drivers access their mobile portal through a secure web link — no app store download required. They can view jobs, submit tickets, upload photos, and update their status right from their phone's browser.",
                },
              },
              {
                '@type': 'Question',
                name: 'Can I generate invoices and trip sheets automatically?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. TruckFlowUS generates professional PDF invoices from your completed tickets and creates broker trip sheets with per-truck breakdowns. You can email them directly to customers and brokers from the platform.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does the AI ticket scanning work?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Simply take a photo of a paper load ticket with your phone. Our AI reads the ticket and auto-fills the data — material, quantity, ticket number, and more. It eliminates manual data entry and reduces errors.',
                },
              },
              {
                '@type': 'Question',
                name: 'Is there a free trial?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. You can sign up and start using TruckFlowUS immediately with no credit card required. Set up your company, add drivers and trucks, and start dispatching in under 5 minutes.',
                },
              },
              {
                '@type': 'Question',
                name: 'How does TruckFlowUS compare to paper tickets and spreadsheets?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Paper tickets get lost, require manual data entry, and delay invoicing by days or weeks. TruckFlowUS replaces that entire workflow — drivers submit digital load tickets from their phones, data syncs instantly, and invoices generate automatically from completed loads. Most companies see billing turnaround cut in half.',
                },
              },
              {
                '@type': 'Question',
                name: 'Can I manage multiple job sites and materials at the same time?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Absolutely. TruckFlowUS handles multiple active job sites, material types, brokers, and customers simultaneously. Dispatchers see everything on one dashboard and can assign the right truck to the right job based on truck type, driver availability, and proximity.',
                },
              },
              {
                '@type': 'Question',
                name: 'Does TruckFlowUS support Spanish-speaking drivers?',
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: 'Yes. The entire driver mobile portal and dispatcher interface supports both English and Spanish. Drivers can switch languages with one tap, making it easy for bilingual crews to use the platform without barriers.',
                },
              },
            ],
          }),
        }}
      />

      {/* ── Footer ── */}
      <footer className="border-t border-steel-800 bg-steel-900/40">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-safety rounded flex items-center justify-center font-black text-diesel text-xs">
                  TF
                </div>
                <span className="text-sm font-bold text-white">TruckFlowUS</span>
              </div>
              <p className="text-sm text-steel-400 leading-relaxed">
                {lang === 'en'
                  ? 'All-in-one dump truck software for ticketing, dispatch, invoicing, and fleet management. Built for hauling companies across the United States.'
                  : 'Software todo-en-uno para camiones: tickets, despacho, facturación y gestión de flota. Hecho para empresas de acarreo en Estados Unidos.'}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t('pub.footer.platform')}</h3>
              <ul className="space-y-2 text-sm text-steel-400">
                <li><Link href="/signup" className="hover:text-steel-200 transition-colors">{t('pub.nav.startTrial')}</Link></li>
                <li><Link href="/login" className="hover:text-steel-200 transition-colors">{t('pub.footer.dispatcherLogin')}</Link></li>
                <li><Link href="/d/login" className="hover:text-steel-200 transition-colors">{t('pub.footer.driverLogin')}</Link></li>
                <li><Link href="/subscribe" className="hover:text-steel-200 transition-colors">{t('pub.footer.plans')}</Link></li>
                <li><Link href="/blog" className="hover:text-steel-200 transition-colors">{t('pub.nav.blog')}</Link></li>
                <li><Link href="/contact" className="hover:text-steel-200 transition-colors">{t('pub.footer.contactUs')}</Link></li>
                <li><Link href="/resources" className="hover:text-steel-200 transition-colors">{t('pub.footer.resourcesGuides')}</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t('pub.footer.features')}</h3>
              <ul className="space-y-2 text-sm text-steel-400">
                <li>{t('pub.footer.feat1')}</li>
                <li>{t('pub.footer.feat2')}</li>
                <li>{t('pub.footer.feat3')}</li>
                <li>{t('pub.footer.feat4')}</li>
                <li>{t('pub.footer.feat5')}</li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-3">{t('pub.footer.legal')}</h3>
              <ul className="space-y-2 text-sm text-steel-400">
                <li><Link href="/terms" className="hover:text-steel-200 transition-colors">{t('pub.footer.terms')}</Link></li>
                <li><Link href="/privacy" className="hover:text-steel-200 transition-colors">{t('pub.footer.privacy')}</Link></li>
                <li><Link href="/acceptable-use" className="hover:text-steel-200 transition-colors">{t('pub.footer.acceptableUse')}</Link></li>
                <li><Link href="/sms-terms" className="hover:text-steel-200 transition-colors">{t('pub.footer.smsTerms')}</Link></li>
                <li><Link href="/cookies" className="hover:text-steel-200 transition-colors">{t('pub.footer.cookies')}</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-steel-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-steel-600">
              &copy; {new Date().getFullYear()} TruckFlowUS. {t('pub.nav.allRights')}
            </p>
            <p className="text-xs text-steel-600">
              {t('pub.footer.tagline')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="bg-steel-900/50 border border-steel-800 rounded-xl p-6 hover:border-steel-700 transition-colors">
      <div className="w-10 h-10 rounded-lg bg-safety/10 text-safety flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-steel-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  desc,
}: {
  step: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-safety text-diesel font-extrabold text-xl flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-steel-400 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  return (
    <details className="group bg-steel-900/50 border border-steel-800 rounded-xl">
      <summary className="flex items-center justify-between cursor-pointer px-6 py-5 text-left font-semibold text-white hover:text-safety transition-colors list-none">
        {q}
        <svg
          className="w-5 h-5 text-steel-500 group-open:rotate-180 transition-transform flex-shrink-0 ml-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-6 pb-5 text-steel-400 text-sm leading-relaxed">
        {a}
      </div>
    </details>
  );
}

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className="w-5 h-5 text-safety flex-shrink-0 mt-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}
