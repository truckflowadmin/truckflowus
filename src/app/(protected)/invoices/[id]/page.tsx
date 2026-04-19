export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { format } from 'date-fns';
import { fmtQty, qtyUnit } from '@/lib/format';
import { updateInvoiceStatusAction, emailInvoiceAction, saveInvoiceNotesAction, updateDueDateAction } from '../actions';
import DeleteInvoiceButton from './DeleteInvoiceButton';

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-steel-200 text-steel-800',
  SENT: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const invoice = await prisma.invoice.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: {
      customer: true,
      broker: true,
      tickets: { orderBy: { completedAt: 'asc' } },
      company: true,
    },
  });
  if (!invoice) notFound();

  const isBroker = invoice.invoiceType === 'BROKER';
  const billedToName = isBroker ? invoice.broker?.name : invoice.customer?.name;
  const billedToContact = isBroker
    ? (() => {
        const contacts = Array.isArray(invoice.broker?.contacts)
          ? invoice.broker.contacts as any[]
          : JSON.parse(String(invoice.broker?.contacts || '[]'));
        return contacts[0]?.name || null;
      })()
    : invoice.customer?.contact;
  const billedToAddress = isBroker ? invoice.broker?.mailingAddress : invoice.customer?.address;
  const billedToEmail = isBroker ? invoice.broker?.email : invoice.customer?.email;

  return (
    <div className="p-8 max-w-4xl">
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/invoices" className="text-sm text-steel-500 hover:text-steel-800">← Invoices</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-3xl font-bold tracking-tight font-mono">
              INV-{String(invoice.invoiceNumber).padStart(4, '0')}
            </h1>
            <span className={`badge ${STATUS_COLORS[invoice.status]}`}>{invoice.status}</span>
            <span className={`badge ${isBroker ? 'bg-purple-100 text-purple-800' : 'bg-blue-50 text-blue-700'}`}>
              {isBroker ? 'Broker' : 'Customer'}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`/invoices/${invoice.id}/pdf`} target="_blank" className="btn-primary">Download PDF</a>
          <DeleteInvoiceButton invoiceId={invoice.id} />
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="panel p-5">
          <div className="label">Billed To</div>
          <div className="font-semibold">{billedToName ?? '—'}</div>
          {billedToContact && <div className="text-sm text-steel-600">{billedToContact}</div>}
          {billedToAddress && <div className="text-sm text-steel-600 whitespace-pre-line">{billedToAddress}</div>}
        </div>
        <div className="panel p-5">
          <div className="label">Service Period</div>
          <div>{format(invoice.periodStart, 'MMM d, yyyy')}</div>
          <div>to {format(invoice.periodEnd, 'MMM d, yyyy')}</div>
        </div>
        <div className="panel p-5">
          <div className="label">Dates</div>
          <div className="text-sm mb-2">Issued {format(invoice.issueDate, 'MMM d, yyyy')}</div>
          <form action={updateDueDateAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={invoice.id} />
            <label className="text-sm text-steel-600">Due:</label>
            <input
              name="dueDate"
              type="date"
              className="input text-sm py-1 px-2"
              defaultValue={invoice.dueDate ? format(invoice.dueDate, 'yyyy-MM-dd') : ''}
            />
            <button type="submit" className="text-xs text-safety-dark hover:underline">Save</button>
          </form>
        </div>
      </div>

      <section className="panel overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-steel-200 font-semibold">Line Items</div>
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
            <tr>
              <th className="text-left px-5 py-2">Ticket</th>
              <th className="text-left px-5 py-2">Date</th>
              <th className="text-left px-5 py-2">Material</th>
              <th className="text-right px-5 py-2">Qty</th>
              <th className="text-right px-5 py-2">Rate/Unit</th>
              <th className="text-right px-5 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.tickets.map((t) => {
              const rate = t.ratePerUnit ? Number(t.ratePerUnit) : 0;
              const qty = Number(t.quantity);
              const amount = rate * qty;
              return (
                <tr key={t.id} className="border-b border-steel-100">
                  <td className="px-5 py-3 font-mono">
                    <Link href={`/tickets/${t.id}`} className="hover:text-safety-dark">
                      #{String(t.ticketNumber).padStart(4, '0')}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-steel-600">{t.completedAt ? format(t.completedAt, 'MMM d') : '—'}</td>
                  <td className="px-5 py-3">{t.material ?? '—'}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmtQty(t.quantity, t.quantityType)} {qtyUnit(t.quantityType)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">${rate.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-medium">${amount.toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-steel-50">
            <tr>
              <td colSpan={5} className="px-5 py-2 text-right text-steel-600">Subtotal</td>
              <td className="px-5 py-2 text-right tabular-nums">${Number(invoice.subtotal).toFixed(2)}</td>
            </tr>
            {Number(invoice.taxRate) > 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-2 text-right text-steel-600">
                  Tax ({(Number(invoice.taxRate) * 100).toFixed(2)}%)
                </td>
                <td className="px-5 py-2 text-right tabular-nums">${Number(invoice.taxAmount).toFixed(2)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-diesel">
              <td colSpan={5} className="px-5 py-3 text-right font-bold">TOTAL</td>
              <td className="px-5 py-3 text-right tabular-nums font-bold text-lg">${Number(invoice.total).toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="panel p-5">
        <h2 className="font-semibold mb-3">Notes / Memo</h2>
        <form action={saveInvoiceNotesAction} className="space-y-2">
          <input type="hidden" name="id" value={invoice.id} />
          <textarea
            name="notes"
            rows={3}
            defaultValue={invoice.notes ?? ''}
            placeholder="Add payment instructions, notes, or a memo for this invoice…"
            className="input"
          />
          <button className="btn-primary text-sm" type="submit">Save Notes</button>
        </form>
      </section>

      <section className="panel p-5">
        <h2 className="font-semibold mb-3">Status</h2>
        <div className="flex flex-wrap gap-2">
          {(['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'] as const).map((s) => (
            <form key={s} action={updateInvoiceStatusAction}>
              <input type="hidden" name="id" value={invoice.id} />
              <input type="hidden" name="status" value={s} />
              <button
                type="submit"
                disabled={invoice.status === s}
                className={`px-4 py-2 rounded border text-sm transition-colors ${
                  invoice.status === s
                    ? 'bg-steel-100 text-steel-400 border-steel-200 cursor-not-allowed'
                    : 'bg-white border-steel-300 hover:bg-steel-50'
                }`}
              >
                Mark {s}
              </button>
            </form>
          ))}
        </div>
      </section>

      <section className="panel p-5">
        <h2 className="font-semibold mb-3">Email to {isBroker ? 'Broker' : 'Customer'}</h2>
        <form action={emailInvoiceAction} className="space-y-3">
          <input type="hidden" name="id" value={invoice.id} />
          <div>
            <label className="label">Recipient Email</label>
            <input
              name="to"
              type="email"
              defaultValue={billedToEmail ?? ''}
              placeholder={billedToEmail || 'Enter email address'}
              className="input"
            />
            <p className="text-xs text-steel-500 mt-1">
              Sends the PDF invoice as an attachment.
              {invoice.status === 'DRAFT' && ' Status will auto-advance to SENT.'}
            </p>
          </div>
          <button className="btn-primary" type="submit">Send Invoice Email</button>
        </form>
        {!process.env.SMTP_HOST && (
          <p className="text-xs text-steel-400 mt-3">
            SMTP not configured — emails will be logged to console.
            Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env.
          </p>
        )}
      </section>
    </div>
  );
}
