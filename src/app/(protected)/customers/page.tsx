import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

async function createCustomerAction(formData: FormData) {
  'use server';
  const session = await requireSession();
  const name = String(formData.get('name') || '').trim();
  if (!name) throw new Error('Name required');
  await prisma.customer.create({
    data: {
      companyId: session.companyId,
      name,
      contact: String(formData.get('contact') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
      email: String(formData.get('email') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
    },
  });
  revalidatePath('/customers');
}

export default async function CustomersPage() {
  const session = await requireSession();
  const customers = await prisma.customer.findMany({
    where: { companyId: session.companyId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { tickets: true, invoices: true } } },
  });

  return (
    <div className="p-8 max-w-5xl">
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">People</div>
        <h1 className="text-3xl font-bold tracking-tight">Customers</h1>
      </header>

      <form action={createCustomerAction} className="panel p-5 mb-6 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="md:col-span-2">
          <label className="label">Company Name *</label>
          <input name="name" required className="input" />
        </div>
        <div>
          <label className="label">Contact</label>
          <input name="contact" className="input" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input name="phone" className="input" />
        </div>
        <div>
          <label className="label">Email</label>
          <input name="email" type="email" className="input" />
        </div>
        <div className="md:col-span-6">
          <label className="label">Address</label>
          <input name="address" className="input" />
        </div>
        <div className="md:col-span-6">
          <button className="btn-accent" type="submit">+ Add Customer</button>
        </div>
      </form>

      <div className="panel overflow-hidden">
        {customers.length === 0 ? (
          <div className="p-10 text-center text-steel-500">No customers yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-5 py-2">Name</th>
                <th className="text-left px-5 py-2">Contact</th>
                <th className="text-left px-5 py-2">Phone</th>
                <th className="text-left px-5 py-2">Email</th>
                <th className="text-right px-5 py-2">Tickets</th>
                <th className="text-right px-5 py-2">Invoices</th>
                <th className="text-right px-5 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-steel-100 hover:bg-steel-50">
                  <td className="px-5 py-3 font-medium">
                    <a href={`/customers/${c.id}`} className="hover:text-safety-dark">{c.name}</a>
                  </td>
                  <td className="px-5 py-3">{c.contact ?? '—'}</td>
                  <td className="px-5 py-3">{c.phone ?? '—'}</td>
                  <td className="px-5 py-3">{c.email ?? '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c._count.tickets}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{c._count.invoices}</td>
                  <td className="px-5 py-3 text-right">
                    <a href={`/customers/${c.id}/edit`} className="text-xs text-steel-600 hover:text-steel-900">Edit</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
