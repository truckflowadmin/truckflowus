import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { StatusBadge } from '@/components/StatusBadge';
import { format } from 'date-fns';
import { assignDriverAction, updateStatusAction, deleteTicketAction, duplicateTicketAction, markTicketReviewedAction, unmarkTicketReviewedAction } from '../actions';
import { getEntityAuditLog } from '@/lib/audit';
import TicketPhotoUpload from './TicketPhotoUpload';
import RotatableImage from '@/components/RotatableImage';

const QTY_LABELS: Record<string, string> = { LOADS: 'Loads', TONS: 'Tons', YARDS: 'Yards' };
const RATE_LABELS: Record<string, string> = { LOADS: 'Rate / load', TONS: 'Rate / ton', YARDS: 'Rate / yard' };

export default async function TicketDetail({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const ticket = await prisma.ticket.findFirst({
    where: { id: params.id, companyId: session.companyId },
    include: { driver: { include: { assignedTruck: { select: { truckNumber: true } } } }, customer: true, broker: true, invoice: true },
  });
  if (!ticket) notFound();

  const drivers = await prisma.driver.findMany({
    where: { companyId: session.companyId, active: true },
    include: { assignedTruck: { select: { truckNumber: true } } },
    orderBy: { name: 'asc' },
  });

  const logs = await prisma.smsLog.findMany({
    where: { ticketId: ticket.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const auditLogs = await getEntityAuditLog(ticket.id);

  const num = String(ticket.ticketNumber).padStart(4, '0');
  const rate = ticket.ratePerUnit ? Number(ticket.ratePerUnit) : null;
  const total = rate !== null ? rate * Number(ticket.quantity) : null;
  const qtyLabel = QTY_LABELS[ticket.quantityType] || 'Loads';
  const rateLabel = RATE_LABELS[ticket.quantityType] || 'Rate / load';

  return (
    <div className="p-8 max-w-5xl">
      {ticket.invoiceId && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <span className="text-purple-600 text-lg leading-none">&#128274;</span>
          <p className="text-sm text-purple-800 font-medium flex-1">
            This ticket is on an invoice and cannot be modified.
          </p>
        </div>
      )}
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/tickets" className="text-sm text-steel-500 hover:text-steel-800">← Tickets</Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-3xl font-bold tracking-tight font-mono">#{num}</h1>
            <StatusBadge status={ticket.status} />
            {ticket.dispatcherReviewedAt ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800">
                ✓ Reviewed
              </span>
            ) : ticket.photoUrl ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-800">
                Pending Review
              </span>
            ) : null}
          </div>
          <div className="text-sm text-steel-500 mt-1">
            Created {format(ticket.createdAt, 'MMM d, yyyy h:mm a')}
          </div>
        </div>
        <div className="flex gap-2">
          <form action={duplicateTicketAction}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <button className="btn-ghost text-sm">Duplicate</button>
          </form>
          {!ticket.invoiceId && <Link href={`/tickets/${ticket.id}/edit`} className="btn-ghost">Edit</Link>}
          {!ticket.invoiceId && (
            <form action={deleteTicketAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <button className="btn-ghost text-red-600 hover:bg-red-50 border-red-200">Delete</button>
            </form>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="panel p-5">
            <h2 className="font-semibold mb-4">Job Details</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Info label="Customer" value={ticket.customer?.name ?? '—'} />
              {ticket.broker && (
                <Info label="Broker" value={`${ticket.broker.name} (${Number(ticket.broker.commissionPct)}%)`} />
              )}
              <Info label="Truck #" value={ticket.truckNumber ?? '—'} />
              <Info label="Material" value={ticket.material ?? '—'} />
              <Info label={qtyLabel} value={ticket.quantityType === 'TONS' ? String(Number(ticket.quantity)) : String(Math.round(Number(ticket.quantity)))} />
              <Info label={rateLabel} value={rate !== null ? `$${rate.toFixed(2)}` : '—'} />
              <Info label="Line total" value={total !== null ? `$${total.toFixed(2)}` : '—'} />
              {ticket.ticketRef && <Info label="Ticket #" value={ticket.ticketRef} />}
              <Info label="Date" value={ticket.date ? format(ticket.date, 'MMM d, yyyy') : '—'} />
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="label">Hauled From</div>
                  <div>{ticket.hauledFrom}</div>
                </div>
                <div>
                  <div className="label">Hauled To</div>
                  <div>{ticket.hauledTo}</div>
                </div>
              </div>
              {ticket.driverNotes && (
                <div className="sm:col-span-2">
                  <div className="label">Driver Notes</div>
                  <pre className="whitespace-pre-wrap text-steel-700 bg-steel-50 p-3 rounded border border-steel-200 text-xs">{ticket.driverNotes}</pre>
                </div>
              )}
            </dl>
          </section>

          {/* Driver Photo & AI-Scanned Data */}
          {ticket.invoiceId ? (
            /* Invoiced tickets: static read-only photo section */
            (ticket.photoUrl || ticket.scannedTons || ticket.scannedYards || ticket.scannedTicketNumber || ticket.scannedDate) && (
              <section className="panel p-5">
                <h2 className="font-semibold mb-4">Driver Ticket Photo</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ticket.photoUrl && (
                    <div className="sm:col-span-2">
                      <RotatableImage
                        src={ticket.photoUrl}
                        alt="Ticket photo"
                        className="rounded-lg border border-steel-200 max-h-64 object-contain w-full bg-steel-50"
                        linkToFullSize
                      />
                      <div className="text-xs text-steel-500 mt-1">
                        Click to view full size · Hover to rotate
                        {ticket.scannedAt && <> • Scanned {format(ticket.scannedAt, 'MMM d, h:mm a')}</>}
                      </div>
                    </div>
                  )}
                  {(ticket.scannedTons || ticket.scannedYards || ticket.scannedTicketNumber || ticket.scannedDate) && (
                    <div className="sm:col-span-2 bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-3">
                        AI-Extracted Data
                      </div>
                      <dl className="grid grid-cols-2 gap-3 text-sm">
                        {ticket.scannedTicketNumber && (
                          <div>
                            <dt className="text-xs text-steel-500">Physical Ticket #</dt>
                            <dd className="font-medium">{ticket.scannedTicketNumber}</dd>
                          </div>
                        )}
                        {ticket.scannedDate && (
                          <div>
                            <dt className="text-xs text-steel-500">Ticket Date</dt>
                            <dd className="font-medium">{ticket.scannedDate}</dd>
                          </div>
                        )}
                        {ticket.scannedTons && (
                          <div>
                            <dt className="text-xs text-steel-500">Tons</dt>
                            <dd className="font-medium">{ticket.scannedTons}</dd>
                          </div>
                        )}
                        {ticket.scannedYards && (
                          <div>
                            <dt className="text-xs text-steel-500">Yards</dt>
                            <dd className="font-medium">{ticket.scannedYards}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </div>
              </section>
            )
          ) : (
            /* Non-invoiced tickets: interactive upload component (always shown) */
            <TicketPhotoUpload
              ticketId={ticket.id}
              currentPhotoUrl={ticket.photoUrl}
              currentExtracted={{
                tons: ticket.scannedTons ?? null,
                yards: ticket.scannedYards ?? null,
                ticketNumber: ticket.scannedTicketNumber ?? null,
                date: ticket.scannedDate ?? null,
              }}
              scannedAt={ticket.scannedAt?.toISOString() ?? null}
            />
          )}

          <section className="panel p-5">
            <h2 className="font-semibold mb-4">Timeline</h2>
            <ul className="text-sm space-y-2">
              <TimelineRow label="Created" at={ticket.createdAt} />
              <TimelineRow label="Dispatched" at={ticket.dispatchedAt} />
              <TimelineRow label="Started" at={ticket.startedAt} />
              <TimelineRow label="Completed" at={ticket.completedAt} />
            </ul>
          </section>

          <section className="panel p-5">
            <h2 className="font-semibold mb-4">SMS Activity</h2>
            {logs.length === 0 ? (
              <p className="text-sm text-steel-500">No SMS activity yet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {logs.map((l) => (
                  <li key={l.id} className="border-l-2 pl-3 py-1" style={{ borderColor: l.direction === 'OUTBOUND' ? '#FFB500' : '#22262b' }}>
                    <div className="flex items-center gap-2 text-xs text-steel-500">
                      <span className="font-semibold">{l.direction}</span>
                      <span>{l.phone}</span>
                      <span>•</span>
                      <span>{format(l.createdAt, 'MMM d h:mm a')}</span>
                      {!l.success && <span className="text-red-600">• FAILED</span>}
                    </div>
                    <pre className="whitespace-pre-wrap mt-1 text-steel-800">{l.message}</pre>
                    {l.error && <div className="text-xs text-red-600 mt-1">{l.error}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Audit Trail */}
          {auditLogs.length > 0 && (
            <section className="panel p-5">
              <h2 className="font-semibold mb-4">Activity Log</h2>
              <ul className="space-y-2 text-sm">
                {auditLogs.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 border-l-2 border-purple-300 pl-3 py-1">
                    <div className="flex-1">
                      <div className="text-steel-800">{a.summary}</div>
                      <div className="text-xs text-steel-500 mt-0.5">
                        {a.actorRole === 'SUPERADMIN' && (
                          <span className="inline-block bg-purple-100 text-purple-800 rounded-full px-1.5 py-0.5 text-[10px] font-medium mr-1">
                            Platform
                          </span>
                        )}
                        {a.actor} · {format(a.createdAt, 'MMM d, h:mm a')}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="font-semibold mb-4">Driver</h2>
            {ticket.driver ? (
              <div className="text-sm">
                <div className="font-medium text-base">{ticket.driver.name}</div>
                <div className="text-steel-500">{ticket.driver.phone}</div>
                              </div>
            ) : (
              <p className="text-sm text-steel-500 mb-3">No driver assigned.</p>
            )}
            {!ticket.invoiceId && (
              <form action={assignDriverAction} className="mt-3 space-y-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <select name="driverId" className="input" required defaultValue="">
                  <option value="" disabled>{ticket.driver ? 'Reassign to…' : 'Assign driver…'}</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <button className="btn-accent w-full" type="submit">
                  {ticket.driver ? 'Reassign & Send SMS' : 'Assign & Send SMS'}
                </button>
              </form>
            )}
          </section>

          {!ticket.invoiceId && (
            <section className="panel p-5">
              <h2 className="font-semibold mb-4">Update Status</h2>
              <div className="space-y-2">
                {(['PENDING', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'ISSUE', 'CANCELLED'] as const).map((s) => (
                  <form key={s} action={updateStatusAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <input type="hidden" name="status" value={s} />
                    <button
                      type="submit"
                      disabled={ticket.status === s}
                      className={`w-full text-left px-3 py-2 rounded border text-sm transition-colors ${
                        ticket.status === s
                          ? 'bg-steel-100 text-steel-400 border-steel-200 cursor-not-allowed'
                          : 'bg-white border-steel-300 hover:bg-steel-50'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  </form>
                ))}
              </div>
            </section>
          )}

          {/* Dispatcher Review */}
          {ticket.photoUrl && !ticket.invoiceId && (
            <section className="panel p-5">
              <h2 className="font-semibold mb-4">Driver Submission Review</h2>
              {ticket.dispatcherReviewedAt ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 bg-green-500 rounded-full" />
                    <span className="text-sm font-medium text-green-800">Reviewed</span>
                  </div>
                  <p className="text-xs text-steel-500 mb-3">
                    Reviewed on {format(ticket.dispatcherReviewedAt, 'MMM d, yyyy h:mm a')}
                  </p>
                  <p className="text-xs text-steel-500 mb-3">
                    Driver can no longer edit this ticket.
                  </p>
                  <form action={unmarkTicketReviewedAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <button className="btn-ghost text-sm w-full text-amber-700 border-amber-300 hover:bg-amber-50">
                      Undo Review (allow driver edits)
                    </button>
                  </form>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-amber-800">Pending Review</span>
                  </div>
                  <p className="text-xs text-steel-500 mb-3">
                    The driver can still edit this ticket. Marking it as reviewed will lock driver edits.
                  </p>
                  <form action={markTicketReviewedAction}>
                    <input type="hidden" name="ticketId" value={ticket.id} />
                    <button className="btn-accent w-full py-2.5 font-bold">
                      ✓ Mark as Reviewed
                    </button>
                  </form>
                </div>
              )}
            </section>
          )}

          {ticket.invoice && (
            <section className="panel p-5">
              <h2 className="font-semibold mb-2">Invoice</h2>
              <Link href={`/invoices/${ticket.invoice.id}`} className="text-safety-dark hover:underline text-sm">
                Invoice #{String(ticket.invoice.invoiceNumber).padStart(4, '0')}
              </Link>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function TimelineRow({ label, at }: { label: string; at: Date | null | undefined }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`w-2 h-2 rounded-full ${at ? 'bg-safety' : 'bg-steel-300'}`} />
      <span className="w-28 text-steel-500">{label}</span>
      <span className="tabular-nums">{at ? format(at, 'MMM d, h:mm a') : <span className="text-steel-400">—</span>}</span>
    </li>
  );
}
