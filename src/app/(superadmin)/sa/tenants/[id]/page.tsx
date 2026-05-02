import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { featuresBySide, formatPrice } from '@/lib/features';
import TenantNav from '@/components/TenantNav';
import { FeatureManager } from '@/components/FeatureManager';
import { audit } from '@/lib/audit';
import { getServerLang, t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------
async function changePlan(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const id = String(formData.get('companyId') || '');
  const planId = String(formData.get('planId') || '');
  if (!id) return;
  const oldCompany = await prisma.company.findUnique({ where: { id }, include: { plan: true } });

  // Prevent duplicate subscription — skip if company already has this plan
  if (oldCompany?.planId === (planId || null)) {
    revalidatePath(`/sa/tenants/${id}`);
    return;
  }

  await prisma.company.update({
    where: { id },
    data: { planId: planId || null },
  });
  const newPlan = planId ? await prisma.plan.findUnique({ where: { id: planId } }) : null;
  await audit({
    companyId: id,
    entityType: 'company',
    entityId: id,
    action: 'plan_change',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Changed plan from "${oldCompany?.plan?.name ?? 'None'}" to "${newPlan?.name ?? 'None'}"`,
    details: { oldPlanId: oldCompany?.planId, newPlanId: planId || null },
  });
  revalidatePath(`/sa/tenants/${id}`);
}

// saveFeatureOverrides is now handled via /api/sa/tenants/features (JSON API for client component)

async function toggleSuspended(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const id = String(formData.get('companyId') || '');
  const next = formData.get('next') === 'true';
  await prisma.company.update({
    where: { id },
    data: { suspended: next, suspendedAt: next ? new Date() : null },
  });
  await audit({
    companyId: id,
    entityType: 'company',
    entityId: id,
    action: next ? 'suspend' : 'unsuspend',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: next ? 'Suspended tenant' : 'Unsuspended tenant',
  });
  revalidatePath(`/sa/tenants/${id}`);
  revalidatePath('/', 'layout');
}

async function deleteTenant(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const id = String(formData.get('companyId') || '');
  const confirm = String(formData.get('confirmName') || '');
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return;
  if (confirm.trim() !== company.name) {
    redirect(`/sa/tenants/${id}?deleteError=1`);
  }
  await prisma.company.delete({ where: { id } });
  redirect('/sa/tenants');
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { deleteError?: string };
}) {
  await requireSuperadmin();
  const lang = getServerLang();

  const [company, plans, dispatcherCount, driverCount, ticketCount, invoiceCount] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: params.id },
        include: {
          plan: true,
          users: { orderBy: { createdAt: 'asc' } },
        },
      }),
      prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.user.count({ where: { companyId: params.id } }),
      prisma.driver.count({ where: { companyId: params.id } }),
      prisma.ticket.count({ where: { companyId: params.id } }),
      prisma.invoice.count({ where: { companyId: params.id } }),
    ]);

  if (!company) notFound();

  const grouped = featuresBySide();

  // Usage stats
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [ticketsThisMonth, photoUploads] = await Promise.all([
    prisma.ticket.count({
      where: { companyId: company.id, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.ticket.count({
      where: { companyId: company.id, photoUrl: { not: null } },
    }),
  ]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">{company.name}</h1>
          <p className="text-purple-300 text-sm">
            {[company.city, company.state, company.zip].filter(Boolean).join(', ') || '—'}
          </p>
          <p className="text-purple-300 text-xs mt-1">
            {t('sa.tenantSince', lang)} {company.createdAt.toLocaleDateString()}
          </p>
        </div>
        {company.suspended ? (
          <span className="badge bg-red-900 text-red-200">{t('sa.suspended', lang)}</span>
        ) : (
          <span className="badge bg-emerald-900 text-emerald-200">{t('common.active', lang)}</span>
        )}
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label={t('sa.dispatchers', lang)} value={dispatcherCount} />
        <Stat label={t('sa.drivers', lang)} value={driverCount} />
        <Stat label={t('nav.tickets', lang)} value={ticketCount} />
        <Stat label={t('nav.invoices', lang)} value={invoiceCount} />
      </div>

      {/* Usage this month */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label={t('sa.tickets30d', lang)} value={ticketsThisMonth} />
        <Stat label={t('sa.photoUploads', lang)} value={photoUploads} />
        <Stat label={t('sa.activeDrivers', lang)} value={driverCount} />
      </div>

      {/* Subscription */}
      <section className="panel-sa">
        <h2 className="font-semibold text-white mb-3">{t('sa.subscription', lang)}</h2>
        <form action={changePlan} className="flex items-end gap-3 flex-wrap">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="flex-1 min-w-[200px]">
            <label className="label-sa" htmlFor="planId">{t('sa.plan', lang)}</label>
            <select
              id="planId"
              name="planId"
              defaultValue={company.planId ?? ''}
              className="input-sa"
            >
              <option value="">{t('sa.noPlan', lang)}</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {formatPrice(p.priceMonthlyCents)}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-purple">{t('sa.updatePlan', lang)}</button>
        </form>
        {company.plan && (
          <p className="text-purple-300 text-xs mt-2">
            {t('sa.limits', lang)}: {t('sa.driversLabel', lang)} {company.plan.maxDrivers ?? t('sa.unlimited', lang)} · {t('sa.ticketsLabel', lang)}{' '}
            {company.plan.maxTicketsPerMonth ?? t('sa.unlimited', lang)}.{' '}
            <Link href={`/sa/plans/${company.plan.id}/edit`} className="text-purple-400 hover:text-purple-200">
              {t('sa.editPlanTemplate', lang)}
            </Link>
          </p>
        )}
      </section>

      {/* Unified Feature Management */}
      <section className="panel-sa">
        <FeatureManager
          companyId={company.id}
          companyName={company.name}
          planName={company.plan?.name ?? null}
          planFeatures={company.plan?.features ?? []}
          initialOverrides={company.featureOverrides}
          initialDisabled={company.disabledFeatures}
          sections={[
            { title: t('sa.dispatcherFeatures', lang), hint: t('sa.webApp', lang), side: 'dispatcher', items: grouped.dispatcher },
            { title: t('sa.dispatcherViewAccess', lang), hint: t('sa.viewAccessHint', lang), side: 'dispatcher_views', items: grouped.dispatcher_views },
            { title: t('sa.driverAppFeatures', lang), hint: t('sa.driverMobileHint', lang), side: 'driver', items: grouped.driver },
            { title: t('sa.driverViewAccess', lang), hint: t('sa.driverViewHint', lang), side: 'driver_views', items: grouped.driver_views },
          ]}
        />
      </section>

      {/* Dispatchers */}
      <section className="panel-sa">
        <h2 className="font-semibold text-white mb-3">{t('sa.dispatchers', lang)}</h2>
        {company.users.length === 0 ? (
          <p className="text-purple-300 text-sm italic">{t('sa.noDispatchers', lang)}</p>
        ) : (
          <ul className="divide-y divide-purple-900/40 text-sm">
            {company.users.map((u) => (
              <li key={u.id} className="py-2 flex items-center justify-between">
                <div>
                  <div className="text-white">{u.name}</div>
                  <div className="text-xs text-purple-300">{u.email}</div>
                </div>
                <span className="text-xs text-purple-400">{u.role}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tenant status */}
      <section className="panel-sa">
        <h2 className="font-semibold text-white mb-3">{t('sa.tenantStatus', lang)}</h2>
        <form action={toggleSuspended}>
          <input type="hidden" name="companyId" value={company.id} />
          <input type="hidden" name="next" value={(!company.suspended).toString()} />
          {company.suspended ? (
            <>
              <p className="text-sm text-purple-200 mb-3">
                {t('sa.suspendedDesc', lang)}
              </p>
              <button type="submit" className="btn-purple">{t('sa.unsuspendTenant', lang)}</button>
            </>
          ) : (
            <>
              <p className="text-sm text-purple-200 mb-3">
                {t('sa.suspendDesc', lang)}
              </p>
              <button type="submit" className="btn-danger">{t('sa.suspendTenant', lang)}</button>
            </>
          )}
        </form>
      </section>

      {/* Danger zone */}
      <section className="panel-sa border-red-900/60">
        <h2 className="font-semibold text-white mb-3">{t('sa.dangerZone', lang)}</h2>
        <form action={deleteTenant} className="space-y-3">
          <input type="hidden" name="companyId" value={company.id} />
          {searchParams.deleteError && (
            <p className="text-sm text-red-300 bg-red-950 border border-red-800 rounded px-3 py-2">
              {t('sa.confirmNameError', lang)}
            </p>
          )}
          <p className="text-sm text-purple-200">
            {t('sa.deleteWarning', lang)} <strong className="text-red-300">{t('sa.allData', lang)}</strong> {t('sa.deleteDataList', lang)}{' '}
            <code className="text-red-300">{company.name}</code> {t('sa.toConfirm', lang)}
          </p>
          <input name="confirmName" className="input-sa" placeholder={company.name} required />
          <button type="submit" className="btn-danger">{t('sa.permanentlyDelete', lang)}</button>
        </form>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="panel-sa">
      <div className="text-xs uppercase tracking-wider text-purple-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  );
}
