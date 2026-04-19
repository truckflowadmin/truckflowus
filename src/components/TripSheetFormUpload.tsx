'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  brokerId: string;
  currentFile: string | null;
}

export default function TripSheetFormUpload({ brokerId, currentFile }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheBust, setCacheBust] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      return;
    }

    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheet-form`, {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setCacheBust(Date.now());
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleRemove() {
    if (!confirm('Remove the trip sheet form template?')) return;
    setUploading(true);
    setError(null);

    try {
      const res = await fetch(`/api/brokers/${brokerId}/trip-sheet-form`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to remove');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="label-sa">Trip Sheet Form (PDF Template)</label>

      {currentFile ? (
        <div className="flex items-center gap-3 mt-1">
          <a
            href={`/api/uploads/trip-sheet-forms/${currentFile}?v=${cacheBust}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-purple-400 hover:text-purple-200 underline"
          >
            View current form
          </a>
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploading}
            className="text-xs text-red-400 hover:text-red-300"
          >
            {uploading ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        <p className="text-xs text-purple-400 mt-1">No form uploaded. Upload a PDF to use as the trip sheet template.</p>
      )}

      <form onSubmit={handleUpload} className="flex items-center gap-3 mt-2">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="text-sm text-purple-200 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-purple-700 file:text-white hover:file:bg-purple-600 file:cursor-pointer"
        />
        <button
          type="submit"
          disabled={uploading}
          className="btn-purple text-sm"
        >
          {uploading ? 'Uploading…' : currentFile ? 'Replace' : 'Upload'}
        </button>
      </form>

      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
