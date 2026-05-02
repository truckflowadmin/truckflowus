import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin, signSession, setSessionCookie, backupSuperadminSession } from '@/lib/auth';
import { signDriverSession, setDriverSessionCookie } from '@/lib/driver-auth';
import { audit } from '@/lib/audit';
import TenantNav from '@/components/TenantNav';
import LocalTime from '@/components/LocalTime';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------

async function impersonateDispatcherAction(formData: FormData) {
  'use server';
  const sa = await requireSuperadmin();
  const userId = String(formData.get('userId') || '');
  const companyId = String(formData.get('companyId') || '');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.companyId !== companyId) throw new Error('User does not belong to this company');

  await audit({
    companyId: user.companyId,
    entityType: 'user',
    entityId: userId,
    action: 'impersonate',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Superadmin impersonated dispatcher ${user.email}`,
  });

  // Backup the superadmin session so they can return
  const currentSaToken = signSession({
    userId: sa.userId,
    companyId: sa.companyId,
    role: sa.role,
    email: sa.email,
    name: sa.name,
  });
  backupSuperadminSession(currentSaToken);

  // Create an impersonated session as that user
  const token = signSession({
    userId: user.id,
    companyId: user.companyId,
    role: user.role,
    email: user.email,
    name: user.name,
    impersonatedBy: sa.userId,
  });
  setSessionCookie(token);
  redirect('/dashboard');
}

async function forceLogoutUserAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const userId = String(formData.get('userId') || '');
  const companyId = String(formData.get('companyId') || '');

  // Verify ownership before modifying
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.companyId !== companyId) throw new Error('User not found in this company');

  await prisma.user.update({
    where: { id: userId },
    data: { sessionInvalidatedAt: new Date() },
  });
  await audit({
    companyId,
    entityType: 'user',
    entityId: userId,
    action: 'force_logout',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Force-logged out dispatcher ${user?.email ?? userId}`,
  });

  revalidatePath(`/sa/tenants/${companyId}/debug`);
}

async function forceLogoutDriverAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');

  // Verify ownership before modifying
  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver || driver.companyId !== companyId) throw new Error('Driver not found in this company');

  await prisma.driver.update({
    where: { id: driverId },
    data: { sessionInvalidatedAt: new Date() },
  });
  await audit({
    companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'force_logout',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Force-logged out driver ${driver?.name ?? driverId}`,
  });

  revalidatePath(`/sa/tenants/${companyId}/debug`);
}

async function forceLogoutAllAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const companyId = String(formData.get('companyId') || '');
  const now = new Date();

  await Promise.all([
    prisma.user.updateMany({
      where: { companyId },
      data: { sessionInvalidatedAt: now },
    }),
    prisma.driver.updateMany({
      where: { companyId },
      data: { sessionInvalidatedAt: now },
    }),
  ]);

  await audit({
    companyId,
    entityType: 'company',
    entityId: companyId,
    action: 'force_logout_all',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Force-logged out ALL dispatchers and drivers for this tenant`,
  });

  revalidatePath(`/sa/tenants/${companyId}/debug`);
}

async function impersonateDriverAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const driverId = String(formData.get('driverId') || '');
  const companyId = String(formData.get('companyId') || '');

  const driver = await prisma.driver.findUnique({ where: { id: driverId } });
  if (!driver) throw new Error('Driver not found');
  if (driver.companyId !== companyId) throw new Error('Driver does not belong to this company');

  await audit({
    companyId: driver.companyId,
    entityType: 'driver',
    entityId: driverId,
    action: 'impersonate',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Superadmin impersonated driver ${driver.name} (${driver.phone})`,
  });

  // Create a driver session cookie and redirect to the driver portal
  const token = signDriverSession({
    driverId: driver.id,
    companyId: driver.companyId,
    name: driver.name,
    phone: driver.phone,
  });
  setDriverSessionCookie(token);
  redirect('/d/portal');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DebugPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({
    where: { id: params.id },
    include: {
      users: {
        orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          lastPasswordChange: true,
          sessionInvalidatedAt: true,
          securityQ1: true,
          createdAt: true,
        },
      },
      drivers: {
        orderBy: { lastLoginAt: { sort: 'desc', nulls: 'last' } },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          active: true,
          pinSet: true,
          accessToken: true,
          securityQ1: true,
          lastLoginAt: true,
          sessionInvalidatedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!company) notFound();

  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  // Recent audit logs for this tenant (last 20)
  const recentLogs = await prisma.auditLog.findMany({
    where: { companyId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <header>
        <h1 className="text-2xl font-bold text-white">Debug &amp; Troubleshoot</h1>
        <p className="text-purple-300 text-sm mt-1">
          Impersonate users, view activity, and manage sessions for {company.name}.
        </p>
      </header>

      {/* ── FORCE LOGOUT ALL ────────────────────────────────────────────── */}
      <section className="panel-sa border border-red-900/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-white">Force Logout Everyone</h2>
            <p className="text-xs text-purple-400 mt-1">
              Immediately invalidate all active dispatcher and driver sessions for this tenant.
            </p>
          </div>
          <form action={forceLogoutAllAction}>
            <input type="hidden" name="companyId" value={company.id} />
            <button type="submit" className="btn-danger text-xs">
              Logout All Users
            </button>
          </form>
        </div>
      </section>

      {/* ── DISPATCHER IMPERSONATION & SESSIONS ─────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          Dispatchers &amp; Admins — Impersonate &amp; Sessions
        </h2>
        <div className="space-y-3">
          {company.users.map((user) => (
            <div key={user.id} className="panel-sa">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
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
                        SQ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-purple-400">{user.email}</div>

                  {/* Activity stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-purple-500">Last login: </span>
                      <span className="text-purple-200">
                        <LocalTime date={user.lastLoginAt} fallback="Never" />
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-500">PW changed: </span>
                      <span className="text-purple-200">
                        <LocalTime date={user.lastPasswordChange} fallback="Never" />
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-500">Sessions invalidated: </span>
                      <span className="text-purple-200">
                        <LocalTime date={user.sessionInvalidatedAt} fallback="Never" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <form action={impersonateDispatcherAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-purple text-xs" title="Login as this user">
                      Impersonate
                    </button>
                  </form>
                  <form action={forceLogoutUserAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-ghost text-xs text-red-400 hover:text-red-300">
                      Force Logout
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}

          {company.users.length === 0 && (
            <p className="text-sm text-purple-400 py-4 text-center">No dispatchers.</p>
          )}
        </div>
      </section>

      {/* ── DRIVER VIEW-AS & SESSIONS ───────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-semibold text-purple-200 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400" />
          Drivers — View As &amp; Sessions ({company.drivers.length})
        </h2>
        <div className="space-y-3">
          {company.drivers.map((driver) => (
            <div key={driver.id} className={`panel-sa ${!driver.active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
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
                        SQ
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-purple-400">
                    {driver.phone}
                    {driver.email && <span className="ml-2">· {driver.email}</span>}
                  </div>

                  {/* Activity stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 text-xs">
                    <div>
                      <span className="text-purple-500">Last login: </span>
                      <span className="text-purple-200">
                        <LocalTime date={driver.lastLoginAt} fallback="Never" />
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-500">Created: </span>
                      <span className="text-purple-200">
                        <LocalTime date={driver.createdAt} />
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-500">Sessions invalidated: </span>
                      <span className="text-purple-200">
                        <LocalTime date={driver.sessionInvalidatedAt} fallback="Never" />
                      </span>
                    </div>
                  </div>

                  {/* Access link */}
                  <div className="mt-2">
                    <span className="text-[10px] text-purple-500">Setup link: </span>
                    <code className="text-[10px] text-purple-300 bg-purple-950 rounded px-1.5 py-0.5 select-all">
                      {appUrl}/d/{driver.accessToken}
                    </code>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <form action={impersonateDriverAction}>
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-purple text-xs">
                      View As Driver
                    </button>
                  </form>
                  <form action={forceLogoutDriverAction}>
                    <input type="hidden" name="driverId" value={driver.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button type="submit" className="btn-ghost text-xs text-red-400 hover:text-red-300">
                      Force Logout
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}

          {company.drivers.length === 0 && (
            <p className="text-sm text-purple-400 py-4 text-center">No drivers.</p>
          )}
        </div>
      </section>

      {/* ── RECENT ACTIVITY LOG ─────────────────────────────────────────── */}
      <section className="panel-sa">
        <h2 className="font-semibold text-white mb-3">Recent Activity (Last 20)</h2>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-purple-400 text-center py-4">No recent activity.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-b border-purple-900/30 pb-2">
                <span className={`text-[10px] rounded-full px-2 py-0.5 font-medium whitespace-nowrap ${
                  log.action.includes('login') || log.action.includes('logout')
                    ? 'bg-blue-900/60 text-blue-200'
                    : log.action.includes('reset') || log.action.includes('clear')
                    ? 'bg-yellow-900/60 text-yellow-200'
                    : log.action.includes('impersonate')
                    ? 'bg-purple-900/60 text-purple-200'
                    : 'bg-purple-900/40 text-purple-300'
                }`}>
                  {log.action.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className="text-purple-200 flex-1">{log.summary}</span>
                <span className="text-purple-500 whitespace-nowrap">
                  <LocalTime date={log.createdAt} />
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
