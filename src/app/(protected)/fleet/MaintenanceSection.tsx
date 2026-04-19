'use client';

import { useState, Fragment } from 'react';

interface FilterData {
  id: string;
  filterType: string;
  partNumber: string | null;
  lastReplacedAt: string | null;
  nextDueAt: string | null;
  mileage: number | null;
  nextDueMileage: number | null;
  notes: string | null;
}

interface TruckMaintData {
  id: string;
  truckNumber: string;
  year: number | null;
  make: string | null;
  model: string | null;
  status: string;
  engineMake: string | null;
  engineModel: string | null;
  engineSerial: string | null;
  transmissionMake: string | null;
  transmissionModel: string | null;
  transmissionSerial: string | null;
  rearEndMake: string | null;
  rearEndModel: string | null;
  rearEndRatio: string | null;
  rearEndSerial: string | null;
  oilType: string | null;
  oilBrand: string | null;
  filters: FilterData[];
}

interface Props {
  initialTrucks: TruckMaintData[];
}

const FILTER_TYPES = [
  { key: 'DIESEL', label: 'Diesel Filter', icon: '⛽' },
  { key: 'OIL', label: 'Oil Filter', icon: '🛢️' },
  { key: 'AIR_CABIN', label: 'Cabin Air Filter', icon: '🌬️' },
  { key: 'AIR_ENGINE', label: 'Engine Air Filter', icon: '💨' },
  { key: 'TIRES', label: 'Tires', icon: '🛞' },
  { key: 'BRAKES', label: 'Brakes', icon: '🛑' },
] as const;

// Types that benefit from mileage tracking
const MILEAGE_TYPES = new Set(['OIL', 'TIRES', 'BRAKES']);

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  OUT_OF_SERVICE: 'bg-red-100 text-red-800',
  SOLD: 'bg-steel-200 text-steel-600',
};

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  return d >= now && d <= thirtyDays;
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function fmtMileage(n: number | null): string {
  if (n == null) return '';
  return n.toLocaleString() + ' mi';
}

export default function MaintenanceSection({ initialTrucks }: Props) {
  const [trucks, setTrucks] = useState<TruckMaintData[]>(initialTrucks);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDrivetrain, setEditingDrivetrain] = useState<string | null>(null);
  const [editingOil, setEditingOil] = useState<string | null>(null);
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Drivetrain form
  const [dtForm, setDtForm] = useState({
    engineMake: '', engineModel: '', engineSerial: '',
    transmissionMake: '', transmissionModel: '', transmissionSerial: '',
    rearEndMake: '', rearEndModel: '', rearEndRatio: '', rearEndSerial: '',
  });

  // Oil spec form
  const [oilForm, setOilForm] = useState({ oilType: '', oilBrand: '' });

  // Filter form
  const [filterForm, setFilterForm] = useState({
    partNumber: '', lastReplacedAt: '', nextDueAt: '', mileage: '', nextDueMileage: '', notes: '',
  });

  function openDrivetrainEdit(t: TruckMaintData) {
    setDtForm({
      engineMake: t.engineMake || '', engineModel: t.engineModel || '', engineSerial: t.engineSerial || '',
      transmissionMake: t.transmissionMake || '', transmissionModel: t.transmissionModel || '', transmissionSerial: t.transmissionSerial || '',
      rearEndMake: t.rearEndMake || '', rearEndModel: t.rearEndModel || '', rearEndRatio: t.rearEndRatio || '', rearEndSerial: t.rearEndSerial || '',
    });
    setEditingDrivetrain(t.id);
  }

  function openOilEdit(t: TruckMaintData) {
    setOilForm({ oilType: t.oilType || '', oilBrand: t.oilBrand || '' });
    setEditingOil(t.id);
  }

  function openFilterEdit(truckId: string, filterType: string, existing?: FilterData) {
    setFilterForm({
      partNumber: existing?.partNumber || '',
      lastReplacedAt: existing?.lastReplacedAt ? existing.lastReplacedAt.slice(0, 10) : '',
      nextDueAt: existing?.nextDueAt ? existing.nextDueAt.slice(0, 10) : '',
      mileage: existing?.mileage?.toString() || '',
      nextDueMileage: existing?.nextDueMileage?.toString() || '',
      notes: existing?.notes || '',
    });
    setEditingFilter(`${truckId}-${filterType}`);
  }

  async function refreshTrucks() {
    try {
      const res = await fetch('/api/fleet/trucks');
      const data = await res.json();
      if (res.ok) {
        setTrucks(data.trucks.map((t: any) => ({
          id: t.id, truckNumber: t.truckNumber, year: t.year, make: t.make, model: t.model, status: t.status,
          engineMake: t.engineMake, engineModel: t.engineModel, engineSerial: t.engineSerial,
          transmissionMake: t.transmissionMake, transmissionModel: t.transmissionModel, transmissionSerial: t.transmissionSerial,
          rearEndMake: t.rearEndMake, rearEndModel: t.rearEndModel, rearEndRatio: t.rearEndRatio, rearEndSerial: t.rearEndSerial,
          oilType: t.oilType, oilBrand: t.oilBrand,
          filters: t.filters || [],
        })));
      }
    } catch { /* ignore */ }
  }

  async function saveDrivetrain(truckId: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/fleet/trucks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: truckId, ...dtForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshTrucks();
      setEditingDrivetrain(null);
    } catch (err: any) { setError(err.message || 'Failed to save'); } finally { setLoading(false); }
  }

  async function saveOil(truckId: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/fleet/trucks', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: truckId, ...oilForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshTrucks();
      setEditingOil(null);
    } catch (err: any) { setError(err.message || 'Failed to save'); } finally { setLoading(false); }
  }

  async function saveFilter(truckId: string, filterType: string) {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/fleet/trucks/filters', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId, filterType, ...filterForm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await refreshTrucks();
      setEditingFilter(null);
    } catch (err: any) { setError(err.message || 'Failed to save'); } finally { setLoading(false); }
  }

  async function deleteFilter(filterId: string) {
    if (!confirm('Remove this record?')) return;
    try {
      const res = await fetch(`/api/fleet/trucks/filters?id=${filterId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      await refreshTrucks();
    } catch (err: any) { setError(err.message); }
  }

  function alertCount(t: TruckMaintData): number {
    return t.filters.filter((f) => isOverdue(f.nextDueAt) || isDueSoon(f.nextDueAt)).length;
  }

  const activeTrucks = trucks.filter((t) => t.status === 'ACTIVE');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-steel-900">Maintenance</h2>
          <span className="text-sm text-steel-500">({activeTrucks.length} active trucks)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* Replacement alerts */}
      {trucks.some((t) => alertCount(t) > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-2">⚠ Replacement Alerts</h3>
          <div className="space-y-1">
            {trucks.filter((t) => alertCount(t) > 0).map((t) => {
              const overdue = t.filters.filter((f) => isOverdue(f.nextDueAt));
              const dueSoon = t.filters.filter((f) => isDueSoon(f.nextDueAt) && !isOverdue(f.nextDueAt));
              return (
                <div key={t.id} className="text-sm text-amber-700">
                  <span className="font-medium">{t.truckNumber}</span>:{' '}
                  {overdue.length > 0 && (
                    <span className="text-red-600 font-medium">
                      {overdue.map((f) => FILTER_TYPES.find((ft) => ft.key === f.filterType)?.label || f.filterType).join(', ')} (overdue)
                    </span>
                  )}
                  {overdue.length > 0 && dueSoon.length > 0 && ' · '}
                  {dueSoon.length > 0 && (
                    <span>
                      {dueSoon.map((f) => FILTER_TYPES.find((ft) => ft.key === f.filterType)?.label || f.filterType).join(', ')} (due soon)
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trucks.length === 0 ? (
        <div className="panel p-8 text-center text-steel-400">
          No trucks yet. Add trucks in the Trucks tab first.
        </div>
      ) : (
        <div className="space-y-3">
          {trucks.map((t) => {
            const isExpanded = expandedId === t.id;
            const alerts = alertCount(t);
            const hasDrivetrain = t.engineMake || t.transmissionMake || t.rearEndMake;
            const hasOil = t.oilType || t.oilBrand;

            return (
              <Fragment key={t.id}>
                <div className="panel overflow-hidden">
                  {/* Summary row */}
                  <div
                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-steel-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <div className="w-12 h-12 rounded-lg bg-steel-100 flex items-center justify-center text-xl flex-shrink-0">🔧</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-steel-900">{t.truckNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status] || ''}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-sm text-steel-500">
                        {[t.year, t.make, t.model].filter(Boolean).join(' ') || 'No details'}
                        {hasOil && <span className="ml-2 text-steel-400">· Oil: {[t.oilBrand, t.oilType].filter(Boolean).join(' ')}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs flex-shrink-0">
                      {!hasDrivetrain && <span className="px-2 py-1 bg-steel-100 text-steel-500 rounded font-medium">No drivetrain info</span>}
                      {t.filters.length > 0 && (
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded font-medium">{t.filters.length} tracked</span>
                      )}
                      {alerts > 0 && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">⚠ {alerts} alert{alerts !== 1 ? 's' : ''}</span>
                      )}
                    </div>

                    <div className="text-steel-400 text-sm">{isExpanded ? '▼' : '▶'}</div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-steel-200 bg-steel-50">

                      {/* Oil Specification */}
                      <div className="p-4 pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-steel-700 uppercase tracking-wider">Oil Specification</h4>
                          {editingOil !== t.id && (
                            <button onClick={() => openOilEdit(t)} className="text-xs px-3 py-1 bg-white border border-steel-300 rounded-lg hover:bg-steel-50">
                              {hasOil ? 'Edit' : '+ Set Oil'}
                            </button>
                          )}
                        </div>

                        {editingOil === t.id ? (
                          <div className="bg-white rounded-lg border border-safety p-3">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="label text-xs">Oil Brand</label>
                                <input value={oilForm.oilBrand} onChange={(e) => setOilForm({ ...oilForm, oilBrand: e.target.value })} className="input text-sm" placeholder="Shell Rotella, Mobil Delvac..." />
                              </div>
                              <div>
                                <label className="label text-xs">Oil Type</label>
                                <input value={oilForm.oilType} onChange={(e) => setOilForm({ ...oilForm, oilType: e.target.value })} className="input text-sm" placeholder="15W-40, 5W-40..." />
                              </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={() => saveOil(t.id)} disabled={loading} className="btn-accent text-xs">{loading ? 'Saving...' : 'Save'}</button>
                              <button onClick={() => setEditingOil(null)} className="btn-ghost text-xs">Cancel</button>
                            </div>
                          </div>
                        ) : hasOil ? (
                          <div className="bg-white rounded-lg border border-steel-200 px-4 py-3 flex items-center gap-4 text-sm">
                            <span className="text-lg">🛢️</span>
                            <div>
                              {t.oilBrand && <span className="font-medium text-steel-800">{t.oilBrand}</span>}
                              {t.oilType && <span className="text-steel-600 ml-2">{t.oilType}</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg border border-dashed border-steel-300 p-4 text-center text-sm text-steel-400">
                            No oil specification set.
                          </div>
                        )}
                      </div>

                      {/* Drivetrain Section */}
                      <div className="p-4 pb-2">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-xs font-bold text-steel-700 uppercase tracking-wider">Drivetrain Details</h4>
                          {editingDrivetrain !== t.id && (
                            <button onClick={() => openDrivetrainEdit(t)} className="text-xs px-3 py-1 bg-white border border-steel-300 rounded-lg hover:bg-steel-50">
                              {hasDrivetrain ? 'Edit' : '+ Add Details'}
                            </button>
                          )}
                        </div>

                        {editingDrivetrain === t.id ? (
                          <div className="bg-white rounded-lg border border-safety p-4 space-y-3">
                            <div>
                              <div className="text-xs font-semibold text-steel-600 mb-1">Engine</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div><label className="label text-xs">Make</label><input value={dtForm.engineMake} onChange={(e) => setDtForm({ ...dtForm, engineMake: e.target.value })} className="input text-sm" placeholder="Cummins" /></div>
                                <div><label className="label text-xs">Model</label><input value={dtForm.engineModel} onChange={(e) => setDtForm({ ...dtForm, engineModel: e.target.value })} className="input text-sm" placeholder="X15" /></div>
                                <div><label className="label text-xs">Serial</label><input value={dtForm.engineSerial} onChange={(e) => setDtForm({ ...dtForm, engineSerial: e.target.value })} className="input text-sm" /></div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-steel-600 mb-1">Transmission</div>
                              <div className="grid grid-cols-3 gap-2">
                                <div><label className="label text-xs">Make</label><input value={dtForm.transmissionMake} onChange={(e) => setDtForm({ ...dtForm, transmissionMake: e.target.value })} className="input text-sm" placeholder="Eaton" /></div>
                                <div><label className="label text-xs">Model</label><input value={dtForm.transmissionModel} onChange={(e) => setDtForm({ ...dtForm, transmissionModel: e.target.value })} className="input text-sm" placeholder="Fuller 18" /></div>
                                <div><label className="label text-xs">Serial</label><input value={dtForm.transmissionSerial} onChange={(e) => setDtForm({ ...dtForm, transmissionSerial: e.target.value })} className="input text-sm" /></div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-steel-600 mb-1">Rear End</div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <div><label className="label text-xs">Make</label><input value={dtForm.rearEndMake} onChange={(e) => setDtForm({ ...dtForm, rearEndMake: e.target.value })} className="input text-sm" placeholder="Dana" /></div>
                                <div><label className="label text-xs">Model</label><input value={dtForm.rearEndModel} onChange={(e) => setDtForm({ ...dtForm, rearEndModel: e.target.value })} className="input text-sm" placeholder="DSP40" /></div>
                                <div><label className="label text-xs">Ratio</label><input value={dtForm.rearEndRatio} onChange={(e) => setDtForm({ ...dtForm, rearEndRatio: e.target.value })} className="input text-sm" placeholder="3.73" /></div>
                                <div><label className="label text-xs">Serial</label><input value={dtForm.rearEndSerial} onChange={(e) => setDtForm({ ...dtForm, rearEndSerial: e.target.value })} className="input text-sm" /></div>
                              </div>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => saveDrivetrain(t.id)} disabled={loading} className="btn-accent text-sm">{loading ? 'Saving...' : 'Save'}</button>
                              <button onClick={() => setEditingDrivetrain(null)} className="btn-ghost text-sm">Cancel</button>
                            </div>
                          </div>
                        ) : hasDrivetrain ? (
                          <div className="bg-white rounded-lg border border-steel-200 p-4 space-y-3">
                            {(t.engineMake || t.engineModel || t.engineSerial) && (
                              <div>
                                <div className="text-xs font-semibold text-steel-500 uppercase">Engine</div>
                                <div className="text-sm text-steel-800">
                                  {[t.engineMake, t.engineModel].filter(Boolean).join(' ') || '—'}
                                  {t.engineSerial && <span className="text-steel-400 ml-2">SN: {t.engineSerial}</span>}
                                </div>
                              </div>
                            )}
                            {(t.transmissionMake || t.transmissionModel || t.transmissionSerial) && (
                              <div>
                                <div className="text-xs font-semibold text-steel-500 uppercase">Transmission</div>
                                <div className="text-sm text-steel-800">
                                  {[t.transmissionMake, t.transmissionModel].filter(Boolean).join(' ') || '—'}
                                  {t.transmissionSerial && <span className="text-steel-400 ml-2">SN: {t.transmissionSerial}</span>}
                                </div>
                              </div>
                            )}
                            {(t.rearEndMake || t.rearEndModel || t.rearEndRatio || t.rearEndSerial) && (
                              <div>
                                <div className="text-xs font-semibold text-steel-500 uppercase">Rear End</div>
                                <div className="text-sm text-steel-800">
                                  {[t.rearEndMake, t.rearEndModel].filter(Boolean).join(' ') || '—'}
                                  {t.rearEndRatio && <span className="text-steel-500 ml-2">({t.rearEndRatio})</span>}
                                  {t.rearEndSerial && <span className="text-steel-400 ml-2">SN: {t.rearEndSerial}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg border border-dashed border-steel-300 p-6 text-center text-sm text-steel-400">
                            No drivetrain details recorded yet. Click &quot;Add Details&quot; to get started.
                          </div>
                        )}
                      </div>

                      {/* Filters, Tires & Brakes Section */}
                      <div className="px-4 pb-4">
                        <h4 className="text-xs font-bold text-steel-700 uppercase tracking-wider mb-3">Filters, Tires & Brakes</h4>
                        <div className="space-y-2">
                          {FILTER_TYPES.map((ft) => {
                            const existing = t.filters.find((f) => f.filterType === ft.key);
                            const isEditingThis = editingFilter === `${t.id}-${ft.key}`;
                            const overdue = existing ? isOverdue(existing.nextDueAt) : false;
                            const dueSoon = existing ? isDueSoon(existing.nextDueAt) : false;
                            const showMileage = MILEAGE_TYPES.has(ft.key);

                            return (
                              <div key={ft.key} className="bg-white rounded-lg border border-steel-200 overflow-hidden">
                                <div className="flex items-center gap-3 px-4 py-3">
                                  <span className="text-xl">{ft.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-steel-900">{ft.label}</div>
                                    {existing ? (
                                      <div className="text-xs text-steel-500 mt-0.5 flex flex-wrap gap-x-3">
                                        {existing.partNumber && <span>Part: {existing.partNumber}</span>}
                                        {existing.lastReplacedAt && <span>Last: {new Date(existing.lastReplacedAt).toLocaleDateString()}</span>}
                                        {existing.mileage != null && <span>@ {fmtMileage(existing.mileage)}</span>}
                                        {existing.nextDueAt && (
                                          <span className={`font-medium ${overdue ? 'text-red-600' : dueSoon ? 'text-amber-600' : 'text-steel-500'}`}>
                                            Next: {new Date(existing.nextDueAt).toLocaleDateString()}
                                            {overdue && ' (OVERDUE)'}
                                            {dueSoon && !overdue && ' (due soon)'}
                                          </span>
                                        )}
                                        {existing.nextDueMileage != null && (
                                          <span className="text-steel-500">Due @ {fmtMileage(existing.nextDueMileage)}</span>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-steel-400 mt-0.5">Not tracked</div>
                                    )}
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); openFilterEdit(t.id, ft.key, existing || undefined); }}
                                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-steel-100 text-steel-700 hover:bg-steel-200 transition-colors"
                                    >
                                      {existing ? 'Edit' : '+ Track'}
                                    </button>
                                    {existing && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteFilter(existing.id); }}
                                        className="px-2 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors"
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {isEditingThis && (
                                  <div className="border-t border-steel-200 p-3 bg-steel-50">
                                    <div className={`grid gap-2 ${showMileage ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                                      <div>
                                        <label className="label text-xs">Part # / Size</label>
                                        <input value={filterForm.partNumber} onChange={(e) => setFilterForm({ ...filterForm, partNumber: e.target.value })} className="input text-sm" placeholder={ft.key === 'TIRES' ? '295/75R22.5' : ft.key === 'BRAKES' ? 'Brake pad model' : 'LF16015'} />
                                      </div>
                                      <div>
                                        <label className="label text-xs">Last Replaced</label>
                                        <input type="date" value={filterForm.lastReplacedAt} onChange={(e) => setFilterForm({ ...filterForm, lastReplacedAt: e.target.value })} className="input text-sm" />
                                      </div>
                                      <div>
                                        <label className="label text-xs">Next Due Date</label>
                                        <input type="date" value={filterForm.nextDueAt} onChange={(e) => setFilterForm({ ...filterForm, nextDueAt: e.target.value })} className="input text-sm" />
                                      </div>
                                      {showMileage && (
                                        <>
                                          <div>
                                            <label className="label text-xs">Mileage at Replacement</label>
                                            <input type="number" value={filterForm.mileage} onChange={(e) => setFilterForm({ ...filterForm, mileage: e.target.value })} className="input text-sm" placeholder="125000" />
                                          </div>
                                          <div>
                                            <label className="label text-xs">Next Due Mileage</label>
                                            <input type="number" value={filterForm.nextDueMileage} onChange={(e) => setFilterForm({ ...filterForm, nextDueMileage: e.target.value })} className="input text-sm" placeholder="150000" />
                                          </div>
                                        </>
                                      )}
                                      <div>
                                        <label className="label text-xs">Notes</label>
                                        <input value={filterForm.notes} onChange={(e) => setFilterForm({ ...filterForm, notes: e.target.value })} className="input text-sm" placeholder="Optional notes..." />
                                      </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                      <button onClick={() => saveFilter(t.id, ft.key)} disabled={loading} className="btn-accent text-xs">{loading ? 'Saving...' : 'Save'}</button>
                                      <button onClick={() => setEditingFilter(null)} className="btn-ghost text-xs">Cancel</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
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
