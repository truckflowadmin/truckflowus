/**
 * Password reset helpers.
 *
 * Flow:
 *   1. User submits email on /forgot-password
 *   2. We create a PasswordReset row with a unique token (1h TTL)
 *   3. We "send" the reset link (logged to console in dev, email in prod)
 *   4. User clicks /reset-password?token=xxx
 *   5. We validate the token, let them set a new password, mark token used
 */

import { prisma } from './prisma';
import { hashPassword } from './auth';
import { sendEmail } from './email';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Create a password reset token for the given email.
 * Returns the token string if the user exists, null otherwise.
 * We intentionally don't reveal whether the email exists to the caller page
 * (the page always shows a success message).
 */
export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) return null;

  // Invalidate any existing unused tokens for this user
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const reset = await prisma.passwordReset.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  return reset.token;
}

/**
 * Validate a password reset token. Returns the userId if valid.
 */
export async function validateResetToken(token: string): Promise<string | null> {
  const reset = await prisma.passwordReset.findUnique({ where: { token } });
  if (!reset) return null;
  if (reset.usedAt) return null; // already consumed
  if (reset.expiresAt < new Date()) return null; // expired
  return reset.userId;
}

/**
 * Consume a reset token and set the new password.
 */
export async function consumeResetToken(token: string, newPassword: string): Promise<boolean> {
  const userId = await validateResetToken(token);
  if (!userId) return false;

  const hash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, lastPasswordChange: new Date() },
    }),
    prisma.passwordReset.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
  ]);

  return true;
}

/**
 * Send the reset email via SMTP (uses the same nodemailer transport as invoices/driver reset).
 * Falls back to console log if SMTP is not configured.
 */
export async function sendResetEmail(email: string, token: string, appUrl: string) {
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  // Mask email in logs to avoid PII exposure
  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  console.log(`[email] Sending password reset to ${maskedEmail}`);

  const result = await sendEmail({
    to: email,
    subject: 'TruckFlowUS — Reset Your Password',
    text: `You requested a password reset for your TruckFlowUS account.\n\nClick the link below to set a new password:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\n— TruckFlowUS`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e; margin-bottom: 8px;">Reset Your Password</h2>
        <p style="color: #555; font-size: 15px;">You requested a password reset for your TruckFlowUS account.</p>
        <p style="color: #555; font-size: 15px;">Click the button below to set a new password:</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background: #f5c518; color: #1a1a2e; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block;">
            Reset My Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">This link expires in 1 hour.</p>
        <p style="color: #888; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px;">TruckFlowUS</p>
      </div>
    `,
  });

  if (!result.success) {
    console.error('[email] Failed to send password reset:', result.error);
  }
}

/**
 * Superadmin force-reset: sets the user's password directly and records the change.
 */
export async function forceResetPassword(userId: string, newPassword: string): Promise<boolean> {
  const hash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hash, lastPasswordChange: new Date() },
  });
  return true;
}

/**
 * Superadmin trigger: creates a reset token and sends the email on behalf of the user.
 */
export async function triggerResetEmail(userId: string, appUrl: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return false;

  // Invalidate existing tokens
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const reset = await prisma.passwordReset.create({
    data: {
      userId: user.id,
      expiresAt: new Date(Date.now() + RESET_TTL_MS),
    },
  });

  await sendResetEmail(user.email, reset.token, appUrl);
  return true;
}
