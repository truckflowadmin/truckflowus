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
// Restore actions
// ---------------------------------------------------------------------------

async function restoreCustomerAction(formData: FormData) {
  'use server';
  const sa = await requireSuperadmin();
  const id = String(formData.get('id') || '');
  const companyId = String(formData.get('companyId') || '');
  if (!id || !companyId) throw new Error('Missing id');

  const customer = await prisma.customer.findFirst({
    where: { id, companyId, deletedAt: { not: null } },
  });
  if (!customer) throw new Error('Deleted customer not found');

  await prisma.customer.update({ where: { id }, data: { deletedAt: null } });

  await audit({
    companyId,
    entityType: 'customer',
    entityId: id,
    action: 'RESTORE',
    actor: sa.email,
    actorRole: 'SUPERADMIN',
    summary: `Restored customer "${customer.name}"`,
  });

  revalidatePath(`/sa/tenants/${companyId}/trash`);
  revalidatePath(`/sa/tenants/${companyId}/customers`);
}

async function restoreJobAction(formData: FormData) {
  'use server';
  const sa = await requireSuperadmin();
  const id = String(formData.get('id') || '');
  const companyId = String(formData.get('companyId') || '');
  if (!id || !companyId) throw new Error('Missing id');

  const job = await prisma.job.findFirst({
    where: { id, companyId, deletedAt: { not: null } },
  });
  if (!job) throw new Error('Deleted job not found');

  // Also restore any tickets that were soft-deleted together with this job
  await prisma.$transaction([
    prisma.job.update({ where: { id }, data: { deletedAt: null } }),
    prisma.ticket.updateMany({
      where: { jobId: id, deletedAt: job.deletedAt },
      data: { deletedAt: null },
    }),
  ]);

  await audit({
    companyId,
    entityType: 'job',
    entityId: id,
    action: 'RESTORE',
    actor: sa.email,
    actorRole: 'SUPERADMIN',
    summary: `Restored job #${job.jobNumber}`,
  });

  revalidatePath(`/sa/tenants/${companyId}/trash`);
  revalidatePath(`/sa/tenants/${companyId}/jobs`);
}

async function restoreTicketAction(formData: FormData) {
  'use server';
  const sa = await requireSuperadmin();
  const id = String(formData.get('id') || '');
  const companyId = String(formData.get('companyId') || '');
  if (!id || !companyId) throw new Error('Missing id');

  const ticket = await prisma.ticket.findFirst({
    where: { id, companyId, deletedAt: { not: null } },
  });
  if (!ticket) throw new Error('Deleted ticket not found');

  await prisma.ticket.update({ where: { id }, data: { deletedAt: null } });

  await audit({
    companyId,
    entityType: 'ticket',
    entityId: id,
    action: 'RESTORE',
    actor: sa.email,
    actorRole: 'SUPERADMIN',
    summary: `Restored ticket #${ticket.ticketNumber}`,
  });

  revalidatePath(`/sa/tenants/${companyId}/trash`);
  revalidatePath(`/sa/tenants/${companyId}/tickets`);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function TrashPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();
  const companyId = params.id;

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true },
  });
  if (!company) notFound();

  // Fetch soft-deleted records — bypass middleware by passing explicit deletedAt filter
  const [deletedCustomers, deletedJobs, deletedTickets] = await Promise.all([
    prisma.customer.findMany({
      where: { companyId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: { id: true, name: true, phone: true, email: true, deletedAt: true },
    }),
    prisma.job.findMany({
      where: { companyId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        jobNumber: true,
        hauledFrom: true,
        hauledTo: true,
        material: true,
        status: true,
        deletedAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.ticket.findMany({
      where: { companyId, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
      select: {
        id: true,
        ticketNumber: true,
        hauledFrom: true,
        hauledTo: true,
        material: true,
        quantity: true,
        quantityType: true,
        status: true,
        deletedAt: true,
        customer: { select: { name: true } },
        driver: { select: { name: true } },
      },
    }),
  ]);

  const totalDeleted = deletedCustomers.length + deletedJobs.length + deletedTickets.length;

  return (
    <div className="p-4 md:p-8 text-white max-w-7xl mx-auto">
      <TenantNav tenantId={companyId} tenantName={company.name} />

      <h2 className="text-2xl font-bold mb-1">Trash</h2>
      <p className="text-purple-400 text-sm mb-6">
        {totalDeleted === 0
          ? 'No deleted records for this tenant.'
          : `${totalDeleted} deleted record${totalDeleted !== 1 ? 's' : ''} — restore items that dispatchers deleted by mistake.`}
      </p>

      {/* ── Deleted Customers ─────────────────────────────── */}
      {deletedCustomers.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-purple-300 mb-3">
            Customers ({deletedCustomers.length})
          </h3>
          <div className="bg-purple-900/30 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-purple-400 text-left border-b border-purple-800">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Deleted</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deletedCustomers.map((c) => (
                  <tr key={c.id} className="border-b border-purple-800/50 hover:bg-purple-900/20">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-purple-300">{c.phone || '—'}</td>
                    <td className="px-4 py-2 text-purple-300">{c.email || '—'}</td>
                    <td className="px-4 py-2 text-purple-400 text-xs">
                      {c.deletedAt ? format(new Date(c.deletedAt), 'MMM d, yyyy h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={restoreCustomerAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="companyId" value={companyId} />
                        <ConfirmButton
                          message={`Restore customer "${c.name}"? It will reappear in the dispatcher's customer list.`}
                          className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          Restore
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Deleted Jobs ─────────────────────────────── */}
      {deletedJobs.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-purple-300 mb-3">
            Jobs ({deletedJobs.length})
          </h3>
          <div className="bg-purple-900/30 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-purple-400 text-left border-b border-purple-800">
                  <th className="px-4 py-2">Job #</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Route</th>
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Deleted</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deletedJobs.map((j) => (
                  <tr key={j.id} className="border-b border-purple-800/50 hover:bg-purple-900/20">
                    <td className="px-4 py-2 font-medium">#{j.jobNumber}</td>
                    <td className="px-4 py-2">{j.customer?.name || '—'}</td>
                    <td className="px-4 py-2 text-purple-300 text-xs">
                      {j.hauledFrom} → {j.hauledTo}
                    </td>
                    <td className="px-4 py-2">{j.material || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-800/50">{j.status}</span>
                    </td>
                    <td className="px-4 py-2 text-purple-400 text-xs">
                      {j.deletedAt ? format(new Date(j.deletedAt), 'MMM d, yyyy h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={restoreJobAction}>
                        <input type="hidden" name="id" value={j.id} />
                        <input type="hidden" name="companyId" value={companyId} />
                        <ConfirmButton
                          message={`Restore job #${j.jobNumber}? Its tickets that were deleted at the same time will also be restored.`}
                          className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          Restore
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Deleted Tickets ─────────────────────────────── */}
      {deletedTickets.length > 0 && (
        <section className="mb-8">
          <h3 className="text-lg font-semibold text-purple-300 mb-3">
            Tickets ({deletedTickets.length})
          </h3>
          <div className="bg-purple-900/30 rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-purple-400 text-left border-b border-purple-800">
                  <th className="px-4 py-2">Ticket #</th>
                  <th className="px-4 py-2">Customer</th>
                  <th className="px-4 py-2">Driver</th>
                  <th className="px-4 py-2">Route</th>
                  <th className="px-4 py-2">Material</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Deleted</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {deletedTickets.map((t) => (
                  <tr key={t.id} className="border-b border-purple-800/50 hover:bg-purple-900/20">
                    <td className="px-4 py-2 font-medium">#{t.ticketNumber}</td>
                    <td className="px-4 py-2">{t.customer?.name || '—'}</td>
                    <td className="px-4 py-2">{t.driver?.name || '—'}</td>
                    <td className="px-4 py-2 text-purple-300 text-xs">
                      {t.hauledFrom} → {t.hauledTo}
                    </td>
                    <td className="px-4 py-2">{t.material || '—'}</td>
                    <td className="px-4 py-2">{Number(t.quantity)} {t.quantityType}</td>
                    <td className="px-4 py-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-purple-800/50">{t.status}</span>
                    </td>
                    <td className="px-4 py-2 text-purple-400 text-xs">
                      {t.deletedAt ? format(new Date(t.deletedAt), 'MMM d, yyyy h:mm a') : '—'}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <form action={restoreTicketAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <input type="hidden" name="companyId" value={companyId} />
                        <ConfirmButton
                          message={`Restore ticket #${t.ticketNumber}? It will reappear in the dispatcher's ticket list.`}
                          className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
                        >
                          Restore
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
