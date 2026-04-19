import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { FEATURE_LABELS, featuresBySide, formatPrice } from '@/lib/features';
import TenantNav from '@/components/TenantNav';
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

async function saveFeatureOverrides(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const id = String(formData.get('companyId') || '');
  if (!id) return;

  // Gather all checkbox states from the form
  const grouped = featuresBySide();
  const allFeatures = [...grouped.dispatcher, ...grouped.dispatcher_views, ...grouped.driver, ...grouped.driver_views];

  const overrides: string[] = [];
  const disabled: string[] = [];

  // Get current plan features
  const company = await prisma.company.findUnique({
    where: { id },
    include: { plan: { select: { features: true } } },
  });
  const planFeatures = new Set(company?.plan?.features ?? []);

  for (const f of allFeatures) {
    const checked = formData.get(`feature_${f.key}`) === 'on';
    const inPlan = planFeatures.has(f.key);

    if (checked && !inPlan) {
      // Feature is ON but not in plan → it's an override
      overrides.push(f.key);
    } else if (!checked && inPlan) {
      // Feature is OFF but in plan → it's disabled
      disabled.push(f.key);
    }
    // Otherwise: matches plan, no override needed
  }

  await prisma.company.update({
    where: { id },
    data: { featureOverrides: overrides, disabledFeatures: disabled },
  });
  await audit({
    companyId: id,
    entityType: 'company',
    entityId: id,
    action: 'feature_override',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Updated feature overrides: +${overrides.length} added, -${disabled.length} disabled`,
    details: { overrides, disabled },
  });
  revalidatePath(`/sa/tenants/${id}`);
  // Revalidate dispatcher routes so sidebar/feature gating picks up the changes
  revalidatePath('/', 'layout');
}

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

  // Compute effective features: plan + overrides − disabled
  const planFeatures = new Set(company.plan?.features ?? []);
  const overrideSet = new Set(company.featureOverrides);
  const disabledSet = new Set(company.disabledFeatures);
  const effectiveFeatures = new Set([...planFeatures, ...overrideSet]);
  for (const f of disabledSet) effectiveFeatures.delete(f);

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
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
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
        <h2 className="font-semibold text-white mb-1">{t('sa.featureManagement', lang)}</h2>
        <p className="text-xs text-purple-300 mb-4">
          {t('sa.featureDesc', lang)}
        </p>
        <form action={saveFeatureOverrides}>
          <input type="hidden" name="companyId" value={company.id} />

          {([
            { title: t('sa.dispatcherFeatures', lang), hint: t('sa.webApp', lang), items: grouped.dispatcher },
            { title: t('sa.dispatcherViewAccess', lang), hint: t('sa.viewAccessHint', lang), items: grouped.dispatcher_views },
            { title: t('sa.driverAppFeatures', lang), hint: t('sa.driverMobileHint', lang), items: grouped.driver },
            { title: t('sa.driverViewAccess', lang), hint: t('sa.driverViewHint', lang), items: grouped.driver_views },
          ]).map((section) => (
            <div key={section.title} className="mb-6">
              <div className="label-sa">{section.title}</div>
              <p className="text-xs text-purple-300 mb-2">{section.hint}</p>
              <ul className="space-y-2">
                {section.items.map((f) => {
                  const isEffective = effectiveFeatures.has(f.key);
                  const inPlan = planFeatures.has(f.key);
                  const isOverride = overrideSet.has(f.key);
                  const isDisabled = disabledSet.has(f.key);

                  // Determine badge
                  let badge = null;
                  if (isOverride) badge = <span className="text-[10px] bg-blue-800 text-blue-200 rounded px-1.5 py-0.5 ml-2">OVERRIDE</span>;
                  if (isDisabled) badge = <span className="text-[10px] bg-red-800 text-red-200 rounded px-1.5 py-0.5 ml-2">DISABLED</span>;

                  return (
                    <li key={f.key} className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        id={`feature_${f.key}`}
                        name={`feature_${f.key}`}
                        defaultChecked={isEffective}
                        className="mt-1 accent-purple-600"
                      />
                      <label htmlFor={`feature_${f.key}`} className="text-sm cursor-pointer">
                        <div className="text-white flex items-center">
                          {f.label}
                          {badge}
                          {!inPlan && isEffective && !isOverride && (
                            <span className="text-[10px] text-purple-400 ml-2">(not in plan)</span>
                          )}
                        </div>
                        <div className="text-xs text-purple-300">{f.description}</div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <button type="submit" className="btn-purple">{t('sa.saveFeatureOverrides', lang)}</button>
        </form>
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
