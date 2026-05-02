import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { audit } from '@/lib/audit';
import TenantNav from '@/components/TenantNav';
import ConfirmButton from '@/components/ConfirmButton';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Server actions
// ---------------------------------------------------------------------------
async function createCustomer(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const companyId = String(formData.get('companyId') || '');
  const name = String(formData.get('name') || '').trim();
  const contact = String(formData.get('contact') || '').trim() || null;
  const phone = String(formData.get('phone') || '').trim() || null;
  const email = String(formData.get('email') || '').trim() || null;
  const address = String(formData.get('address') || '').trim() || null;

  if (!companyId || !name) throw new Error('Customer name is required');

  const customer = await prisma.customer.create({
    data: { companyId, name, contact, phone, email, address },
  });
  await audit({
    companyId,
    entityType: 'customer',
    entityId: customer.id,
    action: 'create',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Created customer "${name}"`,
    details: { name, contact, phone, email, address },
  });
  revalidatePath(`/sa/tenants/${companyId}/customers`);
}

async function updateCustomer(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const customerId = String(formData.get('customerId') || '');
  const companyId = String(formData.get('companyId') || '');
  const name = String(formData.get('name') || '').trim();
  const contact = String(formData.get('contact') || '').trim() || null;
  const phone = String(formData.get('phone') || '').trim() || null;
  const email = String(formData.get('email') || '').trim() || null;
  const address = String(formData.get('address') || '').trim() || null;

  if (!name) throw new Error('Customer name is required');

  const old = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!old) return;

  await prisma.customer.update({
    where: { id: customerId },
    data: { name, contact, phone, email, address },
  });
  await audit({
    companyId,
    entityType: 'customer',
    entityId: customerId,
    action: 'update',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Updated customer "${old.name}" → "${name}"`,
    details: { old: { name: old.name, contact: old.contact, phone: old.phone }, new: { name, contact, phone, email } },
  });
  revalidatePath(`/sa/tenants/${companyId}/customers`);
}

async function deleteCustomer(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const customerId = String(formData.get('customerId') || '');
  const companyId = String(formData.get('companyId') || '');

  const customer = await prisma.customer.findFirst({ where: { id: customerId, companyId } });
  if (!customer) return;

  // Check if customer has invoices
  const invoiceCount = await prisma.invoice.count({ where: { customerId } });
  if (invoiceCount > 0) {
    throw new Error(`Cannot delete — customer has ${invoiceCount} invoice(s). Remove invoices first.`);
  }

  await prisma.customer.delete({ where: { id: customerId } });
  await audit({
    companyId,
    entityType: 'customer',
    entityId: customerId,
    action: 'delete',
    actor: 'Platform Admin',
    actorRole: 'SUPERADMIN',
    summary: `Deleted customer "${customer.name}"`,
    details: { name: customer.name },
  });
  revalidatePath(`/sa/tenants/${companyId}/customers`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function TenantCustomersPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();

  const company = await prisma.company.findUnique({ where: { id: params.id } });
  if (!company) notFound();

  const customers = await prisma.customer.findMany({
    where: { companyId: params.id },
    orderBy: { name: 'asc' },
  });

  // Ticket + invoice counts per customer
  const ticketCounts = await prisma.ticket.groupBy({
    by: ['customerId'],
    where: { companyId: params.id, customerId: { not: null } },
    _count: { id: true },
  });
  const invoiceCounts = await prisma.invoice.groupBy({
    by: ['customerId'],
    where: { companyId: params.id },
    _count: { id: true },
  });
  const tMap: Record<string, number> = {};
  ticketCounts.forEach((tc) => { if (tc.customerId) tMap[tc.customerId] = tc._count.id; });
  const iMap: Record<string, number> = {};
  invoiceCounts.forEach((ic) => { if (ic.customerId) iMap[ic.customerId] = ic._count.id; });

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <TenantNav tenantId={company.id} tenantName={company.name} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white">
          Customers <span className="text-purple-400 font-normal">({customers.length})</span>
        </h1>
      </div>

      {/* Create customer */}
      <details className="panel-sa mb-4">
        <summary className="text-sm font-medium text-purple-300 cursor-pointer py-2 px-1">
          + Add Customer
        </summary>
        <form action={createCustomer} className="mt-3 space-y-3">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label-sa">Name</label>
              <input name="name" required className="input-sa" placeholder="ABC Construction" />
            </div>
            <div>
              <label className="label-sa">Contact Person</label>
              <input name="contact" className="input-sa" placeholder="Optional" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label-sa">Phone</label>
              <input name="phone" className="input-sa" placeholder="Optional" />
            </div>
            <div>
              <label className="label-sa">Email</label>
              <input name="email" type="email" className="input-sa" placeholder="Optional" />
            </div>
            <div>
              <label className="label-sa">Address</label>
              <input name="address" className="input-sa" placeholder="Optional" />
            </div>
          </div>
          <button type="submit" className="btn-purple">Create Customer</button>
        </form>
      </details>

      {/* Customers table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-xs uppercase tracking-wide text-purple-400 border-b border-purple-800">
            <tr>
              <th className="text-left py-2 px-2">Name</th>
              <th className="text-left py-2 px-2">Contact</th>
              <th className="text-left py-2 px-2">Phone</th>
              <th className="text-left py-2 px-2">Email</th>
              <th className="text-left py-2 px-2">Tickets</th>
              <th className="text-left py-2 px-2">Invoices</th>
              <th className="text-left py-2 px-2">Created</th>
              <th className="text-right py-2 px-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-900/30">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-purple-900/20">
                <td className="py-2 px-2 text-white font-medium">{c.name}</td>
                <td className="py-2 px-2 text-purple-300">{c.contact ?? '—'}</td>
                <td className="py-2 px-2 text-purple-300 text-xs">{c.phone ?? '—'}</td>
                <td className="py-2 px-2 text-purple-300 text-xs">{c.email ?? '—'}</td>
                <td className="py-2 px-2 text-purple-300">{tMap[c.id] ?? 0}</td>
                <td className="py-2 px-2 text-purple-300">{iMap[c.id] ?? 0}</td>
                <td className="py-2 px-2 text-purple-300 text-xs">
                  {format(c.createdAt, 'MMM d, yyyy')}
                </td>
                <td className="py-2 px-2 text-right space-x-2">
                  <details className="inline-block relative">
                    <summary className="text-xs text-purple-400 hover:text-purple-200 cursor-pointer">
                      Edit
                    </summary>
                    <div className="absolute right-0 top-6 z-20 bg-[#1a0a2e] border border-purple-800 rounded-lg p-4 shadow-xl w-80">
                      <form action={updateCustomer} className="space-y-2">
                        <input type="hidden" name="customerId" value={c.id} />
                        <input type="hidden" name="companyId" value={company.id} />
                        <div>
                          <label className="label-sa text-xs">Name</label>
                          <input name="name" defaultValue={c.name} required className="input-sa text-xs" />
                        </div>
                        <div>
                          <label className="label-sa text-xs">Contact</label>
                          <input name="contact" defaultValue={c.contact ?? ''} className="input-sa text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="label-sa text-xs">Phone</label>
                            <input name="phone" defaultValue={c.phone ?? ''} className="input-sa text-xs" />
                          </div>
                          <div>
                            <label className="label-sa text-xs">Email</label>
                            <input name="email" defaultValue={c.email ?? ''} className="input-sa text-xs" />
                          </div>
                        </div>
                        <div>
                          <label className="label-sa text-xs">Address</label>
                          <input name="address" defaultValue={c.address ?? ''} className="input-sa text-xs" />
                        </div>
                        <button type="submit" className="btn-purple text-xs w-full">Save</button>
                      </form>
                    </div>
                  </details>
                  <form action={deleteCustomer} className="inline">
                    <input type="hidden" name="customerId" value={c.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <ConfirmButton message="Delete this customer permanently?" className="text-xs text-red-400 hover:text-red-200">
                      Delete
                    </ConfirmButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="text-center text-purple-400 py-8 text-sm">No customers for this tenant.</p>
        )}
      </div>
    </div>
  );
}
