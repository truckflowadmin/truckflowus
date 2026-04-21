'use client';

import { useState, useRef } from 'react';

interface Props {
  currentLogoUrl: string | null;
}

export default function CompanyLogoUpload({ currentLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/company/logo', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Upload failed');
      } else {
        setLogoUrl(data.url);
        setSuccess('Logo uploaded successfully!');
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch {
      setError('Upload failed. Please try again.');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleRemove() {
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/company/logo', { method: 'DELETE' });
      if (res.ok) {
        setLogoUrl(null);
        setSuccess('Logo removed.');
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch {
      setError('Failed to remove logo.');
    }
  }

  return (
    <div className="space-y-3">
      <label className="label">Company Logo</label>
      <p className="text-xs text-steel-500">Displayed on printed checks (top center). PNG or JPG, max 2MB.</p>

      {logoUrl && (
        <div className="flex items-center gap-4">
          <img
            src={logoUrl}
            alt="Company logo"
            className="h-12 max-w-[180px] object-contain border border-steel-200 rounded p-1 bg-white"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="text-xs text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </div>
      )}

      <div>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleUpload}
          className="text-sm"
          disabled={uploading}
        />
        {uploading && <span className="text-xs text-steel-500 ml-2">Uploading...</span>}
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
      {success && <p className="text-sm text-green-700 bg-green-50 rounded px-3 py-2">{success}</p>}
    </div>
  );
}
