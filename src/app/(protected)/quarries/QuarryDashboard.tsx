'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { createQuarry, updateQuarry, deleteQuarry } from './actions';

interface MaterialEntry {
  name: string;
  pricePerUnit: number | null;
  unit: string;
  notes: string;
}

interface QuarryRow {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  website: string | null;
  pricingUrl: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  hoursOfOp: string | null;
  materials: MaterialEntry[];
  notes: string | null;
  active: boolean;
}

const COMMON_MATERIALS = [
  'Base Rock', '57 Stone', 'Rip Rap', 'Crush & Run', 'Screenings',
  'Fill Dirt', 'Top Soil', 'Sand', 'Gravel', 'Limestone',
  'Granite', 'Shell Rock', 'Asphalt Millings', 'Concrete',
  'Limerock', 'Pea Gravel', 'River Rock', 'ABC Stone',
];

/* ── Leaflet loader ──────────────────────────────────── */
let leafletLoadPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject();
  if ((window as any).L) return Promise.resolve();
  if (!leafletLoadPromise) {
    leafletLoadPromise = new Promise<void>((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.head.appendChild(script);
    });
  }
  return leafletLoadPromise;
}

/* ── Map component ───────────────────────────────────── */
function QuarryMap({ quarries, onSelect }: { quarries: QuarryRow[]; onSelect: (id: string) => void }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadLeaflet().then(() => setReady(true)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    if (leafletMap.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, { center: [28.0, -81.5], zoom: 8, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);
    leafletMap.current = map;
    setTimeout(() => map.invalidateSize(), 200);
  }, [ready]);

  useEffect(() => {
    if (!leafletMap.current) return;
    const L = (window as any).L;
    const map = leafletMap.current;

    // Clear old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    const withCoords = quarries.filter(q => q.lat != null && q.lng != null);
    if (withCoords.length === 0) return;

    withCoords.forEach(q => {
      const materialList = (q.materials || []).map(m => m.name).join(', ');
      const marker = L.marker([q.lat, q.lng])
        .addTo(map)
        .bindPopup(`
          <div style="min-width:180px">
            <strong>${q.name}</strong><br/>
            ${q.phone ? `<span style="font-size:12px">📞 ${q.phone}</span><br/>` : ''}
            ${materialList ? `<span style="font-size:11px;color:#666">${materialList}</span>` : ''}
          </div>
        `);
      marker.on('click', () => onSelect(q.id));
      markersRef.current.push(marker);
    });

    // Fit bounds
    if (withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map(q => [q.lat, q.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([withCoords[0].lat, withCoords[0].lng], 12);
    }
  }, [quarries, ready]);

  useEffect(() => {
    return () => {
      if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; }
    };
  }, []);

  return <div ref={mapRef} className="w-full h-[350px] bg-steel-100 rounded-lg" style={{ zIndex: 0 }} />;
}

/* ── Add/Edit form ───────────────────────────────────── */
function QuarryForm({
  quarry,
  onClose,
}: {
  quarry: QuarryRow | null; // null = create mode
  onClose: () => void;
}) {
  const [materials, setMaterials] = useState<MaterialEntry[]>(quarry?.materials || []);
  const [newMaterial, setNewMaterial] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addMaterial(name: string) {
    if (!name.trim()) return;
    if (materials.some(m => m.name.toLowerCase() === name.trim().toLowerCase())) return;
    setMaterials([...materials, { name: name.trim(), pricePerUnit: null, unit: 'TON', notes: '' }]);
    setNewMaterial('');
  }

  function removeMaterial(idx: number) {
    setMaterials(materials.filter((_, i) => i !== idx));
  }

  function updateMaterial(idx: number, field: keyof MaterialEntry, value: any) {
    setMaterials(materials.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    fd.set('materials', JSON.stringify(materials));
    if (quarry) fd.set('id', quarry.id);

    const res = quarry ? await updateQuarry(fd) : await createQuarry(fd);
    if (res.success) {
      onClose();
      window.location.reload();
    } else {
      setError(res.error || 'Failed to save');
    }
    setSaving(false);
  }

  const unusedMaterials = COMMON_MATERIALS.filter(
    m => !materials.some(mat => mat.name.toLowerCase() === m.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-steel-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{quarry ? 'Edit Quarry' : 'Add Mine / Quarry'}</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-700 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" defaultValue={quarry?.name ?? ''} placeholder="e.g. Vulcan Materials - Naples" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input name="phone" type="tel" className="input" defaultValue={quarry?.phone ?? ''} />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="input" defaultValue={quarry?.email ?? ''} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Contact Person</label>
              <input name="contactPerson" className="input" defaultValue={quarry?.contactPerson ?? ''} />
            </div>
            <div>
              <label className="label">Hours of Operation</label>
              <input name="hoursOfOp" className="input" defaultValue={quarry?.hoursOfOp ?? ''} placeholder="Mon-Fri 6am-4pm" />
            </div>
          </div>

          <div className="pt-3 border-t border-steel-200">
            <h3 className="text-sm font-semibold text-steel-700 mb-3">Address & Location</h3>
            <div>
              <label className="label">Street Address</label>
              <input name="address" className="input" defaultValue={quarry?.address ?? ''} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="label">City</label>
                <input name="city" className="input" defaultValue={quarry?.city ?? ''} />
              </div>
              <div>
                <label className="label">State</label>
                <input name="state" className="input" maxLength={2} defaultValue={quarry?.state ?? ''} />
              </div>
              <div>
                <label className="label">ZIP</label>
                <input name="zip" className="input" maxLength={10} defaultValue={quarry?.zip ?? ''} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label">Latitude</label>
                <input name="lat" type="number" step="any" className="input" defaultValue={quarry?.lat ?? ''} placeholder="26.1420" />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input name="lng" type="number" step="any" className="input" defaultValue={quarry?.lng ?? ''} placeholder="-81.7948" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-steel-200">
            <h3 className="text-sm font-semibold text-steel-700 mb-3">Website & Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Website</label>
                <input name="website" type="url" className="input" defaultValue={quarry?.website ?? ''} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Pricing Page URL</label>
                <input name="pricingUrl" type="url" className="input" defaultValue={quarry?.pricingUrl ?? ''} placeholder="Link to online pricing" />
                <p className="text-xs text-steel-400 mt-1">Direct link to their pricing page if available online</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-steel-200">
            <h3 className="text-sm font-semibold text-steel-700 mb-3">Materials Available</h3>

            {/* Quick-add chips */}
            {unusedMaterials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {unusedMaterials.slice(0, 12).map(m => (
                  <button key={m} type="button" onClick={() => addMaterial(m)}
                    className="text-xs px-2.5 py-1 rounded-full bg-steel-100 text-steel-600 hover:bg-steel-200 transition-colors">
                    + {m}
                  </button>
                ))}
              </div>
            )}

            {/* Custom material input */}
            <div className="flex gap-2 mb-3">
              <input
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(newMaterial); } }}
                className="input flex-1 text-sm"
                placeholder="Add custom material..."
              />
              <button type="button" onClick={() => addMaterial(newMaterial)}
                className="btn-ghost text-sm px-3">Add</button>
            </div>

            {/* Materials list */}
            {materials.length > 0 && (
              <div className="space-y-2">
                {materials.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-steel-50 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium flex-1 min-w-[120px]">{m.name}</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={m.pricePerUnit ?? ''}
                      onChange={(e) => updateMaterial(idx, 'pricePerUnit', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-24 text-sm border border-steel-200 rounded px-2 py-1 bg-white text-right"
                      placeholder="Price"
                    />
                    <select
                      value={m.unit}
                      onChange={(e) => updateMaterial(idx, 'unit', e.target.value)}
                      className="text-xs border border-steel-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="TON">/ton</option>
                      <option value="YARD">/yard</option>
                      <option value="LOAD">/load</option>
                    </select>
                    <input
                      value={m.notes}
                      onChange={(e) => updateMaterial(idx, 'notes', e.target.value)}
                      className="w-28 text-xs border border-steel-200 rounded px-2 py-1 bg-white"
                      placeholder="Notes"
                    />
                    <button type="button" onClick={() => removeMaterial(idx)}
                      className="text-red-400 hover:text-red-600 text-sm px-1">&times;</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="label">Internal Notes</label>
            <textarea name="notes" className="input" rows={2} defaultValue={quarry?.notes ?? ''} />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-steel-200">
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? 'Saving...' : quarry ? 'Save Changes' : 'Add Quarry'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Quarry card ─────────────────────────────────────── */
function QuarryCard({
  quarry,
  onEdit,
  onDelete,
  highlight,
}: {
  quarry: QuarryRow;
  onEdit: () => void;
  onDelete: () => void;
  highlight: boolean;
}) {
  const fullAddress = [quarry.address, quarry.city, quarry.state, quarry.zip].filter(Boolean).join(', ');
  const mapsUrl = quarry.lat && quarry.lng
    ? `https://www.google.com/maps?q=${quarry.lat},${quarry.lng}`
    : fullAddress
      ? `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`
      : null;

  return (
    <div className={`panel p-5 transition-all ${highlight ? 'ring-2 ring-safety' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg">{quarry.name}</h3>
          {quarry.contactPerson && (
            <p className="text-sm text-steel-500">Contact: {quarry.contactPerson}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit} className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">Edit</button>
          <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Delete</button>
        </div>
      </div>

      {/* Contact info */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm mb-3">
        {quarry.phone && (
          <a href={`tel:${quarry.phone}`} className="text-blue-600 hover:text-blue-800">
            📞 {quarry.phone}
          </a>
        )}
        {quarry.email && (
          <a href={`mailto:${quarry.email}`} className="text-blue-600 hover:text-blue-800">
            ✉ {quarry.email}
          </a>
        )}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
            📍 {fullAddress || 'View on Map'}
          </a>
        )}
      </div>

      {quarry.hoursOfOp && (
        <p className="text-xs text-steel-500 mb-3">🕐 {quarry.hoursOfOp}</p>
      )}

      {/* Pricing / Website links */}
      <div className="flex gap-3 mb-3">
        {quarry.pricingUrl && (
          <a href={quarry.pricingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors">
            💲 View Pricing Online
          </a>
        )}
        {quarry.website && !quarry.pricingUrl && (
          <a href={quarry.website} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
            🌐 Visit Website
          </a>
        )}
        {quarry.website && quarry.pricingUrl && (
          <a href={quarry.website} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-steel-100 text-steel-700 hover:bg-steel-200 transition-colors">
            🌐 Website
          </a>
        )}
        {!quarry.pricingUrl && !quarry.website && quarry.phone && (
          <span className="text-xs text-steel-500 italic">No online pricing — call for quotes</span>
        )}
      </div>

      {/* Materials */}
      {quarry.materials.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-1.5">Materials</div>
          <div className="flex flex-wrap gap-1.5">
            {quarry.materials.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {m.name}
                {m.pricePerUnit != null && (
                  <span className="font-semibold">${m.pricePerUnit.toFixed(2)}/{m.unit === 'TON' ? 'tn' : m.unit === 'YARD' ? 'yd' : 'ld'}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {quarry.notes && (
        <p className="text-xs text-steel-500 mt-3 italic">{quarry.notes}</p>
      )}
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────── */
export default function QuarryDashboard({ quarries }: { quarries: QuarryRow[] }) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [showForm, setShowForm] = useState(false);
  const [editQuarry, setEditQuarry] = useState<QuarryRow | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return quarries;
    const q = search.toLowerCase();
    return quarries.filter(quarry => {
      if (quarry.name.toLowerCase().includes(q)) return true;
      if (quarry.city?.toLowerCase().includes(q)) return true;
      if (quarry.state?.toLowerCase().includes(q)) return true;
      if (quarry.materials.some(m => m.name.toLowerCase().includes(q))) return true;
      if (quarry.contactPerson?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [quarries, search]);

  // Unique materials across all quarries for filter suggestions
  const allMaterials = useMemo(() => {
    const set = new Set<string>();
    quarries.forEach(q => q.materials.forEach(m => set.add(m.name)));
    return [...set].sort();
  }, [quarries]);

  async function handleDelete(id: string) {
    const quarry = quarries.find(q => q.id === id);
    if (!quarry) return;
    if (!confirm(`Delete "${quarry.name}"? This cannot be undone.`)) return;
    await deleteQuarry(id);
    window.location.reload();
  }

  return (
    <>
      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Total Quarries</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{quarries.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">With Pricing Links</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{quarries.filter(q => q.pricingUrl).length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">On Map</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{quarries.filter(q => q.lat && q.lng).length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Materials Tracked</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{allMaterials.length}</div>
        </div>
      </section>

      {/* Search & controls */}
      <div className="panel p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, city, or material (e.g. 57 stone, rip rap)..."
              className="input text-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex bg-steel-50 rounded-md p-0.5 border border-steel-200">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === 'list' ? 'bg-white shadow-sm text-steel-900' : 'text-steel-500 hover:text-steel-700'
                }`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setView('map')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === 'map' ? 'bg-white shadow-sm text-steel-900' : 'text-steel-500 hover:text-steel-700'
                }`}
              >
                Map
              </button>
            </div>
            <button onClick={() => { setEditQuarry(null); setShowForm(true); }} className="btn-accent text-sm">
              + Add Quarry
            </button>
          </div>
        </div>

        {/* Material quick-filter chips */}
        {allMaterials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {allMaterials.map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setSearch(search === m ? '' : m)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  search.toLowerCase() === m.toLowerCase()
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map view */}
      {view === 'map' && (
        <div className="panel overflow-hidden mb-4">
          <QuarryMap
            quarries={filtered}
            onSelect={(id) => { setHighlightId(id); setView('list'); }}
          />
        </div>
      )}

      {/* List view */}
      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">
          {quarries.length === 0 ? (
            <div>
              <div className="text-3xl mb-2">⛏</div>
              <p className="font-medium">No mines or quarries yet</p>
              <p className="text-sm mt-1">Add your first quarry to start tracking materials and pricing.</p>
              <button onClick={() => { setEditQuarry(null); setShowForm(true); }}
                className="btn-accent mt-4 text-sm">
                + Add First Quarry
              </button>
            </div>
          ) : (
            <p>No quarries match &quot;{search}&quot;</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(q => (
            <QuarryCard
              key={q.id}
              quarry={q}
              highlight={highlightId === q.id}
              onEdit={() => { setEditQuarry(q); setShowForm(true); }}
              onDelete={() => handleDelete(q.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit form modal */}
      {showForm && (
        <QuarryForm
          quarry={editQuarry}
          onClose={() => { setShowForm(false); setEditQuarry(null); }}
        />
      )}
    </>
  );
}
