'use client';

interface BillingAlertBannerProps {
  type: 'trial_ending' | 'payment_overdue';
  daysLeft?: number;
  daysOverdue?: number;
  lang?: 'en' | 'es';
}

const STRINGS = {
  trial_ending: {
    title: {
      en: 'Your Trial Is Ending Soon',
      es: 'Tu Prueba Gratuita Termina Pronto',
    },
    body: {
      en: 'Your free trial expires in {days} day(s). Subscribe now to keep full access to TruckFlowUS without interruption.',
      es: 'Tu prueba gratuita expira en {days} dia(s). Suscribete ahora para mantener acceso completo a TruckFlowUS sin interrupcion.',
    },
    cta: { en: 'Subscribe Now', es: 'Suscribirte Ahora' },
    ctaHref: '/subscribe',
  },
  payment_overdue: {
    title: {
      en: 'Payment Overdue',
      es: 'Pago Vencido',
    },
    body: {
      en: 'Your payment is {days} day(s) overdue. Please update your payment method to avoid account suspension.',
      es: 'Tu pago tiene {days} dia(s) de retraso. Por favor actualiza tu metodo de pago para evitar la suspension de tu cuenta.',
    },
    cta: { en: 'Update Payment', es: 'Actualizar Pago' },
    ctaHref: '/settings',
  },
};

export default function BillingAlertBanner({
  type,
  daysLeft,
  daysOverdue,
  lang = 'en',
}: BillingAlertBannerProps) {
  const l = lang === 'es' ? 'es' : 'en';
  const s = STRINGS[type];
  const days = type === 'trial_ending' ? (daysLeft ?? 0) : (daysOverdue ?? 0);
  const isUrgent = type === 'payment_overdue' || (type === 'trial_ending' && (daysLeft ?? 0) <= 1);

  const borderColor = isUrgent ? 'border-red-500/40' : 'border-amber-500/40';
  const bgColor = isUrgent ? 'bg-red-950/30' : 'bg-amber-950/30';
  const iconColor = isUrgent ? 'text-red-400' : 'text-amber-400';
  const titleColor = isUrgent ? 'text-red-300' : 'text-amber-300';
  const bodyColor = isUrgent ? 'text-red-200/80' : 'text-amber-200/80';
  const btnBg = isUrgent
    ? 'bg-red-500 hover:bg-red-400 text-white'
    : 'bg-amber-500 hover:bg-amber-400 text-gray-900';

  const bodyText = s.body[l].replace(/\{days\}/g, String(days));

  return (
    <div className="mx-4 mt-4 lg:mx-6">
      <div className={`rounded-xl border ${borderColor} ${bgColor} p-4 shadow-lg`}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>
            {type === 'payment_overdue' ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className={`${titleColor} font-semibold text-sm`}>
              {s.title[l]}
            </h3>
            <p className={`${bodyColor} text-sm mt-1`}>
              {bodyText}
            </p>
          </div>
        </div>

        <div className="mt-3 ml-9 flex items-center gap-3">
          <a
            href={s.ctaHref}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors shadow ${btnBg}`}
          >
            {s.cta[l]}
          </a>
        </div>
      </div>
    </div>
  );
}
