'use client';

import { useState, useEffect, useRef } from 'react';
import DriverTrackingHistory from '@/components/DriverTrackingHistory';

interface DriverOption {
  id: string;
  name: string;
  truckNumber: string | null;
  active: boolean;
}

/* ── Leaflet loader (shared with DriverTrackingHistory) ──────── */
let leafletLoadPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
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
      script.onerror = () => reject(new Error('Failed to load Leaflet'));
      document.head.appendChild(script);
    });
  }
  return leafletLoadPromise;
}

/* ── Preview map (no driver selected) ────────────────────────── */
function PreviewMap() {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    loadLeaflet()
      .then(() => setLeafletReady(true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletMapRef.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, {
      center: [26.14, -81.79], // SW Florida default
      zoom: 10,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    leafletMapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
  }, [leafletReady]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="panel overflow-hidden relative">
      <div ref={mapRef} className="w-full h-[450px] bg-steel-100" style={{ zIndex: 0 }} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 1 }}>
        <div className="bg-white/90 backdrop-blur-sm rounded-lg px-6 py-4 text-center shadow-sm">
          <div className="text-2xl mb-1">📍</div>
          <p className="text-steel-500 text-sm font-medium">Select a driver above to view tracking history</p>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function TrackingSection({ drivers }: { drivers: DriverOption[] }) {
  const [selectedDriverId, setSelectedDriverId] = useState('');

  return (
    <div className="max-w-7xl">
      {/* Driver selector */}
      <div className="panel p-4 mb-4">
        <label className="block text-xs font-medium text-steel-500 mb-1">Select Driver</label>
        <select
          value={selectedDriverId}
          onChange={(e) => setSelectedDriverId(e.target.value)}
          className="input text-sm py-2 max-w-md"
        >
          <option value="">— Choose a driver —</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}{d.truckNumber ? ` (${d.truckNumber})` : ''}{!d.active ? ' [Inactive]' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Map / Tracking history */}
      {selectedDriverId ? (
        <DriverTrackingHistory key={selectedDriverId} driverId={selectedDriverId} />
      ) : (
        <PreviewMap />
      )}
    </div>
  );
}
