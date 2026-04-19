import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { forceResetPassword, triggerResetEmail } from '@/lib/password-reset';
import { hashPin } from '@/lib/driver-auth';
import { audit } from '@/lib/audit';
import { clearAttempts } from '@/lib/rate-limit';
import { randomBytes } from 'crypto';
import TenantNav from '@/components/TenantNav';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Dispatcher server actions
// ---------------------------------------------------------------------------

async function forceResetAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const userId = String(formData.get('userId') || '');
  const companyId = String(formData.get('companyId') || '');
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  // Verify entity belongs to claimed company
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?pwError=User+not+found`);
  }

  if (!newPassword || newPassword.length < 6) {
    redirect(`/sa/tenants/${companyId}/passwords?pwError=Password+must+be+at+least+6+characters`);
  }
  if (newPassword !== confirmPassword) {
    redirect(`/sa/tenants/${companyId}/passwords?pwError=Passwords+do+not+match`);
  }

  await forceResetPassword(userId, newPassword);
  await audit({
    companyId,
    entityType: 'user',
    entityId: userId,
    action: 'force_password_reset',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Force-reset password for ${user?.email ?? userId}`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?pwSuccess=${encodeURIComponent(user.email)}`);
}

async function sendResetEmailAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const userId = String(formData.get('userId') || '');
  const companyId = String(formData.get('companyId') || '');
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('User not found')}&msgType=error`);
  }

  const sent = await triggerResetEmail(userId, appUrl);
  if (!sent) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('Failed to send reset email — check SMTP settings')}&msgType=error`);
  }

  await audit({
    companyId,
    entityType: 'user',
    entityId: userId,
    action: 'send_reset_email',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Sent password reset email to ${user?.email ?? userId}`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent(`Password reset email sent to ${user.email}`)}&msgType=success`);
}

async function clearUserSecurityQuestionsAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const userId = String(formData.get('userId') || '');
  const companyId = String(formData.get('companyId') || '');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('User not found')}&msgType=error`);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      securityQ1: null, securityA1: null,
      securityQ2: null, securityA2: null,
      securityQ3: null, securityA3: null,
    },
  });
  // Set flag via raw SQL — safe if column doesn't exist yet (pre-migration)
  try {
    await prisma.$executeRaw`UPDATE "User" SET "mustSetSecurityQuestions" = true WHERE "id" = ${userId}`;
  } catch { /* column may not exist yet */ }

  await audit({
    companyId,
    entityType: 'user',
    entityId: userId,
    action: 'clear_security_questions',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Cleared security questions for ${user?.email ?? userId} — will be required to re-set at next login`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent(`Cleared security questions for ${user.email}. They will be required to set new ones at next login.`)}&msgType=success`);
}

// ---------------------------------------------------------------------------
// Driver server actions
// ---------------------------------------------------------------------------

async function forceResetDriverPinAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');
  const newPin = String(formData.get('newPin') || '');
  const confirmPin = String(formData.get('confirmPin') || '');

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver || driver.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?pinError=Driver+not+found`);
  }

  if (!/^\d{4,6}$/.test(newPin)) {
    redirect(`/sa/tenants/${companyId}/passwords?pinError=PIN+must+be+4-6+digits`);
  }
  if (newPin !== confirmPin) {
    redirect(`/sa/tenants/${companyId}/passwords?pinError=PINs+do+not+match`);
  }

  const hash = await hashPin(newPin);
  await prisma.driver.update({
    where: { id: driverId },
    data: { pinHash: hash, pinSet: true },
  });

  // Clear any login lockout so the driver can log in immediately with the new PIN
  const normalizedPhone = driver.phone.replace(/\D/g, '');
  await clearAttempts(normalizedPhone, 'driver_login');

  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'force_pin_reset',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Force-reset PIN for driver ${driver?.name ?? driverId} (${driver?.phone ?? ''})`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?pinSuccess=${encodeURIComponent(driver.name)}`);
}

async function sendDriverResetEmailAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver || driver.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('Driver not found')}&msgType=error`);
  }
  if (!driver.email) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent(`Driver ${driver.name} has no email on file`)}&msgType=error`);
  }

  const token = randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.driver.update({
    where: { id: driverId },
    data: { resetToken: token, resetTokenExp: exp },
  });

  const { sendEmail } = await import('@/lib/email');
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  const resetUrl = `${appUrl}/d/reset-email/${token}`;

  const result = await sendEmail({
    to: driver.email,
    subject: 'TruckFlowUS — Reset Your Driver PIN',
    text: `Your PIN has been flagged for reset by an administrator.\n\nClick the link below to set a new PIN:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\n— TruckFlowUS`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Reset Your Driver PIN</h2>
        <p style="color: #555; font-size: 15px;">Your PIN has been flagged for reset by an administrator.</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background: #f5c518; color: #1a1a2e; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Reset My PIN
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">This link expires in 1 hour.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">TruckFlowUS</p>
      </div>
    `,
  });

  if (!result.success) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('Failed to send email — check SMTP settings')}&msgType=error`);
  }

  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'send_driver_reset_email',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Sent PIN reset email to driver ${driver.name} (${driver.email})`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent(`PIN reset email sent to ${driver.name} (${driver.email})`)}&msgType=success`);
}

async function clearDriverSecurityQuestionsAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');

  const driverCheck = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driverCheck || driverCheck.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('Driver not found')}&msgType=error`);
  }

  await prisma.driver.update({
    where: { id: driverId },
    data: {
      securityQ1: null, securityA1: null,
      securityQ2: null, securityA2: null,
      securityQ3: null, securityA3: null,
    },
  });
  // Set flag via raw SQL — safe if column doesn't exist yet (pre-migration)
  try {
    await prisma.$executeRaw`UPDATE "Driver" SET "mustSetSecurityQuestions" = true WHERE "id" = ${driverId}`;
  } catch { /* column may not exist yet */ }

  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'clear_security_questions',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Cleared security questions for driver ${driverCheck.name} — will be required to re-set at next login`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent(`Cleared security questions for ${driverCheck.name}. They will be required to set new ones at next login.`)}&msgType=success`);
}

async function resetDriverSetupAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');

  const driverCheck = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driverCheck || driverCheck.companyId !== companyId) {
    redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent('Driver not found')}&msgType=error`);
  }

  // Clear login lockout too
  const normalizedPhone = driverCheck.phone.replace(/\D/g, '');
  await clearAttempts(normalizedPhone, 'driver_login');
  await clearAttempts(normalizedPhone, 'driver_pin_reset');

  await prisma.driver.update({
    where: { id: driverId },
    data: {
      pinHash: null,
      pinSet: false,
      accessToken: randomBytes(24).toString('hex'), // regenerate to invalidate old setup URL
      securityQ1: null, securityA1: null,
      securityQ2: null, securityA2: null,
      securityQ3: null, securityA3: null,
      resetToken: null,
      resetTokenExp: null,
    },
  });
  // Clear the flag via raw SQL — fresh setup will require them anyway
  try {
    await prisma.$executeRaw`UPDATE "Driver" SET "mustSetSecurityQuestions" = false WHERE "id" = ${driverId}`;
  } catch { /* column may not exist yet */ }

  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'reset_driver_setup',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Full auth reset for driver ${driverCheck.name} — must redo first-time setup`,
  });

  redirect(`/sa/tenants/${companyId}/passwords?msg=${encodeURIComponent(`Full auth reset for ${driverCheck.name}. They must redo first-time setup via their new access link.`)}&msgType=success`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function PasswordManagementPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { pinSuccess?: string; pinError?: string; pwSuccess?: string; pwError?: string; msg?: string; msgType?: string };
}) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      users: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          lastPasswordChange: true,
          securityQ1: true,
          createdAt: true,
        },
      },
      drivers: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          active: true,
          pinSet: true,
          securityQ1: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!company) notFound();

  // Get recent password reset tokens for this company's users
  const userIds = company.users.map((u) => u.id);
  const recentResets = await prisma.passwordReset.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { email: true } } },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <header>
        <h1 className="text-2xl font-bold text-white">Password & PIN Management</h1>
        <p className="text-purple-300 text-sm mt-1">
          Force-reset credentials, send reset emails, manage security questions, and view login history for {company.name}.
        </p>
      </header>

      {/* General success/error banner */}
      {searchParams.msg && (
        <div className={`p-3 rounded-lg text-sm ${
          searchParams.msgType === 'error'
            ? 'bg-red-900/50 border border-red-700 text-red-200'
            : 'bg-green-900/50 border border-green-700 text-green-200'
        }`}>
          {searchParams.msg}
        </div>
      )}

      {/* ── DISPATCHERS / ADMINS ────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          Dispatchers &amp; Admins
        </h2>

        {searchParams.pwSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/50 border border-green-700 text-green-200 text-sm">
            Password successfully reset for <strong>{searchParams.pwSuccess}</strong>.
          </div>
        )}
        {searchParams.pwError && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">
            {searchParams.pwError}
          </div>
        )}

        <div className="space-y-4">
          {company.users.map((user) => (
            <div key={user.id} className="panel-sa">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{user.name}</h3>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-700 text-purple-200'
                          : 'bg-purple-900 text-purple-300'
                      }`}
                    >
                      {user.role}
                    </span>
                    {user.securityQ1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900 text-green-200">
                        Security Q's Set
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-purple-300">{user.email}</div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div className="bg-purple-950/50 rounded p-2">
                  <div className="text-purple-400 uppercase tracking-wider">Last Login</div>
                  <div className="text-white mt-1">
                    <LocalTime date={user.lastLoginAt} fallback="Never" />
                  </div>
                </div>
                <div className="bg-purple-950/50 rounded p-2">
                  <div className="text-purple-400 uppercase tracking-wider">Password Changed</div>
                  <div className="text-white mt-1">
                    <LocalTime date={user.lastPasswordChange} fallback="Never (using original)" />
                  </div>
                </div>
                <div className="bg-purple-950/50 rounded p-2">
                  <div className="text-purple-400 uppercase tracking-wider">Account Created</div>
                  <div className="text-white mt-1">
                    <LocalTime date={user.createdAt} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                <form action={sendResetEmailAction}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="companyId" value={company.id} />
                  <button type="submit" className="btn-purple text-xs">
                    Send Reset Email
                  </button>
                </form>

                {user.securityQ1 && (
                  <form action={clearUserSecurityQuestionsAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-ghost text-xs text-yellow-300 hover:text-yellow-200">
                      Clear Security Questions
                    </button>
                  </form>
                )}

                <details className="flex-1">
                  <summary className="btn-ghost text-xs cursor-pointer inline-block">
                    Force Reset Password
                  </summary>
                  <form action={forceResetAction} className="mt-3 space-y-2 border-t border-purple-800 pt-3">
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label-sa text-xs">New Password</label>
                        <input
                          name="newPassword"
                          type="password"
                          required
                          minLength={6}
                          className="input-sa text-sm"
                          placeholder="Min 6 characters"
                        />
                      </div>
                      <div>
                        <label className="label-sa text-xs">Confirm</label>
                        <input
                          name="confirmPassword"
                          type="password"
                          required
                          minLength={6}
                          className="input-sa text-sm"
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-danger text-xs">
                      Set New Password
                    </button>
                    <p className="text-[10px] text-purple-400">
                      This immediately changes the user's password. They will need the new password to sign in.
                    </p>
                  </form>
                </details>
              </div>
            </div>
          ))}

          {company.users.length === 0 && (
            <div className="panel-sa text-center py-8">
              <p className="text-purple-300">No dispatchers on this tenant yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* ── DRIVERS ─────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Drivers ({company.drivers.length})
        </h2>

        {searchParams.pinSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-green-900/50 border border-green-700 text-green-200 text-sm">
            PIN successfully reset for <strong>{searchParams.pinSuccess}</strong>. The driver can now log in with the new PIN.
          </div>
        )}
        {searchParams.pinError && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-200 text-sm">
            {searchParams.pinError}
          </div>
        )}

        <div className="space-y-4">
          {company.drivers.map((driver) => (
            <div key={driver.id} className={`panel-sa ${!driver.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold">{driver.name}</h3>
                    {!driver.active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900 text-red-200">
                        Inactive
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        driver.pinSet
                          ? 'bg-green-900 text-green-200'
                          : 'bg-yellow-900 text-yellow-200'
                      }`}
                    >
                      {driver.pinSet ? 'PIN Set' : 'No PIN'}
                    </span>
                    {driver.securityQ1 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-900 text-green-200">
                        Security Q's Set
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-purple-300">
                    {driver.phone}
                    {driver.email && <span className="ml-2 text-purple-400">· {driver.email}</span>}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                <div className="bg-purple-950/50 rounded p-2">
                  <div className="text-purple-400 uppercase tracking-wider">Last Login</div>
                  <div className="text-white mt-1">
                    <LocalTime date={driver.lastLoginAt} fallback="Never" />
                  </div>
                </div>
                <div className="bg-purple-950/50 rounded p-2">
                  <div className="text-purple-400 uppercase tracking-wider">PIN Status</div>
                  <div className="text-white mt-1">
                    {driver.pinSet ? 'Set up & active' : 'Not set up yet'}
                  </div>
                </div>
                <div className="bg-purple-950/50 rounded p-2">
                  <div className="text-purple-400 uppercase tracking-wider">Created</div>
                  <div className="text-white mt-1">
                    <LocalTime date={driver.createdAt} />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                {driver.email && (
                  <form action={sendDriverResetEmailAction}>
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-purple text-xs">
                      Send PIN Reset Email
                    </button>
                  </form>
                )}

                {driver.securityQ1 && (
                  <form action={clearDriverSecurityQuestionsAction}>
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-ghost text-xs text-yellow-300 hover:text-yellow-200">
                      Clear Security Questions
                    </button>
                  </form>
                )}

                <details>
                  <summary className="btn-ghost text-xs cursor-pointer inline-block">
                    Force Reset PIN
                  </summary>
                  <form action={forceResetDriverPinAction} className="mt-3 space-y-2 border-t border-purple-800 pt-3">
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="label-sa text-xs">New PIN</label>
                        <input
                          name="newPin"
                          type="password"
                          required
                          minLength={4}
                          maxLength={6}
                          pattern="\d{4,6}"
                          className="input-sa text-sm"
                          placeholder="4-6 digits"
                        />
                      </div>
                      <div>
                        <label className="label-sa text-xs">Confirm</label>
                        <input
                          name="confirmPin"
                          type="password"
                          required
                          minLength={4}
                          maxLength={6}
                          className="input-sa text-sm"
                        />
                      </div>
                    </div>
                    <button type="submit" className="btn-danger text-xs">
                      Set New PIN
                    </button>
                  </form>
                </details>

                <details>
                  <summary className="btn-ghost text-xs cursor-pointer inline-block text-red-400">
                    Full Auth Reset
                  </summary>
                  <form action={resetDriverSetupAction} className="mt-3 border-t border-purple-800 pt-3">
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <p className="text-[10px] text-red-300 mb-2">
                      This clears the driver's PIN, security questions, and reset tokens.
                      The driver will need to redo their first-time setup via their access link.
                    </p>
                    <button type="submit" className="btn-danger text-xs">
                      Reset Everything
                    </button>
                  </form>
                </details>
              </div>
            </div>
          ))}

          {company.drivers.length === 0 && (
            <div className="panel-sa text-center py-8">
              <p className="text-purple-300">No drivers on this tenant yet.</p>
            </div>
          )}
        </div>
      </section>

      {/* Recent reset activity */}
      {recentResets.length > 0 && (
        <section className="panel-sa">
          <h2 className="font-semibold text-white mb-3">Recent Password Reset Activity</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
                <tr>
                  <th className="text-left py-2 pr-4">User</th>
                  <th className="text-left py-2 pr-4">Requested</th>
                  <th className="text-left py-2 pr-4">Expires</th>
                  <th className="text-left py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/40">
                {recentResets.map((r) => {
                  const expired = r.expiresAt < new Date();
                  const used = !!r.usedAt;
                  let status = 'Pending';
                  let statusClass = 'bg-yellow-900 text-yellow-200';
                  if (used) {
                    status = 'Used';
                    statusClass = 'bg-green-900 text-green-200';
                  } else if (expired) {
                    status = 'Expired';
                    statusClass = 'bg-red-900 text-red-200';
                  }

                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 text-white">{r.user.email}</td>
                      <td className="py-2 pr-4 text-purple-300"><LocalTime date={r.createdAt} /></td>
                      <td className="py-2 pr-4 text-purple-300"><LocalTime date={r.expiresAt} /></td>
                      <td className="py-2 pr-4">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusClass}`}>
                          {status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
