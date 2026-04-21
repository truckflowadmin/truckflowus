import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import type { Role } from '@prisma/client';

const COOKIE_NAME = 'tf_session';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in .env.local for development.');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface SessionPayload {
  userId: string;
  /** null for SUPERADMIN (platform-level user). */
  companyId: string | null;
  role: Role;
  email: string;
  name: string;
  /** Set when a superadmin is impersonating this user. */
  impersonatedBy?: string;
}

const SA_BACKUP_COOKIE = 'tf_sa_backup';

/**
 * Save the superadmin's current session to a backup cookie before impersonation,
 * so they can return to their own session.
 */
export function backupSuperadminSession(token: string) {
  cookies().set(SA_BACKUP_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 30, // 30 minutes — short-lived for security
  });
}

/**
 * Restore the superadmin session from backup cookie (end impersonation).
 * Returns true if a backup was found and restored, false otherwise.
 */
export function restoreSuperadminSession(): boolean {
  const backup = cookies().get(SA_BACKUP_COOKIE)?.value;
  if (!backup) return false;
  const payload = verifySession(backup);
  if (!payload || payload.role !== 'SUPERADMIN') return false;
  setSessionCookie(backup);
  cookies().delete(SA_BACKUP_COOKIE);
  return true;
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 12);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2d', audience: 'dispatcher' });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET, { audience: 'dispatcher' }) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSessionCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 2, // 2 days
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

/**
 * Get the current session from the cookie. Returns null if not logged in,
 * if the token is invalid, or if the session has been force-invalidated
 * by a superadmin.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;

  // Check session invalidation (force-logout by superadmin)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { sessionInvalidatedAt: true },
  });
  if (user?.sessionInvalidatedAt) {
    // JWT `iat` is in seconds; compare with invalidation timestamp
    const decoded = jwt.decode(token) as { iat?: number } | null;
    if (decoded?.iat && decoded.iat < user.sessionInvalidatedAt.getTime() / 1000) {
      clearSessionCookie();
      return null;
    }
  }

  return payload;
}

/**
 * Require a tenant-scoped session (ADMIN or DISPATCHER). SUPERADMINs are
 * redirected elsewhere by the (protected) layout, so reaching here with one is
 * a bug — we throw. Return type guarantees non-null companyId so existing
 * per-tenant queries keep compiling and stay safe.
 */
export async function requireSession(): Promise<
  SessionPayload & { companyId: string }
> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (session.role === 'SUPERADMIN' || !session.companyId) {
    throw new Error('TENANT_ONLY');
  }
  return session as SessionPayload & { companyId: string };
}

/** Require a SUPERADMIN session. Throws otherwise. */
export async function requireSuperadmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error('UNAUTHENTICATED');
  if (session.role !== 'SUPERADMIN') throw new Error('SUPERADMIN_ONLY');
  return session;
}

export async function loginWithCredentials(email: string, password: string) {
  const { checkRateLimit, recordAttempt, clearAttempts } = await import('./rate-limit');
  const normalizedEmail = email.toLowerCase();

  // Rate limit check — lock after 3 failed attempts, require password reset
  const limit = await checkRateLimit({
    key: normalizedEmail,
    type: 'dispatcher_login',
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
  });
  // Helper: check if user has usable security questions (set AND not locked out)
  async function checkSecurityQuestionStatus(email: string): Promise<boolean> {
    const u = await prisma.user.findUnique({
      where: { email },
      select: { securityQ1: true },
    });
    if (!u?.securityQ1) return false;
    // Check if security question attempts are also exhausted
    const sqLimit = await checkRateLimit({
      key: email,
      type: 'security_reset',
      maxAttempts: 3,
      windowMs: 15 * 60 * 1000,
    });
    return sqLimit.allowed;
  }

  if (!limit.allowed) {
    const hasSQ = await checkSecurityQuestionStatus(normalizedEmail);
    return { locked: true as const, hasSecurityQuestions: hasSQ };
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true, name: true, role: true, companyId: true, passwordHash: true, securityQ1: true },
  });
  if (!user) {
    await recordAttempt(normalizedEmail, 'dispatcher_login', false);
    const afterLimit = await checkRateLimit({ key: normalizedEmail, type: 'dispatcher_login', maxAttempts: 3, windowMs: 15 * 60 * 1000 });
    if (!afterLimit.allowed) return { locked: true as const, hasSecurityQuestions: false };
    return { notFound: true as const, attemptsLeft: afterLimit.attemptsLeft };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await recordAttempt(normalizedEmail, 'dispatcher_login', false);
    const afterLimit = await checkRateLimit({ key: normalizedEmail, type: 'dispatcher_login', maxAttempts: 3, windowMs: 15 * 60 * 1000 });
    if (!afterLimit.allowed) {
      const hasSQ = user.securityQ1 ? await checkSecurityQuestionStatus(normalizedEmail) : false;
      return { locked: true as const, hasSecurityQuestions: hasSQ };
    }
    return { failed: true as const, attemptsLeft: afterLimit.attemptsLeft };
  }

  // Successful login — clear failed attempts
  await clearAttempts(normalizedEmail, 'dispatcher_login');

  // Block login for dispatchers whose company has been suspended by superadmin.
  if (user.companyId) {
    const co = await prisma.company.findUnique({
      where: { id: user.companyId },
      select: { suspended: true },
    });
    if (co?.suspended) return { suspended: true as const };
  }

  // Track last login time
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const payload: SessionPayload = {
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    name: user.name,
  };
  // Session regeneration: clear any existing cookie before issuing a new session
  clearSessionCookie();
  const token = signSession(payload);
  setSessionCookie(token);
  return payload;
}

/** Where a user lands after login, based on their role. */
export function landingPathForRole(role: Role): string {
  return role === 'SUPERADMIN' ? '/sa/overview' : '/dashboard';
}

/**
 * Async version that checks whether a dispatcher's company has a plan.
 * Redirects to /subscribe if not. Call from login flow.
 */
export async function landingPathForUser(
  role: Role,
  companyId: string | null,
): Promise<string> {
  if (role === 'SUPERADMIN') return '/sa/overview';
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { planId: true },
    });
    if (!company?.planId) return '/subscribe';
  }
  return '/dashboard';
}
