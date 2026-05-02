import { Suspense } from 'react';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { getServerLang, t } from '@/lib/i18n';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import { enforceDriverLimit } from '@/lib/features';
import { safePage } from '@/lib/server-error';
import DriversPageTabs from './DriversPageTabs';
import TimeOffSection from './TimeOffSection';
import PayrollSection from './PayrollSection';
import TrackingSection from './TrackingSection';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------
async function createDriverAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const name = String(formData.get('name') || '').trim();
  const phoneRaw = String(formData.get('phone') || '').trim();
  if (!name || !phoneRaw) throw new Error('Name and phone required');
  const digits = phoneRaw.replace(/\D/g, '');
  let phone = phoneRaw;
  if (digits.length === 10) phone = `+1${digits}`;
  else if (digits.length === 11 && digits.startsWith('1')) phone = `+${digits}`;
  else if (!phoneRaw.startsWith('+')) phone = `+${digits}`;

  // Truck assignment — derive truckNumber from the assigned truck
  const assignedTruckId = String(formData.get('assignedTruckId') || '').trim() || null;
  let truckNumber: string | null = null;
  if (assignedTruckId) {
    const truck = await prisma.truck.findFirst({
      where: { id: assignedTruckId, companyId: session.companyId },
      select: { truckNumber: true },
    });
    if (!truck) throw new Error('Selected truck not found');
    truckNumber = truck.truckNumber;
  }

  // Enforce plan driver limit
  await enforceDriverLimit(session.companyId);

  const workerType = String(formData.get('workerType') || 'EMPLOYEE') as 'EMPLOYEE' | 'CONTRACTOR';
  const payType = String(formData.get('payType') || 'HOURLY') as 'HOURLY' | 'SALARY' | 'PERCENTAGE';
  const payRateStr = String(formData.get('payRate') || '').trim();
  const payRate = payRateStr ? parseFloat(payRateStr) : undefined;

  await prisma.driver.create({
    data: {
      companyId: session.companyId,
      name, phone, truckNumber, assignedTruckId,
      workerType, payType,
      ...(payRate !== undefined ? { payRate } : {}),
      accessToken: randomBytes(24).toString('hex'),
      accessTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  revalidatePath('/drivers');
}

async function toggleDriverAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const d = await prisma.driver.findFirst({ where: { id, companyId: session.companyId } });
  if (!d) return;
  await prisma.driver.update({ where: { id }, data: { active: !d.active } });
  revalidatePath('/drivers');
}

async function rotateTokenAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const d = await prisma.driver.findFirst({ where: { id, companyId: session.companyId } });
  if (!d) return;
  await prisma.driver.update({
    where: { id },
    data: {
      accessToken: randomBytes(24).toString('hex'),
      accessTokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });
  revalidatePath('/drivers');
}

// ---------------------------------------------------------------------------
// Drivers list content (rendered as a slot inside tabs)
// ---------------------------------------------------------------------------
async function DriversListContent() {
  const session = await requireSession();
  const [drivers, trucks] = await Promise.all([
    prisma.driver.findMany({
      where: { companyId: session.companyId },
      include: { assignedTruck: { select: { truckNumber: true } } },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.truck.findMany({
      where: { companyId: session.companyId, status: 'ACTIVE' },
      orderBy: { truckNumber: 'asc' },
      select: { id: true, truckNumber: true, make: true, model: true },
    }),
  ]);
  const appUrl = process.env.APP_URL || 'http://localhost:3000';

  return (
    <div className="max-w-7xl">
      <form action={createDriverAction} className="panel p-5 mb-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" />
          </div>
          <div>
            <label className="label">Phone *</label>
            <input name="phone" required className="input" placeholder="(239) 555-0111" />
          </div>
          <div>
            <label className="label">Assigned Truck</label>
            <select name="assignedTruckId" className="input">
              <option value="">None</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truckNumber}{t.make ? ` — ${t.make}${t.model ? ' ' + t.model : ''}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Worker Type *</label>
            <select name="workerType" required className="input">
              <option value="EMPLOYEE">Employee</option>
              <option value="CONTRACTOR">Contractor</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Pay Type</label>
            <select name="payType" className="input">
              <option value="HOURLY">Hourly</option>
              <option value="SALARY">Salary</option>
              <option value="PERCENTAGE">Percentage</option>
            </select>
          </div>
          <div>
            <label className="label">Pay Rate</label>
            <input name="payRate" type="number" step="0.01" min="0" className="input" placeholder="0.00" />
          </div>
          <div className="md:col-span-2 flex items-end">
            <button className="btn-accent w-full" type="submit">+ Add Driver</button>
          </div>
        </div>
      </form>

      <div className="panel">
        {drivers.length === 0 ? (
          <div className="p-10 text-center text-steel-500">No drivers yet.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-3 md:px-5 py-2">Name</th>
                <th className="text-left px-3 md:px-5 py-2">Phone</th>
                <th className="text-left px-3 md:px-5 py-2">Truck</th>
                <th className="text-left px-3 md:px-5 py-2 hidden md:table-cell">Mobile URL</th>
                <th className="text-left px-3 md:px-5 py-2">Status</th>
                <th className="text-right px-3 md:px-5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d) => (
                <tr key={d.id} className="border-b border-steel-100">
                  <td className="px-3 md:px-5 py-3 font-medium">{d.name}</td>
                  <td className="px-3 md:px-5 py-3 font-mono text-xs">{d.phone}</td>
                  <td className="px-3 md:px-5 py-3">{d.assignedTruck?.truckNumber ?? '—'}</td>
                  <td className="px-3 md:px-5 py-3 font-mono text-xs text-steel-500 hidden md:table-cell">
                    <a href={`/d/${d.accessToken}`} target="_blank" className="hover:text-safety-dark">
                      {appUrl}/d/{d.accessToken.slice(0, 12)}…
                    </a>
                  </td>
                  <td className="px-3 md:px-5 py-3">
                    <span className={`badge ${d.active ? 'bg-green-100 text-green-800' : 'bg-steel-200 text-steel-600'}`}>
                      {d.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-3 md:px-5 py-3 text-right">
                    <a href={`/drivers/${d.id}/edit`} className="text-xs text-steel-600 hover:text-steel-900 px-2">Edit</a>
                    <form action={rotateTokenAction} className="inline">
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-xs text-steel-600 hover:text-steel-900 px-2">Rotate Token</button>
                    </form>
                    <form action={toggleDriverAction} className="inline">
                      <input type="hidden" name="id" value={d.id} />
                      <button className="text-xs text-steel-600 hover:text-steel-900 px-2">
                        {d.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payroll content (rendered as a slot inside tabs)
// ---------------------------------------------------------------------------
async function PayrollContent() {
  const session = await requireSession();
  const drivers = await prisma.driver.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: {
      id: true, name: true, phone: true, active: true,
      workerType: true, payType: true, payRate: true,
      assignedTruck: { select: { truckNumber: true } },
    },
  });
  const serialized = drivers.map((d) => ({
    ...d,
    truckNumber: d.assignedTruck?.truckNumber ?? null,
    payRate: d.payRate?.toString() ?? null,
  }));
  return <PayrollSection drivers={serialized} />;
}

// ---------------------------------------------------------------------------
// Tracking content (rendered as a slot inside tabs)
// ---------------------------------------------------------------------------
async function TrackingContent() {
  const session = await requireSession();
  const drivers = await prisma.driver.findMany({
    where: { companyId: session.companyId },
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, truckNumber: true, active: true },
  });
  return <TrackingSection drivers={drivers} />;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function DriversPage() {
  const lang = getServerLang();
  return (
    <div className="p-4 md:p-8 max-w-7xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">{t('drivers.people', lang)}</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('drivers.title', lang)}</h1>
      </header>

      <DriversPageTabs
        driversContent={
          <Suspense fallback={<div className="p-10 text-center text-steel-500">Loading drivers…</div>}>
            <DriversListContent />
          </Suspense>
        }
        payrollContent={
          <Suspense fallback={<div className="p-10 text-center text-steel-500">Loading payroll…</div>}>
            <PayrollContent />
          </Suspense>
        }
        timeOffContent={
          <Suspense fallback={<div className="p-10 text-center text-steel-500">Loading time-off requests…</div>}>
            <TimeOffSection />
          </Suspense>
        }
        trackingContent={
          <Suspense fallback={<div className="p-10 text-center text-steel-500">Loading tracking…</div>}>
            <TrackingContent />
          </Suspense>
        }
      />
    </div>
  );
}
