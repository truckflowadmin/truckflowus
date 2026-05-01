'use client';

import { useState, useMemo, useEffect, useRef } from 'react';

/* ── Types ──────────────────────────────────────────── */
interface MaterialInfo {
  name: string;
  unit?: string;
}

interface QuarryEntry {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  contactPerson: string | null;
  website: string | null;
  pricingUrl: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  lat: number;
  lng: number;
  hoursOfOp: string | null;
  materials: MaterialInfo[];
  notes: string | null;
}

/* ── Pre-seeded SW Florida quarry/mine directory ──── */
const QUARRIES: QuarryEntry[] = [
  {
    id: 'vulcan-naples',
    name: 'Vulcan Materials - Naples',
    phone: '(239) 455-4550',
    email: null,
    contactPerson: null,
    website: 'https://www.vulcanmaterials.com',
    pricingUrl: null,
    address: '3825 White Lake Blvd',
    city: 'Naples',
    state: 'FL',
    zip: '34117',
    lat: 26.1475,
    lng: -81.6200,
    hoursOfOp: 'Mon-Fri 6:00am - 4:30pm',
    materials: [
      { name: 'Base Rock' }, { name: '57 Stone' }, { name: 'Rip Rap' },
      { name: 'Screenings' }, { name: 'Limerock' }, { name: 'Crush & Run' },
      { name: 'Asphalt' },
    ],
    notes: 'Major regional supplier. Call for current pricing.',
  },
  {
    id: 'bonness-naples',
    name: 'Bonness Company',
    phone: '(239) 597-6221',
    email: null,
    contactPerson: null,
    website: 'https://www.bonness.com',
    pricingUrl: null,
    address: '1990 Seward Ave',
    city: 'Naples',
    state: 'FL',
    zip: '34109',
    lat: 26.2280,
    lng: -81.7660,
    hoursOfOp: 'Mon-Fri 7:00am - 5:00pm',
    materials: [
      { name: 'Fill Dirt' }, { name: 'Shell Rock' }, { name: 'Limerock' },
      { name: 'Sand' }, { name: 'Screenings' }, { name: 'Base Rock' },
    ],
    notes: 'Also provides site work & paving.',
  },
  {
    id: 'florida-rock-ftmyers',
    name: 'Florida Rock Industries - Ft. Myers',
    phone: '(239) 334-0773',
    email: null,
    contactPerson: null,
    website: 'https://www.patriottrans.com',
    pricingUrl: null,
    address: '2301 Widman Way',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33901',
    lat: 26.6337,
    lng: -81.8546,
    hoursOfOp: 'Mon-Fri 6:30am - 4:30pm',
    materials: [
      { name: '57 Stone' }, { name: 'Base Rock' }, { name: 'Rip Rap' },
      { name: 'Concrete' }, { name: 'Sand' }, { name: 'Shell Rock' },
    ],
    notes: null,
  },
  {
    id: 'titan-america-medley',
    name: 'Titan America - Pennsuco',
    phone: '(305) 364-2200',
    email: null,
    contactPerson: null,
    website: 'https://www.titanamerica.com',
    pricingUrl: null,
    address: '11600 NW South River Dr',
    city: 'Medley',
    state: 'FL',
    zip: '33178',
    lat: 25.8580,
    lng: -80.3500,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm, Sat 6:00am - 12:00pm',
    materials: [
      { name: 'Base Rock' }, { name: '57 Stone' }, { name: 'Rip Rap' },
      { name: 'Limerock' }, { name: 'Concrete' }, { name: 'Screenings' },
      { name: 'Fill Dirt' },
    ],
    notes: 'Large mining operation with on-site concrete batch plant.',
  },
  {
    id: 'white-rock-quarries',
    name: 'White Rock Quarries',
    phone: '(305) 821-8402',
    email: null,
    contactPerson: null,
    website: 'https://www.whiterockquarries.com',
    pricingUrl: null,
    address: '8500 NW 166th St',
    city: 'Miami Lakes',
    state: 'FL',
    zip: '33016',
    lat: 25.9230,
    lng: -80.3310,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Base Rock' }, { name: 'Fill Dirt' }, { name: 'Limerock' },
      { name: 'Crush & Run' }, { name: 'Screenings' }, { name: 'Rip Rap' },
      { name: '57 Stone' },
    ],
    notes: null,
  },
  {
    id: 'apac-lehigh',
    name: 'APAC Southeast - Lehigh Acres',
    phone: '(239) 369-1161',
    email: null,
    contactPerson: null,
    website: null,
    pricingUrl: null,
    address: '901 Leeland Heights Blvd',
    city: 'Lehigh Acres',
    state: 'FL',
    zip: '33936',
    lat: 26.5980,
    lng: -81.6270,
    hoursOfOp: 'Mon-Fri 6:00am - 4:00pm',
    materials: [
      { name: 'Asphalt Millings' }, { name: 'Base Rock' },
      { name: 'Crush & Run' }, { name: 'Fill Dirt' },
    ],
    notes: 'Specializes in asphalt & road base materials.',
  },
  {
    id: 'cemex-ftmyers',
    name: 'CEMEX - Fort Myers',
    phone: '(239) 332-1440',
    email: null,
    contactPerson: null,
    website: 'https://www.cemexusa.com',
    pricingUrl: null,
    address: '3350 Metro Pkwy',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33916',
    lat: 26.5920,
    lng: -81.8350,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm, Sat 7:00am - 12:00pm',
    materials: [
      { name: 'Concrete' }, { name: 'Sand' }, { name: 'Gravel' },
      { name: '57 Stone' }, { name: 'Base Rock' },
    ],
    notes: 'Ready-mix concrete plant. Aggregates available.',
  },
  {
    id: 'vulcan-ftmyers',
    name: 'Vulcan Materials - Fort Myers',
    phone: '(239) 337-2202',
    email: null,
    contactPerson: null,
    website: 'https://www.vulcanmaterials.com',
    pricingUrl: null,
    address: '5600 Division Dr',
    city: 'Fort Myers',
    state: 'FL',
    zip: '33905',
    lat: 26.6510,
    lng: -81.7950,
    hoursOfOp: 'Mon-Fri 6:00am - 4:30pm',
    materials: [
      { name: 'Base Rock' }, { name: '57 Stone' }, { name: 'Rip Rap' },
      { name: 'Screenings' }, { name: 'Limerock' }, { name: 'Granite' },
      { name: 'Asphalt' }, { name: 'Sand' },
    ],
    notes: null,
  },
  {
    id: 'quality-enterprises-naples',
    name: 'Quality Enterprises USA',
    phone: '(239) 435-7200',
    email: null,
    contactPerson: null,
    website: 'https://www.qualityenterprises.net',
    pricingUrl: null,
    address: '3894 Mannix Dr Suite 216',
    city: 'Naples',
    state: 'FL',
    zip: '34114',
    lat: 26.1100,
    lng: -81.7480,
    hoursOfOp: 'Mon-Fri 7:00am - 5:00pm',
    materials: [
      { name: 'Limerock' }, { name: 'Fill Dirt' }, { name: 'Shell Rock' },
      { name: 'Base Rock' }, { name: 'Sand' },
    ],
    notes: 'Utility & site work contractor with quarry operations.',
  },
  {
    id: 'ranger-construction-palmbeach',
    name: 'Ranger Construction - Palm Beach',
    phone: '(561) 793-9400',
    email: null,
    contactPerson: null,
    website: 'https://www.rangerconstruction.com',
    pricingUrl: null,
    address: '230 S State Rd 7',
    city: 'West Palm Beach',
    state: 'FL',
    zip: '33413',
    lat: 26.6640,
    lng: -80.1520,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Asphalt' }, { name: 'Base Rock' }, { name: 'Asphalt Millings' },
      { name: '57 Stone' }, { name: 'Screenings' },
    ],
    notes: 'Asphalt production & aggregate supply.',
  },
  {
    id: 'martin-marietta-clewiston',
    name: 'Martin Marietta Materials - Clewiston',
    phone: '(863) 983-6161',
    email: null,
    contactPerson: null,
    website: 'https://www.martinmarietta.com',
    pricingUrl: null,
    address: 'Hwy 27',
    city: 'Clewiston',
    state: 'FL',
    zip: '33440',
    lat: 26.7540,
    lng: -80.9340,
    hoursOfOp: 'Mon-Fri 6:00am - 4:00pm',
    materials: [
      { name: 'Base Rock' }, { name: '57 Stone' }, { name: 'Rip Rap' },
      { name: 'Screenings' }, { name: 'Fill Dirt' }, { name: 'Limerock' },
      { name: 'Crush & Run' },
    ],
    notes: 'Large inland quarry. Delivery available.',
  },
  {
    id: 'bergeron-land-development',
    name: 'Bergeron Land Development',
    phone: '(954) 584-0192',
    email: null,
    contactPerson: null,
    website: null,
    pricingUrl: null,
    address: '4455 SW 64th Ave',
    city: 'Davie',
    state: 'FL',
    zip: '33314',
    lat: 26.0630,
    lng: -80.2300,
    hoursOfOp: 'Mon-Fri 6:30am - 4:30pm',
    materials: [
      { name: 'Fill Dirt' }, { name: 'Limerock' }, { name: 'Shell Rock' },
      { name: 'Sand' }, { name: 'Base Rock' },
    ],
    notes: 'Active rock mine in Broward County.',
  },
  {
    id: 'preferred-materials-pompano',
    name: 'Preferred Materials - Pompano',
    phone: '(954) 917-2217',
    email: null,
    contactPerson: null,
    website: 'https://www.preferredmaterials.com',
    pricingUrl: null,
    address: '1300 NW 23rd Ave',
    city: 'Pompano Beach',
    state: 'FL',
    zip: '33069',
    lat: 26.2450,
    lng: -80.1440,
    hoursOfOp: 'Mon-Fri 6:00am - 4:00pm',
    materials: [
      { name: 'Asphalt' }, { name: 'Asphalt Millings' },
      { name: 'Base Rock' }, { name: 'Limerock' },
    ],
    notes: 'Hot-mix asphalt plant with aggregate pickup.',
  },
  {
    id: 'rinker-materials-miami',
    name: 'Rinker Materials - Miami',
    phone: '(305) 633-0344',
    email: null,
    contactPerson: null,
    website: null,
    pricingUrl: null,
    address: '2201 NW 36th St',
    city: 'Miami',
    state: 'FL',
    zip: '33142',
    lat: 25.8080,
    lng: -80.2390,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Concrete' }, { name: '57 Stone' }, { name: 'Sand' },
      { name: 'Gravel' }, { name: 'Pea Gravel' },
    ],
    notes: 'Ready-mix concrete & aggregate supplier.',
  },
  {
    id: 'collier-paving',
    name: 'Collier Paving & Concrete',
    phone: '(239) 597-7676',
    email: null,
    contactPerson: null,
    website: 'https://www.collierpaving.com',
    pricingUrl: null,
    address: '3600 White Lake Blvd',
    city: 'Naples',
    state: 'FL',
    zip: '34117',
    lat: 26.1460,
    lng: -81.6180,
    hoursOfOp: 'Mon-Fri 6:00am - 5:00pm',
    materials: [
      { name: 'Concrete' }, { name: 'Base Rock' }, { name: 'Limerock' },
      { name: 'Sand' }, { name: 'Fill Dirt' },
    ],
    notes: 'Concrete & base material. Good for Collier County jobs.',
  },
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
};

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // miles
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
  const key = `${city.toLowerCase().trim()},${(state || 'fl').toLowerCase().trim()}`;
  return CITY_COORDS[key] || null;
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
  quarries: QuarryEntry[];
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

    // Company marker
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

    quarries.forEach((q) => {
      const materialList = q.materials.map((m) => m.name).join(', ');
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

    // Fit bounds to include all markers + company
    const allPoints: [number, number][] = quarries.map((q) => [q.lat, q.lng]);
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

/* ── Quarry card (read-only) ─────────────────────────── */
function QuarryCard({
  quarry,
  distance,
  highlight,
}: {
  quarry: QuarryEntry;
  distance: number | null;
  highlight: boolean;
}) {
  const fullAddress = [quarry.address, quarry.city, quarry.state, quarry.zip].filter(Boolean).join(', ');
  const mapsUrl = `https://www.google.com/maps?q=${quarry.lat},${quarry.lng}`;

  return (
    <div className={`panel p-5 transition-all ${highlight ? 'ring-2 ring-safety' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg">{quarry.name}</h3>
          <p className="text-sm text-steel-500">
            {quarry.city}, {quarry.state}
            {distance != null && (
              <span className="ml-2 text-xs font-medium text-steel-400">
                ~{Math.round(distance)} mi away
              </span>
            )}
          </p>
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
        <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
          📍 {fullAddress || 'View on Map'}
        </a>
      </div>

      {quarry.hoursOfOp && (
        <p className="text-xs text-steel-500 mb-3">🕐 {quarry.hoursOfOp}</p>
      )}

      {/* Pricing / Website links */}
      <div className="flex flex-wrap gap-2 mb-3">
        {quarry.pricingUrl && (
          <a
            href={quarry.pricingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
          >
            💲 View Pricing Online
          </a>
        )}
        {quarry.website && (
          <a
            href={quarry.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium px-3 py-1.5 rounded-full bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
          >
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
              <span
                key={i}
                className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200"
              >
                {m.name}
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
  companyCity,
  companyState,
}: {
  companyCity: string | null;
  companyState: string | null;
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [materialFilter, setMaterialFilter] = useState<string | null>(null);

  const companyCoords = useMemo(
    () => getCompanyCoords(companyCity, companyState),
    [companyCity, companyState]
  );

  // All unique materials across the directory
  const allMaterials = useMemo(() => {
    const set = new Set<string>();
    QUARRIES.forEach((q) => q.materials.forEach((m) => set.add(m.name)));
    return [...set].sort();
  }, []);

  // Filter + sort by distance
  const quarries = useMemo(() => {
    let list = [...QUARRIES];

    // Text search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((quarry) => {
        if (quarry.name.toLowerCase().includes(q)) return true;
        if (quarry.city.toLowerCase().includes(q)) return true;
        if (quarry.state.toLowerCase().includes(q)) return true;
        if (quarry.materials.some((m) => m.name.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    // Material filter chip
    if (materialFilter) {
      list = list.filter((quarry) =>
        quarry.materials.some((m) => m.name.toLowerCase() === materialFilter.toLowerCase())
      );
    }

    // Sort by distance if we have company coords
    if (companyCoords) {
      list.sort((a, b) => {
        const distA = haversine(companyCoords.lat, companyCoords.lng, a.lat, a.lng);
        const distB = haversine(companyCoords.lat, companyCoords.lng, b.lat, b.lng);
        return distA - distB;
      });
    }

    return list;
  }, [search, materialFilter, companyCoords]);

  // Distance for each quarry
  const distanceMap = useMemo(() => {
    if (!companyCoords) return new Map<string, number>();
    const map = new Map<string, number>();
    QUARRIES.forEach((q) => {
      map.set(q.id, haversine(companyCoords.lat, companyCoords.lng, q.lat, q.lng));
    });
    return map;
  }, [companyCoords]);

  return (
    <>
      {/* Stats row */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">
            Quarries Listed
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{QUARRIES.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">
            Showing
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{quarries.length}</div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">
            With Websites
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {QUARRIES.filter((q) => q.website).length}
          </div>
        </div>
        <div className="panel p-4">
          <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">
            Materials Tracked
          </div>
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
              placeholder="Search by name, city, or material (e.g. 57 stone, rip rap)..."
              className="input text-sm w-full"
            />
          </div>
          <div className="flex bg-steel-50 rounded-md p-0.5 border border-steel-200">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'list'
                  ? 'bg-white shadow-sm text-steel-900'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setView('map')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                view === 'map'
                  ? 'bg-white shadow-sm text-steel-900'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              Map
            </button>
          </div>
        </div>

        {/* Material quick-filter chips */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {allMaterials.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMaterialFilter(materialFilter === m ? null : m);
                setSearch('');
              }}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                materialFilter === m
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

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
      {companyCoords && (
        <p className="text-xs text-steel-400 mb-3 px-1">
          Sorted by distance from {companyCity}, {companyState}. Distances are approximate.
        </p>
      )}

      {/* List view */}
      {quarries.length === 0 ? (
        <div className="panel p-10 text-center text-steel-500">
          <p>No quarries match your search. Try a different material or location.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {quarries.map((q) => (
            <QuarryCard
              key={q.id}
              quarry={q}
              distance={distanceMap.get(q.id) ?? null}
              highlight={highlightId === q.id}
            />
          ))}
        </div>
      )}
    </>
  );
}
