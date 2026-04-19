/**
 * Audit logging helper.
 *
 * Creates AuditLog rows that are visible to both superadmin and dispatchers.
 * Call this from any server action or API route that mutates tenant data.
 */

import { prisma } from './prisma';

export type AuditEntityType = 'ticket' | 'driver' | 'customer' | 'company' | 'user';
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'status_change'
  | 'assign'
  | 'suspend'
  | 'unsuspend'
  | 'plan_change'
  | 'feature_override'
  | 'force_password_reset'
  | 'send_reset_email';

interface AuditEntry {
  companyId: string;
  entityType: AuditEntityType;
  entityId?: string | null;
  action: AuditAction | string;
  actor: string; // email or name
  actorRole: 'SUPERADMIN' | 'ADMIN' | 'DISPATCHER';
  summary: string;
  details?: Record<string, any> | null;
}

/**
 * Write an audit log entry. Fire-and-forget — never throws.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: entry.companyId,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        action: entry.action,
        actor: entry.actor,
        actorRole: entry.actorRole,
        summary: entry.summary,
        details: entry.details ? JSON.stringify(entry.details) : null,
      },
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log:', err);
  }
}

/**
 * Fetch recent audit entries for an entity.
 */
export async function getEntityAuditLog(
  entityId: string,
  limit = 20,
) {
  return prisma.auditLog.findMany({
    where: { entityId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Fetch recent audit entries for a company.
 */
export async function getCompanyAuditLog(
  companyId: string,
  opts?: { entityType?: AuditEntityType; limit?: number },
) {
  return prisma.auditLog.findMany({
    where: {
      companyId,
      ...(opts?.entityType ? { entityType: opts.entityType } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: opts?.limit ?? 50,
  });
}
