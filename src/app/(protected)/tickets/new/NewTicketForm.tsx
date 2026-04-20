'use client';

import { useState, useRef } from 'react';
import { createTicketAction, createCustomerInlineAction, createMaterialInlineAction } from '../actions';

interface Props {
  drivers: { id: string; name: string; truckNumber: string | null }[];
  customers: { id: string; name: string }[];
  materials: string[];
  brokers: { id: string; name: string }[];
  defaultRate: string;
}

export function NewTicketForm({ drivers, customers: initialCustomers, materials: initialMaterials, brokers, defaultRate }: Props) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [materials, setMaterials] = useState(initialMaterials);
  const [quantityType, setQuantityType] = useState<'LOADS' | 'TONS' | 'YARDS'>('LOADS');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newMatName, setNewMatName] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const customerSelectRef = useRef<HTMLSelectElement>(null);
  const materialSelectRef = useRef<HTMLSelectElement>(null);

  async function handleAddCustomer() {
    if (!newCustName.trim()) return;
    setSavingCustomer(true);
    try {
      const fd = new FormData();
      fd.set('name', newCustName.trim());
      const result = await createCustomerInlineAction(fd);
      if (result?.id) {
        setCustomers((prev) => [...prev, { id: result.id, name: result.name }].sort((a, b) => a.name.localeCompare(b.name)));
        setNewCustName('');
        setShowNewCustomer(false);
        // Select the new customer after state update
        setTimeout(() => {
          if (customerSelectRef.current) customerSelectRef.current.value = result.id;
        }, 0);
      }
    } finally {
      setSavingCustomer(false);
    }
  }

  async function handleAddMaterial() {
    if (!newMatName.trim()) return;
    setSavingMaterial(true);
    try {
      const fd = new FormData();
      fd.set('name', newMatName.trim());
      const result = await createMaterialInlineAction(fd);
      if (result?.name) {
        setMaterials((prev) => [...prev, result.name].sort());
        setNewMatName('');
        setShowNewMaterial(false);
        setTimeout(() => {
          if (materialSelectRef.current) materialSelectRef.current.value = result.name;
        }, 0);
      }
    } finally {
      setSavingMaterial(false);
    }
  }

  const quantityLabel = quantityType === 'LOADS' ? 'Loads' : quantityType === 'TONS' ? 'Tons' : 'Yards';
  const rateLabel = quantityType === 'LOADS' ? 'Rate per load ($)' : quantityType === 'TONS' ? 'Rate per ton ($)' : 'Rate per yard ($)';

  return (
    <form action={createTicketAction} className="panel p-6 space-y-5">
      {/* Hidden field for quantity type */}
      <input type="hidden" name="quantityType" value={quantityType} />

      {/* Customer with inline add */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label" htmlFor="customerId">Customer</label>
          <button
            type="button"
            onClick={() => setShowNewCustomer(!showNewCustomer)}
            className="text-xs text-safety-dark hover:underline"
          >
            {showNewCustomer ? 'Cancel' : '+ Add New'}
          </button>
        </div>
        {showNewCustomer ? (
          <div className="flex gap-2">
            <input
              value={newCustName}
              onChange={(e) => setNewCustName(e.target.value)}
              placeholder="Customer name"
              className="input flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomer(); } }}
            />
            <button
              type="button"
              onClick={handleAddCustomer}
              disabled={savingCustomer || !newCustName.trim()}
              className="btn-accent text-sm"
            >
              {savingCustomer ? 'Saving…' : 'Add'}
            </button>
          </div>
        ) : (
          <select ref={customerSelectRef} id="customerId" name="customerId" className="input">
            <option value="">— Select customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Driver */}
      <div>
        <label className="label" htmlFor="driverId">Assign Driver</label>
        <select id="driverId" name="driverId" className="input">
          <option value="">— Leave unassigned —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-steel-500 mt-1">
          Assigning a driver will immediately send them an SMS.
        </p>
      </div>

      {/* Broker (only shown if feature enabled and brokers exist) */}
      {brokers.length > 0 && (
        <div>
          <label className="label" htmlFor="brokerId">Broker</label>
          <select id="brokerId" name="brokerId" className="input">
            <option value="">— No broker —</option>
            {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}

      {/* Material with inline add */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="label" htmlFor="material">Material</label>
          <button
            type="button"
            onClick={() => setShowNewMaterial(!showNewMaterial)}
            className="text-xs text-safety-dark hover:underline"
          >
            {showNewMaterial ? 'Cancel' : '+ Add New'}
          </button>
        </div>
        {showNewMaterial ? (
          <div className="flex gap-2">
            <input
              value={newMatName}
              onChange={(e) => setNewMatName(e.target.value)}
              placeholder="Material name (e.g. Fill Dirt)"
              className="input flex-1"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddMaterial(); } }}
            />
            <button
              type="button"
              onClick={handleAddMaterial}
              disabled={savingMaterial || !newMatName.trim()}
              className="btn-accent text-sm"
            >
              {savingMaterial ? 'Saving…' : 'Add'}
            </button>
          </div>
        ) : (
          <select ref={materialSelectRef} id="material" name="material" className="input">
            <option value="">— Select material —</option>
            {materials.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
      </div>

      {/* Quantity type toggle + quantity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Quantity Type</label>
          <div className="flex rounded-lg border border-steel-300 overflow-hidden">
            {(['LOADS', 'TONS', 'YARDS'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setQuantityType(t)}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  quantityType === t
                    ? 'bg-diesel text-white'
                    : 'bg-white text-steel-700 hover:bg-steel-50'
                }`}
              >
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="quantity">{quantityLabel}</label>
          <input id="quantity" name="quantity" type="number" min={quantityType === 'TONS' ? '0.01' : '1'} step={quantityType === 'TONS' ? '0.01' : '1'} defaultValue={1} className="input" />
        </div>
      </div>

      {/* Hauled From / Hauled To */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="hauledFrom">Hauled From *</label>
          <input id="hauledFrom" name="hauledFrom" required className="input" placeholder="Pit, quarry, yard name…" />
        </div>
        <div>
          <label className="label" htmlFor="hauledTo">Hauled To *</label>
          <input id="hauledTo" name="hauledTo" required className="input" placeholder="Job site, address…" />
        </div>
      </div>

      {/* Truck Number */}
      <div>
        <label className="label" htmlFor="truckNumber">Truck #</label>
        <input id="truckNumber" name="truckNumber" className="input" placeholder="Truck number" />
      </div>

      {/* Ticket Number, Date, Rate */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label" htmlFor="ticketRef">Ticket Number</label>
          <input id="ticketRef" name="ticketRef" className="input" placeholder="Physical ticket #" />
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" name="date" type="date" className="input" />
        </div>
        <div>
          <label className="label" htmlFor="ratePerUnit">{rateLabel}</label>
          <input
            id="ratePerUnit" name="ratePerUnit" type="number" step="0.01" min="0"
            defaultValue={defaultRate}
            className="input"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-steel-200">
        <button type="submit" className="btn-accent">Create Ticket</button>
        <a href="/tickets" className="btn-ghost">Cancel</a>
      </div>
    </form>
  );
}
