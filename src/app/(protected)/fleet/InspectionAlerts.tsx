'use client';

import { useState, useEffect } from 'react';

interface InspectionAlert {
  truckId: string;
  truckNumber: string;
  inspectionExpiry: string;
  expired: boolean;
}

export default function InspectionAlerts() {
  const [alerts, setAlerts] = useState<InspectionAlert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/inspection-alerts')
      .then((r) => r.json())
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => {});
  }, []);

  async function handleAcknowledge(truckId: string) {
    setAcknowledging(truckId);
    try {
      await fetch('/api/fleet/inspection-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId }),
      });
      setDismissed((prev) => new Set([...prev, truckId]));
    } catch {
      // silently fail
    } finally {
      setAcknowledging(null);
    }
  }

  const visible = alerts.filter((a) => !dismissed.has(a.truckId));
  if (visible.length === 0) return null;

  function daysUntil(dateStr: string): number {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div className="space-y-2 mb-6">
      {visible.map((alert) => {
        const days = daysUntil(alert.inspectionExpiry);
        const isExpired = alert.expired;
        return (
          <div
            key={alert.truckId}
            className={`flex items-center justify-between gap-4 px-4 py-3 rounded-lg border ${
              isExpired
                ? 'bg-red-50 border-red-300 text-red-800'
                : 'bg-amber-50 border-amber-300 text-amber-800'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-lg">{isExpired ? '🚨' : '🔍'}</span>
              <div className="min-w-0">
                <div className="font-semibold text-sm">
                  Truck {alert.truckNumber} — Inspection {isExpired ? 'Expired' : 'Expiring Soon'}
                </div>
                <div className="text-xs mt-0.5">
                  {isExpired
                    ? `Expired ${new Date(alert.inspectionExpiry).toLocaleDateString()}`
                    : `Expires in ${days} day${days === 1 ? '' : 's'} (${new Date(alert.inspectionExpiry).toLocaleDateString()})`}
                </div>
              </div>
            </div>
            <button
              onClick={() => handleAcknowledge(alert.truckId)}
              disabled={acknowledging === alert.truckId}
              className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                isExpired
                  ? 'bg-red-200 hover:bg-red-300 text-red-900'
                  : 'bg-amber-200 hover:bg-amber-300 text-amber-900'
              } disabled:opacity-50`}
            >
              {acknowledging === alert.truckId ? 'Done' : 'Acknowledge'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
