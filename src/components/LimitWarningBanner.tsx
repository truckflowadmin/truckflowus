'use client';

interface LimitWarningBannerProps {
  maxDrivers: number | null;
  maxTicketsPerMonth: number | null;
  currentDrivers: number;
  currentMonthTickets: number;
  driversOver: boolean;
  ticketsOver: boolean;
  planName: string | null;
  lang?: 'en' | 'es';
}

const STRINGS = {
  overDriversTitle: {
    en: 'Driver Limit Exceeded',
    es: 'Límite de Conductores Excedido',
  },
  overDriversBody: {
    en: 'Your {plan} plan allows {max} driver(s), but you currently have {current}. You will not be able to add new drivers. Existing drivers can still operate, but new dispatches may be restricted in the future.',
    es: 'Tu plan {plan} permite {max} conductor(es), pero actualmente tienes {current}. No podrás agregar nuevos conductores. Los conductores existentes pueden seguir operando, pero los nuevos despachos podrían restringirse en el futuro.',
  },
  overTicketsTitle: {
    en: 'Monthly Ticket Limit Exceeded',
    es: 'Límite Mensual de Boletas Excedido',
  },
  overTicketsBody: {
    en: 'Your {plan} plan allows {max} tickets per month, but you have used {current} this month. You will not be able to create new tickets until next month or until you upgrade.',
    es: 'Tu plan {plan} permite {max} boletas por mes, pero has usado {current} este mes. No podrás crear nuevas boletas hasta el próximo mes o hasta que actualices tu plan.',
  },
  upgradeNow: { en: 'Upgrade Now', es: 'Actualizar Ahora' },
  whatHappens: { en: 'What happens if you stay on this plan?', es: '¿Qué pasa si te quedas en este plan?' },
  driverConsequence: {
    en: 'You cannot add new drivers — your existing {current} driver(s) will continue working, but you are {over} over your limit of {max}.',
    es: 'No podrás agregar nuevos conductores — tus {current} conductor(es) actuales seguirán trabajando, pero estás {over} por encima de tu límite de {max}.',
  },
  ticketConsequence: {
    en: "You cannot create new tickets this month \u2014 you've used {current} of your {max} monthly allowance. This resets on the 1st of next month.",
    es: 'No puedes crear nuevas boletas este mes — has usado {current} de tu límite mensual de {max}. Esto se reinicia el 1° del próximo mes.',
  },
  futureWarning: {
    en: 'In the future, dispatching may also be restricted for drivers over the limit.',
    es: 'En el futuro, los despachos también podrían restringirse para conductores por encima del límite.',
  },
};

function interpolate(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? key));
}

export default function LimitWarningBanner({
  maxDrivers,
  maxTicketsPerMonth,
  currentDrivers,
  currentMonthTickets,
  driversOver,
  ticketsOver,
  planName,
  lang = 'en',
}: LimitWarningBannerProps) {
  if (!driversOver && !ticketsOver) return null;

  const plan = planName || 'Current';
  const driversOverBy = maxDrivers != null ? currentDrivers - maxDrivers : 0;
  const l = lang === 'es' ? 'es' : 'en';

  return (
    <div className="mx-4 mt-4 lg:mx-6">
      {/* Main warning card */}
      <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 shadow-lg">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 text-amber-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-amber-300 font-semibold text-sm">
              {driversOver && ticketsOver
                ? (l === 'es' ? 'Límites del Plan Excedidos' : 'Plan Limits Exceeded')
                : driversOver
                  ? STRINGS.overDriversTitle[l]
                  : STRINGS.overTicketsTitle[l]}
            </h3>

            {/* Driver over-limit message */}
            {driversOver && maxDrivers != null && (
              <p className="text-amber-200/80 text-sm mt-1">
                {interpolate(STRINGS.overDriversBody[l], { plan, max: maxDrivers, current: currentDrivers })}
              </p>
            )}

            {/* Ticket over-limit message */}
            {ticketsOver && maxTicketsPerMonth != null && (
              <p className="text-amber-200/80 text-sm mt-1">
                {interpolate(STRINGS.overTicketsBody[l], { plan, max: maxTicketsPerMonth, current: currentMonthTickets })}
              </p>
            )}
          </div>
        </div>

        {/* Consequences section */}
        <div className="mt-3 ml-9 rounded-lg bg-amber-900/20 border border-amber-800/30 p-3">
          <p className="text-amber-300 text-xs font-semibold mb-2">
            {STRINGS.whatHappens[l]}
          </p>
          <ul className="space-y-1.5">
            {driversOver && maxDrivers != null && (
              <li className="flex items-start gap-2 text-xs text-amber-200/70">
                <span className="text-red-400 mt-0.5">✕</span>
                <span>{interpolate(STRINGS.driverConsequence[l], { current: currentDrivers, max: maxDrivers, over: driversOverBy })}</span>
              </li>
            )}
            {ticketsOver && maxTicketsPerMonth != null && (
              <li className="flex items-start gap-2 text-xs text-amber-200/70">
                <span className="text-red-400 mt-0.5">✕</span>
                <span>{interpolate(STRINGS.ticketConsequence[l], { current: currentMonthTickets, max: maxTicketsPerMonth })}</span>
              </li>
            )}
            {driversOver && (
              <li className="flex items-start gap-2 text-xs text-amber-200/70">
                <span className="text-amber-400 mt-0.5">⚠</span>
                <span>{STRINGS.futureWarning[l]}</span>
              </li>
            )}
          </ul>
        </div>

        {/* Upgrade CTA */}
        <div className="mt-3 ml-9 flex items-center gap-3">
          <a
            href="/subscribe"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-amber-400 transition-colors shadow"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            {STRINGS.upgradeNow[l]}
          </a>
        </div>
      </div>
    </div>
  );
}
