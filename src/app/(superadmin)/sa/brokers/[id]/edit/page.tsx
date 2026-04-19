import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperadmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import BrokerContactsEditor from '@/components/BrokerContactsEditor';
import TripSheetFormUpload from '@/components/TripSheetFormUpload';
import BrokerLogoUpload from '@/components/BrokerLogoUpload';
import type { BrokerContact } from '@/lib/broker-types';

async function updateBrokerAction(formData: FormData) {
  'use server';
  await requireSuperadmin();
  const brokerId = String(formData.get('brokerId') || '');
  const broker = await prisma.broker.findUnique({ where: { id: brokerId } });
  if (!broker) throw new Error('Broker not found');

  let contacts: BrokerContact[] = [];
  try {
    contacts = JSON.parse(String(formData.get('contacts') || '[]'));
  } catch { /* empty */ }

  await prisma.broker.update({
    where: { id: brokerId },
    data: {
      name: String(formData.get('name') || '').trim() || broker.name,
      contacts,
      email: String(formData.get('email') || '').trim() || null,
      phone: String(formData.get('phone') || '').trim() || null,
      commissionPct: Number(formData.get('commissionPct') || '0') || 0,
      mailingAddress: String(formData.get('mailingAddress') || '').trim() || null,
      dueDateRule: String(formData.get('dueDateRule') || 'NEXT_FRIDAY'),
      dueDateDays: formData.get('dueDateRule') === 'CUSTOM'
        ? (Number(formData.get('dueDateDays') || '30') || 30)
        : null,
      notes: String(formData.get('notes') || '').trim() || null,
      active: formData.get('active') === 'on',
    },
  });

  revalidatePath('/sa/brokers');
  redirect('/sa/brokers');
}

export default async function SuperadminEditGlobalBrokerPage({
  params,
}: {
  params: { id: string };
}) {
  await requireSuperadmin();

  const broker = await prisma.broker.findUnique({ where: { id: params.id } });
  if (!broker) notFound();

  const existingContacts = Array.isArray(broker.contacts) ? (broker.contacts as unknown as BrokerContact[]) : [];

  return (
    <div className="p-8 max-w-3xl">
      <header className="mb-6">
        <Link href="/sa/brokers" className="text-sm text-purple-400 hover:text-purple-200">
          ← Back to Brokers
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white mt-1">Edit Broker — {broker.name}</h1>
      </header>

      <form action={updateBrokerAction} className="panel-sa p-6 space-y-5">
        <input type="hidden" name="brokerId" value={broker.id} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="label-sa" htmlFor="name">Broker Name *</label>
            <input id="name" name="name" required className="input-sa" defaultValue={broker.name} />
          </div>
          <div>
            <label className="label-sa" htmlFor="email">Primary Email</label>
            <input id="email" name="email" type="email" className="input-sa" defaultValue={broker.email ?? ''} />
          </div>
          <div>
            <label className="label-sa" htmlFor="phone">Phone (for SMS jobs)</label>
            <input id="phone" name="phone" type="tel" className="input-sa" defaultValue={broker.phone ?? ''} placeholder="+12395550111" />
          </div>
          <div>
            <label className="label-sa" htmlFor="commissionPct">Commission %</label>
            <input id="commissionPct" name="commissionPct" type="number" step="0.01" min="0" max="100" className="input-sa"
              defaultValue={Number(broker.commissionPct).toFixed(2)} />
          </div>
        </div>

        <BrokerContactsEditor initial={existingContacts} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label-sa" htmlFor="dueDateRule">Invoice Due Date Rule</label>
            <select id="dueDateRule" name="dueDateRule" className="input-sa" defaultValue={broker.dueDateRule}>
              <option value="NEXT_FRIDAY">Next Friday after period end</option>
              <option value="NET_15">Net 15 days</option>
              <option value="NET_30">Net 30 days</option>
              <option value="NET_45">Net 45 days</option>
              <option value="NET_60">Net 60 days</option>
              <option value="CUSTOM">Custom days</option>
            </select>
          </div>
          <div>
            <label className="label-sa" htmlFor="dueDateDays">Custom Days (if Custom)</label>
            <input id="dueDateDays" name="dueDateDays" type="number" min="1" max="365" className="input-sa"
              defaultValue={broker.dueDateDays ?? ''} placeholder="e.g. 45" />
          </div>
        </div>

        <div>
          <label className="label-sa" htmlFor="mailingAddress">Mailing Address (for trip sheet header)</label>
          <textarea id="mailingAddress" name="mailingAddress" rows={3} className="input-sa" placeholder="123 Main St&#10;City, ST 12345" defaultValue={broker.mailingAddress ?? ''} />
        </div>

        <div>
          <label className="label-sa" htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={3} className="input-sa" defaultValue={broker.notes ?? ''} />
        </div>

        <div className="flex items-center gap-2">
          <input id="active" name="active" type="checkbox" defaultChecked={broker.active} className="rounded border-purple-500/50 bg-[#0f0719]" />
          <label htmlFor="active" className="text-sm text-purple-100">Active</label>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-purple-500/30">
          <button type="submit" className="btn-purple">Save Changes</button>
          <Link href="/sa/brokers" className="text-sm text-purple-400 hover:text-purple-200">Cancel</Link>
        </div>
      </form>

      {/* Trip sheet upload + logo — outside the main form to avoid nested-form issues */}
      <div className="panel-sa p-6 mt-4 space-y-6">
        <BrokerLogoUpload brokerId={broker.id} currentFile={broker.logoFile} />
        <TripSheetFormUpload brokerId={broker.id} currentFile={broker.tripSheetForm} />
      </div>
    </div>
  );
}
