'use client';

import { useState, useRef, useCallback } from 'react';
import { bulkCreateJobTicketsAction } from '../scanActions';

interface JobPrefill {
  id: string;
  hauledFrom: string;
  hauledTo: string;
  material: string | null;
  truckNumber: string | null;
  quantityType: string;
  ratePerUnit: string | null;
  date: string | null;
  customerId: string | null;
  driverId: string | null;
  brokerId: string | null;
  customerName: string | null;
  driverName: string | null;
  brokerName: string | null;
}

interface ScannedItem {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'scanned' | 'error';
  photoUrl: string | null;
  extracted: Record<string, string | null>;
  // Editable fields (override from scan)
  quantity: string;
  quantityType: string;
  ticketRef: string;
  date: string;
  // Scanned raw data
  scannedTons: string | null;
  scannedYards: string | null;
  scannedTicketNumber: string | null;
  scannedDate: string | null;
  scannedRawText: string | null;
  errorMsg?: string;
}

let nextId = 0;

export default function JobBulkScanForm({ job }: { job: JobPrefill }) {
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateItem = useCallback((id: string, patch: Partial<ScannedItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setError(null);
    setSuccess(null);

    const newItems: ScannedItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const id = `scan-${nextId++}`;
      const preview = URL.createObjectURL(file);
      newItems.push({
        id, file, preview,
        status: 'uploading',
        photoUrl: null,
        extracted: {},
        quantity: '1',
        quantityType: job.quantityType || 'LOADS',
        ticketRef: '',
        date: job.date ? job.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
        scannedTons: null,
        scannedYards: null,
        scannedTicketNumber: null,
        scannedDate: null,
        scannedRawText: null,
      });
    }

    setItems(prev => [...prev, ...newItems]);

    // Upload + scan each
    for (const item of newItems) {
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        const res = await fetch('/api/tickets/scan?jobContext=true', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) {
          updateItem(item.id, { status: 'error', errorMsg: data.error || 'Scan failed' });
          continue;
        }

        const ext = data.extracted || {};
        // Auto-fill quantity from scan
        let qty = '1';
        let qType = job.quantityType || 'LOADS';
        if (ext.tons && parseFloat(ext.tons) > 0) {
          qty = ext.tons;
          qType = 'TONS';
        } else if (ext.yards && parseFloat(ext.yards) > 0) {
          qty = ext.yards;
          qType = 'YARDS';
        }

        updateItem(item.id, {
          status: 'scanned',
          photoUrl: data.photoUrl,
          extracted: ext,
          quantity: qty,
          quantityType: qType,
          ticketRef: ext.ticketNumber || '',
          date: job.date ? job.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
          scannedTons: ext.tons || null,
          scannedYards: ext.yards || null,
          scannedTicketNumber: ext.ticketNumber || null,
          scannedDate: null,
          scannedRawText: ext.rawText || null,
        });
      } catch (err: any) {
        updateItem(item.id, { status: 'error', errorMsg: err.message || 'Upload failed' });
      }
    }
  }

  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id));
  }

  const readyItems = items.filter(it => it.status === 'scanned');
  const uploadingCount = items.filter(it => it.status === 'uploading').length;

  async function handleCreate() {
    if (readyItems.length === 0) return;
    setCreating(true);
    setError(null);
    setSuccess(null);

    const payload = readyItems.map(it => ({
      jobId: job.id,
      photoUrl: it.photoUrl || '',
      quantity: parseFloat(it.quantity) || 1,
      quantityType: it.quantityType,
      ticketRef: it.ticketRef || null,
      date: it.date || null,
      hauledFrom: job.hauledFrom,
      hauledTo: job.hauledTo,
      material: job.material,
      customerId: job.customerId,
      driverId: job.driverId,
      brokerId: job.brokerId,
      ratePerUnit: job.ratePerUnit ? parseFloat(job.ratePerUnit) : null,
      truckNumber: job.truckNumber,
      scannedTons: it.scannedTons,
      scannedYards: it.scannedYards,
      scannedTicketNumber: it.scannedTicketNumber,
      scannedDate: it.scannedDate,
      scannedRawText: it.scannedRawText,
    }));

    try {
      const result = await bulkCreateJobTicketsAction(JSON.stringify(payload));
      setSuccess(`Created ${result.created} ticket(s): #${result.ticketNumbers.join(', #')}`);
      setItems([]);
      // Reload to update job progress
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to create tickets');
    } finally {
      setCreating(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  return (
    <div className="panel p-5">
      <h3 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-3">
        Bulk Scan Tickets
      </h3>

      {/* Job prefill summary */}
      <div className="flex flex-wrap gap-2 mb-4 text-xs">
        <span className="px-2 py-1 bg-steel-100 rounded text-steel-600">
          From: <span className="font-medium text-steel-800">{job.hauledFrom}</span>
        </span>
        <span className="px-2 py-1 bg-steel-100 rounded text-steel-600">
          To: <span className="font-medium text-steel-800">{job.hauledTo}</span>
        </span>
        {job.material && (
          <span className="px-2 py-1 bg-steel-100 rounded text-steel-600">
            Material: <span className="font-medium text-steel-800">{job.material}</span>
          </span>
        )}
        {job.customerName && (
          <span className="px-2 py-1 bg-blue-50 rounded text-blue-700">
            Customer: {job.customerName}
          </span>
        )}
        {job.brokerName && (
          <span className="px-2 py-1 bg-purple-50 rounded text-purple-700">
            Broker: {job.brokerName}
          </span>
        )}
        {job.driverName && (
          <span className="px-2 py-1 bg-green-50 rounded text-green-700">
            Driver: {job.driverName}
          </span>
        )}
        {job.date && (
          <span className="px-2 py-1 bg-steel-100 rounded text-steel-600">
            Date: <span className="font-medium text-steel-800">{new Date(job.date).toLocaleDateString()}</span>
          </span>
        )}
        {job.ratePerUnit && (
          <span className="px-2 py-1 bg-steel-100 rounded text-steel-600">
            Rate: ${parseFloat(job.ratePerUnit).toFixed(2)}
          </span>
        )}
      </div>

      {/* Error / Success banners */}
      {error && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <span className="text-red-500 text-lg leading-none mt-0.5">&#9888;</span>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <span className="text-green-500 text-lg leading-none mt-0.5">&#10003;</span>
          <p className="text-sm text-green-700 flex-1">{success}</p>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-steel-300 rounded-lg p-6 text-center cursor-pointer hover:border-steel-400 hover:bg-steel-50 transition-colors mb-4"
      >
        <p className="text-sm text-steel-600 mb-1">Drop ticket images here or click to browse</p>
        <p className="text-xs text-steel-400">AI will scan for quantity &amp; ticket # only — all other fields prefilled from job</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
        />
      </div>

      {/* Uploading indicator */}
      {uploadingCount > 0 && (
        <div className="text-sm text-steel-500 mb-3">
          Scanning {uploadingCount} image{uploadingCount !== 1 ? 's' : ''}...
        </div>
      )}

      {/* Scanned items table */}
      {items.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-steel-200 mb-4">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
              <tr>
                <th className="text-left px-3 py-2 w-16">Photo</th>
                <th className="text-left px-3 py-2">Ticket #</th>
                <th className="text-right px-3 py-2">Quantity</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={`border-b border-steel-100 ${it.status === 'error' ? 'bg-red-50/50' : ''}`}>
                  <td className="px-3 py-2">
                    <img src={it.preview} alt="" className="w-12 h-12 object-cover rounded border border-steel-200" />
                  </td>
                  <td className="px-3 py-2">
                    {it.status === 'scanned' ? (
                      <input
                        type="text"
                        value={it.ticketRef}
                        onChange={(e) => updateItem(it.id, { ticketRef: e.target.value })}
                        placeholder="Ticket ref"
                        className="input text-sm py-1 w-28"
                      />
                    ) : (
                      <span className="text-steel-400 text-xs">{it.status === 'uploading' ? 'Scanning...' : '—'}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {it.status === 'scanned' ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, { quantity: e.target.value })}
                        className="input text-sm py-1 w-20 text-right"
                      />
                    ) : (
                      <span className="text-steel-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {it.status === 'scanned' ? (
                      <select
                        value={it.quantityType}
                        onChange={(e) => updateItem(it.id, { quantityType: e.target.value })}
                        className="input text-xs py-1 w-20"
                      >
                        <option value="LOADS">Loads</option>
                        <option value="TONS">Tons</option>
                        <option value="YARDS">Yards</option>
                      </select>
                    ) : (
                      <span className="text-steel-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {it.status === 'uploading' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Scanning...</span>
                    )}
                    {it.status === 'scanned' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700">Ready</span>
                    )}
                    {it.status === 'error' && (
                      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700" title={it.errorMsg}>
                        Error
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => removeItem(it.id)}
                      className="text-red-400 hover:text-red-600 text-sm">&times;</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create button */}
      {readyItems.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="btn-accent text-sm py-2 px-4 disabled:opacity-50"
          >
            {creating ? 'Creating...' : `Create ${readyItems.length} Ticket${readyItems.length !== 1 ? 's' : ''}`}
          </button>
          <button
            type="button"
            onClick={() => { setItems([]); setError(null); setSuccess(null); }}
            className="btn-ghost text-sm py-2 px-4"
          >
            Clear All
          </button>
          <span className="text-xs text-steel-500">
            All tickets will be linked to this job with prefilled info
          </span>
        </div>
      )}
    </div>
  );
}
