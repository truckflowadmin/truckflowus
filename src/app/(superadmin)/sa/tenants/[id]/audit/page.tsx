import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import TenantNav from '@/components/TenantNav';
import AuditFilters from './AuditFilters';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-900/60 text-emerald-200',
  update: 'bg-blue-900/60 text-blue-200',
  delete: 'bg-red-900/60 text-red-200',
  status_change: 'bg-yellow-900/60 text-yellow-200',
  assign: 'bg-purple-900/60 text-purple-200',
  suspend: 'bg-red-900/60 text-red-200',
  unsuspend: 'bg-emerald-900/60 text-emerald-200',
  plan_change: 'bg-blue-900/60 text-blue-200',
  feature_override: 'bg-purple-900/60 text-purple-200',
  // Password & PIN actions
  force_password_reset: 'bg-orange-900/60 text-orange-200',
  send_reset_email: 'bg-orange-900/60 text-orange-200',
  force_pin_reset: 'bg-orange-900/60 text-orange-200',
  send_driver_reset_email: 'bg-orange-900/60 text-orange-200',
  clear_security_questions: 'bg-yellow-900/60 text-yellow-200',
  reset_driver_setup: 'bg-red-900/60 text-red-200',
  // Session actions
  impersonate: 'bg-pink-900/60 text-pink-200',
  force_logout: 'bg-red-900/60 text-red-200',
  force_logout_all: 'bg-red-900/60 text-red-200',
};

const ENTITY_ICONS: Record<string, string> = {
  ticket: '▤',
  driver: '▲',
  customer: '◉',
  company: '⚙',
  user: '👤',
};

/** Friendly labels for action types in the filter dropdown */
const ACTION_LABELS: Record<string, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  status_change: 'Status Change',
  assign: 'Assign',
  suspend: 'Suspend',
  unsuspend: 'Unsuspend',
  plan_change: 'Plan Change',
  feature_override: 'Feature Override',
  force_password_reset: 'Password Reset',
  send_reset_email: 'Reset Email Sent',
  force_pin_reset: 'PIN Reset',
  send_driver_reset_email: 'Driver Reset Email',
  clear_security_questions: 'Clear Security Q\'s',
  reset_driver_setup: 'Reset Driver Setup',
  impersonate: 'Impersonate',
  force_logout: 'Force Logout',
  force_logout_all: 'Force Logout All',
};

export default async function TenantAuditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: {
    action?: string;
    from?: string;
    to?: string;
    search?: string;
  };
}) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      users: { select: { id: true, email: true, name: true } },
      drivers: { select: { id: true, phone: true, name: true } },
    },
  });
  if (!company) notFound();

  // Parse filter params
  const filterAction = searchParams.action || '';
  const filterFrom = searchParams.from || '';
  const filterTo = searchParams.to || '';
  const filterSearch = (searchParams.search || '').trim().toLowerCase();

  // Build audit log query with filters
  const auditWhere: any = { companyId: params.id };

  if (filterAction) {
    auditWhere.action = filterAction;
  }

  if (filterFrom || filterTo) {
    auditWhere.createdAt = {};
    if (filterFrom) {
      auditWhere.createdAt.gte = new Date(filterFrom + 'T00:00:00');
    }
    if (filterTo) {
      auditWhere.createdAt.lte = new Date(filterTo + 'T23:59:59');
    }
  }

  if (filterSearch) {
    auditWhere.OR = [
      { actor: { contains: filterSearch, mode: 'insensitive' } },
      { summary: { contains: filterSearch, mode: 'insensitive' } },
    ];
  }

  // Fetch filtered audit logs
  const logs = await prisma.auditLog.findMany({
    where: auditWhere,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  // Get distinct actions for the filter dropdown (always unfiltered)
  const distinctActions = await prisma.auditLog.findMany({
    where: { companyId: params.id },
    select: { action: true },
    distinct: ['action'],
    orderBy: { action: 'asc' },
  });
  const availableActions = distinctActions.map((d) => d.action);

  // Split into password/PIN-related and general logs
  const passwordActions = new Set([
    'force_password_reset',
    'send_reset_email',
    'force_pin_reset',
    'send_driver_reset_email',
    'clear_security_questions',
    'reset_driver_setup',
  ]);
  const passwordLogs = logs.filter((l) => passwordActions.has(l.action));
  const generalLogs = logs.filter((l) => !passwordActions.has(l.action));

  // Fetch recent login attempts for this tenant's users and drivers
  const userEmails = company.users.map((u) => u.email.toLowerCase());
  const driverPhones = company.drivers.map((d) => d.phone.replace(/\D/g, ''));
  const allKeys = [...userEmails, ...driverPhones];

  // Build login attempt query with filters
  const attemptWhere: any = {
    key: { in: allKeys.length > 0 ? allKeys : ['__none__'] },
    success: false,
  };

  if (filterFrom || filterTo) {
    attemptWhere.createdAt = {};
    if (filterFrom) attemptWhere.createdAt.gte = new Date(filterFrom + 'T00:00:00');
    if (filterTo) attemptWhere.createdAt.lte = new Date(filterTo + 'T23:59:59');
  }

  if (filterSearch) {
    // For login attempts, filter by key matching the search
    attemptWhere.key = {
      in: allKeys.filter((k) => k.includes(filterSearch)),
    };
    if ((attemptWhere.key as any).in.length === 0) {
      // Also check if driver/user names match the search
      const matchingKeys: string[] = [];
      for (const u of company.users) {
        if (u.name.toLowerCase().includes(filterSearch) || u.email.toLowerCase().includes(filterSearch)) {
          matchingKeys.push(u.email.toLowerCase());
        }
      }
      for (const d of company.drivers) {
        if (d.name.toLowerCase().includes(filterSearch) || d.phone.includes(filterSearch)) {
          matchingKeys.push(d.phone.replace(/\D/g, ''));
        }
      }
      attemptWhere.key = { in: matchingKeys.length > 0 ? matchingKeys : ['__none__'] };
    }
  }

  const loginAttempts = allKeys.length > 0
    ? await prisma.loginAttempt.findMany({
        where: attemptWhere,
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    : [];

  // Build lookup maps for display names
  const emailToName: Record<string, string> = {};
  for (const u of company.users) {
    emailToName[u.email.toLowerCase()] = u.name;
  }
  const phoneToName: Record<string, string> = {};
  for (const d of company.drivers) {
    phoneToName[d.phone.replace(/\D/g, '')] = d.name;
  }

  const hasActiveFilters = !!(filterAction || filterFrom || filterTo || filterSearch);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-white">
          Audit Log <span className="text-purple-400 font-normal">({logs.length}{hasActiveFilters ? ' filtered' : ''})</span>
        </h1>
      </div>

      {/* ── FILTERS ─────────────────────────────────────────────── */}
      <Suspense fallback={<div className="panel-sa p-4 text-purple-400 text-sm">Loading filters...</div>}>
        <AuditFilters
          tenantId={params.id}
          currentAction={filterAction}
          currentFrom={filterFrom}
          currentTo={filterTo}
          currentSearch={filterSearch}
          availableActions={availableActions}
          actionLabels={ACTION_LABELS}
        />
      </Suspense>

      {/* ── PASSWORD & PIN ACTIVITY ──────────────────────────────── */}
      {(!filterAction || passwordActions.has(filterAction)) && (
        <section>
          <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            Password &amp; PIN Activity
          </h2>

          {/* Failed login attempts */}
          {loginAttempts.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-purple-300 mb-2">Failed Login Attempts</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
                    <tr>
                      <th className="text-left py-2 pr-4">Who</th>
                      <th className="text-left py-2 pr-4">Type</th>
                      <th className="text-left py-2 pr-4">Key</th>
                      <th className="text-left py-2 pr-4">When</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-900/40">
                    {loginAttempts.map((a) => {
                      const isDriver = a.type === 'driver_login';
                      const displayName = isDriver
                        ? phoneToName[a.key] ?? 'Unknown driver'
                        : emailToName[a.key] ?? 'Unknown user';
                      return (
                        <tr key={a.id}>
                          <td className="py-2 pr-4 text-white">{displayName}</td>
                          <td className="py-2 pr-4">
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                isDriver
                                  ? 'bg-green-900 text-green-200'
                                  : 'bg-purple-900 text-purple-200'
                              }`}
                            >
                              {isDriver ? 'Driver PIN' : 'Password'}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-purple-300 font-mono text-xs">{a.key}</td>
                          <td className="py-2 pr-4 text-purple-400">
                            <LocalTime date={a.createdAt} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Password/PIN admin actions */}
          {passwordLogs.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-purple-300 mb-2">Admin Password &amp; PIN Actions</h3>
              <div className="space-y-2">
                {passwordLogs.map((log) => {
                  let details: Record<string, any> | null = null;
                  try {
                    details = log.details ? JSON.parse(log.details) : null;
                  } catch {}

                  return (
                    <div key={log.id} className="panel-sa flex items-start gap-3 py-3 px-4">
                      <span className="text-lg mt-0.5">{ENTITY_ICONS[log.entityType] ?? '🔑'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                              ACTION_COLORS[log.action] ?? 'bg-purple-900/40 text-purple-300'
                            }`}
                          >
                            {log.action.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-xs text-purple-400 uppercase">{log.entityType}</span>
                          <span className="text-xs text-purple-500">by {log.actor}</span>
                        </div>
                        <p className="text-sm text-purple-100 mt-1">{log.summary}</p>
                        {details && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-purple-500 cursor-pointer">
                              Show details
                            </summary>
                            <pre className="text-[10px] text-purple-400 bg-purple-950/50 rounded p-2 mt-1 overflow-x-auto">
                              {JSON.stringify(details, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                      <div className="text-xs text-purple-500 whitespace-nowrap">
                        <LocalTime date={log.createdAt} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : loginAttempts.length === 0 ? (
            <p className="text-sm text-purple-400 py-4">
              {hasActiveFilters ? 'No password/PIN activity matches your filters.' : 'No password or PIN activity yet.'}
            </p>
          ) : null}
        </section>
      )}

      {/* ── GENERAL AUDIT LOG ────────────────────────────────────── */}
      {(!filterAction || !passwordActions.has(filterAction)) && (
        <section>
          <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            General Activity ({generalLogs.length})
          </h2>

          {generalLogs.length === 0 ? (
            <p className="text-center text-purple-400 py-12 text-sm">
              {hasActiveFilters ? 'No activity matches your filters.' : 'No audit entries yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {generalLogs.map((log) => {
                let details: Record<string, any> | null = null;
                try {
                  details = log.details ? JSON.parse(log.details) : null;
                } catch {}

                return (
                  <div key={log.id} className="panel-sa flex items-start gap-3 py-3 px-4">
                    <span className="text-lg mt-0.5">{ENTITY_ICONS[log.entityType] ?? '•'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] rounded-full px-2 py-0.5 font-medium ${
                            ACTION_COLORS[log.action] ?? 'bg-purple-900/40 text-purple-300'
                          }`}
                        >
                          {log.action.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-purple-400 uppercase">{log.entityType}</span>
                        <span className="text-xs text-purple-500">by {log.actor}</span>
                      </div>
                      <p className="text-sm text-purple-100 mt-1">{log.summary}</p>
                      {details && (
                        <details className="mt-1">
                          <summary className="text-[10px] text-purple-500 cursor-pointer">
                            Show details
                          </summary>
                          <pre className="text-[10px] text-purple-400 bg-purple-950/50 rounded p-2 mt-1 overflow-x-auto">
                            {JSON.stringify(details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <div className="text-xs text-purple-500 whitespace-nowrap">
                      <LocalTime date={log.createdAt} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
