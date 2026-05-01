'use client';

import { useState } from 'react';
import DriverTrackingHistory from '@/components/DriverTrackingHistory';

interface DriverOption {
  id: string;
  name: string;
  truckNumber: string | null;
  active: boolean;
}

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

      {/* Tracking history */}
      {selectedDriverId ? (
        <DriverTrackingHistory key={selectedDriverId} driverId={selectedDriverId} />
      ) : (
        <div className="panel p-12 text-center text-steel-400">
          <div className="text-3xl mb-2">📍</div>
          <p>Select a driver above to view their tracking history.</p>
        </div>
      )}
    </div>
  );
}
