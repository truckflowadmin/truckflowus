import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const DRIVER_COOKIE = 'tf_driver_session';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is required. Set it in .env.local for development.');
  }
  return secret;
}

const JWT_SECRET = getJwtSecret();

export interface DriverSession {
  driverId: string;
  companyId: string;
  name: string;
  phone: string;
}

// ---------------------------------------------------------------------------
// PIN hashing
// ---------------------------------------------------------------------------
export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ---------------------------------------------------------------------------
// Security answer hashing (stored as lowercase bcrypt)
// ---------------------------------------------------------------------------
export async function hashAnswer(answer: string): Promise<string> {
  return bcrypt.hash(answer.trim().toLowerCase(), 12);
}

export async function verifyAnswer(answer: string, hash: string): Promise<boolean> {
  return bcrypt.compare(answer.trim().toLowerCase(), hash);
}

// ---------------------------------------------------------------------------
// JWT session
// ---------------------------------------------------------------------------
export function signDriverSession(payload: DriverSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '2d', audience: 'driver' });
}

export function verifyDriverSession(token: string): DriverSession | null {
  try {
    return jwt.verify(token, JWT_SECRET, { audience: 'driver' }) as DriverSession;
  } catch (err: any) {
    console.log(`[driver-auth] JWT verify failed: ${err.message}`);
    return null;
  }
}

export function setDriverSessionCookie(token: string) {
  cookies().set(DRIVER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 2, // 2 days
  });
}

export function clearDriverSessionCookie() {
  cookies().delete(DRIVER_COOKIE);
}

export async function getDriverSession(): Promise<DriverSession | null> {
  const token = cookies().get(DRIVER_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyDriverSession(token);
  if (!payload) return null;

  // Check session invalidation (force-logout by superadmin)
  const driver = await prisma.driver.findUnique({
    where: { id: payload.driverId },
    select: { sessionInvalidatedAt: true },
  });
  if (driver?.sessionInvalidatedAt) {
    const decoded = jwt.decode(token) as { iat?: number } | null;
    if (decoded?.iat && decoded.iat < driver.sessionInvalidatedAt.getTime() / 1000) {
      clearDriverSessionCookie();
      return null;
    }
  }

  return payload;
}

/**
 * Get driver session from either cookie (web) or Authorization header (mobile app).
 * Call this from API routes that need to support both web and native app clients.
 */
export async function getDriverSessionFromRequest(req: Request): Promise<DriverSession | null> {
  // Try X-Driver-Token first (mobile app — immune to iOS Authorization header stripping)
  // Then fall back to standard Authorization Bearer header (web / other clients)
  const customToken = req.headers.get('X-Driver-Token');
  const authHeader = req.headers.get('Authorization');
  const token = customToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (token) {
    const payload = verifyDriverSession(token);
    if (payload) {
      // Check session invalidation
      const driver = await prisma.driver.findUnique({
        where: { id: payload.driverId },
        select: { sessionInvalidatedAt: true },
      });
      if (driver?.sessionInvalidatedAt) {
        const decoded = jwt.decode(token) as { iat?: number } | null;
        if (decoded?.iat && decoded.iat < driver.sessionInvalidatedAt.getTime() / 1000) {
          return null;
        }
      }
      return payload;
    }
  }

  // Fall back to cookie (web)
  return getDriverSession();
}

/**
 * Login a driver by phone + PIN. Returns session payload or null.
 */
export async function loginDriver(phone: string, pin: string): Promise<DriverSession | { notFound: true } | { wrongPin: true }> {
  // Normalize phone
  const normalizedPhone = phone.replace(/\D/g, '');
  const phoneVariants = [
    normalizedPhone,
    `+${normalizedPhone}`,
    `+1${normalizedPhone}`,
    normalizedPhone.startsWith('1') ? `+${normalizedPhone}` : null,
    normalizedPhone.startsWith('1') ? normalizedPhone.slice(1) : null,
  ].filter(Boolean);

  const driver = await prisma.driver.findFirst({
    where: {
      phone: { in: phoneVariants as string[] },
      active: true,
      pinSet: true,
    },
    select: { id: true, companyId: true, name: true, phone: true, pinHash: true },
  });

  if (!driver || !driver.pinHash) return { notFound: true as const };
  const valid = await verifyPin(pin, driver.pinHash);
  if (!valid) return { wrongPin: true as const };

  // Track last login time AND invalidate any existing sessions on other devices.
  // getDriverSession() already checks JWT `iat` against sessionInvalidatedAt, so
  // setting it to "now" causes every previously-issued token to be rejected.
  const now = new Date();
  await prisma.driver.update({
    where: { id: driver.id },
    data: { lastLoginAt: now, sessionInvalidatedAt: now },
  });

  return {
    driverId: driver.id,
    companyId: driver.companyId,
    name: driver.name,
    phone: driver.phone,
  };
}

// ---------------------------------------------------------------------------
// Re-export from the shared file so existing imports keep working.
// The list lives in security-questions.ts so client components can import
// it without pulling in next/headers (server-only).
export { SECURITY_QUESTIONS } from './security-questions';
