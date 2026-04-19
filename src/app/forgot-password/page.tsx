import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createPasswordResetToken, sendResetEmail } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

export const metadata: Metadata = {
  title: 'Forgot Password',
  description:
    'Reset your TruckFlowUS account password. Enter your email to receive a password reset link.',
};

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { sent?: string };
}) {
  async function requestReset(formData: FormData) {
    'use server';
    const email = String(formData.get('email') || '').trim().toLowerCase();
    if (!email) return;

    // Rate limit to prevent email bombing (max 5 per 15 min per email)
    const { checkRateLimit, recordAttempt } = await import('@/lib/rate-limit');
    const limit = await checkRateLimit({
      key: `reset:${email}`,
      type: 'password_reset',
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!limit.allowed) {
      // Still redirect to success to prevent enumeration
      redirect('/forgot-password?sent=1');
    }
    await recordAttempt(`reset:${email}`, 'password_reset', true);

    const token = await createPasswordResetToken(email);
    if (token) {
      const appUrl = process.env.APP_URL || 'http://localhost:3000';
      await sendResetEmail(email, token, appUrl);

      // Audit: password reset email requested
      const user = await prisma.user.findUnique({
        where: { email },
        select: { id: true, companyId: true },
      });
      if (user?.companyId) {
        await audit({
          companyId: user.companyId,
          entityType: 'user',
          entityId: user.id,
          action: 'update',
          actor: email,
          actorRole: 'DISPATCHER',
          summary: `${email} requested password reset email`,
        });
      }
    }

    // Always show success to prevent email enumeration
    redirect('/forgot-password?sent=1');
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">TF</div>
            <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
          </div>
          <p className="text-steel-400 text-sm mt-2">Reset your password</p>
        </div>

        {searchParams.sent ? (
          <div className="panel p-6 text-center">
            <div className="text-3xl mb-3">✉️</div>
            <h2 className="font-bold text-lg text-steel-900 mb-2">Check your email</h2>
            <p className="text-sm text-steel-600 mb-4">
              If an account exists with that email, we sent a password reset link.
              The link expires in 1 hour.
            </p>
            <Link href="/login" className="text-sm text-safety-dark hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form action={requestReset} className="panel p-6 space-y-4">
            <p className="text-sm text-steel-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required autoFocus className="input" />
            </div>
            <button type="submit" className="btn-accent w-full">Send Reset Link</button>
            <div className="text-center space-y-2">
              <Link href="/forgot-password/security" className="text-sm text-safety-dark hover:underline block">
                Reset via security questions instead
              </Link>
              <Link href="/login" className="text-sm text-steel-500 hover:text-steel-700 block">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
