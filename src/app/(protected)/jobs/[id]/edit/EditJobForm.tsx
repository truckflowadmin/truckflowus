'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateJobAction } from '../../actions';
const TRUCK_TYPE_LABELS: Record<string, string> = {
  SINGLE_AXLE: 'Single Axle',
  TANDEM: 'Tandem',
  TRI_AXLE: 'Tri-Axle',
  QUAD: 'Quad',
  SUPER_DUMP: 'Super Dump',
  OTHER: 'Other',
};

interface JobData {
  id: string;
  jobNumber: number;
  name: string;
  status: string;
  hauledFrom: string;
  hauledFromAddress: string | null;
  hauledTo: string;
  hauledToAddress: string | null;
  material: string | null;
  truckNumber: string | null;
  requiredTruckType: string | null;
  requiredTruckCount: number;
  assignedDriverIds: string[];
  quantityType: string;
  totalLoads: number;
  ratePerUnit: string | null;
  date: string | null;
  notes: string | null;
  openForDrivers: boolean;
  customerId: string | null;
  brokerId: string | null;
  driverId: string | null;
}

interface Props {
  job: JobData;
  customers: { id: string; name: string }[];
  drivers: { id: string; name: string; truckType: string | null }[];
  materials: string[];
  brokers: { id: string; name: string }[];
}

export default function EditJobForm({ job, customers, drivers, materials, brokers }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [brokerId, setBrokerId] = useState(job.brokerId || '');
  const [error, setError] = useState('');
  const [quantityType, setQuantityType] = useState(job.quantityType || 'LOADS');
  const [requiredTruckType, setRequiredTruckType] = useState(job.requiredTruckType || '');
  const [requiredTruckCount, setRequiredTruckCount] = useState(job.requiredTruckCount || 1);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>(job.assignedDriverIds || []);
  const [openForDrivers, setOpenForDrivers] = useState(job.openForDrivers);

  const rateLabel = quantityType === 'TONS' ? 'Rate Per Ton' : quantityType === 'YARDS' ? 'Rate Per Yard' : 'Rate Per Load';

  const filteredDrivers = (requiredTruckType
    ? drivers.filter((d) => d.truckType === requiredTruckType)
    : drivers
  ).filter((d) => !selectedDriverIds.includes(d.id));

  const slotsRemaining = requiredTruckCount - selectedDriverIds.length;

  function addDriver(driverId: string) {
    if (!driverId || selectedDriverIds.includes(driverId)) return;
    if (selectedDriverIds.length >= requiredTruckCount) return;
    setSelectedDriverIds((prev) => [...prev, driverId]);
  }

  function removeDriver(driverId: string) {
    setSelectedDriverIds((prev) => prev.filter((id) => id !== driverId));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData(e.currentTarget);
      fd.set('driverIds', JSON.stringify(selectedDriverIds));
      fd.set('requiredTruckCount', String(requiredTruckCount));
      const result = await updateJobAction(job.id, fd);
      if (result?.ok) {
        router.push(`/jobs/${job.id}`);
      } else if (result?.error) {
        setError(result.error);
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update job');
      setSubmitting(false);
    }
  }

  const dateVal = job.date ? new Date(job.date).toISOString().split('T')[0] : '';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="label">Job Name *</label>
          <input name="name" required className="input" defaultValue={job.name} />
          <p className="text-xs text-steel-400 mt-1">
            {brokerId ? 'Will auto-match to a customer with this name' : 'Short description of the job'}
          </p>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={job.status} className="input">
            <option value="CREATED">Created</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="PARTIALLY_COMPLETED">Partially Completed</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Hauled From *</label>
          <input name="hauledFrom" required className="input" defaultValue={job.hauledFrom} />
          <input name="hauledFromAddress" className="input mt-1.5" placeholder="Address, coordinates, or Maps link" defaultValue={job.hauledFromAddress || ''} />
        </div>
        <div>
          <label className="label">Hauled To *</label>
          <input name="hauledTo" required className="input" defaultValue={job.hauledTo} />
          <input name="hauledToAddress" className="input mt-1.5" placeholder="Address, coordinates, or Maps link" defaultValue={job.hauledToAddress || ''} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {brokers.length > 0 && (
          <div>
            <label className="label">Broker</label>
            <select name="brokerId" className="input" value={brokerId} onChange={(e) => setBrokerId(e.target.value)}>
              <option value="">— No Broker —</option>
              {brokers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="label">Customer {!brokerId ? '*' : ''}</label>
          <select name="customerId" className="input" defaultValue={job.customerId || ''} required={!brokerId}>
            <option value="">— Select Customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Trucks Required */}
      <div className="panel p-4 bg-steel-50 space-y-4">
        <h3 className="font-semibold text-sm text-steel-800">Trucks Required</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">How many trucks are needed? *</label>
            <input
              name="requiredTruckCount"
              type="number"
              min="1"
              max="50"
              className="input"
              value={requiredTruckCount}
              onChange={(e) => {
                const val = Math.max(1, parseInt(e.target.value) || 1);
                setRequiredTruckCount(val);
                if (selectedDriverIds.length > val) {
                  setSelectedDriverIds((prev) => prev.slice(0, val));
                }
              }}
            />
          </div>
          <div>
            <label className="label">Truck Type</label>
            <select
              name="requiredTruckType"
              className="input"
              value={requiredTruckType}
              onChange={(e) => {
                setRequiredTruckType(e.target.value);
                setSelectedDriverIds([]);
              }}
            >
              <option value="">— Any Truck —</option>
              {Object.entries(TRUCK_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-steel-500">
          {requiredTruckType
            ? `Need ${requiredTruckCount} ${TRUCK_TYPE_LABELS[requiredTruckType] || requiredTruckType} truck${requiredTruckCount !== 1 ? 's' : ''} for this job`
            : `Need ${requiredTruckCount} truck${requiredTruckCount !== 1 ? 's' : ''} (any type) for this job`}
        </p>
      </div>

      {/* Driver Assignment */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="label">Assign Drivers</label>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            slotsRemaining === 0
              ? 'bg-green-100 text-green-700'
              : 'bg-steel-100 text-steel-600'
          }`}>
            {selectedDriverIds.length}/{requiredTruckCount} assigned
          </span>
        </div>

        {/* Currently assigned drivers */}
        {selectedDriverIds.length > 0 && (
          <div className="space-y-2">
            {selectedDriverIds.map((did) => {
              const driver = drivers.find((d) => d.id === did);
              if (!driver) return null;
              return (
                <div key={did} className="flex items-center gap-3 bg-white border border-steel-200 rounded-lg px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-safety/20 text-diesel flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {driver.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-steel-900 truncate">{driver.name}</div>
                    {driver.truckType && (
                      <div className="text-xs text-steel-500">{TRUCK_TYPE_LABELS[driver.truckType] || driver.truckType}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDriver(did)}
                    className="text-red-400 hover:text-red-600 text-sm px-2 py-1"
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add driver dropdown */}
        {slotsRemaining > 0 && (
          <div>
            <select
              className="input"
              value=""
              onChange={(e) => { addDriver(e.target.value); }}
            >
              <option value="">
                {filteredDrivers.length > 0
                  ? `— Add a driver (${slotsRemaining} slot${slotsRemaining !== 1 ? 's' : ''} remaining) —`
                  : '— No matching drivers available —'}
              </option>
              {filteredDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}{d.truckType ? ` (${TRUCK_TYPE_LABELS[d.truckType] || d.truckType})` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Self-assign toggle */}
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            name="openForDrivers"
            value="true"
            checked={openForDrivers}
            onChange={(e) => setOpenForDrivers(e.target.checked)}
            className="rounded border-steel-300"
          />
          <span className="text-sm text-steel-700">
            Allow drivers to self-assign
            {openForDrivers && slotsRemaining > 0 && (
              <span className="text-steel-500"> — {slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} open for claiming</span>
            )}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Material</label>
          <input name="material" className="input" list="job-materials" defaultValue={job.material || ''} />
          <datalist id="job-materials">{materials.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div>
          <label className="label">Total Loads</label>
          <input name="totalLoads" type="number" min="0" defaultValue={job.totalLoads || ''} className="input" placeholder="Leave blank for unlimited" />
          <p className="text-xs text-steel-400 mt-1">0 or blank = unlimited</p>
        </div>
        <div>
          <label className="label">Quantity Type</label>
          <select name="quantityType" className="input" value={quantityType} onChange={(e) => setQuantityType(e.target.value)}>
            <option value="LOADS">Loads</option>
            <option value="TONS">Tons</option>
            <option value="YARDS">Yards</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">{rateLabel}</label>
          <input name="ratePerUnit" type="number" min="0" step="0.01" className="input"
            defaultValue={job.ratePerUnit ? parseFloat(job.ratePerUnit) : ''} />
        </div>
        <div>
          <label className="label">Target Date</label>
          <input name="date" type="date" className="input" defaultValue={dateVal} />
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea name="notes" rows={3} className="input" defaultValue={job.notes || ''} />
      </div>

      {/* Hidden field for driver IDs */}
      <input type="hidden" name="driverIds" value={JSON.stringify(selectedDriverIds)} />

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={submitting} className="btn-accent">
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
        <a href={`/jobs/${job.id}`} className="btn-ghost">Cancel</a>
      </div>
    </form>
  );
}
