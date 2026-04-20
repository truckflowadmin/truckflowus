import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { validateResetToken, consumeResetToken } from '@/lib/password-reset';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/audit';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Set a new password for your TruckFlowUS account.',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; success?: string; error?: string };
}) {
  const { token, success, error } = searchParams;

  // Success state
  if (success) {
    return (
      <main className="min-h-screen grid place-items-center p-6 bg-diesel">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2">
              <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">TF</div>
              <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
            </div>
          </div>
          <div className="panel p-6 text-center">
            <div className="text-3xl mb-3">✓</div>
            <h2 className="font-bold text-lg text-steel-900 mb-2">Password updated</h2>
            <p className="text-sm text-steel-600 mb-4">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <Link href="/login" className="btn-accent inline-block px-8">
              Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Validate token
  if (!token) {
    return <InvalidToken message="No reset token provided." />;
  }

  const userId = await validateResetToken(token);
  if (!userId) {
    return <InvalidToken message="This reset link is invalid or has expired." />;
  }

  async function resetPassword(formData: FormData) {
    'use server';
    const tkn = String(formData.get('token') || '');
    const newPw = String(formData.get('newPassword') || '');
    const confirm = String(formData.get('confirmPassword') || '');

    if (!newPw || newPw.length < 6) {
      redirect(`/reset-password?token=${tkn}&error=Password must be at least 6 characters`);
    }
    if (newPw !== confirm) {
      redirect(`/reset-password?token=${tkn}&error=Passwords do not match`);
    }

    // Look up user before consuming token for audit
    const resetRecord = await prisma.passwordReset.findFirst({
      where: { token: tkn, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: { select: { id: true, email: true, companyId: true } } },
    });

    const ok = await consumeResetToken(tkn, newPw);
    if (!ok) {
      redirect(`/reset-password?token=${tkn}&error=Token expired or already used`);
    }

    // Audit: password reset via email link
    if (resetRecord?.user?.companyId) {
      await audit({
        companyId: resetRecord.user.companyId,
        entityType: 'user',
        entityId: resetRecord.user.id,
        action: 'force_password_reset',
        actor: resetRecord.user.email,
        actorRole: 'DISPATCHER',
        summary: `${resetRecord.user.email} reset password via email link`,
      });
    }

    redirect('/reset-password?success=1');
  }

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">TF</div>
            <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
          </div>
          <p className="text-steel-400 text-sm mt-2">Set a new password</p>
        </div>

        <form action={resetPassword} className="panel p-6 space-y-4">
          <input type="hidden" name="token" value={token} />

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>
          )}

          <div>
            <label className="label" htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={6}
              autoFocus
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={6}
              className="input"
            />
          </div>
          <button type="submit" className="btn-accent w-full">Reset Password</button>
        </form>
      </div>
    </main>
  );
}

function InvalidToken({ message }: { message: string }) {
  return (
    <main className="min-h-screen grid place-items-center p-6 bg-diesel">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-xl">TF</div>
            <h1 className="text-white text-2xl font-bold tracking-tight">TruckFlowUS</h1>
          </div>
        </div>
        <div className="panel p-6 text-center">
          <div className="text-3xl mb-3">⚠️</div>
          <h2 className="font-bold text-lg text-steel-900 mb-2">Invalid Link</h2>
          <p className="text-sm text-steel-600 mb-4">{message}</p>
          <Link href="/forgot-password" className="text-sm text-safety-dark hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    </main>
  );
}
