'use client';

import { useState, useRef } from 'react';
import RotatableImage from '@/components/RotatableImage';

interface ExtractedData {
  tons: string | null;
  yards: string | null;
  ticketNumber: string | null;
  date: string | null;
}

/* We only surface the ticket number for corrections — tons/yards/date
   are still captured by AI but the dispatcher only needs to verify the
   physical ticket number when reviewing photos. */

interface Props {
  ticketId: string;
  currentPhotoUrl: string | null;
  currentExtracted: ExtractedData;
  scannedAt: string | null;
}

export default function TicketPhotoUpload({ ticketId, currentPhotoUrl, currentExtracted, scannedAt }: Props) {
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl);
  const [extracted, setExtracted] = useState<ExtractedData>(currentExtracted);
  const [savedExtracted, setSavedExtracted] = useState<ExtractedData>(currentExtracted);
  const [lastScannedAt, setLastScannedAt] = useState(scannedAt);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('ticketId', ticketId);
      form.append('file', file);
      const res = await fetch('/api/tickets/photo', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setPhotoUrl(json.photoUrl);
      setExtracted(json.extracted);
      setSavedExtracted(json.extracted);
      setLastScannedAt(new Date().toISOString());
      setEditing(false);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }

  async function handleSaveCorrections() {
    setError(null);
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/tickets/photo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId,
          scannedTons: extracted.tons || null,
          scannedYards: extracted.yards || null,
          scannedTicketNumber: extracted.ticketNumber || null,
          scannedDate: extracted.date || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setSavedExtracted({ ...extracted });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setExtracted({ ...savedExtracted });
    setEditing(false);
  }

  const hasExtracted = extracted.tons || extracted.yards || extracted.ticketNumber || extracted.date;
  const hasChanges = JSON.stringify(extracted) !== JSON.stringify(savedExtracted);

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Driver Ticket Photo</h2>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="btn-ghost text-xs"
        >
          {uploading ? 'Uploading…' : photoUrl ? 'Replace Photo' : 'Upload Photo'}
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={onFileChange}
      />

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Photo display / drop zone */}
        <div
          className={`sm:col-span-2 relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
            dragOver
              ? 'border-safety-dark bg-safety-light/20'
              : photoUrl
                ? 'border-transparent'
                : 'border-steel-300 bg-steel-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
              <div className="flex items-center gap-2 text-sm text-steel-600">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Uploading &amp; extracting data…
              </div>
            </div>
          )}

          {photoUrl ? (
            <div onClick={(e) => e.stopPropagation()}>
              <RotatableImage
                src={photoUrl}
                alt="Ticket photo"
                className="rounded-lg border border-steel-200 max-h-64 object-contain w-full bg-steel-50"
                linkToFullSize
              />
              <div className="text-xs text-steel-500 mt-1">
                Click image to view full size · Hover to rotate · Drop or click to replace
                {lastScannedAt && (
                  <>
                    {' '}· Scanned{' '}
                    {new Date(lastScannedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-steel-500">
              <div className="text-2xl mb-2">📷</div>
              <p>Drag &amp; drop a ticket photo here, or click to browse</p>
              <p className="text-xs mt-1">JPG, PNG, or WebP</p>
            </div>
          )}
        </div>

        {/* AI-Extracted Data — editable */}
        {(hasExtracted || photoUrl) && (
          <div className="sm:col-span-2 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-green-800 uppercase tracking-wider">
                AI-Extracted Data
              </div>
              {!editing && hasExtracted && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-green-700 hover:text-green-900 hover:underline"
                >
                  Edit
                </button>
              )}
              {saveSuccess && (
                <span className="text-xs text-green-700 font-medium">Saved</span>
              )}
            </div>

            {editing ? (
              <div className="space-y-3">
                <div className="max-w-xs">
                  <label className="text-xs text-steel-500 block mb-1">Physical Ticket #</label>
                  <input
                    type="text"
                    value={extracted.ticketNumber ?? ''}
                    onChange={(e) => setExtracted((p) => ({ ...p, ticketNumber: e.target.value || null }))}
                    className="input text-sm w-full"
                    placeholder="e.g. 12345"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving || !hasChanges}
                    onClick={handleSaveCorrections}
                    className="btn-accent text-xs px-3 py-1.5 disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="btn-ghost text-xs px-3 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : hasExtracted ? (
              <dl className="text-sm">
                <div>
                  <dt className="text-xs text-steel-500">Physical Ticket #</dt>
                  <dd className="font-medium">{extracted.ticketNumber || <span className="text-steel-400 italic">Not detected</span>}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-xs text-steel-500 italic">No data extracted yet. Upload a photo to scan.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
