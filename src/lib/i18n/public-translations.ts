/**
 * Translations for the public-facing website (landing, blog, contact, resources, etc.)
 * Kept separate from the app translations for clarity.
 */
import type { Lang } from './translations';

const publicTranslations: Record<string, Record<Lang, string>> = {
  // ─── Navigation ────────────────────────────────────────────────────────
  'pub.nav.blog': { en: 'Blog', es: 'Blog' },
  'pub.nav.contact': { en: 'Contact', es: 'Contacto' },
  'pub.nav.resources': { en: 'Resources', es: 'Recursos' },
  'pub.nav.login': { en: 'Log in', es: 'Iniciar Sesión' },
  'pub.nav.startTrial': { en: 'Start Free Trial', es: 'Prueba Gratis' },
  'pub.nav.backHome': { en: '← Back to TruckFlowUS', es: '← Volver a TruckFlowUS' },
  'pub.nav.allRights': { en: 'All rights reserved.', es: 'Todos los derechos reservados.' },

  // ─── Homepage Hero ───────────��──────────────────────���──────────────────
  'pub.hero.title1': { en: 'Dump Truck', es: 'Software de' },
  'pub.hero.title2': { en: 'Dispatch Software', es: 'Despacho de Camiones' },
  'pub.hero.title3': { en: 'That Actually Works', es: 'Que Realmente Funciona' },
  'pub.hero.subtitle': {
    en: 'Digital load tickets, real-time dispatch, automated invoicing, and a driver mobile portal — all in one platform. Replace your paper tickets and spreadsheets today.',
    es: 'Tickets de carga digitales, despacho en tiempo real, facturaci��n automatizada y portal móvil para conductores — todo en una plataforma. Reemplace sus tickets de papel y hojas de cálculo hoy.',
  },
  'pub.hero.cta': { en: 'Start Free — No Credit Card', es: 'Empiece Gratis — Sin Tarjeta' },
  'pub.hero.ctaSub': { en: '14-day free trial · Set up in under 5 minutes', es: 'Prueba gratis de 14 días · Configure en menos de 5 minutos' },

  // ─── Homepage Features ────���────────────────────────────────────────────
  'pub.features.heading': { en: 'Everything Your Hauling Company Needs', es: 'Todo lo que su Empresa de Acarreo Necesita' },
  'pub.features.subtitle': {
    en: 'One platform to run your dump truck business — from dispatch to invoicing.',
    es: 'Una plataforma para manejar su negocio de camiones — del despacho a la facturación.',
  },
  'pub.feat.tickets.title': { en: 'Digital Load Tickets', es: 'Tickets de Carga Digitales' },
  'pub.feat.tickets.desc': {
    en: 'Drivers submit tickets with photos from their phone. No more lost paper slips or end-of-week scrambles.',
    es: 'Los conductores envían tickets con fotos desde su teléfono. No más papeles perdidos o búsquedas de fin de semana.',
  },
  'pub.feat.dispatch.title': { en: 'Real-Time Dispatch', es: 'Despacho en Tiempo Real' },
  'pub.feat.dispatch.desc': {
    en: 'Create jobs, assign drivers, and track progress live. Multi-truck assignments with one click.',
    es: 'Cree trabajos, asigne conductores y rastree el progreso en vivo. Asignaciones multi-camión con un clic.',
  },
  'pub.feat.invoicing.title': { en: 'Automated Invoicing', es: 'Facturación Automatizada' },
  'pub.feat.invoicing.desc': {
    en: 'Reviewed tickets automatically roll into professional PDF invoices and trip sheets. Email them directly.',
    es: 'Los tickets revisados se convierten automáticamente en facturas PDF profesionales y hojas de viaje. Envíelas por correo directamente.',
  },
  'pub.feat.driver.title': { en: 'Driver Mobile Portal', es: 'Portal Móvil del Conductor' },
  'pub.feat.driver.desc': {
    en: 'No app download needed. Drivers get a secure link that works on any phone browser — submit tickets, view jobs, upload photos.',
    es: 'No necesita descargar app. Los conductores reciben un enlace seguro que funciona en cualquier navegador — enviar tickets, ver trabajos, subir fotos.',
  },
  'pub.feat.fleet.title': { en: 'Fleet Management', es: 'Gestión de Flota' },
  'pub.feat.fleet.desc': {
    en: 'Track trucks, documents, expenses, and maintenance. Set up truck types and assign the right equipment.',
    es: 'Rastree camiones, documentos, gastos y mantenimiento. Configure tipos de camión y asigne el equipo correcto.',
  },
  'pub.feat.ai.title': { en: 'AI Ticket Scanning', es: 'Escaneo IA de Tickets' },
  'pub.feat.ai.desc': {
    en: 'Photograph a broker text or job sheet and let AI auto-fill job details. Works with scale tickets too.',
    es: 'Fotografíe un texto de broker o hoja de trabajo y deje que la IA auto-llene los detalles. También funciona con tickets de báscula.',
  },

  // ─── Homepage Social Proof ─────────────────────────────────────────────
  'pub.social.heading': { en: 'Built for Real Hauling Operations', es: 'Hecho para Operaciones de Acarreo Reales' },
  'pub.social.stat1': { en: 'Active Trucks', es: 'Camiones Activos' },
  'pub.social.stat2': { en: 'Tickets Processed', es: 'Tickets Procesados' },
  'pub.social.stat3': { en: 'Hours Saved Weekly', es: 'Horas Ahorradas por Semana' },

  // ─── Homepage FAQ ───────────────���─────────────────────��────────────────
  'pub.faq.heading': { en: 'Frequently Asked Questions', es: 'Preguntas Frecuentes' },
  'pub.faq.q1': { en: 'Do drivers need to download an app?', es: '¿Los conductores necesitan descargar una app?' },
  'pub.faq.a1': {
    en: 'No. Drivers access their portal through a secure web link that works on any phone browser — iPhone or Android. No app store needed.',
    es: 'No. Los conductores acceden a su portal mediante un enlace web seguro que funciona en cualquier navegador — iPhone o Android. Sin app store.',
  },
  'pub.faq.q2': { en: 'How long does setup take?', es: '¿Cuánto tiempo toma la configuración?' },
  'pub.faq.a2': {
    en: 'Most companies are up and running in under 5 minutes. Add your trucks, invite your drivers, and start dispatching jobs immediately.',
    es: 'La mayoría de empresas están operando en menos de 5 minutos. Agregue sus camiones, invite a sus conductores y empiece a despachar trabajos inmediatamente.',
  },
  'pub.faq.q3': { en: 'What about paper vs digital tickets?', es: '¿Qué hay de los tickets de papel vs digitales?' },
  'pub.faq.a3': {
    en: 'TruckFlowUS replaces paper tickets with digital ones that include photos, timestamps, and GPS verification. No more lost tickets or illegible handwriting.',
    es: 'TruckFlowUS reemplaza los tickets de papel con digitales que incluyen fotos, marcas de tiempo y verificación GPS. No más tickets perdidos o escritura ilegible.',
  },
  'pub.faq.q4': { en: 'Can I manage multiple job sites?', es: '¿Puedo administrar múltiples sitios de trabajo?' },
  'pub.faq.a4': {
    en: 'Yes. Create jobs with different pickup and delivery locations, assign multiple trucks, and track everything from one dashboard.',
    es: 'Sí. Cree trabajos con diferentes ubicaciones de carga y entrega, asigne múltiples camiones y rastree todo desde un panel.',
  },
  'pub.faq.q5': { en: 'Is there Spanish language support?', es: '¿Hay soporte en español?' },
  'pub.faq.a5': {
    en: 'Yes! The entire platform — dispatcher dashboard, driver portal, and this website — supports English and Spanish with a one-click toggle.',
    es: '¡Sí! Toda la plataforma — panel del despachador, portal del conductor y este sitio web — soporta inglés y español con un clic.',
  },
  'pub.faq.q6': { en: 'How does invoicing work?', es: '¿Cómo funciona la facturación?' },
  'pub.faq.a6': {
    en: 'Once you review and approve driver tickets, they automatically feed into invoices and trip sheets. Generate a professional PDF and email it to your customer in seconds.',
    es: 'Una vez que revise y apruebe los tickets de conductores, se convierten automáticamente en facturas y hojas de viaje. Genere un PDF profesional y envíelo a su cliente en segundos.',
  },

  // ─── Homepage Footer ─────────────���─────────────────────────────────────
  'pub.footer.platform': { en: 'Platform', es: 'Plataforma' },
  'pub.footer.dispatcherLogin': { en: 'Dispatcher Login', es: 'Acceso Despachador' },
  'pub.footer.driverLogin': { en: 'Driver Login', es: 'Acceso Conductor' },
  'pub.footer.plans': { en: 'Plans & Pricing', es: 'Planes y Precios' },
  'pub.footer.contactUs': { en: 'Contact Us', es: 'Contáctenos' },
  'pub.footer.resourcesGuides': { en: 'Resources & Guides', es: 'Recursos y Guías' },
  'pub.footer.legal': { en: 'Legal', es: 'Legal' },
  'pub.footer.terms': { en: 'Terms of Service', es: 'Términos de Servicio' },
  'pub.footer.privacy': { en: 'Privacy Policy', es: 'Política de Privacidad' },
  'pub.footer.acceptableUse': { en: 'Acceptable Use', es: 'Uso Aceptable' },
  'pub.footer.smsTerms': { en: 'SMS Terms', es: 'Términos SMS' },
  'pub.footer.cookies': { en: 'Cookie Policy', es: 'Política de Cookies' },
  'pub.footer.features': { en: 'Features', es: 'Funciones' },
  'pub.footer.feat1': { en: 'Load Ticket Management', es: 'Gestión de Tickets de Carga' },
  'pub.footer.feat2': { en: 'Job Dispatch & Tracking', es: 'Despacho y Rastreo de Trabajos' },
  'pub.footer.feat3': { en: 'PDF Invoicing & Trip Sheets', es: 'Facturación PDF y Hojas de Viaje' },
  'pub.footer.feat4': { en: 'AI Ticket Scanning', es: 'Escaneo IA de Tickets' },
  'pub.footer.feat5': { en: 'Fleet & Driver Management', es: 'Gestión de Flota y Conductores' },
  'pub.footer.tagline': {
    en: 'Dump truck dispatch software · Hauling company management · Made in the USA',
    es: 'Software de despacho de camiones · Gestión de empresas de acarreo · Hecho en USA',
  },

  // ─── Contact Page ──────────────────────────────────────────────────────
  'pub.contact.title': { en: 'Contact', es: 'Contáctenos' },
  'pub.contact.titleAccent': { en: 'Us', es: '' },
  'pub.contact.subtitle': {
    en: "Have a question, feature request, or running into an issue? We'd love to hear from you. Fill out the form and we'll get back to you as soon as possible.",
    es: '¿Tiene una pregunta, solicitud de función o un problema? Nos encantaría saber de usted. Complete el formulario y le responderemos lo antes posible.',
  },
  'pub.contact.email': { en: 'Email', es: 'Correo Electrónico' },
  'pub.contact.responseTime': { en: 'Response Time', es: 'Tiempo de Respuesta' },
  'pub.contact.responseDesc': { en: 'We typically respond within 24 hours', es: 'Normalmente respondemos dentro de 24 horas' },
  'pub.contact.existing': { en: 'Existing Customers', es: 'Clientes Existentes' },
  'pub.contact.existingDesc': {
    en: "If you're already a TruckFlowUS user, include your company name so we can look up your account.",
    es: 'Si ya es usuario de TruckFlowUS, incluya el nombre de su empresa para que podamos buscar su cuenta.',
  },
  'pub.contact.yourName': { en: 'Your Name', es: 'Su Nombre' },
  'pub.contact.emailAddr': { en: 'Email Address', es: 'Correo Electrónico' },
  'pub.contact.helpWith': { en: 'What can we help with?', es: '¿En qué podemos ayudarle?' },
  'pub.contact.selectCat': { en: 'Select a category...', es: 'Seleccione una categoría...' },
  'pub.contact.catSpecial': { en: 'Special Request', es: 'Solicitud Especial' },
  'pub.contact.catBug': { en: 'Something Not Working', es: 'Algo No Funciona' },
  'pub.contact.catGeneral': { en: 'General Inquiry', es: 'Consulta General' },
  'pub.contact.catOther': { en: 'Other', es: 'Otro' },
  'pub.contact.message': { en: 'Message', es: 'Mensaje' },
  'pub.contact.messagePlaceholder': { en: 'Tell us what you need help with...', es: 'Cuéntenos en qué necesita ayuda...' },
  'pub.contact.send': { en: 'Send Message', es: 'Enviar Mensaje' },
  'pub.contact.sending': { en: 'Sending...', es: 'Enviando...' },
  'pub.contact.sent': { en: 'Message Sent!', es: '¡Mensaje Enviado!' },
  'pub.contact.sentDesc': {
    en: "Thanks for reaching out. We'll get back to you as soon as possible.",
    es: 'Gracias por contactarnos. Le responderemos lo antes posible.',
  },
  'pub.contact.sendAnother': { en: 'Send another message', es: 'Enviar otro mensaje' },
  'pub.contact.errorConnection': { en: 'Failed to send. Please check your connection and try again.', es: 'Error al enviar. Verifique su conexión e intente de nuevo.' },

  // ─── Resources Page ────────────────────────────────────────────────────
  'pub.resources.title': { en: 'Resources &', es: 'Recursos y' },
  'pub.resources.titleAccent': { en: 'Guides', es: 'Guías' },
  'pub.resources.subtitle': {
    en: 'Download our step-by-step guides to get your team up and running fast. Available in English and Spanish. Share these with your dispatchers and drivers so everyone knows exactly how to use TruckFlowUS.',
    es: 'Descargue nuestras guías paso a paso para que su equipo esté operando rápidamente. Disponible en inglés y español. Compártalas con sus despachadores y conductores para que todos sepan usar TruckFlowUS.',
  },
  'pub.resources.dispatcherGuide': { en: 'Dispatcher Guide', es: 'Guía del Despachador' },
  'pub.resources.dispatcherDesc': {
    en: 'A 10-slide walkthrough covering everything a dispatcher needs — from logging in and navigating the dashboard to creating jobs, managing tickets, generating invoices, and running reports.',
    es: 'Una guía de 10 diapositivas que cubre todo lo que un despachador necesita — desde iniciar sesión y navegar el panel hasta crear trabajos, gestionar tickets, generar facturas e informes.',
  },
  'pub.resources.driverGuide': { en: 'Driver Guide', es: 'Guía del Conductor' },
  'pub.resources.driverDesc': {
    en: 'A 9-slide walkthrough for drivers — how to log in via your unique link, view and accept jobs, submit load tickets, upload photos, manage your profile, and track pay history.',
    es: 'Una guía de 9 diapositivas para conductores — cómo iniciar sesión con su enlace único, ver y aceptar trabajos, enviar tickets de carga, subir fotos, y ver historial de pagos.',
  },
  'pub.resources.slides': { en: 'slides', es: 'diapositivas' },
  'pub.resources.for': { en: 'For', es: 'Para' },
  'pub.resources.dispatchersAdmins': { en: 'Dispatchers & Admins', es: 'Despachadores y Admins' },
  'pub.resources.drivers': { en: 'Drivers', es: 'Conductores' },
  'pub.resources.downloadEn': { en: 'Download — English', es: 'Descargar — Inglés' },
  'pub.resources.downloadEs': { en: 'Download — Spanish', es: 'Descargar — Español' },
  'pub.resources.needHelp': { en: 'Need more help getting started?', es: '¿Necesita más ayuda para empezar?' },
  'pub.resources.needHelpDesc': {
    en: 'Our team is here to help you set up your account and train your crew.',
    es: 'Nuestro equipo está aquí para ayudarle a configurar su cuenta y capacitar a su equipo.',
  },

  // ─── Blog ─────────────────────────────────────────────��────────────────
  'pub.blog.title': { en: 'The TruckFlowUS', es: 'El' },
  'pub.blog.titleAccent': { en: 'Blog', es: 'Blog de TruckFlowUS' },
  'pub.blog.subtitle': {
    en: 'Practical guides and industry insights for dump truck operators, dispatchers, and hauling company owners.',
    es: 'Guías prácticas e información de la industria para operadores de camiones, despachadores y dueños de empresas de acarreo.',
  },
  'pub.blog.readMore': { en: 'Read more →', es: 'Leer más →' },
  'pub.blog.noPosts': { en: 'No posts yet. Check back soon!', es: '¡Aún no hay publicaciones! Vuelva pronto.' },
  'pub.blog.backToBlog': { en: '← All articles', es: '← Todos los artículos' },
  'pub.blog.share': { en: 'Share this article', es: 'Compartir este artículo' },

  // ─── Signup ────────────────────────────────────────────────────────────
  'pub.signup.title': { en: 'Start Your Free Trial', es: 'Empiece su Prueba Gratis' },
  'pub.signup.subtitle': {
    en: 'Set up your dump truck dispatch software in under 5 minutes. No credit card required.',
    es: 'Configure su software de despacho de camiones en menos de 5 minutos. Sin tarjeta de crédito.',
  },

  // ─── Login ���─────────────────��───────────────��──────────────────────────
  'pub.login.title': { en: 'Dispatcher Login', es: 'Acceso Despachador' },
  'pub.login.subtitle': { en: 'Sign in to your dispatch dashboard', es: 'Inicie sesión en su panel de despacho' },
};

export default publicTranslations;
