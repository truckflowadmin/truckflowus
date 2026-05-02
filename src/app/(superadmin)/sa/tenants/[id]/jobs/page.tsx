import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { audit } from '@/lib/audit';
import TenantNav from '@/components/TenantNav';
import AddressLink from '@/components/AddressLink';
import AutoSubmitSelect from '@/components/AutoSubmitSelect';
import ConfirmButton from '@/components/ConfirmButton';
import BrokerToggleSelect from '@/components/BrokerToggleSelect';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------
async function createJob(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const companyId = String(formData.get('companyId') || '');
  const name = String(formData.get('name') || '').trim();
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  if (!name || !hauledFrom || !hauledTo) throw new Error('Name, Hauled From, and Hauled To are required');

  const customerId = String(formData.get('customerId') || '') || null;
  const brokerId = String(formData.get('brokerId') || '') || null;
  const driverId = String(formData.get('driverId') || '') || null;
  const material = String(formData.get('material') || '').trim() || null;
  const quantityType = (String(formData.get('quantityType') || '') || 'LOADS') as any;
  const totalLoadsStr = String(formData.get('totalLoads') || '');
  const totalLoads = totalLoadsStr ? (parseInt(totalLoadsStr) || 0) : 0;
  const rateRaw = String(formData.get('ratePerUnit') || '');
  const ratePerUnit = rateRaw ? parseFloat(rateRaw) : null;
  const dateRaw = String(formData.get('date') || '');
  const date = dateRaw ? new Date(dateRaw) : null;
  const hauledFromAddress = String(formData.get('hauledFromAddress') || '').trim() || null;
  const hauledToAddress = String(formData.get('hauledToAddress') || '').trim() || null;
  const notes = String(formData.get('notes') || '').trim() || null;
  const openForDrivers = formData.get('openForDrivers') === 'true';

  if (!brokerId && !customerId) throw new Error('Either a broker or a customer must be selected');

  const last = await prisma.job.findFirst({
    where: { companyId },
    orderBy: { jobNumber: 'desc' },
    select: { jobNumber: true },
  });
  const jobNumber = (last?.jobNumber ?? 0) + 1;

  const job = await prisma.job.create({
    data: {
      companyId,
      jobNumber,
      name,
      customerId,
      brokerId,
      driverId,
      status: driverId ? 'ASSIGNED' : 'CREATED',
      hauledFrom,
      hauledFromAddress,
      hauledTo,
      hauledToAddress,
      material,
      quantityType,
      totalLoads,
      ratePerUnit,
      date,
      notes,
      openForDrivers,
      assignedAt: driverId ? new Date() : null,
    },
  });

  if (material) {
    await prisma.material.upsert({
      where: { companyId_name: { companyId, name: material } },
      update: {},
      create: { companyId, name: material },
    });
  }

  await audit({
    companyId,
    entityType: 'ticket',
    entityId: job.id,
    action: 'create',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Created job #${jobNumber} "${name}" (${hauledFrom} → ${hauledTo}, ${totalLoads} loads)`,
    details: { jobNumber, name, hauledFrom, hauledTo, totalLoads },
  });
  revalidatePath(`/sa/tenants/${companyId}/jobs`);
}

async function updateJob(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const jobId = String(formData.get('jobId') || '');
  const companyId = String(formData.get('companyId') || '');

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) return;

  // Block if job has invoiced tickets
  const invoicedCount = await prisma.ticket.count({ where: { jobId, invoiceId: { not: null } } });
  if (invoicedCount > 0) throw new Error('This job has invoiced tickets and cannot be modified');

  const name = String(formData.get('name') || '').trim();
  const hauledFrom = String(formData.get('hauledFrom') || '').trim();
  const hauledTo = String(formData.get('hauledTo') || '').trim();
  const customerId = String(formData.get('customerId') || '') || null;
  const brokerId = String(formData.get('brokerId') || '') || null;
  const driverId = String(formData.get('driverId') || '') || null;
  const material = String(formData.get('material') || '').trim() || null;
  const quantityType = (String(formData.get('quantityType') || '') || 'LOADS') as any;
  const totalLoadsStr = String(formData.get('totalLoads') || '');
  const totalLoads = totalLoadsStr ? (parseInt(totalLoadsStr) || 0) : 0;
  const rateRaw = String(formData.get('ratePerUnit') || '');
  const ratePerUnit = rateRaw ? parseFloat(rateRaw) : null;
  const dateRaw = String(formData.get('date') || '');
  const date = dateRaw ? new Date(dateRaw) : null;
  const hauledFromAddress = String(formData.get('hauledFromAddress') || '').trim() || null;
  const hauledToAddress = String(formData.get('hauledToAddress') || '').trim() || null;
  const notes = String(formData.get('notes') || '').trim() || null;
  const openForDrivers = formData.get('openForDrivers') === 'true';

  // Auto-promote status if driver newly assigned
  let status = job.status;
  if (!job.driverId && driverId && status === 'CREATED') status = 'ASSIGNED';

  await prisma.job.update({
    where: { id: jobId },
    data: {
      name, hauledFrom, hauledFromAddress, hauledTo, hauledToAddress, customerId, brokerId, driverId,
      status, material, quantityType, totalLoads, ratePerUnit, date, notes, openForDrivers,
      assignedAt: !job.driverId && driverId ? new Date() : job.assignedAt,
    },
  });
  await audit({
    companyId,
    entityType: 'ticket',
    entityId: jobId,
    action: 'update',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Updated job #${job.jobNumber} "${name}"`,
    details: { name, hauledFrom, hauledTo, totalLoads, material },
  });
  revalidatePath(`/sa/tenants/${companyId}/jobs`);
}

async function updateJobStatus(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const jobId = String(formData.get('jobId') || '');
  const companyId = String(formData.get('companyId') || '');
  const status = String(formData.get('status') || '') as any;
  const validStatuses = ['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  if (!jobId || !status || !validStatuses.includes(status)) return;

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) return;

  // Block if job has invoiced tickets
  const invoicedSA = await prisma.ticket.count({ where: { jobId, invoiceId: { not: null } } });
  if (invoicedSA > 0) throw new Error('This job has invoiced tickets and cannot be modified');

  const oldStatus = job.status;
  if (oldStatus === status) return; // no change

  const patch: any = { status };
  const now = new Date();
  if (status === 'IN_PROGRESS' && !job.startedAt) patch.startedAt = now;
  if (status === 'COMPLETED' && !job.completedAt) patch.completedAt = now;
  if (status === 'ASSIGNED' && !job.assignedAt) patch.assignedAt = now;

  try {
    await prisma.job.update({ where: { id: jobId }, data: patch });
  } catch (err) {
    console.error('[sa-jobs] Status update error:', err);
    throw new Error('Failed to update job status');
  }
  await audit({
    companyId,
    entityType: 'ticket',
    entityId: jobId,
    action: 'status_change',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Changed job #${job.jobNumber} status from ${oldStatus} to ${status}`,
    details: { oldStatus, newStatus: status },
  });
  revalidatePath(`/sa/tenants/${companyId}/jobs`);
}

async function deleteJob(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const jobId = String(formData.get('jobId') || '');
  const companyId = String(formData.get('companyId') || '');

  const job = await prisma.job.findFirst({ where: { id: jobId, companyId } });
  if (!job) return;

  // Block if job has invoiced tickets
  const invoicedDel = await prisma.ticket.count({ where: { jobId, invoiceId: { not: null } } });
  if (invoicedDel > 0) throw new Error('This job has invoiced tickets and cannot be deleted');

  await prisma.ticket.updateMany({ where: { jobId }, data: { jobId: null } });
  await prisma.job.delete({ where: { id: jobId } });
  await audit({
    companyId,
    entityType: 'ticket',
    entityId: jobId,
    action: 'delete',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Deleted job #${job.jobNumber} (${job.status}, ${job.completedLoads}/${job.totalLoads} loads)`,
    details: { jobNumber: job.jobNumber, status: job.status },
  });
  revalidatePath(`/sa/tenants/${companyId}/jobs`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function TenantJobsPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const [jobs, drivers, customers, brokers, materials] = await Promise.all([
    prisma.job.findMany({
      where: { companyId: params.id },
      include: {
        driver: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true } },
        broker: { select: { id: true, name: true } },
        _count: { select: { tickets: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.driver.findMany({
      where: { companyId: params.id, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      where: { companyId: params.id },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.broker.findMany({
      where: { companyId: params.id, active: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.material.findMany({
      where: { companyId: params.id },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  jobs.forEach((j) => {
    statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
  });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-white">
          Jobs <span className="text-purple-400 font-normal">({jobs.length})</span>
        </h1>
        <div className="flex gap-2 text-xs flex-wrap">
          {Object.entries(statusCounts).map(([s, c]) => (
            <span key={s} className="badge bg-purple-900/60 text-purple-200">
              {s.replace('_', ' ')} {c}
            </span>
          ))}
        </div>
      </div>

      {/* Create job */}
      <details className="panel-sa mb-4">
        <summary className="text-sm font-medium text-purple-300 cursor-pointer py-2 px-1">
          + Create Job
        </summary>
        <form action={createJob} className="mt-3 space-y-3">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="md:col-span-3">
              <label className="label-sa sa-create-name-label">Job Name *</label>
              <input name="name" required className="input-sa" placeholder="e.g. Deliver fill dirt to Main St" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label-sa">Hauled From *</label>
              <input name="hauledFrom" required className="input-sa" placeholder="Pickup location" />
              <input name="hauledFromAddress" className="input-sa mt-1" placeholder="Address" />
            </div>
            <div>
              <label className="label-sa">Hauled To *</label>
              <input name="hauledTo" required className="input-sa" placeholder="Delivery location" />
              <input name="hauledToAddress" className="input-sa mt-1" placeholder="Address" />
            </div>
            <div>
              <label className="label-sa">Material</label>
              <input name="material" className="input-sa" list="sa-job-materials" placeholder="e.g. Fill dirt" />
              <datalist id="sa-job-materials">{materials.map((m) => <option key={m.name} value={m.name} />)}</datalist>
            </div>
            <div>
              <label className="label-sa">Total Loads</label>
              <input name="totalLoads" type="number" min="0" defaultValue="" className="input-sa" placeholder="0 = unlimited" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label-sa">Broker</label>
              <BrokerToggleSelect
                name="brokerId"
                className="input-sa"
                customerWrapClass="sa-create-cust-wrap"
                nameLabelClass="sa-create-name-label"
                nameLabelBroker="Customer Name *"
                nameLabelDefault="Job Name *"
              >
                <option value="">— None —</option>
                {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </BrokerToggleSelect>
            </div>
            <div className="sa-create-cust-wrap">
              <label className="label-sa">Customer</label>
              <select name="customerId" className="input-sa">
                <option value="">— None —</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-sa">Driver</label>
              <select name="driverId" className="input-sa">
                <option value="">— Unassigned —</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label-sa">Date</label>
              <input name="date" type="date" className="input-sa" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label-sa">Qty Type</label>
              <select name="quantityType" className="input-sa">
                <option value="LOADS">Loads</option>
                <option value="TONS">Tons</option>
                <option value="YARDS">Yards</option>
              </select>
            </div>
            <div>
              <label className="label-sa">Rate/Unit</label>
              <input name="ratePerUnit" type="number" min="0" step="0.01" className="input-sa" placeholder="0.00" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer text-purple-300 text-xs py-2">

                <input type="checkbox" name="openForDrivers" value="true" className="rounded border-purple-600" />
                Open for drivers
              </label>
            </div>
            <div className="flex items-end">
              <button type="submit" className="btn-purple w-full">Create Job</button>
            </div>
          </div>
          <div>
            <label className="label-sa">Notes</label>
            <textarea name="notes" rows={2} className="input-sa" placeholder="Special instructions..." />
          </div>
        </form>
      </details>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
            <tr>
              <th className="text-left py-2 px-2">#</th>
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Status</th>
              <th className="text-left py-2 px-2">Driver</th>
              <th className="text-left py-2 px-2">Cust / Broker</th>
              <th className="text-left py-2 px-2">Route</th>
              <th className="text-center py-2 px-2">Loads</th>
              <th className="text-left py-2 px-2">Tickets</th>
              <th className="text-left py-2 px-2">Created</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-900/30">
            {jobs.map((j) => {
              const dateVal = j.date ? format(j.date, 'yyyy-MM-dd') : '';
              return (
                <tr key={j.id} className="hover:bg-purple-900/20">
                  <td className="py-2 px-2 font-mono font-bold text-white">#{j.jobNumber}</td>
                  <td className="py-2 px-2 text-purple-200 text-xs max-w-[160px] truncate">{j.name}</td>
                  <td className="py-2 px-2">
                    <form action={updateJobStatus} className="inline">
                      <input type="hidden" name="jobId" value={j.id} />
                      <input type="hidden" name="companyId" value={company.id} />
                      <AutoSubmitSelect
                        name="status"
                        defaultValue={j.status}
                        className="bg-transparent text-xs border border-purple-700 rounded px-1.5 py-1 text-purple-200"
                      >
                        {(['CREATED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const).map(
                          (s) => (
                            <option key={s} value={s}>
                              {s.replace('_', ' ')}
                            </option>
                          ),
                        )}
                      </AutoSubmitSelect>
                    </form>
                  </td>
                  <td className="py-2 px-2 text-purple-200 text-xs">{j.driver?.name ?? '—'}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs">
                    {j.broker?.name || j.customer?.name || '—'}
                  </td>
                  <td className="py-2 px-2 text-purple-300 text-xs max-w-[180px]">
                    <div className="truncate">{j.hauledFrom} → {j.hauledTo}</div>
                    {(j.hauledFromAddress || j.hauledToAddress) && (
                      <div className="flex gap-2 mt-0.5">
                        {j.hauledFromAddress && <AddressLink value={j.hauledFromAddress} className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-0.5" />}
                        {j.hauledToAddress && <AddressLink value={j.hauledToAddress} className="text-[10px] text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-0.5" />}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className="font-mono text-xs">
                      <span className={j.totalLoads > 0 && j.completedLoads >= j.totalLoads ? 'text-green-400 font-bold' : 'text-purple-200'}>
                        {j.completedLoads}
                      </span>
                      {j.totalLoads > 0
                        ? <span className="text-purple-500">/{j.totalLoads}</span>
                        : <span className="text-purple-500"> loads</span>
                      }
                    </span>
                  </td>
                  <td className="py-2 px-2 text-purple-300 text-xs">{j._count.tickets}</td>
                  <td className="py-2 px-2 text-purple-300 text-xs">
                    {format(j.createdAt, 'MMM d, yyyy')}
                  </td>
                  <td className="py-2 px-2 text-right space-x-2">
                    {/* Edit popup */}
                    <details className="inline-block relative">
                      <summary className="text-xs text-purple-400 hover:text-purple-200 cursor-pointer">
                        Edit
                      </summary>
                      <div className="absolute right-0 top-6 z-20 bg-[#1a0a2e] border border-purple-800 rounded-lg p-4 shadow-xl w-[420px]">
                        <form action={updateJob} className="space-y-2">
                          <input type="hidden" name="jobId" value={j.id} />
                          <input type="hidden" name="companyId" value={company.id} />
                          <div>
                            <label className="label-sa text-xs sa-edit-name-label">{j.brokerId ? 'Customer Name' : 'Name'}</label>
                            <input name="name" defaultValue={j.name} required className="input-sa text-xs" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Hauled From</label>
                              <input name="hauledFrom" defaultValue={j.hauledFrom} required className="input-sa text-xs" />
                              <input name="hauledFromAddress" defaultValue={j.hauledFromAddress ?? ''} className="input-sa text-xs mt-1" placeholder="Address" />
                            </div>
                            <div>
                              <label className="label-sa text-xs">Hauled To</label>
                              <input name="hauledTo" defaultValue={j.hauledTo} required className="input-sa text-xs" />
                              <input name="hauledToAddress" defaultValue={j.hauledToAddress ?? ''} className="input-sa text-xs mt-1" placeholder="Address" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Broker</label>
                              <BrokerToggleSelect
                                name="brokerId"
                                defaultValue={j.brokerId ?? ''}
                                className="input-sa text-xs"
                                customerWrapClass="sa-edit-cust-wrap"
                                nameLabelClass="sa-edit-name-label"
                                nameLabelBroker="Customer Name"
                                nameLabelDefault="Name"
                              >
                                <option value="">— None —</option>
                                {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </BrokerToggleSelect>
                            </div>
                            <div className="sa-edit-cust-wrap" style={j.brokerId ? { display: 'none' } : undefined}>
                              <label className="label-sa text-xs">Customer</label>
                              <select name="customerId" defaultValue={j.customerId ?? ''} className="input-sa text-xs">
                                <option value="">— None —</option>
                                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Driver</label>
                              <select name="driverId" defaultValue={j.driverId ?? ''} className="input-sa text-xs">
                                <option value="">— Unassigned —</option>
                                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="label-sa text-xs">Material</label>
                              <input name="material" defaultValue={j.material ?? ''} className="input-sa text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="label-sa text-xs">Loads</label>
                              <input name="totalLoads" type="number" min="0" defaultValue={j.totalLoads || ''} className="input-sa text-xs" placeholder="0=unlimited" />
                            </div>
                            <div>
                              <label className="label-sa text-xs">Type</label>
                              <select name="quantityType" defaultValue={j.quantityType} className="input-sa text-xs">
                                <option value="LOADS">Loads</option>
                                <option value="TONS">Tons</option>
                                <option value="YARDS">Yards</option>
                              </select>
                            </div>
                            <div>
                              <label className="label-sa text-xs">Rate</label>
                              <input name="ratePerUnit" type="number" min="0" step="0.01" defaultValue={j.ratePerUnit?.toString() ?? ''} className="input-sa text-xs" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="label-sa text-xs">Date</label>
                              <input name="date" type="date" defaultValue={dateVal} className="input-sa text-xs" />
                            </div>
                            <div className="flex items-end">
                              <label className="flex items-center gap-2 cursor-pointer text-purple-300 text-xs py-2">
                
                                <input type="checkbox" name="openForDrivers" value="true" defaultChecked={j.openForDrivers} className="rounded border-purple-600" />
                                Open for drivers
                              </label>
                            </div>
                          </div>
                          <div>
                            <label className="label-sa text-xs">Notes</label>
                            <textarea name="notes" rows={2} defaultValue={j.notes ?? ''} className="input-sa text-xs" />
                          </div>
                          <button type="submit" className="btn-purple text-xs w-full">Save</button>
                        </form>
                      </div>
                    </details>
                    {/* Delete */}
                    <form action={deleteJob} className="inline">
                      <input type="hidden" name="jobId" value={j.id} />
                      <input type="hidden" name="companyId" value={company.id} />
                      <ConfirmButton
                        message="Delete this job permanently? Linked tickets will be unlinked."
                        className="text-xs text-red-400 hover:text-red-200"
                      >
                        Delete
                      </ConfirmButton>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <p className="text-center text-purple-400 py-8 text-sm">No jobs for this tenant.</p>
        )}
      </div>
    </div>
  );
}
