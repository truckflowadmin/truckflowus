/**
 * Database-backed rate limiting.
 *
 * Persists across server restarts and works across multiple instances.
 * Old records are cleaned up periodically.
 */
import { prisma } from './prisma';

interface RateLimitConfig {
  /** Unique key (email, phone, IP, etc.) */
  key: string;
  /** Category — e.g. "dispatcher_login", "driver_pin_reset", "security_reset" */
  type: string;
  /** Max failed attempts within the window */
  maxAttempts: number;
  /** Window size in milliseconds (default: 15 minutes) */
  windowMs?: number;
}

interface RateLimitResult {
  allowed: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  /** Minutes until the window resets (only meaningful when !allowed) */
  retryAfterMinutes: number;
}

/**
 * Check if a key is rate-limited. Does NOT record a new attempt —
 * call `recordAttempt()` after the check.
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const windowMs = config.windowMs ?? 15 * 60 * 1000;
  const windowStart = new Date(Date.now() - windowMs);

  const count = await prisma.loginAttempt.count({
    where: {
      key: config.key.toLowerCase(),
      type: config.type,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  const allowed = count < config.maxAttempts;
  return {
    allowed,
    attemptsUsed: count,
    attemptsLeft: Math.max(0, config.maxAttempts - count),
    retryAfterMinutes: allowed ? 0 : Math.ceil(windowMs / 60000),
  };
}

/**
 * Record an attempt (success or failure).
 */
export async function recordAttempt(
  key: string,
  type: string,
  success: boolean,
): Promise<void> {
  await prisma.loginAttempt.create({
    data: {
      key: key.toLowerCase(),
      type,
      success,
    },
  });

  // Probabilistic pruning — ~1% of writes trigger cleanup to keep table bounded
  if (Math.random() < 0.01) {
    pruneOldAttempts().catch(() => {}); // fire-and-forget
  }
}

/**
 * Clear failed attempts for a key (e.g. after successful login).
 */
export async function clearAttempts(key: string, type: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({
    where: { key: key.toLowerCase(), type },
  });
}

/**
 * Housekeeping — delete attempts older than the window.
 * Call periodically (e.g. from a cron job) to keep the table small.
 */
export async function pruneOldAttempts(olderThanMs = 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
