import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { hashPassword, signSession, setSessionCookie, getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Sign Up',
  description:
    'Create your TruckFlowUS account. Dump truck ticketing, dispatch, and invoicing software for hauling companies.',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  // Already logged in — send to landing
  const session = await getSession();
  if (session) redirect('/');

  async function signup(formData: FormData) {
    'use server';
    const name = String(formData.get('name') || '').trim();
    const email = String(formData.get('email') || '').trim().toLowerCase();
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const companyName = String(formData.get('companyName') || '').trim();
    const phone = String(formData.get('phone') || '').trim() || null;
    const city = String(formData.get('city') || '').trim() || null;
    const state = String(formData.get('state') || '').trim() || null;

    // Validation
    if (!name || !email || !password || !companyName) {
      redirect('/signup?error=All fields marked * are required');
    }
    if (password.length < 6) {
      redirect('/signup?error=Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      redirect('/signup?error=Passwords do not match');
    }

    // Check if email already taken
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      redirect('/signup?error=An account with this email already exists');
    }

    // Create company (no plan — they'll pick one on /subscribe)
    const company = await prisma.company.create({
      data: {
        name: companyName,
        phone,
        city,
        state,
      },
    });

    // Create admin user for this company
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: 'ADMIN',
        companyId: company.id,
      },
    });

    // Sign them in immediately
    const token = signSession({
      userId: user.id,
      companyId: company.id,
      role: user.role,
      email: user.email,
      name: user.name,
    });
    setSessionCookie(token);

    // No plan yet → go straight to plan selection
    redirect('/subscribe');
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">
              TF
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
          </div>
          <p className="text-steel-400 text-sm mt-2">Create your dispatch account</p>
        </div>

        <form action={signup} className="panel p-6 space-y-4">
          {searchParams.error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">
              {searchParams.error}
            </p>
          )}

          {/* Company info */}
          <div>
            <h3 className="text-xs uppercase tracking-widest text-steel-500 font-semibold mb-2">
              Company
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="companyName">Company Name *</label>
                <input
                  id="companyName"
                  name="companyName"
                  required
                  autoFocus
                  className="input"
                  placeholder="Acme Hauling Co."
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1">
                  <label className="label" htmlFor="city">City</label>
                  <input id="city" name="city" className="input" placeholder="Cape Coral" />
                </div>
                <div>
                  <label className="label" htmlFor="state">State</label>
                  <input id="state" name="state" className="input" placeholder="FL" />
                </div>
                <div>
                  <label className="label" htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" type="tel" className="input" placeholder="(239) 555-0100" />
                </div>
              </div>
            </div>
          </div>

          {/* Account info */}
          <div>
            <h3 className="text-xs uppercase tracking-widest text-steel-500 font-semibold mb-2">
              Your Account
            </h3>
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="name">Full Name *</label>
                <input id="name" name="name" required className="input" placeholder="John Smith" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="input"
                  placeholder="john@acmehauling.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label" htmlFor="password">Password *</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={6}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="confirmPassword">Confirm *</label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={6}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-accent w-full text-base py-3">
            Create Account
          </button>

          <p className="text-xs text-steel-500 text-center">
            You'll choose a subscription plan on the next step.
          </p>
        </form>

        <p className="text-center mt-4">
          <a href="/login" className="text-sm text-steel-400 hover:text-steel-200">
            Already have an account? Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
