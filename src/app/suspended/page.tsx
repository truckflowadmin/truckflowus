import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Lang } from '@/lib/i18n';

export default function SuspendedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const lang = (cookies().get('lang')?.value === 'es' ? 'es' : 'en') as Lang;
  const reason = searchParams.reason || 'suspended';

  const isPaused = reason === 'paused';

  const title = isPaused
    ? (lang === 'es' ? 'Suscripción Pausada' : 'Subscription Paused')
    : (lang === 'es' ? 'Cuenta Suspendida' : 'Account Suspended');

  const message = isPaused
    ? (lang === 'es'
        ? 'Su suscripción ha sido pausada por el administrador. Mientras esté pausada, no puede acceder a la plataforma. Contacte a su administrador para reactivar su cuenta.'
        : 'Your subscription has been paused by your administrator. While paused, you cannot access the platform. Contact your administrator to reactivate your account.')
    : (lang === 'es'
        ? 'Su cuenta ha sido suspendida. Esto puede deberse a un pago vencido o una acción administrativa. Contacte al administrador para resolver este problema.'
        : 'Your account has been suspended. This may be due to an overdue payment or an administrative action. Contact your administrator to resolve this issue.');

  const contactLabel = lang === 'es' ? 'Contactar Soporte' : 'Contact Support';
  const logoutLabel = lang === 'es' ? 'Cerrar Sesión' : 'Sign Out';

  return (
    <div className="min-h-screen bg-steel-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl ${
            isPaused ? 'bg-amber-100' : 'bg-red-100'
          }`}>
            {isPaused ? '⏸' : '⚠'}
          </div>

          <h1 className="text-2xl font-bold text-steel-900 mb-2">{title}</h1>
          <p className="text-steel-600 text-sm leading-relaxed mb-6">{message}</p>

          <div className="space-y-3">
            <Link
              href="mailto:admin@truckflowus.com"
              className="block w-full px-4 py-2.5 rounded-lg bg-safety text-diesel font-semibold text-sm hover:bg-safety/90 transition-colors"
            >
              {contactLabel}
            </Link>
            <form action="/api/logout" method="post">
              <button
                type="submit"
                className="w-full px-4 py-2.5 rounded-lg border border-steel-300 text-steel-600 text-sm font-medium hover:bg-steel-50 transition-colors"
              >
                {logoutLabel}
              </button>
            </form>
          </div>
        </div>

        <div className="text-center mt-4">
          <div className="flex items-center justify-center gap-2">
            <div className="w-7 h-7 bg-diesel rounded flex items-center justify-center font-black text-safety text-xs">TF</div>
            <span className="text-sm text-steel-500 font-medium">TruckFlowUS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
