'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createJobAction } from '../actions';
import ScanPreviewModal, { type ScanPreviewData } from './ScanPreviewModal';

const TRUCK_TYPE_LABELS: Record<string, string> = {
  SINGLE_AXLE: 'Single Axle',
  TANDEM: 'Tandem',
  TRI_AXLE: 'Tri-Axle',
  QUAD: 'Quad',
  SUPER_DUMP: 'Super Dump',
  OTHER: 'Other',
};

interface Props {
  customers: { id: string; name: string }[];
  drivers: { id: string; name: string; truckType: string | null; truckNumber: string | null }[];
  materials: string[];
  brokers: { id: string; name: string }[];
}

export default function NewJobForm({ customers, drivers, materials, brokers }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [openForDrivers, setOpenForDrivers] = useState(false);

  // Controlled form fields (so scan can prefill them)
  const [name, setName] = useState('');
  const [hauledFrom, setHauledFrom] = useState('');
  const [hauledFromAddress, setHauledFromAddress] = useState('');
  const [hauledTo, setHauledTo] = useState('');
  const [hauledToAddress, setHauledToAddress] = useState('');
  const [brokerId, setBrokerId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [requiredTruckType, setRequiredTruckType] = useState('');
  const [requiredTruckCount, setRequiredTruckCount] = useState(1);
  const [selectedDriverIds, setSelectedDriverIds] = useState<string[]>([]);
  const [material, setMaterial] = useState('');
  const [totalLoads, setTotalLoads] = useState('');
  const [quantityType, setQuantityType] = useState('LOADS');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  // Scan state
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'warning'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Scan preview modal state
  const [scanPreview, setScanPreview] = useState<{
    imageUrl: string;
    data: ScanPreviewData;
    hasError: boolean;
    errorMessage?: string;
  } | null>(null);

  const rateLabel = quantityType === 'TONS' ? 'Rate Per Ton' : quantityType === 'YARDS' ? 'Rate Per Yard' : 'Rate Per Load';

  // Filter drivers by required truck type (and exclude already selected)
  const filteredDrivers = (requiredTruckType
    ? drivers.filter((d) => d.truckType === requiredTruckType)
    : drivers
  ).filter((d) => !selectedDriverIds.includes(d.id));

  const slotsRemaining = requiredTruckCount - selectedDriverIds.length;

  useEffect(() => {
    const saved = localStorage.getItem('tf_openForDrivers');
    if (saved === 'true') setOpenForDrivers(true);
  }, []);

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
      // Inject multi-driver selection as JSON
      fd.set('driverIds', JSON.stringify(selectedDriverIds));
      fd.set('requiredTruckCount', String(requiredTruckCount));
      const result = await createJobAction(fd);
      if (result?.ok) {
        router.push(`/jobs/${result.jobId}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
      setSubmitting(false);
    }
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setError('');
    setScanMessage(null);

    try {
      // Create a local preview URL for the image
      const imageUrl = URL.createObjectURL(file);

      const fd = new FormData();
      fd.append('image', file);

      const res = await fetch('/api/jobs/scan', { method: 'POST', body: fd });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Scan failed');
      }

      // Build truck number string from all scanned numbers
      let truckNumberStr = '';
      if (data.truckNumbers && Array.isArray(data.truckNumbers)) {
        truckNumberStr = data.truckNumbers.join(', ');
      } else if (data.truckNumber) {
        truckNumberStr = data.truckNumber;
      }

      // Open preview modal with editable fields
      setScanPreview({
        imageUrl,
        data: {
          customerName: data.customerName ?? '',
          hauledFromName: data.hauledFromName ?? '',
          hauledFromAddress: data.hauledFromAddress ?? '',
          hauledToName: data.hauledToName ?? '',
          hauledToAddress: data.hauledToAddress ?? '',
          material: data.material ?? '',
          quantity: data.quantity != null ? String(data.quantity) : '',
          quantityType: data.quantityType ?? '',
          ratePerUnit: data.ratePerUnit != null ? String(data.ratePerUnit) : '',
          date: data.date ?? '',
          notes: data.notes ?? '',
          brokerName: data.brokerName ?? '',
          truckNumber: truckNumberStr,
          driverName: data.driverName ?? '',
          rawText: data.rawText ?? '',
        },
        hasError: !!data._error,
        errorMessage: data._error,
      });
    } catch (err: any) {
      setError(err.message || 'Scan failed');
    } finally {
      setScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  /** Called when user confirms fields in the preview modal */
  function applyScanData(data: ScanPreviewData) {
    let filled = 0;

    if (data.customerName) {
      setName(data.customerName);
      const match = customers.find(
        (c) => c.name.toLowerCase() === data.customerName.toLowerCase()
      );
      if (match) setCustomerId(match.id);
      filled++;
    }
    if (data.hauledFromName) { setHauledFrom(data.hauledFromName); filled++; }
    if (data.hauledFromAddress) { setHauledFromAddress(data.hauledFromAddress); filled++; }
    if (data.hauledToName) { setHauledTo(data.hauledToName); filled++; }
    if (data.hauledToAddress) { setHauledToAddress(data.hauledToAddress); filled++; }
    if (data.material) { setMaterial(data.material); filled++; }
    if (data.quantity) { setTotalLoads(data.quantity); filled++; }
    if (data.quantityType) { setQuantityType(data.quantityType); filled++; }
    if (data.ratePerUnit) { setRatePerUnit(data.ratePerUnit); filled++; }
    if (data.date) { setDate(data.date); filled++; }
    if (data.notes) { setNotes(data.notes); filled++; }

    // Try to match broker
    if (data.brokerName) {
      const match = brokers.find(
        (b) => b.name.toLowerCase() === data.brokerName.toLowerCase()
      );
      if (match) { setBrokerId(match.id); filled++; }
    }

    // Try to match truck numbers to drivers and preselect them
    const scannedTruckNums: string[] = [];
    if (data.truckNumber) {
      scannedTruckNums.push(...data.truckNumber.split(/[,;]\s*/).map((s: string) => s.trim()).filter(Boolean));
    }

    if (scannedTruckNums.length > 0) {
      const matchedDriverIds: string[] = [];
      for (const tn of scannedTruckNums) {
        const normalized = tn.toLowerCase().replace(/[\s\-#]/g, '');
        const match = drivers.find((d) => {
          if (!d.truckNumber) return false;
          const driverTn = d.truckNumber.toLowerCase().replace(/[\s\-#]/g, '');
          return driverTn === normalized || driverTn.includes(normalized) || normalized.includes(driverTn);
        });
        if (match && !matchedDriverIds.includes(match.id)) {
          matchedDriverIds.push(match.id);
        }
      }
      if (matchedDriverIds.length > 0) {
        setSelectedDriverIds(matchedDriverIds);
        setRequiredTruckCount((prev) => Math.max(prev, matchedDriverIds.length));
        filled += matchedDriverIds.length;
      }
    }

    // Try to match driver by name (if no truck number matches)
    if (data.driverName && scannedTruckNums.length === 0) {
      const match = drivers.find(
        (d) => d.name.toLowerCase() === data.driverName.toLowerCase()
      );
      if (match) {
        setSelectedDriverIds((prev) => prev.includes(match.id) ? prev : [...prev, match.id]);
        filled++;
      }
    }

    // Clean up preview
    if (scanPreview?.imageUrl) {
      URL.revokeObjectURL(scanPreview.imageUrl);
    }
    setScanPreview(null);

    if (filled > 0) {
      setScanMessage({ type: 'success', text: `Applied ${filled} field${filled !== 1 ? 's' : ''} from scan. Review and adjust before creating.` });
    } else {
      setScanMessage({ type: 'warning', text: "No fields were applied. Try a clearer photo or enter details manually." });
    }
  }

  function cancelScanPreview() {
    if (scanPreview?.imageUrl) {
      URL.revokeObjectURL(scanPreview.imageUrl);
    }
    setScanPreview(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {scanMessage && (
        <div className={`rounded-lg px-4 py-3 text-sm ${
          scanMessage.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-amber-50 border border-amber-200 text-amber-700'
        }`}>
          {scanMessage.text}
          <button type="button" onClick={() => setScanMessage(null)} className="ml-2 opacity-60 hover:opacity-100">{'\u2715'}</button>
        </div>
      )}

      {/* Scan button */}
      <div className="panel p-4 bg-steel-50 border-dashed border-2 border-steel-300">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Scan a Document</h3>
            <p className="text-xs text-steel-500 mt-0.5">
              Take a photo or upload a work order, dispatch sheet, or broker request to auto-fill the form
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleScan}
            className="hidden"
            id="job-scan-input"
          />
          <label
            htmlFor="job-scan-input"
            className={`btn-accent cursor-pointer inline-flex items-center gap-2 ${scanning ? 'opacity-60 pointer-events-none' : ''}`}
          >
            {scanning ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Scanning...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                Scan
              </>
            )}
          </label>
        </div>
      </div>

      {/* Job name */}
      <div>
        <label className="label">Job Name *</label>
        <input
          name="name"
          required
          className="input"
          placeholder="e.g. Deliver fill dirt to Main St site"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="text-xs text-steel-400 mt-1">
          {brokerId ? 'Will auto-match to a customer with this name' : 'Short description of the job'}
        </p>
      </div>

      {/* Route */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">Hauled From *</label>
          <input name="hauledFrom" required className="input" placeholder="Pickup location name" value={hauledFrom} onChange={(e) => setHauledFrom(e.target.value)} />
          <input name="hauledFromAddress" className="input mt-1.5" placeholder="Address, coordinates, or Maps link" value={hauledFromAddress} onChange={(e) => setHauledFromAddress(e.target.value)} />
        </div>
        <div>
          <label className="label">Hauled To *</label>
          <input name="hauledTo" required className="input" placeholder="Delivery location name" value={hauledTo} onChange={(e) => setHauledTo(e.target.value)} />
          <input name="hauledToAddress" className="input mt-1.5" placeholder="Address, coordinates, or Maps link" value={hauledToAddress} onChange={(e) => setHauledToAddress(e.target.value)} />
        </div>
      </div>

      {/* Broker / Customer */}
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
          <select name="customerId" className="input" required={!brokerId} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">— Select Customer —</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!brokerId && <p className="text-xs text-steel-400 mt-1">Required when no broker is selected</p>}
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
                // Trim selected drivers if count reduced
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

        {/* Add driver dropdown — only show if slots remain */}
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
            {requiredTruckType && filteredDrivers.length === 0 && selectedDriverIds.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No drivers have a {TRUCK_TYPE_LABELS[requiredTruckType]} truck assigned</p>
            )}
            <p className="text-xs text-steel-400 mt-1">Leave empty to let drivers self-assign</p>
          </div>
        )}

        {/* Self-assign toggle */}
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            name="openForDrivers"
            value="true"
            checked={openForDrivers}
            onChange={(e) => {
              setOpenForDrivers(e.target.checked);
              localStorage.setItem('tf_openForDrivers', String(e.target.checked));
            }}
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

      {/* Material & loads */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="label">Material</label>
          <input name="material" className="input" list="job-materials" placeholder="e.g. Fill dirt" value={material} onChange={(e) => setMaterial(e.target.value)} />
          <datalist id="job-materials">{materials.map((m) => <option key={m} value={m} />)}</datalist>
        </div>
        <div>
          <label className="label">Total Loads</label>
          <input name="totalLoads" type="number" min="0" className="input" placeholder="Leave blank for unlimited" value={totalLoads} onChange={(e) => setTotalLoads(e.target.value)} />
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

      {/* Rate & date */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="label">{rateLabel}</label>
          <input name="ratePerUnit" type="number" min="0" step="0.01" className="input" placeholder="e.g. 12.50" value={ratePerUnit} onChange={(e) => setRatePerUnit(e.target.value)} />
        </div>
        <div>
          <label className="label">Target Date</label>
          <input name="date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="label">Notes</label>
        <textarea name="notes" rows={3} className="input" placeholder="Special instructions, site access info, etc." value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {/* Hidden field for driver IDs — serialized as JSON */}
      <input type="hidden" name="driverIds" value={JSON.stringify(selectedDriverIds)} />

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={submitting} className="btn-accent">
          {submitting ? 'Creating...' : 'Create Job'}
        </button>
        <a href="/jobs" className="btn-ghost">Cancel</a>
      </div>

      {/* Scan preview modal */}
      {scanPreview && (
        <ScanPreviewModal
          imageUrl={scanPreview.imageUrl}
          data={scanPreview.data}
          hasError={scanPreview.hasError}
          errorMessage={scanPreview.errorMessage}
          onConfirm={applyScanData}
          onCancel={cancelScanPreview}
        />
      )}
    </form>
  );
}
