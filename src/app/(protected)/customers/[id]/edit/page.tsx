import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import ConfirmButton from '@/components/ConfirmButton';

async function updateCustomerAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const customer = await prisma.customer.findFirst({ where: { id, companyId: session.companyId } });
  if (!customer) throw new Error('Not found');

  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Name required');

  await prisma.customer.update({
    where: { id },
    data: {
      name,
      contact: String(formData.get('contact') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
      email: String(formData.get('email') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
    },
  });

  revalidatePath('/customers');
  redirect('/customers');
}

async function deleteCustomerAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const id = String(formData.get('id') || '');
  const customer = await prisma.customer.findFirst({ where: { id, companyId: session.companyId } });
  if (!customer) throw new Error('Customer not found');

  // Block deletion if customer has any jobs, tickets, or invoices
  const [jobCount, ticketCount, invoiceCount] = await Promise.all([
    prisma.job.count({ where: { customerId: id } }),
    prisma.ticket.count({ where: { customerId: id } }),
    prisma.invoice.count({ where: { customerId: id } }),
  ]);

  if (jobCount > 0 || ticketCount > 0 || invoiceCount > 0) {
    const parts: string[] = [];
    if (jobCount > 0) parts.push(`${jobCount} job${jobCount !== 1 ? 's' : ''}`);
    if (ticketCount > 0) parts.push(`${ticketCount} ticket${ticketCount !== 1 ? 's' : ''}`);
    if (invoiceCount > 0) parts.push(`${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}`);
    throw new Error(`Cannot delete this customer — they have ${parts.join(', ')} linked. Remove or reassign those records first.`);
  }

  await prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
  revalidatePath('/customers');
  redirect('/customers');
}

export default async function EditCustomerPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const customer = await prisma.customer.findFirst({
    where: { id: params.id, companyId: session.companyId },
  });
  if (!customer) notFound();

  return (
    <div className="p-8 max-w-xl">
      <header className="mb-6">
        <Link href="/customers" className="text-sm text-steel-500 hover:text-steel-800">← Customers</Link>
        <h1 className="text-3xl font-bold tracking-tight mt-1">Edit Customer</h1>
      </header>

      <form action={updateCustomerAction} className="panel p-6 space-y-4">
        <input type="hidden" name="id" value={customer.id} />
        <div>
          <label className="label">Company Name *</label>
          <input name="name" required className="input" defaultValue={customer.name} />
        </div>
        <div>
          <label className="label">Contact Person</label>
          <input name="contact" className="input" defaultValue={customer.contact ?? ''} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Phone</label>
            <input name="phone" className="input" defaultValue={customer.phone ?? ''} />
          </div>
          <div>
            <label className="label">Email</label>
            <input name="email" type="email" className="input" defaultValue={customer.email ?? ''} />
          </div>
        </div>
        <div>
          <label className="label">Address</label>
          <input name="address" className="input" defaultValue={customer.address ?? ''} />
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-steel-200">
          <button type="submit" className="btn-accent">Save</button>
          <Link href="/customers" className="btn-ghost">Cancel</Link>
        </div>
      </form>

      {/* Delete customer */}
      <form action={deleteCustomerAction} className="mt-6 panel p-6 border-red-200 bg-red-50">
        <input type="hidden" name="id" value={customer.id} />
        <h3 className="text-sm font-semibold text-red-800 mb-1">Delete Customer</h3>
        <p className="text-xs text-red-700 mb-3">
          This will permanently remove this customer. Deletion is only allowed if the customer has no jobs, tickets, or invoices.
        </p>
        <ConfirmButton
          message={`Are you sure you want to delete "${customer.name}"? This cannot be undone.`}
          className="px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700"
        >
          Delete Customer
        </ConfirmButton>
      </form>
    </div>
  );
}
