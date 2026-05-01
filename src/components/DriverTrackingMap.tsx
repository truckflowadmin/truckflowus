'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface DriverPin {
  driverId: string;
  driverName: string;
  truckNumber: string | null;
  jobId: string;
  jobNumber: number;
  jobName: string;
  destination: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  lastUpdate: string;
  hasLocation?: boolean;
}

/**
 * Live map showing active driver locations.
 * Uses Leaflet + OpenStreetMap (free, no API key needed).
 * Polls /api/tracking every 15 seconds.
 */

// Leaflet script/style loader — shared across instances
let leafletLoadPromise: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('SSR'));
  if ((window as any).L) return Promise.resolve();

  if (!leafletLoadPromise) {
    leafletLoadPromise = new Promise<void>((resolve, reject) => {
      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);

      // Load JS
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

export default function DriverTrackingMap({ labels }: { labels: {
  title: string;
  noDrivers: string;
  speed: string;
  lastUpdate: string;
  destination: string;
  job: string;
  truck: string;
} }) {
  const [drivers, setDrivers] = useState<DriverPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDriver, setSelectedDriver] = useState<DriverPin | null>(null);
  const [leafletReady, setLeafletReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tracking', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setDrivers(data.drivers || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  // Load Leaflet
  useEffect(() => {
    loadLeaflet()
      .then(() => setLeafletReady(true))
      .catch(() => console.warn('[Map] Failed to load Leaflet'));
  }, []);

  // Initialize map once Leaflet is loaded
  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletMapRef.current) return;

    const L = (window as any).L;
    const map = L.map(mapRef.current, {
      center: [26.14, -81.79], // SW Florida default
      zoom: 10,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    leafletMapRef.current = map;

    // Fix Leaflet container size issue when rendered in hidden/dynamic containers
    setTimeout(() => map.invalidateSize(), 200);
  }, [leafletReady]);

  // Update markers when drivers change
  useEffect(() => {
    if (!leafletMapRef.current || !leafletReady) return;

    const L = (window as any).L;
    const map = leafletMapRef.current;

    // Clear old markers
    markersRef.current.forEach((m: any) => map.removeLayer(m));
    markersRef.current = [];

    if (drivers.length === 0) return;

    const bounds: [number, number][] = [];

    drivers.forEach((driver) => {
      // Skip drivers without a known location (lat/lng 0,0 = no GPS ping yet)
      if (driver.latitude === 0 && driver.longitude === 0) return;
      const pos: [number, number] = [driver.latitude, driver.longitude];
      bounds.push(pos);

      // Create a custom circle marker with initials
      const initials = driver.driverName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
      const icon = L.divIcon({
        className: 'leaflet-driver-marker',
        html: `<div style="
          width: 32px; height: 32px; border-radius: 50%;
          background: #FF8C00; border: 2px solid #1E3A5F;
          display: flex; align-items: center; justify-content: center;
          color: white; font-weight: 700; font-size: 11px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        ">${initials}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker(pos, { icon }).addTo(map);

      // Popup with driver info
      marker.bindPopup(`
        <div style="font-family: system-ui; min-width: 160px;">
          <div style="font-weight: 700; font-size: 14px;">${driver.driverName}</div>
          ${driver.truckNumber ? `<div style="color: #666; font-size: 12px;">${labels.truck}: ${driver.truckNumber}</div>` : ''}
          <div style="margin-top: 6px; font-size: 12px;">
            <div><strong>${labels.job}:</strong> #${driver.jobNumber} — ${driver.jobName}</div>
            <div><strong>${labels.destination}:</strong> ${driver.destination}</div>
            <div><strong>${labels.speed}:</strong> ${formatSpeed(driver.speed)}</div>
            <div><strong>${labels.lastUpdate}:</strong> ${formatTime(driver.lastUpdate)}</div>
          </div>
        </div>
      `);

      marker.on('click', () => setSelectedDriver(driver));
      markersRef.current.push(marker);
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14);
    }
    // bounds.length === 0: all drivers have no GPS yet — keep default map center
  }, [drivers, leafletReady, labels]);

  // Poll every 15 seconds
  useEffect(() => {
    load();
    const interval = setInterval(load, 15_000);

    function onVisibility() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  };

  const formatSpeed = (speed: number | null) => {
    if (speed == null || speed < 0) return '--';
    const mph = speed * 2.237; // m/s to mph
    return `${Math.round(mph)} mph`;
  };

  return (
    <div className="panel">
      <div className="flex items-center justify-between p-4 border-b border-steel-100">
        <h2 className="text-lg font-bold text-steel-900">{labels.title}</h2>
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${drivers.length > 0 ? 'bg-green-500 animate-pulse' : 'bg-steel-300'}`} />
          <span className="text-sm text-steel-500">
            {drivers.length} active driver{drivers.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} className="w-full h-[400px] bg-steel-100" style={{ zIndex: 0 }} />

      {/* Driver info card */}
      {selectedDriver && (
        <div className="p-4 bg-navy-50 border-t border-navy-100">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-steel-900">{selectedDriver.driverName}</div>
              {selectedDriver.truckNumber && (
                <div className="text-sm text-steel-500">
                  {labels.truck}: {selectedDriver.truckNumber}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedDriver(null)}
              className="text-steel-400 hover:text-steel-600"
            >
              ✕
            </button>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-steel-500">{labels.job}:</span>{' '}
              <a href={`/jobs/${selectedDriver.jobId}`} className="text-navy-600 hover:underline">
                #{selectedDriver.jobNumber}
              </a>
              <span className="text-steel-400"> — {selectedDriver.jobName}</span>
            </div>
            <div>
              <span className="text-steel-500">{labels.destination}:</span>{' '}
              {selectedDriver.destination}
            </div>
            <div>
              <span className="text-steel-500">{labels.speed}:</span>{' '}
              {formatSpeed(selectedDriver.speed)}
            </div>
            <div>
              <span className="text-steel-500">{labels.lastUpdate}:</span>{' '}
              {formatTime(selectedDriver.lastUpdate)}
            </div>
          </div>
        </div>
      )}

      {/* Driver list (fallback / additional view) */}
      {drivers.length === 0 && !loading && (
        <div className="p-8 text-center text-steel-400">
          <div className="text-3xl mb-2">📍</div>
          <p>{labels.noDrivers}</p>
        </div>
      )}

      {drivers.length > 0 && (
        <div className="border-t border-steel-100">
          {drivers.map((d) => (
            <button
              key={d.driverId}
              onClick={() => {
                setSelectedDriver(d);
                if (leafletMapRef.current) {
                  leafletMapRef.current.panTo([d.latitude, d.longitude]);
                  leafletMapRef.current.setZoom(14);
                }
              }}
              className={`w-full text-left px-4 py-3 border-b border-steel-50 hover:bg-steel-50 transition-colors ${
                selectedDriver?.driverId === d.driverId ? 'bg-navy-50' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-steel-900">{d.driverName}</span>
                  {d.truckNumber && (
                    <span className="ml-2 text-xs text-steel-400">({d.truckNumber})</span>
                  )}
                </div>
                <span className="text-xs text-steel-400">
                  {d.hasLocation === false ? 'No GPS' : formatTime(d.lastUpdate)}
                </span>
              </div>
              <div className="text-sm text-steel-500 mt-0.5">
                #{d.jobNumber} — {d.jobName} → {d.destination}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
