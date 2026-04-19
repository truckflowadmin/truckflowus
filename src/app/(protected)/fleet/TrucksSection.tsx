'use client';

import { useState, Fragment } from 'react';
import RotatableImage from '@/components/RotatableImage';

interface TruckPhoto {
  id: string;
  docType: string;
  label: string | null;
  fileUrl: string;
}

interface TruckData {
  id: string;
  truckNumber: string;
  vin: string | null;
  year: number | null;
  make: string | null;
  model: string | null;
  licensePlate: string | null;
  registrationExpiry: string | null;
  insuranceExpiry: string | null;
  inspectionExpiry: string | null;
  status: string;
  truckType: string | null;
  notes: string | null;
  photos: TruckPhoto[];
  expenseCount: number;
  createdAt: string;
}

const TRUCK_TYPE_LABELS: Record<string, string> = {
  SINGLE_AXLE: 'Single Axle',
  TANDEM: 'Tandem',
  TRI_AXLE: 'Tri-Axle',
  QUAD: 'Quad',
  SUPER_DUMP: 'Super Dump',
  OTHER: 'Other',
};

interface Props {
  initialTrucks: TruckData[];
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  OUT_OF_SERVICE: 'bg-red-100 text-red-800',
  SOLD: 'bg-steel-200 text-steel-600',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  OUT_OF_SERVICE: 'Out of Service',
  SOLD: 'Sold',
};

// Required truck documents — mirrors the driver document pattern
const REQUIRED_TRUCK_DOCS = [
  { docType: 'REGISTRATION', label: 'Truck Registration', icon: '📋' },
  { docType: 'INSURANCE', label: 'Insurance', icon: '🛡' },
  { docType: 'INSPECTION', label: 'Truck Inspection', icon: '🔍' },
] as const;

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  return d >= now && d <= thirtyDays;
}

function isExpired(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function TrucksSection({ initialTrucks }: Props) {
  const [trucks, setTrucks] = useState<TruckData[]>(initialTrucks);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null); // "truckId-docType"
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [otherLabel, setOtherLabel] = useState('');

  // Form fields
  const [form, setForm] = useState({
    truckNumber: '', vin: '', year: '', make: '', model: '',
    licensePlate: '', registrationExpiry: '', insuranceExpiry: '', inspectionExpiry: '', status: 'ACTIVE', truckType: '', notes: '',
    payToName: '', dispatcherName: '',
  });

  function resetForm() {
    setForm({ truckNumber: '', vin: '', year: '', make: '', model: '', licensePlate: '', registrationExpiry: '', insuranceExpiry: '', inspectionExpiry: '', status: 'ACTIVE', truckType: '', notes: '', payToName: '', dispatcherName: '' });
  }

  function openEdit(t: TruckData) {
    setForm({
      truckNumber: t.truckNumber,
      vin: t.vin || '',
      year: t.year?.toString() || '',
      make: t.make || '',
      model: t.model || '',
      licensePlate: t.licensePlate || '',
      registrationExpiry: t.registrationExpiry ? t.registrationExpiry.slice(0, 10) : '',
      insuranceExpiry: t.insuranceExpiry ? t.insuranceExpiry.slice(0, 10) : '',
      inspectionExpiry: t.inspectionExpiry ? t.inspectionExpiry.slice(0, 10) : '',
      status: t.status,
      truckType: t.truckType || '',
      notes: t.notes || '',
      payToName: (t as any).payToName || '',
      dispatcherName: (t as any).dispatcherName || '',
    });
    setEditingId(t.id);
    setShowForm(true);
  }

  function getDoc(truck: TruckData, docType: string): TruckPhoto | undefined {
    return truck.photos.find((p) => p.docType === docType);
  }

  function getOtherDocs(truck: TruckData): TruckPhoto[] {
    return truck.photos.filter((p) => p.docType === 'OTHER' || p.docType === 'TRUCK_PHOTO');
  }

  async function handleSave() {
    setError(null);
    if (!form.truckNumber.trim()) { setError('Truck number is required'); return; }
    setLoading(true);
    try {
      if (editingId) {
        const res = await fetch('/api/fleet/trucks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...form }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const res = await fetch('/api/fleet/trucks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }
      await refreshTrucks();
      setShowForm(false);
      setEditingId(null);
      resetForm();
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this truck? This will also remove all its documents and photos.')) return;
    try {
      const res = await fetch(`/api/fleet/trucks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      setTrucks((prev) => prev.filter((t) => t.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function refreshTrucks() {
    const res = await fetch('/api/fleet/trucks');
    const data = await res.json();
    if (res.ok) setTrucks(data.trucks);
  }

  async function handleDocUpload(truckId: string, docType: string, label?: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const key = `${truckId}-${docType}`;
      setUploadingDoc(key);
      try {
        const fd = new FormData();
        fd.append('truckId', truckId);
        fd.append('file', file);
        fd.append('docType', docType);
        if (label) fd.append('label', label);
        const res = await fetch('/api/fleet/trucks/photos', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await refreshTrucks();
      } catch (err: any) {
        setError(err.message);
      } finally {
        setUploadingDoc(null);
      }
    };
    input.click();
  }

  async function handleDocDelete(photoId: string) {
    try {
      const res = await fetch(`/api/fleet/trucks/photos?id=${photoId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await refreshTrucks();
    } catch (err: any) {
      setError(err.message);
    }
  }

  const filtered = filterStatus ? trucks.filter((t) => t.status === filterStatus) : trucks;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-steel-900">Trucks</h2>
          <span className="text-sm text-steel-500">({filtered.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input text-sm py-1.5">
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="OUT_OF_SERVICE">Out of Service</option>
            <option value="SOLD">Sold</option>
          </select>
          <button onClick={() => { resetForm(); setEditingId(null); setShowForm(true); }} className="btn-accent text-sm">
            + Add Truck
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Add / Edit Form */}
      {showForm && (
        <div className="panel p-5 space-y-4 border-2 border-safety">
          <h3 className="font-semibold text-steel-800">{editingId ? 'Edit Truck' : 'New Truck'}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><label className="label">Truck # *</label><input value={form.truckNumber} onChange={(e) => setForm({ ...form, truckNumber: e.target.value })} className="input" placeholder="T-101" /></div>
            <div><label className="label">VIN</label><input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value })} className="input" placeholder="1XKWDB0X..." /></div>
            <div><label className="label">Year</label><input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className="input" placeholder="2024" /></div>
            <div><label className="label">Make</label><input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} className="input" placeholder="Kenworth" /></div>
            <div><label className="label">Model</label><input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} className="input" placeholder="T680" /></div>
            <div><label className="label">License Plate</label><input value={form.licensePlate} onChange={(e) => setForm({ ...form, licensePlate: e.target.value })} className="input" /></div>
            <div><label className="label">Registration Expiry</label><input type="date" value={form.registrationExpiry} onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })} className="input" /></div>
            <div><label className="label">Insurance Expiry</label><input type="date" value={form.insuranceExpiry} onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })} className="input" /></div>
            <div><label className="label">Inspection Expiry</label><input type="date" value={form.inspectionExpiry} onChange={(e) => setForm({ ...form, inspectionExpiry: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className="label">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
                <option value="ACTIVE">Active</option><option value="OUT_OF_SERVICE">Out of Service</option><option value="SOLD">Sold</option>
              </select>
            </div>
            <div><label className="label">Truck Type</label>
              <select value={form.truckType} onChange={(e) => setForm({ ...form, truckType: e.target.value })} className="input">
                <option value="">— Not Set —</option>
                {Object.entries(TRUCK_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input" placeholder="Optional notes..." /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Pay To Name (Trip Sheet)</label><input value={form.payToName} onChange={(e) => setForm({ ...form, payToName: e.target.value })} className="input" placeholder="Leave blank to use company name" /></div>
            <div><label className="label">Dispatcher Name (Trip Sheet)</label><input value={form.dispatcherName} onChange={(e) => setForm({ ...form, dispatcherName: e.target.value })} className="input" placeholder="Leave blank to use broker dispatcher" /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={loading} className="btn-accent">{loading ? 'Saving...' : editingId ? 'Update' : 'Add Truck'}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); resetForm(); setError(null); }} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {/* Truck List */}
      {filtered.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          {trucks.length === 0 ? 'No trucks yet. Add your first truck above.' : 'No trucks match the current filter.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const isExpanded = expandedId === t.id;
            const requiredUploaded = REQUIRED_TRUCK_DOCS.filter((r) => getDoc(t, r.docType)).length;
            const requiredTotal = REQUIRED_TRUCK_DOCS.length;
            const otherDocs = getOtherDocs(t);

            return (
              <Fragment key={t.id}>
                <div className="panel overflow-hidden">
                  {/* Summary row */}
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-steel-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <div className="w-14 h-14 rounded-lg bg-steel-100 flex items-center justify-center text-2xl flex-shrink-0 overflow-hidden">
                      {t.photos.find((p) => p.docType === 'TRUCK_PHOTO') ? (
                        <img src={t.photos.find((p) => p.docType === 'TRUCK_PHOTO')!.fileUrl} alt="" className="w-full h-full object-cover" />
                      ) : t.photos.length > 0 ? (
                        <img src={t.photos[0].fileUrl} alt="" className="w-full h-full object-cover" />
                      ) : '🚛'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-steel-900">{t.truckNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || ''}`}>
                          {STATUS_LABELS[t.status] || t.status}
                        </span>
                      </div>
                      <div className="text-sm text-steel-500 truncate">
                        {[t.year, t.make, t.model].filter(Boolean).join(' ') || 'No details'}
                        {t.truckType ? ` · ${TRUCK_TYPE_LABELS[t.truckType] || t.truckType}` : ''}
                        {t.licensePlate ? ` · ${t.licensePlate}` : ''}
                      </div>
                    </div>

                    {/* Expiry + doc warnings */}
                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      {isExpired(t.registrationExpiry) && <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">Reg Expired</span>}
                      {isExpiringSoon(t.registrationExpiry) && !isExpired(t.registrationExpiry) && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">Reg Expiring</span>}
                      {isExpired(t.insuranceExpiry) && <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">Ins Expired</span>}
                      {isExpiringSoon(t.insuranceExpiry) && !isExpired(t.insuranceExpiry) && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">Ins Expiring</span>}
                      {isExpired(t.inspectionExpiry) && <span className="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">Insp Expired</span>}
                      {isExpiringSoon(t.inspectionExpiry) && !isExpired(t.inspectionExpiry) && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">Insp Expiring</span>}
                      {requiredUploaded < requiredTotal && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">{requiredUploaded}/{requiredTotal} docs</span>
                      )}
                    </div>

                    <div className="text-steel-400 text-sm">{isExpanded ? '▼' : '▶'}</div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-steel-200 bg-steel-50">
                      {/* Truck Info */}
                      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div><span className="text-steel-400 text-xs uppercase">VIN</span><div className="font-medium text-steel-800">{t.vin || '—'}</div></div>
                        <div><span className="text-steel-400 text-xs uppercase">License Plate</span><div className="font-medium text-steel-800">{t.licensePlate || '—'}</div></div>
                        <div>
                          <span className="text-steel-400 text-xs uppercase">Reg Expiry</span>
                          <div className={`font-medium ${isExpired(t.registrationExpiry) ? 'text-red-600' : isExpiringSoon(t.registrationExpiry) ? 'text-amber-600' : 'text-steel-800'}`}>
                            {t.registrationExpiry ? new Date(t.registrationExpiry).toLocaleDateString() : '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-steel-400 text-xs uppercase">Insurance Expiry</span>
                          <div className={`font-medium ${isExpired(t.insuranceExpiry) ? 'text-red-600' : isExpiringSoon(t.insuranceExpiry) ? 'text-amber-600' : 'text-steel-800'}`}>
                            {t.insuranceExpiry ? new Date(t.insuranceExpiry).toLocaleDateString() : '—'}
                          </div>
                        </div>
                        <div>
                          <span className="text-steel-400 text-xs uppercase">Inspection Expiry</span>
                          <div className={`font-medium ${isExpired(t.inspectionExpiry) ? 'text-red-600' : isExpiringSoon(t.inspectionExpiry) ? 'text-amber-600' : 'text-steel-800'}`}>
                            {t.inspectionExpiry ? new Date(t.inspectionExpiry).toLocaleDateString() : '—'}
                          </div>
                        </div>
                      </div>

                      {t.notes && (
                        <div className="px-4 pb-3 text-sm text-steel-600 bg-white mx-4 rounded-lg p-3 border border-steel-200 mb-3">
                          {t.notes}
                        </div>
                      )}

                      {/* Required Documents — mirrors driver document pattern */}
                      <div className="px-4 pb-4">
                        <h4 className="text-xs font-bold text-steel-700 uppercase tracking-wider mb-3">Required Documents</h4>
                        <div className="space-y-2">
                          {REQUIRED_TRUCK_DOCS.map((req) => {
                            const doc = getDoc(t, req.docType);
                            const isUploading = uploadingDoc === `${t.id}-${req.docType}`;
                            return (
                              <div key={req.docType} className="bg-white rounded-lg border border-steel-200 overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3">
                                  <span className="text-xl">{req.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-steel-900">{req.label}</div>
                                    {doc ? (
                                      <div className="text-xs text-green-600 mt-0.5">✓ Uploaded</div>
                                    ) : (
                                      <div className="text-xs text-amber-600 mt-0.5">⚠ Not uploaded</div>
                                    )}
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDocUpload(t.id, req.docType); }}
                                    disabled={isUploading}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                      doc ? 'bg-steel-100 text-steel-700 hover:bg-steel-200' : 'bg-safety text-diesel hover:bg-safety-dark'
                                    }`}
                                  >
                                    {isUploading ? 'Uploading…' : doc ? 'Update' : 'Upload'}
                                  </button>
                                </div>
                                {doc && (
                                  <div className="border-t border-steel-100 p-2 bg-steel-50">
                                    {doc.fileUrl.endsWith('.pdf') ? (
                                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 px-2">📄 View PDF</a>
                                    ) : (
                                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <img src={doc.fileUrl} alt={req.label} className="w-full max-h-40 object-contain rounded bg-white" />
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Upload checklist */}
                        <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                          requiredUploaded === requiredTotal
                            ? 'bg-green-50 text-green-800 border border-green-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {requiredUploaded === requiredTotal
                            ? '✅ All required documents uploaded!'
                            : `📋 ${requiredUploaded} of ${requiredTotal} required documents uploaded`}
                        </div>

                        {/* Other Documents / Truck Photos */}
                        <h4 className="text-xs font-bold text-steel-700 uppercase tracking-wider mt-4 mb-2">Other Documents & Photos</h4>

                        {otherDocs.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {otherDocs.map((doc) => (
                              <div key={doc.id} className="bg-white rounded-lg border border-steel-200 overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3">
                                  <span className="text-xl">{doc.docType === 'TRUCK_PHOTO' ? '📷' : '📎'}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-steel-900">{doc.label || (doc.docType === 'TRUCK_PHOTO' ? 'Truck Photo' : 'Other Document')}</div>
                                  </div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDocDelete(doc.id); }}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                  >
                                    Remove
                                  </button>
                                </div>
                                <div className="border-t border-steel-100 p-2 bg-steel-50">
                                  {doc.fileUrl.endsWith('.pdf') ? (
                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 px-2">📄 View PDF</a>
                                  ) : (
                                    <RotatableImage
                                      src={doc.fileUrl}
                                      alt={doc.label || 'Photo'}
                                      className="w-full max-h-40 object-contain rounded bg-white"
                                      linkToFullSize
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Other Document */}
                        <div className="bg-white rounded-lg border border-steel-200 p-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={otherLabel}
                              onChange={(e) => setOtherLabel(e.target.value)}
                              placeholder="Document name (e.g. DOT Permit)"
                              className="flex-1 rounded-lg border border-steel-300 px-3 py-2 text-sm focus:ring-2 focus:ring-safety focus:border-safety outline-none"
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!otherLabel.trim()) { setError('Enter a name for the document'); return; }
                                handleDocUpload(t.id, 'OTHER', otherLabel.trim());
                                setOtherLabel('');
                              }}
                              disabled={uploadingDoc === `${t.id}-OTHER`}
                              className="px-4 py-2 rounded-lg bg-safety text-diesel text-sm font-semibold hover:bg-safety-dark transition-colors whitespace-nowrap"
                            >
                              {uploadingDoc === `${t.id}-OTHER` ? 'Uploading…' : '+ Add'}
                            </button>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDocUpload(t.id, 'TRUCK_PHOTO'); }}
                              disabled={uploadingDoc === `${t.id}-TRUCK_PHOTO`}
                              className="text-xs px-3 py-1.5 bg-steel-100 text-steel-700 rounded-lg hover:bg-steel-200 transition-colors"
                            >
                              {uploadingDoc === `${t.id}-TRUCK_PHOTO` ? 'Uploading…' : '📷 Add Truck Photo'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 px-4 pb-4 border-t border-steel-200 pt-3">
                        <button onClick={() => openEdit(t)} className="text-sm px-3 py-1.5 bg-white border border-steel-300 rounded-lg hover:bg-steel-50 transition-colors">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(t.id)} className="text-sm px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
