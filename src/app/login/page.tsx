import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loginWithCredentials, getSession, landingPathForRole, landingPathForUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to your TruckFlowUS account to manage dump truck ticketing, dispatch, and invoicing.',
  alternates: { canonical: '/login' },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; next?: string; suspended?: string; signedout?: string; locked?: string; attempts?: string; notfound?: string; sq?: string };
}) {
  // Wrap in try/catch — if the DB is unreachable or the session cookie is stale,
  // we still want to render the login form rather than crashing the page.
  try {
    const session = await getSession();
    if (session) {
      const landing = await landingPathForUser(session.role, session.companyId);
      redirect(landing);
    }
  } catch (e: any) {
    // Re-throw Next.js redirect (it throws internally)
    if (e?.digest?.startsWith('NEXT_REDIRECT')) throw e;
    console.error('[login] getSession failed, showing login form:', e.message);
  }

  async function login(formData: FormData) {
    'use server';
    const email = String(formData.get('email') || '');
    const password = String(formData.get('password') || '');
    const rawNext = String(formData.get('next') || '');

    // Prevent open redirect — only allow relative paths starting with /
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';

    let result: Awaited<ReturnType<typeof loginWithCredentials>>;
    try {
      result = await loginWithCredentials(email, password);
    } catch (err: any) {
      console.error('[login] loginWithCredentials threw:', err.message);
      redirect(`/login?error=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    }

    if (!result) {
      redirect(`/login?error=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    }
    if ('locked' in result && result.locked) {
      const sq = result.hasSecurityQuestions ? '1' : '0';
      redirect(`/login?locked=1&sq=${sq}`);
    }
    if ('notFound' in result && result.notFound) {
      redirect(`/login?notfound=1${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    }
    if ('failed' in result && result.failed) {
      redirect(`/login?error=1&attempts=${result.attemptsLeft}${next ? `&next=${encodeURIComponent(next)}` : ''}`);
    }
    if ('suspended' in result && result.suspended) {
      redirect('/login?suspended=1');
    }
    const landing = 'role' in result
      ? await landingPathForUser(result.role, result.companyId)
      : '/dashboard';
    redirect(next || landing);
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">TF</div>
            <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
          </div>
          <p className="text-steel-400 text-sm mt-2">Sign in</p>
        </div>
        <form action={login} className="panel p-6 space-y-4">
          <input type="hidden" name="next" value={searchParams.next || ''} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoFocus className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required className="input" />
          </div>
          {searchParams.signedout && (
            <p className="text-sm text-green-600">You have been signed out successfully.</p>
          )}
          {searchParams.locked && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <p className="font-medium">Account locked</p>
              <p className="mt-1">Too many failed login attempts. Please reset your password to unlock your account.</p>
              {searchParams.sq === '1' ? (
                <a href="/forgot-password/security" className="mt-2 inline-block w-full text-center py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm">
                  Reset via Security Questions
                </a>
              ) : (
                <a href="/forgot-password" className="mt-2 inline-block w-full text-center py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm">
                  Reset via Email
                </a>
              )}
            </div>
          )}
          {searchParams.notfound && !searchParams.locked && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <p>No account found with this email address.</p>
              <p className="mt-1">
                Don&apos;t have an account?{' '}
                <a href="/signup" className="underline font-medium text-safety hover:text-safety-dark">Sign up here</a>
              </p>
            </div>
          )}
          {searchParams.error && !searchParams.locked && !searchParams.notfound && (
            <div className="text-sm text-red-600">
              <p>Invalid email or password.</p>
              {searchParams.attempts && (
                <p className="mt-1 font-medium">
                  {searchParams.attempts === '0'
                    ? 'This was your last attempt.'
                    : `${searchParams.attempts} attempt${searchParams.attempts === '1' ? '' : 's'} remaining before your account is locked.`}
                </p>
              )}
            </div>
          )}
          {searchParams.suspended && (
            <p className="text-sm text-red-600">
              This account's company is suspended. Contact platform support.
            </p>
          )}
          <button type="submit" className="btn-accent w-full">Sign In</button>
          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-steel-500 hover:text-steel-700">
              Forgot your password?
            </a>
          </div>
        </form>
        <p className="text-center mt-4">
          <a href="/signup" className="text-sm text-steel-400 hover:text-steel-200">
            Don&apos;t have an account? <span className="text-safety">Sign up</span>
          </a>
        </p>
        <p className="text-center mt-3">
          <a href="/d/login" className="text-sm text-steel-400 hover:text-steel-200">
            Are you a driver? <span className="text-safety">Driver Sign In</span>
          </a>
        </p>
        <p className="text-center mt-3">
          <a
            href="mailto:truckflowadmin@gmail.com?subject=TruckFlowUS%20Sign%20In%20Support%20Request&body=Please%20describe%20your%20issue%20below%3A%0A%0A"
            className="text-sm text-steel-500 hover:text-steel-300"
          >
            Having issues signing in? <span className="underline">Contact support</span>
          </a>
        </p>
      </div>
    </main>
  );
}
