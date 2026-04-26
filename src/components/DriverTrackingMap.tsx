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
}

/**
 * Live map showing active driver locations.
 * Uses Google Maps JavaScript API.
 * Polls /api/tracking every 15 seconds.
 */
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
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
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

  // Initialize Google Map
  useEffect(() => {
    if (!mapRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      // Fallback: show a list view instead of map
      return;
    }

    const g = (window as any).google;
    // Load Google Maps script if not already loaded
    if (!g?.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else {
      initMap();
    }

    function initMap() {
      if (!mapRef.current) return;
      const gm = (window as any).google.maps;
      googleMapRef.current = new gm.Map(mapRef.current, {
        center: { lat: 26.14, lng: -81.79 }, // SW Florida default
        zoom: 10,
        mapTypeControl: false,
        streetViewControl: false,
      });
    }
  }, []);

  // Update markers when drivers change
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Clear old markers
    markersRef.current.forEach((m: any) => m.setMap(null));
    markersRef.current = [];

    if (drivers.length === 0) return;

    const gm = (window as any).google?.maps;
    if (!gm) return;

    const bounds = new gm.LatLngBounds();

    drivers.forEach((driver) => {
      const pos = { lat: driver.latitude, lng: driver.longitude };
      bounds.extend(pos);

      const marker = new gm.Marker({
        position: pos,
        map: googleMapRef.current!,
        title: driver.driverName,
        label: {
          text: driver.driverName.split(' ')[0][0] + (driver.driverName.split(' ')[1]?.[0] || ''),
          color: '#FFFFFF',
          fontWeight: '700',
          fontSize: '11px',
        },
        icon: {
          path: gm.SymbolPath.CIRCLE,
          scale: 16,
          fillColor: '#FF8C00',
          fillOpacity: 1,
          strokeColor: '#1E3A5F',
          strokeWeight: 2,
        },
      });

      marker.addListener('click', () => setSelectedDriver(driver));
      markersRef.current.push(marker);
    });

    if (drivers.length > 1) {
      googleMapRef.current.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    } else {
      googleMapRef.current.setCenter({ lat: drivers[0].latitude, lng: drivers[0].longitude });
      googleMapRef.current.setZoom(14);
    }
  }, [drivers]);

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
      <div ref={mapRef} className="w-full h-[400px] bg-steel-100" />

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
                if (googleMapRef.current) {
                  googleMapRef.current.panTo({ lat: d.latitude, lng: d.longitude });
                  googleMapRef.current.setZoom(14);
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
                <span className="text-xs text-steel-400">{formatTime(d.lastUpdate)}</span>
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
