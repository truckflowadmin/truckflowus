import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { FEATURE_CATALOG, featuresBySide } from '@/lib/features';

export const dynamic = 'force-dynamic';

async function savePlan(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const id = String(formData.get('id') || '');
  if (!id) return;

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim() || null;
  const priceDollarsStr = String(formData.get('priceDollars') || '0').trim();
  const maxDriversStr = String(formData.get('maxDrivers') || '').trim();
  const maxTicketsStr = String(formData.get('maxTicketsPerMonth') || '').trim();
  const active = formData.get('active') === 'on';

  const features = FEATURE_CATALOG.map((f) => f.key).filter(
    (key) => formData.get(`feature_${key}`) === 'on',
  );

  const priceDollars = Number(priceDollarsStr);
  if (!name) throw new Error('Name is required');
  if (!Number.isFinite(priceDollars) || priceDollars < 0) {
    throw new Error('Price must be a non-negative number');
  }
  const priceMonthlyCents = Math.round(priceDollars * 100);

  const maxDrivers = maxDriversStr === '' ? null : Number(maxDriversStr);
  const maxTicketsPerMonth = maxTicketsStr === '' ? null : Number(maxTicketsStr);
  if (maxDrivers !== null && (!Number.isInteger(maxDrivers) || maxDrivers < 0)) {
    throw new Error('Max drivers must be a non-negative integer or blank for unlimited');
  }
  if (
    maxTicketsPerMonth !== null &&
    (!Number.isInteger(maxTicketsPerMonth) || maxTicketsPerMonth < 0)
  ) {
    throw new Error('Max tickets/month must be a non-negative integer or blank for unlimited');
  }

  await prisma.plan.update({
    where: { id },
    data: {
      name,
      description,
      priceMonthlyCents,
      maxDrivers,
      maxTicketsPerMonth,
      features,
      active,
    },
  });

  revalidatePath('/sa/plans');
  revalidatePath(`/sa/plans/${id}/edit`);
  // Revalidate dispatcher routes so sidebar gating picks up the new features
  revalidatePath('/', 'layout');
  redirect('/sa/plans');
}

export default async function EditPlanPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();

  const plan = await prisma.plan.findUnique({
    where: { id: params.id },
    include: { _count: { select: { companies: true } } },
  });
  if (!plan) notFound();

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <nav className="text-sm">
        <Link href="/sa/plans" className="text-purple-400 hover:text-purple-200">
          ← Plans
        </Link>
      </nav>
      <header>
        <div className="text-purple-400 text-xs uppercase tracking-wider">{plan.key}</div>
        <h1 className="text-2xl font-bold text-white">Edit Plan · {plan.name}</h1>
        <p className="text-purple-300 text-sm mt-1">
          {plan._count.companies} tenant{plan._count.companies === 1 ? '' : 's'} currently on this
          plan.
        </p>
      </header>

      <form action={savePlan} className="panel-sa space-y-5">
        <input type="hidden" name="id" value={plan.id} />

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label-sa" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              className="input-sa"
              required
              defaultValue={plan.name}
            />
          </div>
          <div>
            <label className="label-sa" htmlFor="priceDollars">
              Price (USD / month)
            </label>
            <input
              id="priceDollars"
              name="priceDollars"
              className="input-sa"
              type="number"
              step="0.01"
              min="0"
              defaultValue={(plan.priceMonthlyCents / 100).toFixed(2)}
            />
          </div>
        </div>

        <div>
          <label className="label-sa" htmlFor="description">
            Description
          </label>
          <input
            id="description"
            name="description"
            className="input-sa"
            defaultValue={plan.description ?? ''}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label-sa" htmlFor="maxDrivers">
              Max drivers (blank = unlimited)
            </label>
            <input
              id="maxDrivers"
              name="maxDrivers"
              className="input-sa"
              type="number"
              min="0"
              defaultValue={plan.maxDrivers ?? ''}
            />
          </div>
          <div>
            <label className="label-sa" htmlFor="maxTicketsPerMonth">
              Max tickets/month (blank = unlimited)
            </label>
            <input
              id="maxTicketsPerMonth"
              name="maxTicketsPerMonth"
              className="input-sa"
              type="number"
              min="0"
              defaultValue={plan.maxTicketsPerMonth ?? ''}
            />
          </div>
        </div>

        {(() => {
          const grouped = featuresBySide();
          const SECTIONS: { title: string; hint: string; items: typeof FEATURE_CATALOG }[] = [
            {
              title: 'Dispatcher features',
              hint: 'Checked features are unlocked in the dispatcher web app for tenants on this plan.',
              items: grouped.dispatcher,
            },
            {
              title: 'Dispatcher view access',
              hint: 'Controls which sidebar tabs dispatchers can see. Unchecked tabs appear locked with an upgrade prompt.',
              items: grouped.dispatcher_views,
            },
            {
              title: 'Driver app features',
              hint: "Checked features are unlocked in the driver mobile view (/d/[token]) for this tenant's drivers.",
              items: grouped.driver,
            },
            {
              title: 'Driver view access',
              hint: 'Controls which tabs drivers can see in their mobile app. Unchecked tabs are hidden entirely.',
              items: grouped.driver_views,
            },
          ];
          return SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="label-sa">{section.title}</div>
              <p className="text-xs text-purple-300 mb-2">{section.hint}</p>
              <ul className="space-y-2">
                {section.items.map((f) => (
                  <li key={f.key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      id={`feature_${f.key}`}
                      name={`feature_${f.key}`}
                      defaultChecked={plan.features.includes(f.key)}
                      className="mt-1 accent-purple-600"
                    />
                    <label
                      htmlFor={`feature_${f.key}`}
                      className="text-sm text-steel-100 cursor-pointer"
                    >
                      <div className="text-white">{f.label}</div>
                      <div className="text-xs text-purple-300">{f.description}</div>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ));
        })()}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="active"
            name="active"
            defaultChecked={plan.active}
            className="accent-purple-600"
          />
          <label htmlFor="active" className="text-sm text-white">
            Active (available for assignment)
          </label>
        </div>

        <div className="flex gap-3">
          <button type="submit" className="btn-purple">
            Save changes
          </button>
          <Link href="/sa/plans" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
