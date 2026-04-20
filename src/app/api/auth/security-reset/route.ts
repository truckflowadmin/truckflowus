import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAnswer } from '@/lib/driver-auth';
import { createPasswordResetToken } from '@/lib/password-reset';
import { checkRateLimit, recordAttempt, clearAttempts } from '@/lib/rate-limit';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 3;
const RATE_TYPE = 'security_reset';

/**
 * POST /api/auth/security-reset
 * Actions:
 *   get-questions  — returns the 3 security questions for a given email
 *   verify-answers — verify all 3 answers (with lockout)
 *   reset-password — set new password after successful verification
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const action: string = body.action;

    // ── get-questions ────────────────────────────────────────────────────
    if (action === 'get-questions') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) {
        return NextResponse.json({ error: 'Email required' }, { status: 400 });
      }

      // Rate limit to prevent username enumeration
      const qLimit = await checkRateLimit({
        key: `gq:${email}`,
        type: 'get_questions',
        maxAttempts: 10,
        windowMs: 15 * 60 * 1000,
      });
      if (!qLimit.allowed) {
        return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
      }
      await recordAttempt(`gq:${email}`, 'get_questions', true);

      const user = await prisma.user.findUnique({
        where: { email },
        select: { securityQ1: true, securityQ2: true, securityQ3: true },
      });

      // Return the same generic error for "not found" and "no questions set"
      // to prevent user enumeration
      if (!user || !user.securityQ1 || !user.securityQ2 || !user.securityQ3) {
        return NextResponse.json({ error: 'no_questions' }, { status: 400 });
      }

      return NextResponse.json({
        questions: [user.securityQ1, user.securityQ2, user.securityQ3],
      });
    }

    // ── verify-answers ───────────────────────────────────────────────────
    if (action === 'verify-answers') {
      const email = String(body.email || '').trim().toLowerCase();
      const a1 = String(body.a1 || '').trim();
      const a2 = String(body.a2 || '').trim();
      const a3 = String(body.a3 || '').trim();

      if (!email || !a1 || !a2 || !a3) {
        return NextResponse.json({ error: 'All answers required' }, { status: 400 });
      }

      // Database-backed rate limit check
      const limit = await checkRateLimit({
        key: email,
        type: RATE_TYPE,
        maxAttempts: MAX_ATTEMPTS,
        windowMs: 15 * 60 * 1000,
      });

      if (!limit.allowed) {
        return NextResponse.json({
          error: 'locked',
          minutesLeft: limit.retryAfterMinutes,
        }, { status: 429 });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          securityA1: true, securityA2: true, securityA3: true,
        },
      });

      if (!user || !user.securityA1 || !user.securityA2 || !user.securityA3) {
        // Same generic error to prevent user enumeration
        return NextResponse.json({ error: 'no_questions' }, { status: 400 });
      }

      const [v1, v2, v3] = await Promise.all([
        verifyAnswer(a1, user.securityA1),
        verifyAnswer(a2, user.securityA2),
        verifyAnswer(a3, user.securityA3),
      ]);

      if (!v1 || !v2 || !v3) {
        await recordAttempt(email, RATE_TYPE, false);

        // Re-check to see if this attempt exhausted the limit
        const updated = await checkRateLimit({
          key: email,
          type: RATE_TYPE,
          maxAttempts: MAX_ATTEMPTS,
          windowMs: 15 * 60 * 1000,
        });

        if (!updated.allowed) {
          return NextResponse.json({
            error: 'locked',
            minutesLeft: updated.retryAfterMinutes,
          }, { status: 429 });
        }

        return NextResponse.json({
          error: 'wrong_answers',
          attemptsLeft: updated.attemptsLeft,
        }, { status: 401 });
      }

      // Success — clear attempts, create a reset token
      await clearAttempts(email, RATE_TYPE);
      await recordAttempt(email, RATE_TYPE, true);

      const userForAudit = await prisma.user.findUnique({ where: { email }, select: { id: true, companyId: true } });
      if (userForAudit?.companyId) {
        await audit({
          companyId: userForAudit.companyId,
          entityType: 'user',
          entityId: userForAudit.id,
          action: 'update',
          actor: email,
          actorRole: 'DISPATCHER',
          summary: `${email} verified security questions for password reset`,
        });
      }

      const token = await createPasswordResetToken(email);
      if (!token) {
        return NextResponse.json({ error: 'Failed to create reset token' }, { status: 500 });
      }

      return NextResponse.json({ ok: true, resetToken: token });
    }

    // ── reset-password ───────────────────────────────────────────────────
    if (action === 'reset-password') {
      const token = String(body.token || '');
      const newPassword = String(body.newPassword || '');

      if (!token || !newPassword) {
        return NextResponse.json({ error: 'Token and password required' }, { status: 400 });
      }

      if (newPassword.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
      }

      const { consumeResetToken } = await import('@/lib/password-reset');
      // Look up user before consuming token so we can audit
      const resetRecord = await prisma.passwordReset.findFirst({
        where: { token, usedAt: null, expiresAt: { gt: new Date() } },
        include: { user: { select: { id: true, email: true, companyId: true } } },
      });
      const ok = await consumeResetToken(token, newPassword);
      if (!ok) {
        return NextResponse.json({ error: 'Token expired or already used' }, { status: 400 });
      }
      if (resetRecord?.user?.companyId) {
        await audit({
          companyId: resetRecord.user.companyId,
          entityType: 'user',
          entityId: resetRecord.user.id,
          action: 'force_password_reset',
          actor: resetRecord.user.email,
          actorRole: 'DISPATCHER',
          summary: `${resetRecord.user.email} reset password via security questions`,
        });
      }

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (e: any) {
    console.error('[security-reset]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
