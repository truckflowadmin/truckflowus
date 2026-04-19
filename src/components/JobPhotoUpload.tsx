'use client';

import { useState, useRef } from 'react';
import RotatableImage from '@/components/RotatableImage';

interface Props {
  jobId: string;
  currentPhotoUrl: string | null;
}

export default function JobPhotoUpload({ jobId, currentPhotoUrl }: Props) {
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('jobId', jobId);
      form.append('file', file);
      const res = await fetch('/api/jobs/photo', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      setPhotoUrl(json.photoUrl);
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

  async function handleRemove() {
    setError(null);
    try {
      const res = await fetch(`/api/jobs/photo?jobId=${jobId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      setPhotoUrl(null);
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Job Photo</h2>
        <div className="flex items-center gap-2">
          {photoUrl && (
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="btn-ghost text-xs"
          >
            {uploading ? 'Uploading...' : photoUrl ? 'Replace Photo' : 'Upload Photo'}
          </button>
        </div>
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

      <div
        className={`relative rounded-lg border-2 border-dashed transition-colors cursor-pointer ${
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
              Uploading...
            </div>
          </div>
        )}

        {photoUrl ? (
          <div onClick={(e) => e.stopPropagation()}>
            <RotatableImage
              src={photoUrl}
              alt="Job photo"
              className="rounded-lg border border-steel-200 max-h-64 object-contain w-full bg-steel-50"
              linkToFullSize
            />
            <div className="text-xs text-steel-500 mt-1">
              Click image to view full size · Hover to rotate · Drop or click to replace
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-sm text-steel-500">
            <div className="text-2xl mb-2">📷</div>
            <p>Drag &amp; drop a photo here, or click to browse</p>
            <p className="text-xs mt-1">Work order, dispatch sheet, or job photo — JPG, PNG, or WebP</p>
          </div>
        )}
      </div>
    </section>
  );
}
