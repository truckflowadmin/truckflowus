'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { updateQuarry, createQuarry, deleteQuarry } from './actions';

/* ── Types ──────────────────────────────────────────── */
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
}

interface Suggestion {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website: string | null;
  hoursOfOp: string | null;
  rating: number | null;
  totalRatings: number;
  mapsUrl: string;
}

/* ── Common materials ────────────────────────────────── */
const COMMON_MATERIALS = [
  'Base Rock', '57 Stone', 'Rip Rap', 'Crush & Run', 'Screenings',
  'Fill Dirt', 'Top Soil', 'Sand', 'Gravel', 'Limestone',
  'Granite', 'Shell Rock', 'Asphalt Millings', 'Concrete',
  'Limerock', 'Pea Gravel', 'River Rock', 'ABC Stone', 'Asphalt',
];

/* ── Distance helper (Haversine) ─────────────────── */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  'naples,fl': { lat: 26.1420, lng: -81.7948 },
  'fort myers,fl': { lat: 26.6406, lng: -81.8723 },
  'cape coral,fl': { lat: 26.5629, lng: -81.9495 },
  'lehigh acres,fl': { lat: 26.6254, lng: -81.6248 },
  'bonita springs,fl': { lat: 26.3398, lng: -81.7787 },
  'estero,fl': { lat: 26.4384, lng: -81.8068 },
  'marco island,fl': { lat: 25.9412, lng: -81.7181 },
  'immokalee,fl': { lat: 26.4187, lng: -81.4173 },
  'miami,fl': { lat: 25.7617, lng: -80.1918 },
  'west palm beach,fl': { lat: 26.7153, lng: -80.0534 },
  'pompano beach,fl': { lat: 26.2379, lng: -80.1248 },
  'fort lauderdale,fl': { lat: 26.1224, lng: -80.1373 },
  'hollywood,fl': { lat: 26.0112, lng: -80.1495 },
  'homestead,fl': { lat: 25.4687, lng: -80.4776 },
  'davie,fl': { lat: 26.0629, lng: -80.2331 },
  'coral springs,fl': { lat: 26.2712, lng: -80.2706 },
  'sarasota,fl': { lat: 27.3364, lng: -82.5307 },
  'bradenton,fl': { lat: 27.4989, lng: -82.5748 },
  'port charlotte,fl': { lat: 26.9756, lng: -82.0910 },
  'punta gorda,fl': { lat: 26.9298, lng: -82.0454 },
  'clewiston,fl': { lat: 26.7540, lng: -80.9340 },
  'labelle,fl': { lat: 26.7618, lng: -81.4384 },
  'medley,fl': { lat: 25.8608, lng: -80.3390 },
  'miami lakes,fl': { lat: 25.9087, lng: -80.3187 },
  'tampa,fl': { lat: 27.9506, lng: -82.4572 },
  'orlando,fl': { lat: 28.5383, lng: -81.3792 },
  'jacksonville,fl': { lat: 30.3322, lng: -81.6557 },
  'tallahassee,fl': { lat: 30.4383, lng: -84.2807 },
  'charleston,sc': { lat: 32.7765, lng: -79.9311 },
  'columbia,sc': { lat: 34.0007, lng: -81.0348 },
  'greenville,sc': { lat: 34.8526, lng: -82.3940 },
  'charlotte,nc': { lat: 35.2271, lng: -80.8431 },
  'raleigh,nc': { lat: 35.7796, lng: -78.6382 },
  'atlanta,ga': { lat: 33.7490, lng: -84.3880 },
  'savannah,ga': { lat: 32.0809, lng: -81.0912 },
  'houston,tx': { lat: 29.7604, lng: -95.3698 },
  'dallas,tx': { lat: 32.7767, lng: -96.7970 },
  'san antonio,tx': { lat: 29.4241, lng: -98.4936 },
  'austin,tx': { lat: 30.2672, lng: -97.7431 },
  'nashville,tn': { lat: 36.1627, lng: -86.7816 },
  'memphis,tn': { lat: 35.1495, lng: -90.0490 },
  'birmingham,al': { lat: 33.5207, lng: -86.8025 },
  'mobile,al': { lat: 30.6954, lng: -88.0399 },
  'new orleans,la': { lat: 29.9511, lng: -90.0715 },
  'baton rouge,la': { lat: 30.4515, lng: -91.1871 },
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCompanyCoords(city: string | null, state: string | null): { lat: number; lng: number } | null {
  if (!city) return null;
  const key = `${city.toLowerCase().trim()},${(state || '').toLowerCase().trim()}`;
  return CITY_COORDS[key] || null;
}

/* ── Geocode via Nominatim (OpenStreetMap, free) ───── */
async function geocodeAddress(address: string, city: string | null, state: string | null, zip: string | null): Promise<{ lat: number; lng: number } | null> {
  const query = [address, city, state, zip].filter(Boolean).join(', ');
  if (!query.trim()) return null;
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '1');
    url.searchParams.set('countrycodes', 'us');
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TruckFlowUS/1.0' },
    });
    const data = await res.json();
    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* ignore */ }
  return null;
}

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
function DirectoryMap({
  quarries,
  companyCoords,
  onSelect,
}: {
  quarries: QuarryRow[];
  companyCoords: { lat: number; lng: number } | null;
  onSelect: (id: string) => void;
}) {
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
    const center = companyCoords || { lat: 26.14, lng: -81.79 };
    const map = L.map(mapRef.current, { center: [center.lat, center.lng], zoom: 9, zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    if (companyCoords) {
      const companyIcon = L.divIcon({
        html: '<div style="background:#0d9488;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3)">You</div>',
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([companyCoords.lat, companyCoords.lng], { icon: companyIcon })
        .addTo(map)
        .bindPopup('<strong>Your Company</strong>');
    }

    leafletMap.current = map;
    setTimeout(() => map.invalidateSize(), 200);
  }, [ready, companyCoords]);

  useEffect(() => {
    if (!leafletMap.current) return;
    const L = (window as any).L;
    const map = leafletMap.current;

    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    const withCoords = quarries.filter((q) => q.lat != null && q.lng != null);
    withCoords.forEach((q) => {
      const materialList = (q.materials || []).map((m: any) => m.name).join(', ');
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

    const allPoints: [number, number][] = withCoords.map((q) => [q.lat!, q.lng!]);
    if (companyCoords) allPoints.push([companyCoords.lat, companyCoords.lng]);
    if (allPoints.length > 1) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (allPoints.length === 1) {
      map.setView(allPoints[0], 11);
    }
  }, [quarries, ready, companyCoords]);

  useEffect(() => {
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  return <div ref={mapRef} className="w-full h-[350px] bg-steel-100 rounded-lg" style={{ zIndex: 0 }} />;
}

/* ── Edit form modal ─────────────────────────────────── */
function EditQuarryForm({
  quarry,
  onClose,
}: {
  quarry: QuarryRow;
  onClose: () => void;
}) {
  const [materials, setMaterials] = useState<MaterialEntry[]>(
    (quarry.materials || []).map((m: any) => ({
      name: m.name || '',
      pricePerUnit: m.pricePerUnit ?? null,
      unit: m.unit || 'TON',
      notes: m.notes || '',
    }))
  );
  const [newMaterial, setNewMaterial] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function addMaterial(name: string) {
    if (!name.trim()) return;
    if (materials.some((m) => m.name.toLowerCase() === name.trim().toLowerCase())) return;
    setMaterials([...materials, { name: name.trim(), pricePerUnit: null, unit: 'TON', notes: '' }]);
    setNewMaterial('');
  }

  function removeMaterial(idx: number) {
    setMaterials(materials.filter((_, i) => i !== idx));
  }

  function updateMaterial(idx: number, field: keyof MaterialEntry, value: any) {
    setMaterials(materials.map((m, i) => (i === idx ? { ...m, [field]: value } : m)));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    fd.set('id', quarry.id);
    fd.set('materials', JSON.stringify(materials));

    const res = await updateQuarry(fd);
    if (res.success) {
      onClose();
      window.location.reload();
    } else {
      setError(res.error || 'Failed to save');
    }
    setSaving(false);
  }

  const unusedMaterials = COMMON_MATERIALS.filter(
    (m) => !materials.some((mat) => mat.name.toLowerCase() === m.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-steel-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit Quarry Info</h2>
          <button onClick={onClose} className="text-steel-400 hover:text-steel-700 text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          <div>
            <label className="label">Name *</label>
            <input name="name" required className="input" defaultValue={quarry.name} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Phone</label>
              <input name="phone" type="tel" className="input" defaultValue={quarry.phone ?? ''} />
            </div>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" className="input" defaultValue={quarry.email ?? ''} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Contact Person</label>
              <input name="contactPerson" className="input" defaultValue={quarry.contactPerson ?? ''} />
            </div>
            <div>
              <label className="label">Hours of Operation</label>
              <input name="hoursOfOp" className="input" defaultValue={quarry.hoursOfOp ?? ''} placeholder="Mon-Fri 6am-4pm" />
            </div>
          </div>

          <div className="pt-3 border-t border-steel-200">
            <h3 className="text-sm font-semibold text-steel-700 mb-3">Address & Location</h3>
            <div>
              <label className="label">Street Address</label>
              <input name="address" className="input" defaultValue={quarry.address ?? ''} />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="label">City</label>
                <input name="city" className="input" defaultValue={quarry.city ?? ''} />
              </div>
              <div>
                <label className="label">State</label>
                <input name="state" className="input" maxLength={2} defaultValue={quarry.state ?? ''} />
              </div>
              <div>
                <label className="label">ZIP</label>
                <input name="zip" className="input" maxLength={10} defaultValue={quarry.zip ?? ''} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="label">Latitude</label>
                <input name="lat" type="number" step="any" className="input" defaultValue={quarry.lat ?? ''} />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input name="lng" type="number" step="any" className="input" defaultValue={quarry.lng ?? ''} />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-steel-200">
            <h3 className="text-sm font-semibold text-steel-700 mb-3">Website & Pricing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Website</label>
                <input name="website" type="url" className="input" defaultValue={quarry.website ?? ''} placeholder="https://..." />
              </div>
              <div>
                <label className="label">Pricing Page URL</label>
                <input name="pricingUrl" type="url" className="input" defaultValue={quarry.pricingUrl ?? ''} placeholder="Direct link to pricing" />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-steel-200">
            <h3 className="text-sm font-semibold text-steel-700 mb-3">Materials Available</h3>

            {unusedMaterials.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {unusedMaterials.slice(0, 12).map((m) => (
                  <button key={m} type="button" onClick={() => addMaterial(m)}
                    className="text-xs px-2.5 py-1 rounded-full bg-steel-100 text-steel-600 hover:bg-steel-200 transition-colors">
                    + {m}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <input
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMaterial(newMaterial); } }}
                className="input flex-1 text-sm"
                placeholder="Add custom material..."
              />
              <button type="button" onClick={() => addMaterial(newMaterial)} className="btn-ghost text-sm px-3">
                Add
              </button>
            </div>

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
            <textarea name="notes" className="input" rows={2} defaultValue={quarry.notes ?? ''} />
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-steel-200">
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Suggestion card ─────────────────────────────────── */
function SuggestionCard({
  suggestion,
  alreadyAdded,
  onAdd,
  distance,
}: {
  suggestion: Suggestion;
  alreadyAdded: boolean;
  onAdd: () => void;
  distance: number | null;
}) {
  return (
    <div className={`panel p-4 ${alreadyAdded ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm truncate">{suggestion.name}</h4>
          <p className="text-xs text-steel-500 mt-0.5">
            {[suggestion.address, suggestion.city, suggestion.state].filter(Boolean).join(', ')}
            {distance != null && (
              <span className="ml-1 text-steel-400">~{Math.round(distance)} mi</span>
            )}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs">
            {suggestion.phone ? (
              <a href={`tel:${suggestion.phone}`} className="text-blue-600 hover:text-blue-800">
                📞 {suggestion.phone}
              </a>
            ) : (
              <span className="text-steel-400 italic">📞 No phone</span>
            )}
            {suggestion.website ? (
              <a href={suggestion.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 truncate max-w-[180px]">
                🌐 Website
              </a>
            ) : (
              <span className="text-steel-400 italic">🌐 No website</span>
            )}
            {suggestion.rating && (
              <span className="text-amber-600">
                {'★'.repeat(Math.round(suggestion.rating))} {suggestion.rating.toFixed(1)} ({suggestion.totalRatings})
              </span>
            )}
          </div>
          {suggestion.hoursOfOp ? (
            <p className="text-[11px] text-steel-400 mt-1 truncate">🕐 {suggestion.hoursOfOp}</p>
          ) : (
            <p className="text-[11px] text-steel-400 mt-1 italic">🕐 No hours listed</p>
          )}
          {(!suggestion.phone || !suggestion.website || !suggestion.hoursOfOp) && !alreadyAdded && (
            <p className="text-[10px] text-amber-600 mt-0.5">Missing info can be filled in after adding</p>
          )}
        </div>
        <div className="flex-shrink-0">
          {alreadyAdded ? (
            <span className="text-xs text-green-600 font-medium px-2 py-1 rounded bg-green-50">Added</span>
          ) : (
            <button
              onClick={onAdd}
              className="text-xs font-medium px-3 py-1.5 rounded bg-safety text-diesel hover:bg-safety/90 transition-colors"
            >
              + Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Quarry card ─────────────────────────────────────── */
function QuarryCard({
  quarry,
  distance,
  highlight,
  onEdit,
  onDelete,
}: {
  quarry: QuarryRow;
  distance: number | null;
  highlight: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fullAddress = [quarry.address, quarry.city, quarry.state, quarry.zip].filter(Boolean).join(', ');
  const mapsUrl =
    quarry.lat && quarry.lng
      ? `https://www.google.com/maps?q=${quarry.lat},${quarry.lng}`
      : fullAddress
        ? `https://www.google.com/maps/search/${encodeURIComponent(fullAddress)}`
        : null;

  const materials: MaterialEntry[] = Array.isArray(quarry.materials) ? quarry.materials : [];

  return (
    <div className={`panel p-5 transition-all ${highlight ? 'ring-2 ring-safety' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg">{quarry.name}</h3>
          <p className="text-sm text-steel-500">
            {[quarry.city, quarry.state].filter(Boolean).join(', ')}
            {distance != null && (
              <span className="ml-2 text-xs font-medium text-steel-400">
                ~{Math.round(distance)} mi away
              </span>
            )}
          </p>
          {quarry.contactPerson && (
            <p className="text-xs text-steel-500">Contact: {quarry.contactPerson}</p>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={onEdit}
            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50">
            Edit
          </button>
          <button onClick={onDelete}
            className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50">
            Remove
          </button>
        </div>
      </div>

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

      <div className="flex flex-wrap gap-2 mb-3">
        {quarry.pricingUrl && (
          <a href={quarry.pricingUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors">
            💲 View Pricing Online
          </a>
        )}
        {quarry.website && (
          <a href={quarry.website} target="_blank" rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors">
            🌐 Website
          </a>
        )}
        {!quarry.pricingUrl && !quarry.website && quarry.phone && (
          <span className="text-xs text-steel-500 italic">No online pricing — call for quotes</span>
        )}
      </div>

      {materials.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-1.5">Materials</div>
          <div className="flex flex-wrap gap-1.5">
            {materials.map((m, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                {m.name}
                {m.pricePerUnit != null && (
                  <span className="font-semibold">
                    ${m.pricePerUnit.toFixed(2)}/{m.unit === 'TON' ? 'tn' : m.unit === 'YARD' ? 'yd' : 'ld'}
                  </span>
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

/* ── Main directory component ────────────────────────── */
export default function QuarryDirectory({
  quarries: initialQuarries,
  companyCity,
  companyState,
  companyAddress,
  companyZip,
}: {
  quarries: QuarryRow[];
  companyCity: string | null;
  companyState: string | null;
  companyAddress: string | null;
  companyZip: string | null;
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);
  const [editQuarry, setEditQuarry] = useState<QuarryRow | null>(null);

  // Suggestions state
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [nameSearch, setNameSearch] = useState('');
  const [searchMode, setSearchMode] = useState<'nearby' | 'name'>('nearby');

  // Resolve company coordinates (from lookup table or geocode)
  const [companyCoords, setCompanyCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [coordsResolved, setCoordsResolved] = useState(false);

  useEffect(() => {
    const lookup = getCompanyCoords(companyCity, companyState);
    if (lookup) {
      setCompanyCoords(lookup);
      setCoordsResolved(true);
      return;
    }
    // Try geocoding
    if (companyCity || companyAddress) {
      geocodeAddress(companyAddress || '', companyCity, companyState, companyZip).then((coords) => {
        if (coords) setCompanyCoords(coords);
        setCoordsResolved(true);
      });
    } else {
      setCoordsResolved(true);
    }
  }, [companyCity, companyState, companyAddress, companyZip]);

  // All unique materials
  const allMaterials = useMemo(() => {
    const set = new Set<string>();
    initialQuarries.forEach((q) => {
      const mats: any[] = Array.isArray(q.materials) ? q.materials : [];
      mats.forEach((m: any) => set.add(m.name));
    });
    return [...set].sort();
  }, [initialQuarries]);

  // Filter + sort by distance
  const quarries = useMemo(() => {
    let list = [...initialQuarries];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((quarry) => {
        if (quarry.name.toLowerCase().includes(q)) return true;
        if (quarry.city?.toLowerCase().includes(q)) return true;
        if (quarry.state?.toLowerCase().includes(q)) return true;
        const mats: any[] = Array.isArray(quarry.materials) ? quarry.materials : [];
        if (mats.some((m: any) => m.name.toLowerCase().includes(q))) return true;
        if (quarry.contactPerson?.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    if (materialFilter) {
      list = list.filter((quarry) => {
        const mats: any[] = Array.isArray(quarry.materials) ? quarry.materials : [];
        return mats.some((m: any) => m.name.toLowerCase() === materialFilter.toLowerCase());
      });
    }

    if (companyCoords) {
      list.sort((a, b) => {
        const distA = a.lat && a.lng ? haversine(companyCoords.lat, companyCoords.lng, a.lat, a.lng) : 99999;
        const distB = b.lat && b.lng ? haversine(companyCoords.lat, companyCoords.lng, b.lat, b.lng) : 99999;
        return distA - distB;
      });
    }

    return list;
  }, [initialQuarries, search, materialFilter, companyCoords]);

  const distanceMap = useMemo(() => {
    if (!companyCoords) return new Map<string, number>();
    const map = new Map<string, number>();
    initialQuarries.forEach((q) => {
      if (q.lat && q.lng) {
        map.set(q.id, haversine(companyCoords.lat, companyCoords.lng, q.lat, q.lng));
      }
    });
    return map;
  }, [initialQuarries, companyCoords]);

  // ── Suggestion functions ──
  async function fetchSuggestions() {
    if (!companyCoords) {
      setSuggestionError('Could not determine your location. Please update your company address in Settings.');
      return;
    }
    setLoadingSuggestions(true);
    setSuggestionError('');
    setSuggestions([]);
    setAddedIds(new Set());
    setSearchMode('nearby');

    try {
      const res = await fetch(`/api/quarries/suggest?lat=${companyCoords.lat}&lng=${companyCoords.lng}&radius=50`);
      const data = await res.json();
      if (data.error && !data.suggestions?.length) {
        setSuggestionError(data.error);
      } else {
        const existingNames = new Set(initialQuarries.map((q) => q.name.toLowerCase()));
        const filtered = (data.suggestions || []).filter(
          (s: Suggestion) => !existingNames.has(s.name.toLowerCase())
        );
        setSuggestions(filtered);
        if (filtered.length === 0 && (data.suggestions || []).length > 0) {
          setSuggestionError('All suggestions are already in your directory.');
        }
      }
    } catch {
      setSuggestionError('Failed to fetch suggestions. Check your internet connection.');
    }
    setLoadingSuggestions(false);
  }

  async function searchByName() {
    if (!nameSearch.trim()) return;
    setLoadingSuggestions(true);
    setSuggestionError('');
    setSuggestions([]);
    setAddedIds(new Set());
    setSearchMode('name');

    try {
      const params = new URLSearchParams({ q: nameSearch.trim() });
      if (companyCoords) {
        params.set('lat', String(companyCoords.lat));
        params.set('lng', String(companyCoords.lng));
      }
      const res = await fetch(`/api/quarries/suggest?${params}`);
      const data = await res.json();
      if (data.error && !data.suggestions?.length) {
        setSuggestionError(data.error);
      } else {
        const existingNames = new Set(initialQuarries.map((q) => q.name.toLowerCase()));
        const filtered = (data.suggestions || []).filter(
          (s: Suggestion) => !existingNames.has(s.name.toLowerCase())
        );
        setSuggestions(filtered);
        if (filtered.length === 0 && (data.suggestions || []).length > 0) {
          setSuggestionError('All suggestions are already in your directory.');
        } else if (filtered.length === 0) {
          setSuggestionError(`No results found for "${nameSearch.trim()}". Try a different name or keyword.`);
        }
      }
    } catch {
      setSuggestionError('Search failed. Check your internet connection.');
    }
    setLoadingSuggestions(false);
  }

  async function addSuggestion(suggestion: Suggestion) {
    setAddingIds((prev) => new Set(prev).add(suggestion.placeId));
    const res = await createQuarry({
      name: suggestion.name,
      phone: suggestion.phone,
      website: suggestion.website,
      address: suggestion.address,
      city: suggestion.city,
      state: suggestion.state,
      zip: suggestion.zip,
      lat: suggestion.lat,
      lng: suggestion.lng,
      hoursOfOp: suggestion.hoursOfOp,
      materials: [],
      notes: null,
    });

    setAddingIds((prev) => {
      const next = new Set(prev);
      next.delete(suggestion.placeId);
      return next;
    });

    if (res.success) {
      setAddedIds((prev) => new Set(prev).add(suggestion.placeId));
    }
  }

  async function handleDelete(quarry: QuarryRow) {
    if (!confirm(`Remove "${quarry.name}" from your directory?`)) return;
    await deleteQuarry(quarry.id);
    window.location.reload();
  }

  return (
    <>
      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">In Directory</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{initialQuarries.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">Showing</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{quarries.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">With Websites</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {initialQuarries.filter((q) => q.website).length}
          </div>
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
              onChange={(e) => {
                setSearch(e.target.value);
                setMaterialFilter(null);
              }}
              placeholder="Search by name, city, or material..."
              className="input text-sm w-full"
            />
          </div>
          <div className="flex gap-2">
            <div className="flex bg-steel-50 rounded-md p-0.5 border border-steel-200">
              <button type="button" onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === 'list' ? 'bg-white shadow-sm text-steel-900' : 'text-steel-500 hover:text-steel-700'
                }`}>
                List
              </button>
              <button type="button" onClick={() => setView('map')}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  view === 'map' ? 'bg-white shadow-sm text-steel-900' : 'text-steel-500 hover:text-steel-700'
                }`}>
                Map
              </button>
            </div>
            <button
              onClick={() => {
                setShowSuggestions(!showSuggestions);
                if (!showSuggestions && suggestions.length === 0) fetchSuggestions();
              }}
              className={`text-sm px-3 py-1.5 rounded font-medium transition-colors ${
                showSuggestions
                  ? 'bg-safety text-diesel'
                  : 'bg-steel-100 text-steel-700 hover:bg-steel-200'
              }`}
            >
              📍 Find Nearby
            </button>
          </div>
        </div>

        {/* Material quick-filter chips */}
        {allMaterials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {allMaterials.map((m) => (
              <button key={m} type="button"
                onClick={() => {
                  setMaterialFilter(materialFilter === m ? null : m);
                  setSearch('');
                }}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  materialFilter === m
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}>
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Suggestions panel ── */}
      {showSuggestions && (
        <div className="panel p-4 mb-4 border-2 border-safety/30">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm">Find Quarries & Mines</h3>
              <p className="text-xs text-steel-500">
                {searchMode === 'name'
                  ? `Showing results for "${nameSearch}"`
                  : companyCoords
                    ? `Showing quarries near ${companyCity || 'your location'}, ${companyState || ''}`
                    : 'Resolving your location...'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchSuggestions} disabled={loadingSuggestions}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1">
                {loadingSuggestions ? 'Searching...' : '📍 Nearby'}
              </button>
              <button onClick={() => setShowSuggestions(false)}
                className="text-steel-400 hover:text-steel-700 text-lg leading-none">&times;</button>
            </div>
          </div>

          {/* Name search input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchByName(); } }}
              placeholder="Search by name (e.g. Vulcan Materials, CEMEX)..."
              className="input text-sm flex-1"
            />
            <button
              onClick={searchByName}
              disabled={loadingSuggestions || !nameSearch.trim()}
              className="text-sm px-4 py-1.5 rounded font-medium bg-steel-800 text-white hover:bg-steel-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Search
            </button>
          </div>

          {loadingSuggestions && (
            <div className="flex items-center gap-2 text-sm text-steel-500 py-8 justify-center">
              <span className="animate-spin text-lg">⏳</span>
              {searchMode === 'name'
                ? `Searching for "${nameSearch}"...`
                : 'Searching for quarries, mines, and aggregate suppliers near you...'}
            </div>
          )}

          {suggestionError && !loadingSuggestions && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {suggestionError}
            </div>
          )}

          {!loadingSuggestions && suggestions.length > 0 && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {suggestions.map((s) => (
                <SuggestionCard
                  key={s.placeId}
                  suggestion={s}
                  alreadyAdded={addedIds.has(s.placeId)}
                  distance={s.lat && companyCoords ? haversine(companyCoords.lat, companyCoords.lng, s.lat, s.lng!) : null}
                  onAdd={() => addSuggestion(s)}
                />
              ))}
              {addedIds.size > 0 && (
                <div className="text-center pt-2">
                  <button onClick={() => window.location.reload()}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                    Reload to see added quarries in your directory
                  </button>
                </div>
              )}
            </div>
          )}

          {!loadingSuggestions && suggestions.length === 0 && !suggestionError && (
            <div className="text-center text-sm text-steel-500 py-4">
              No new suggestions found. All nearby quarries may already be in your directory.
            </div>
          )}
        </div>
      )}

      {/* Map view */}
      {view === 'map' && (
        <div className="panel overflow-hidden mb-4">
          <DirectoryMap
            quarries={quarries}
            companyCoords={companyCoords}
            onSelect={(id) => {
              setHighlightId(id);
              setView('list');
            }}
          />
        </div>
      )}

      {/* Proximity note */}
      {companyCoords && quarries.length > 0 && (
        <p className="text-xs text-steel-400 mb-3 px-1">
          Sorted by distance from {companyCity || 'your location'}{companyState ? `, ${companyState}` : ''}. Distances are approximate.
        </p>
      )}

      {/* List view */}
      {quarries.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">
          {initialQuarries.length === 0 ? (
            <div>
              <div className="text-3xl mb-2">⛏</div>
              <p className="font-medium">Your quarry directory is empty</p>
              <p className="text-sm mt-1">
                Click <strong>Find Nearby</strong> to search for quarries and mines near your company address, or add them manually.
              </p>
              {!showSuggestions && (
                <button
                  onClick={() => { setShowSuggestions(true); fetchSuggestions(); }}
                  className="btn-accent mt-4 text-sm"
                >
                  📍 Find Nearby Quarries
                </button>
              )}
            </div>
          ) : (
            <p>No quarries match your search. Try a different material or location.</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quarries.map((q) => (
            <QuarryCard
              key={q.id}
              quarry={q}
              distance={distanceMap.get(q.id) ?? null}
              highlight={highlightId === q.id}
              onEdit={() => setEditQuarry(q)}
              onDelete={() => handleDelete(q)}
            />
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editQuarry && (
        <EditQuarryForm
          quarry={editQuarry}
          onClose={() => setEditQuarry(null)}
        />
      )}
    </>
  );
}
