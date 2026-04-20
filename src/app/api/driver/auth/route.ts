import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import {
  loginDriver,
  signDriverSession,
  setDriverSessionCookie,
  clearDriverSessionCookie,
  hashPin,
  hashAnswer,
  verifyAnswer,
  SECURITY_QUESTIONS,
} from '@/lib/driver-auth';
import { checkRateLimit, recordAttempt, clearAttempts } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

const MAX_ATTEMPTS = 3;
const LOCKOUT_MS = 15 * 60 * 1000;

/**
 * POST /api/driver/auth
 * Actions: login, setup, reset-verify, reset-pin, logout
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  // ---- LOGIN ----
  if (action === 'login') {
    const { phone, pin } = body;
    if (!phone || !pin) {
      return NextResponse.json({ error: 'Phone and PIN required' }, { status: 400 });
    }

    const normalizedKey = phone.replace(/\D/g, '');

    // Helper: check if driver has usable security questions (set AND not locked out)
    async function driverHasSecurityQuestions(phoneKey: string): Promise<boolean> {
      const phoneVariants = [
        phoneKey,
        `+${phoneKey}`,
        `+1${phoneKey}`,
        phoneKey.startsWith('1') ? `+${phoneKey}` : null,
        phoneKey.startsWith('1') ? phoneKey.slice(1) : null,
      ].filter(Boolean) as string[];
      const d = await prisma.driver.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { securityQ1: true },
      });
      if (!d?.securityQ1) return false;
      // Check if security question attempts are also exhausted
      const sqLimit = await checkRateLimit({
        key: phoneKey,
        type: 'driver_pin_reset',
        maxAttempts: MAX_ATTEMPTS,
        windowMs: LOCKOUT_MS,
      });
      return sqLimit.allowed;
    }

    const limit = await checkRateLimit({
      key: normalizedKey,
      type: 'driver_login',
      maxAttempts: 3,
      windowMs: LOCKOUT_MS,
    });
    if (!limit.allowed) {
      const hasSQ = await driverHasSecurityQuestions(normalizedKey);
      // Check if driver has email for email-based reset
      const phoneVariants = [
        normalizedKey,
        `+${normalizedKey}`,
        `+1${normalizedKey}`,
        normalizedKey.startsWith('1') ? `+${normalizedKey}` : null,
        normalizedKey.startsWith('1') ? normalizedKey.slice(1) : null,
      ].filter(Boolean) as string[];
      const driverForEmail = await prisma.driver.findFirst({
        where: { phone: { in: phoneVariants } },
        select: { email: true },
      });
      return NextResponse.json({
        error: 'locked',
        hasSecurityQuestions: hasSQ,
        hasEmail: !!driverForEmail?.email,
        message: 'Account locked due to too many failed attempts. Please reset your PIN.',
      }, { status: 429 });
    }

    const loginResult = await loginDriver(phone, pin);

    // Phone not found — tell driver to contact their dispatcher
    if ('notFound' in loginResult) {
      return NextResponse.json({
        error: 'notFound',
        message: 'No account found with this phone number. Please contact your dispatcher for assistance.',
      }, { status: 401 });
    }

    // Wrong PIN — record attempt and check lockout
    if ('wrongPin' in loginResult) {
      await recordAttempt(normalizedKey, 'driver_login', false);
      const afterLimit = await checkRateLimit({
        key: normalizedKey,
        type: 'driver_login',
        maxAttempts: 3,
        windowMs: LOCKOUT_MS,
      });
      if (!afterLimit.allowed) {
        const hasSQ = await driverHasSecurityQuestions(normalizedKey);
        const pvs = [
          normalizedKey, `+${normalizedKey}`, `+1${normalizedKey}`,
          normalizedKey.startsWith('1') ? `+${normalizedKey}` : null,
          normalizedKey.startsWith('1') ? normalizedKey.slice(1) : null,
        ].filter(Boolean) as string[];
        const dfe = await prisma.driver.findFirst({ where: { phone: { in: pvs } }, select: { email: true } });
        return NextResponse.json({
          error: 'locked',
          hasSecurityQuestions: hasSQ,
          hasEmail: !!dfe?.email,
          message: 'Account locked due to too many failed attempts. Please reset your PIN.',
        }, { status: 429 });
      }
      return NextResponse.json({ error: 'Invalid PIN', attemptsLeft: afterLimit.attemptsLeft }, { status: 401 });
    }

    await clearAttempts(normalizedKey, 'driver_login');
    const token = signDriverSession(loginResult);
    setDriverSessionCookie(token);
    return NextResponse.json({ ok: true, driverName: loginResult.name });
  }

  // ---- FIRST-TIME SETUP (via token) ----
  if (action === 'setup') {
    const { token, pin, email, securityQ1, securityA1, securityQ2, securityA2, securityQ3, securityA3 } = body;
    if (!token || !pin) {
      return NextResponse.json({ error: 'Token and PIN required' }, { status: 400 });
    }

    // Rate limit setup attempts by token to prevent brute-force
    const setupLimit = await checkRateLimit({
      key: `setup:${token}`,
      type: 'driver_setup',
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000,
    });
    if (!setupLimit.allowed) {
      return NextResponse.json({ error: 'Too many setup attempts. Try again later.' }, { status: 429 });
    }
    await recordAttempt(`setup:${token}`, 'driver_setup', true);

    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
    }
    if (!securityQ1 || !securityA1 || !securityQ2 || !securityA2 || !securityQ3 || !securityA3) {
      return NextResponse.json({ error: 'All 3 security questions and answers required' }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({ where: { accessToken: token } });
    if (!driver || !driver.active) {
      return NextResponse.json({ error: 'Invalid or expired setup link' }, { status: 404 });
    }
    if (driver.pinSet) {
      return NextResponse.json({ error: 'Account already set up. Please use the login page.' }, { status: 400 });
    }


    const [pinHash, a1Hash, a2Hash, a3Hash] = await Promise.all([
      hashPin(pin),
      hashAnswer(securityA1),
      hashAnswer(securityA2),
      hashAnswer(securityA3),
    ]);

    await prisma.driver.update({
      where: { id: driver.id },
      data: {
        pinHash,
        pinSet: true,
        email: email || null,
        securityQ1,
        securityA1: a1Hash,
        securityQ2,
        securityA2: a2Hash,
        securityQ3,
        securityA3: a3Hash,
      },
    });

    await audit({
      companyId: driver.companyId,
      entityType: 'driver',
      entityId: driver.id,
      action: 'create',
      actor: driver.name,
      actorRole: 'DISPATCHER',
      summary: `Driver ${driver.name} (${driver.phone}) completed first-time PIN setup`,
    });

    // Auto-login after setup
    const session = {
      driverId: driver.id,
      companyId: driver.companyId,
      name: driver.name,
      phone: driver.phone,
    };
    const sessionToken = signDriverSession(session);
    setDriverSessionCookie(sessionToken);

    return NextResponse.json({ ok: true, driverName: driver.name });
  }

  // ---- RESET: VERIFY SECURITY QUESTIONS ----
  if (action === 'reset-verify') {
    const { phone, answer1, answer2, answer3 } = body;
    if (!phone || !answer1 || !answer2 || !answer3) {
      return NextResponse.json({ error: 'Phone and all 3 answers required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // Database-backed rate limit check
    const limit = await checkRateLimit({
      key: normalizedPhone,
      type: 'driver_pin_reset',
      maxAttempts: MAX_ATTEMPTS,
      windowMs: LOCKOUT_MS,
    });
    if (!limit.allowed) {
      return NextResponse.json({
        error: `Too many failed attempts. Try again in ${limit.retryAfterMinutes} minutes, or reset via email.`,
        locked: true,
        attemptsExhausted: true,
      }, { status: 429 });
    }

    const phoneVariants = [
      normalizedPhone,
      `+${normalizedPhone}`,
      `+1${normalizedPhone}`,
      normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : null,
      normalizedPhone.startsWith('1') ? normalizedPhone.slice(1) : null,
    ].filter(Boolean);

    const driver = await prisma.driver.findFirst({
      where: { phone: { in: phoneVariants as string[] }, active: true, pinSet: true },
    });
    if (!driver || !driver.securityA1 || !driver.securityA2 || !driver.securityA3) {
      // Generic error to prevent phone number enumeration
      return NextResponse.json({ error: 'Security questions not available for this account' }, { status: 400 });
    }

    const [v1, v2, v3] = await Promise.all([
      verifyAnswer(answer1, driver.securityA1),
      verifyAnswer(answer2, driver.securityA2),
      verifyAnswer(answer3, driver.securityA3),
    ]);

    if (!v1 || !v2 || !v3) {
      await recordAttempt(normalizedPhone, 'driver_pin_reset', false);

      const updated = await checkRateLimit({
        key: normalizedPhone,
        type: 'driver_pin_reset',
        maxAttempts: MAX_ATTEMPTS,
        windowMs: LOCKOUT_MS,
      });

      if (!updated.allowed) {
        return NextResponse.json({
          error: 'Too many incorrect answers. You can reset your PIN via email instead.',
          locked: true,
          attemptsExhausted: true,
          hasEmail: !!driver.email,
          remainingAttempts: 0,
        }, { status: 429 });
      }

      return NextResponse.json({
        error: `One or more answers are incorrect. ${updated.attemptsLeft} attempt${updated.attemptsLeft !== 1 ? 's' : ''} remaining.`,
        remainingAttempts: updated.attemptsLeft,
        attemptsExhausted: false,
      }, { status: 401 });
    }

    // Success — clear failed attempts
    await clearAttempts(normalizedPhone, 'driver_pin_reset');
    await recordAttempt(normalizedPhone, 'driver_pin_reset', true);

    // Generate a short-lived, single-use reset token (15 minutes)
    const securityResetToken = randomBytes(32).toString('hex');
    const securityResetExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await prisma.$executeRaw`
      UPDATE "Driver"
      SET "resetToken" = ${securityResetToken}, "resetTokenExp" = ${securityResetExpiry}
      WHERE "id" = ${driver.id}
    `;

    return NextResponse.json({ ok: true, resetToken: securityResetToken, driverName: driver.name });
  }

  // ---- RESET: SET NEW PIN (via security questions) ----
  if (action === 'reset-pin') {
    const { resetToken, newPin } = body;
    if (!resetToken || !newPin) {
      return NextResponse.json({ error: 'Reset token and new PIN required' }, { status: 400 });
    }
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
    }

    // Look up by resetToken (time-limited, single-use)
    const rows = await prisma.$queryRaw<{ id: string; active: boolean; resetTokenExp: Date | null }[]>`
      SELECT "id", "active", "resetTokenExp"
      FROM "Driver"
      WHERE "resetToken" = ${resetToken}
      LIMIT 1
    `;
    const driver = rows[0];
    if (!driver || !driver.active) {
      return NextResponse.json({ error: 'Invalid or expired reset token' }, { status: 404 });
    }
    if (!driver.resetTokenExp || new Date() > new Date(driver.resetTokenExp)) {
      // Clear expired token
      await prisma.$executeRaw`UPDATE "Driver" SET "resetToken" = NULL, "resetTokenExp" = NULL WHERE "id" = ${driver.id}`;
      return NextResponse.json({ error: 'Reset token has expired. Please try again.' }, { status: 410 });
    }

    // Hash new PIN and clear the reset token (single-use)
    const pinHash = await hashPin(newPin);
    await prisma.$executeRaw`
      UPDATE "Driver"
      SET "pinHash" = ${pinHash}, "resetToken" = NULL, "resetTokenExp" = NULL
      WHERE "id" = ${driver.id}
    `;

    // Audit log + clear login lockout so driver can log in immediately
    const driverInfo = await prisma.driver.findUnique({ where: { id: driver.id }, select: { name: true, phone: true, companyId: true } });
    if (driverInfo) {
      // Clear login lockout — the driver just proved identity via security questions
      const normalizedPhone = driverInfo.phone.replace(/\D/g, '');
      await clearAttempts(normalizedPhone, 'driver_login');

      await audit({
        companyId: driverInfo.companyId,
        entityType: 'driver',
        entityId: driver.id,
        action: 'force_pin_reset',
        actor: driverInfo.name,
        actorRole: 'DISPATCHER',
        summary: `Driver ${driverInfo.name} (${driverInfo.phone}) reset PIN via security questions`,
      });
    }

    return NextResponse.json({ ok: true });
  }

  // ---- RESET: GET SECURITY QUESTIONS FOR A PHONE ----
  if (action === 'get-questions') {
    const { phone } = body;
    if (!phone) {
      return NextResponse.json({ error: 'Phone required' }, { status: 400 });
    }

    const normalizedPhone = phone.replace(/\D/g, '');

    // Rate limit to prevent phone enumeration
    const gqLimit = await checkRateLimit({
      key: `gq:${normalizedPhone}`,
      type: 'driver_get_questions',
      maxAttempts: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (!gqLimit.allowed) {
      return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
    }
    await recordAttempt(`gq:${normalizedPhone}`, 'driver_get_questions', true);
    const phoneVariants = [
      normalizedPhone,
      `+${normalizedPhone}`,
      `+1${normalizedPhone}`,
      normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : null,
      normalizedPhone.startsWith('1') ? normalizedPhone.slice(1) : null,
    ].filter(Boolean);

    const driver = await prisma.driver.findFirst({
      where: { phone: { in: phoneVariants as string[] }, active: true, pinSet: true },
      select: { securityQ1: true, securityQ2: true, securityQ3: true, email: true },
    });
    // Return generic error to prevent phone number enumeration
    if (!driver || !driver.securityQ1) {
      return NextResponse.json({ error: 'Security questions not available for this account' }, { status: 400 });
    }

    return NextResponse.json({
      questions: [driver.securityQ1, driver.securityQ2, driver.securityQ3],
      hasEmail: !!driver.email,
    });
  }

  // ---- RESET: SEND EMAIL LINK ----
  if (action === 'send-reset-email') {
    const { phone } = body;
    if (!phone) {
      return NextResponse.json({ error: 'Phone required' }, { status: 400 });
    }

    try {
      const normalizedPhone = phone.replace(/\D/g, '');

      // Rate limit to prevent email bombing (max 3 per 15 min)
      const emailLimit = await checkRateLimit({
        key: `dre:${normalizedPhone}`,
        type: 'driver_reset_email',
        maxAttempts: 3,
        windowMs: 15 * 60 * 1000,
      });
      if (!emailLimit.allowed) {
        return NextResponse.json({ error: 'Too many reset emails. Please try again later.' }, { status: 429 });
      }
      await recordAttempt(`dre:${normalizedPhone}`, 'driver_reset_email', true);
      const phoneVariants = [
        normalizedPhone,
        `+${normalizedPhone}`,
        `+1${normalizedPhone}`,
        normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : null,
        normalizedPhone.startsWith('1') ? normalizedPhone.slice(1) : null,
      ].filter(Boolean);

      const driver = await prisma.driver.findFirst({
        where: { phone: { in: phoneVariants as string[] }, active: true, pinSet: true },
        select: { id: true, email: true, name: true },
      });

      if (!driver || !driver.email) {
        // Return success even if not found to prevent phone enumeration
        return NextResponse.json({ ok: true, maskedEmail: '***' });
      }

      // Generate a secure, time-limited token (1 hour)
      const token = randomBytes(32).toString('hex');
      const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Use raw SQL so this works even if Prisma client hasn't been regenerated yet
      await prisma.$executeRaw`
        UPDATE "Driver"
        SET "resetToken" = ${token}, "resetTokenExp" = ${expiry}
        WHERE "id" = ${driver.id}
      `;

      // Build reset URL
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/d/reset-email/${token}`;

      // Send email
      const maskedEmail = driver.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      const result = await sendEmail({
        to: driver.email,
        subject: 'TruckFlowUS — Reset Your PIN',
        text: `Hi ${driver.name},\n\nYou requested a PIN reset. Click the link below to set a new PIN:\n\n${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, you can safely ignore this email.\n\n— TruckFlowUS`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a1a2e; margin-bottom: 8px;">Reset Your PIN</h2>
            <p style="color: #555; font-size: 15px;">Hi ${driver.name},</p>
            <p style="color: #555; font-size: 15px;">You requested a PIN reset for your TruckFlowUS account. Click the button below to set a new PIN:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${resetUrl}" style="background: #f5c518; color: #1a1a2e; font-weight: 700; font-size: 16px; padding: 14px 32px; border-radius: 8px; text-decoration: none; display: inline-block;">
                Reset My PIN
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
        console.error('[auth] Failed to send reset email:', result.error);
        return NextResponse.json({ error: 'Failed to send email. Please try again or contact your dispatcher.' }, { status: 500 });
      }

      // Audit: PIN reset email sent
      const driverCoForAudit = await prisma.driver.findUnique({
        where: { id: driver.id },
        select: { companyId: true, phone: true },
      });
      if (driverCoForAudit?.companyId) {
        await audit({
          companyId: driverCoForAudit.companyId,
          entityType: 'driver',
          entityId: driver.id,
          action: 'send_driver_reset_email',
          actor: driver.name,
          actorRole: 'DISPATCHER',
          summary: `PIN reset email sent to ${maskedEmail} for driver ${driver.name} (${driverCoForAudit.phone})`,
        });
      }

      return NextResponse.json({ ok: true, maskedEmail });
    } catch (err: any) {
      console.error('[auth] send-reset-email error:', err?.message || err);
      const detail = process.env.NODE_ENV === 'development' ? ` (${err?.message || 'unknown'})` : '';
      return NextResponse.json({ error: `Failed to send reset email. Please try again.${detail}` }, { status: 500 });
    }
  }

  // ---- RESET: SET PIN VIA EMAIL TOKEN ----
  if (action === 'reset-pin-email') {
    const { resetToken: emailResetToken, newPin } = body;
    if (!emailResetToken || !newPin) {
      return NextResponse.json({ error: 'Reset token and new PIN required' }, { status: 400 });
    }
    if (newPin.length < 4 || newPin.length > 6 || !/^\d+$/.test(newPin)) {
      return NextResponse.json({ error: 'PIN must be 4-6 digits' }, { status: 400 });
    }

    try {
      // Use raw SQL to find driver by resetToken (field may not be in generated Prisma client)
      const rows = await prisma.$queryRaw<{ id: string; active: boolean; name: string; resetTokenExp: Date | null }[]>`
        SELECT "id", "active", "name", "resetTokenExp"
        FROM "Driver"
        WHERE "resetToken" = ${emailResetToken}
        LIMIT 1
      `;

      const driver = rows[0];
      if (!driver || !driver.active) {
        return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
      }
      if (!driver.resetTokenExp || new Date() > new Date(driver.resetTokenExp)) {
        // Clear expired token
        await prisma.$executeRaw`
          UPDATE "Driver"
          SET "resetToken" = NULL, "resetTokenExp" = NULL
          WHERE "id" = ${driver.id}
        `;
        return NextResponse.json({ error: 'This reset link has expired. Please request a new one.' }, { status: 410 });
      }

      // Hash new PIN and clear the reset token
      const pinHash = await hashPin(newPin);
      await prisma.$executeRaw`
        UPDATE "Driver"
        SET "pinHash" = ${pinHash}, "resetToken" = NULL, "resetTokenExp" = NULL
        WHERE "id" = ${driver.id}
      `;

      // Audit + clear login lockout so driver can log in immediately
      const driverForAudit = await prisma.driver.findUnique({
        where: { id: driver.id },
        select: { companyId: true, phone: true },
      });
      if (driverForAudit) {
        // Clear login lockout — the driver just proved identity via email link
        const normalizedPhone = driverForAudit.phone.replace(/\D/g, '');
        await clearAttempts(normalizedPhone, 'driver_login');
        await clearAttempts(normalizedPhone, 'driver_pin_reset');

        if (driverForAudit.companyId) {
          await audit({
            companyId: driverForAudit.companyId,
            entityType: 'driver',
            entityId: driver.id,
            action: 'force_pin_reset',
            actor: driver.name,
            actorRole: 'DISPATCHER',
            summary: `Driver ${driver.name} (${driverForAudit.phone}) reset PIN via email link`,
          });
        }
      }

      return NextResponse.json({ ok: true, driverName: driver.name });
    } catch (err: any) {
      console.error('[auth] reset-pin-email error:', err);
      return NextResponse.json({ error: 'Failed to reset PIN. The link may be invalid.' }, { status: 500 });
    }
  }

  // ---- LOGOUT ----
  if (action === 'logout') {
    clearDriverSessionCookie();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
