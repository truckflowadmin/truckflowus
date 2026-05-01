'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

/* ── Types ─────────────────────────────────────────────────────── */
interface LocationPing {
  id: string;
  jobId: string | null;
  jobNumber: number | null;
  jobName: string | null;
  latitude: number;
  longitude: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
}

interface JobOption {
  id: string;
  jobNumber: number;
  name: string;
}

interface TrackingData {
  driver: { id: string; name: string; truckNumber: string | null };
  locations: LocationPing[];
  jobs: JobOption[];
}

/* ── Helpers ───────────────────────────────────────────────────── */
const MS_TO_MPH = 2.237;
const EARTH_RADIUS_MI = 3958.8;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatSpeed(mps: number | null) {
  if (mps == null || mps < 0) return '--';
  return `${Math.round(mps * MS_TO_MPH)} mph`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

/* ── Leaflet loader ────────────────────────────────────────────── */
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

/* ── Alert types ───────────────────────────────────────────────── */
interface Alert {
  type: 'speeding' | 'idle';
  message: string;
  recordedAt: string;
  latitude: number;
  longitude: number;
}

/* ── Component ─────────────────────────────────────────────────── */
export default function DriverTrackingHistory({ driverId }: { driverId: string }) {
  /* Data */
  const [data, setData] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Filters */
  const [dateFrom, setDateFrom] = useState(weekAgoStr());
  const [dateTo, setDateTo] = useState(todayStr());
  const [jobFilter, setJobFilter] = useState('');
  const [speedThreshold, setSpeedThreshold] = useState(70); // mph
  const [idleMinutes, setIdleMinutes] = useState(15);

  /* View state */
  const [activeView, setActiveView] = useState<'map' | 'table'>('map');
  const [sortCol, setSortCol] = useState<'recordedAt' | 'speed'>('recordedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  /* Map refs */
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const [leafletReady, setLeafletReady] = useState(false);

  /* ── Fetch data ──────────────────────────────────────────────── */
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);
      if (jobFilter) params.set('jobId', jobFilter);
      params.set('limit', '5000');

      const res = await fetch(`/api/drivers/${driverId}/tracking?${params}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: TrackingData = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [driverId, dateFrom, dateTo, jobFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── Load Leaflet ────────────────────────────────────────────── */
  useEffect(() => {
    loadLeaflet()
      .then(() => setLeafletReady(true))
      .catch(() => console.warn('[TrackingHistory] Failed to load Leaflet'));
  }, []);

  /* ── Init map ────────────────────────────────────────────────── */
  useEffect(() => {
    if (!leafletReady || !mapRef.current || leafletMapRef.current) return;
    const L = (window as any).L;
    const map = L.map(mapRef.current, {
      center: [26.14, -81.79],
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

  /* ── Computed: alerts ────────────────────────────────────────── */
  const alerts = useMemo<Alert[]>(() => {
    if (!data?.locations.length) return [];
    const result: Alert[] = [];
    const sorted = [...data.locations].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    for (const loc of sorted) {
      if (loc.speed != null) {
        const mph = loc.speed * MS_TO_MPH;
        if (mph >= speedThreshold) {
          result.push({
            type: 'speeding',
            message: `${Math.round(mph)} mph (threshold: ${speedThreshold} mph)`,
            recordedAt: loc.recordedAt,
            latitude: loc.latitude,
            longitude: loc.longitude,
          });
        }
      }
    }

    // Idle detection: consecutive pings at similar location with gap > idleMinutes
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gap = (new Date(curr.recordedAt).getTime() - new Date(prev.recordedAt).getTime()) / 60000;
      if (gap >= idleMinutes) {
        const dist = haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
        if (dist < 0.1) {
          // < 0.1 miles apart → considered idle
          result.push({
            type: 'idle',
            message: `Idle for ${Math.round(gap)} min`,
            recordedAt: prev.recordedAt,
            latitude: prev.latitude,
            longitude: prev.longitude,
          });
        }
      }
    }

    return result.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  }, [data, speedThreshold, idleMinutes]);

  /* ── Computed: stats ─────────────────────────────────────────── */
  const stats = useMemo(() => {
    if (!data?.locations.length) return null;
    const sorted = [...data.locations].sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    let totalDistMi = 0;
    let totalTimeMs = 0;
    let maxSpeed = 0;
    let speedSum = 0;
    let speedCount = 0;

    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      totalDistMi += haversine(prev.latitude, prev.longitude, curr.latitude, curr.longitude);
      totalTimeMs += new Date(curr.recordedAt).getTime() - new Date(prev.recordedAt).getTime();
    }

    for (const loc of sorted) {
      if (loc.speed != null && loc.speed >= 0) {
        const mph = loc.speed * MS_TO_MPH;
        speedSum += mph;
        speedCount++;
        if (mph > maxSpeed) maxSpeed = mph;
      }
    }

    const totalHours = totalTimeMs / 3600000;
    return {
      totalPings: sorted.length,
      distanceMiles: totalDistMi,
      timeOnRoadHours: totalHours,
      avgSpeedMph: speedCount > 0 ? speedSum / speedCount : 0,
      maxSpeedMph: maxSpeed,
      speedingEvents: alerts.filter((a) => a.type === 'speeding').length,
      idleEvents: alerts.filter((a) => a.type === 'idle').length,
    };
  }, [data, alerts]);

  /* ── Draw route on map ───────────────────────────────────────── */
  useEffect(() => {
    if (!leafletMapRef.current || !leafletReady || !data) return;
    const L = (window as any).L;
    const map = leafletMapRef.current;

    // Clear old layers
    layersRef.current.forEach((l: any) => map.removeLayer(l));
    layersRef.current = [];

    const sorted = [...data.locations]
      .filter((l) => !(l.latitude === 0 && l.longitude === 0))
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());

    if (sorted.length === 0) return;

    // Draw polyline route
    const coords: [number, number][] = sorted.map((l) => [l.latitude, l.longitude]);
    const polyline = L.polyline(coords, {
      color: '#1E3A5F',
      weight: 3,
      opacity: 0.8,
    }).addTo(map);
    layersRef.current.push(polyline);

    // Start marker
    const startIcon = L.divIcon({
      className: 'leaflet-tracking-marker',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const startMarker = L.marker(coords[0], { icon: startIcon })
      .bindPopup(`<strong>Start</strong><br/>${formatDate(sorted[0].recordedAt)} ${formatTime(sorted[0].recordedAt)}`)
      .addTo(map);
    layersRef.current.push(startMarker);

    // End marker
    const endIcon = L.divIcon({
      className: 'leaflet-tracking-marker',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    const endMarker = L.marker(coords[coords.length - 1], { icon: endIcon })
      .bindPopup(
        `<strong>End</strong><br/>${formatDate(sorted[sorted.length - 1].recordedAt)} ${formatTime(sorted[sorted.length - 1].recordedAt)}`
      )
      .addTo(map);
    layersRef.current.push(endMarker);

    // Alert markers (speeding)
    for (const alert of alerts.filter((a) => a.type === 'speeding')) {
      const icon = L.divIcon({
        className: 'leaflet-tracking-marker',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:#f59e0b;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;">!</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      const m = L.marker([alert.latitude, alert.longitude], { icon })
        .bindPopup(`<strong>Speeding</strong><br/>${alert.message}<br/>${formatTime(alert.recordedAt)}`)
        .addTo(map);
      layersRef.current.push(m);
    }

    // Fit bounds
    map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
  }, [data, leafletReady, alerts]);

  /* ── Cleanup map ─────────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  /* ── CSV export ──────────────────────────────────────────────── */
  const exportCSV = useCallback(() => {
    if (!data?.locations.length) return;
    const header = 'Date,Time,Latitude,Longitude,Speed (mph),Heading,Accuracy,Job Number,Job Name';
    const rows = [...data.locations]
      .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())
      .map((l) => {
        const d = new Date(l.recordedAt);
        return [
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          l.latitude,
          l.longitude,
          l.speed != null ? Math.round(l.speed * MS_TO_MPH) : '',
          l.heading ?? '',
          l.accuracy != null ? Math.round(l.accuracy) : '',
          l.jobNumber ?? '',
          `"${(l.jobName ?? '').replace(/"/g, '""')}"`,
        ].join(',');
      });

    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tracking-${data.driver.name.replace(/\s+/g, '_')}-${dateFrom}-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, dateFrom, dateTo]);

  /* ── Sorted table data ───────────────────────────────────────── */
  const sortedLocations = useMemo(() => {
    if (!data?.locations) return [];
    return [...data.locations].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'recordedAt') {
        cmp = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
      } else if (sortCol === 'speed') {
        cmp = (a.speed ?? -1) - (b.speed ?? -1);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortCol, sortDir]);

  const toggleSort = (col: 'recordedAt' | 'speed') => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('desc');
    }
  };

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-steel-500 mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-500 mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input text-sm py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-500 mb-1">Job</label>
            <select
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="input text-sm py-1.5"
            >
              <option value="">All Jobs</option>
              {data?.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  #{j.jobNumber} — {j.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-500 mb-1">Speed Alert (mph)</label>
            <input
              type="number"
              min={1}
              value={speedThreshold}
              onChange={(e) => setSpeedThreshold(Number(e.target.value) || 70)}
              className="input text-sm py-1.5 w-20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-steel-500 mb-1">Idle (min)</label>
            <input
              type="number"
              min={1}
              value={idleMinutes}
              onChange={(e) => setIdleMinutes(Number(e.target.value) || 15)}
              className="input text-sm py-1.5 w-20"
            />
          </div>
          <button onClick={exportCSV} className="btn-ghost text-sm py-1.5 ml-auto" disabled={!data?.locations.length}>
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { label: 'Pings', value: stats.totalPings.toLocaleString() },
            { label: 'Distance', value: `${stats.distanceMiles.toFixed(1)} mi` },
            { label: 'Time on Road', value: `${stats.timeOnRoadHours.toFixed(1)} hrs` },
            { label: 'Avg Speed', value: `${Math.round(stats.avgSpeedMph)} mph` },
            { label: 'Max Speed', value: `${Math.round(stats.maxSpeedMph)} mph` },
            {
              label: 'Speeding',
              value: stats.speedingEvents.toString(),
              warn: stats.speedingEvents > 0,
            },
            {
              label: 'Idle Events',
              value: stats.idleEvents.toString(),
              warn: stats.idleEvents > 0,
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`panel p-3 text-center ${(s as any).warn ? 'ring-1 ring-amber-400' : ''}`}
            >
              <div className={`text-xl font-bold ${(s as any).warn ? 'text-amber-600' : 'text-steel-900'}`}>
                {s.value}
              </div>
              <div className="text-xs text-steel-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* View toggle */}
      <div className="flex items-center gap-1 border-b border-steel-200">
        {(['map', 'table'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setActiveView(v)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px capitalize ${
              activeView === v
                ? 'border-safety text-steel-900'
                : 'border-transparent text-steel-500 hover:text-steel-700'
            }`}
          >
            {v === 'map' ? '🗺️ Map' : '📋 Table'}
          </button>
        ))}
        {data?.driver && (
          <span className="ml-auto text-sm text-steel-500 pr-2">
            {data.driver.name}
            {data.driver.truckNumber ? ` · ${data.driver.truckNumber}` : ''}
          </span>
        )}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="panel p-12 text-center text-steel-400">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-steel-300 border-t-safety rounded-full mb-2" />
          <p>Loading tracking data…</p>
        </div>
      )}
      {error && (
        <div className="panel p-6 text-center text-red-600">
          <p>Error: {error}</p>
          <button onClick={fetchData} className="btn-ghost text-sm mt-2">
            Retry
          </button>
        </div>
      )}

      {/* Map view */}
      {!loading && !error && (
        <div style={{ display: activeView === 'map' ? 'block' : 'none' }}>
          <div className="panel overflow-hidden">
            <div ref={mapRef} className="w-full h-[450px] bg-steel-100" style={{ zIndex: 0 }} />
            {data?.locations.length === 0 && (
              <div className="p-8 text-center text-steel-400">
                <div className="text-3xl mb-2">📍</div>
                <p>No tracking data for the selected period.</p>
              </div>
            )}
          </div>

          {/* Map legend */}
          {data && data.locations.length > 0 && (
            <div className="flex items-center gap-4 mt-2 text-xs text-steel-500 px-1">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 border border-white" /> Start
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-white" /> End
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-amber-500 border border-white" /> Speeding
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-4 h-0.5 bg-[#1E3A5F]"
                  style={{ marginTop: 1 }}
                />{' '}
                Route
              </span>
            </div>
          )}
        </div>
      )}

      {/* Table view */}
      {!loading && !error && activeView === 'table' && (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-steel-200 text-left text-steel-500">
                <th
                  className="px-3 py-2 cursor-pointer select-none hover:text-steel-800"
                  onClick={() => toggleSort('recordedAt')}
                >
                  Date / Time {sortCol === 'recordedAt' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-2">Job</th>
                <th className="px-3 py-2">Lat</th>
                <th className="px-3 py-2">Lon</th>
                <th
                  className="px-3 py-2 cursor-pointer select-none hover:text-steel-800"
                  onClick={() => toggleSort('speed')}
                >
                  Speed {sortCol === 'speed' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th className="px-3 py-2">Heading</th>
                <th className="px-3 py-2">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {sortedLocations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-steel-400">
                    No tracking data found.
                  </td>
                </tr>
              )}
              {sortedLocations.map((l) => {
                const mph = l.speed != null ? l.speed * MS_TO_MPH : null;
                const isSpeeding = mph != null && mph >= speedThreshold;
                return (
                  <tr
                    key={l.id}
                    className={`border-b border-steel-50 hover:bg-steel-50 ${isSpeeding ? 'bg-amber-50' : ''}`}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDate(l.recordedAt)}{' '}
                      <span className="text-steel-400">{formatTime(l.recordedAt)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {l.jobNumber ? `#${l.jobNumber}` : '--'}
                      {l.jobName ? (
                        <span className="text-steel-400 ml-1">— {l.jobName}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{l.latitude.toFixed(5)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.longitude.toFixed(5)}</td>
                    <td className={`px-3 py-2 ${isSpeeding ? 'text-amber-700 font-semibold' : ''}`}>
                      {formatSpeed(l.speed)}
                    </td>
                    <td className="px-3 py-2">{l.heading != null ? `${Math.round(l.heading)}°` : '--'}</td>
                    <td className="px-3 py-2">
                      {l.accuracy != null ? `±${Math.round(l.accuracy)}m` : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Alerts section */}
      {!loading && !error && alerts.length > 0 && (
        <div className="panel">
          <div className="px-4 py-3 border-b border-steel-100">
            <h3 className="text-sm font-bold text-steel-800">
              Alerts ({alerts.length})
            </h3>
          </div>
          <div className="divide-y divide-steel-50 max-h-64 overflow-y-auto">
            {alerts.map((a, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-steel-50 cursor-pointer"
                onClick={() => {
                  if (leafletMapRef.current) {
                    leafletMapRef.current.setView([a.latitude, a.longitude], 15);
                    setActiveView('map');
                  }
                }}
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                    a.type === 'speeding' ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                />
                <span className="flex-1">
                  <span className="font-medium text-steel-800 capitalize">{a.type}</span>
                  <span className="text-steel-500 ml-2">{a.message}</span>
                </span>
                <span className="text-xs text-steel-400 whitespace-nowrap">
                  {formatDate(a.recordedAt)} {formatTime(a.recordedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
