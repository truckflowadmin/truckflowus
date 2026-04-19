'use client';

import { useState } from 'react';
import RotatableImage from '@/components/RotatableImage';

interface DocumentData {
  id: string;
  docType: string;
  label: string | null;
  fileUrl: string;
  updatedAt: string;
}

interface Props {
  driverId: string;
  documents: DocumentData[];
}

const REQUIRED_DOCS = [
  { type: 'LICENSE_FRONT', label: 'License (Front)', icon: '🪪' },
  { type: 'LICENSE_BACK', label: 'License (Back)', icon: '🪪' },
  { type: 'MEDICAL_CERT', label: 'Medical Examiner Certificate', icon: '🏥' },
  { type: 'VOID_CHECK', label: 'Void Check', icon: '💳' },
] as const;

export default function DriverDocuments({ driverId, documents: initial }: Props) {
  const [docs, setDocs] = useState<DocumentData[]>(initial);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const otherDocs = docs.filter((d) => d.docType === 'OTHER');

  function getDoc(docType: string) {
    return docs.find((d) => d.docType === docType);
  }

  async function handleUpload(file: File, docType: string, label?: string) {
    setError(null);
    setUploading(docType);
    try {
      const fd = new FormData();
      fd.append('driverId', driverId);
      fd.append('file', file);
      fd.append('docType', docType);
      if (label) fd.append('label', label);

      const res = await fetch('/api/drivers/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const newDoc: DocumentData = {
        id: data.document.id,
        docType: data.document.docType,
        label: data.document.label,
        fileUrl: data.document.fileUrl,
        updatedAt: new Date().toISOString(),
      };

      if (data.replaced) {
        setDocs((prev) => prev.map((d) => (d.docType === docType && d.docType !== 'OTHER' ? newDoc : d)));
      } else {
        setDocs((prev) => [...prev, newDoc]);
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function handleDelete(docId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/drivers/documents?id=${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }

  function triggerFileSelect(docType: string, label?: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleUpload(file, docType, label);
    };
    input.click();
  }

  const missingCount = REQUIRED_DOCS.filter((r) => !getDoc(r.type)).length;

  return (
    <div className="panel p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">Driver Documents</h2>
        {missingCount > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">
            {missingCount} missing
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
      )}

      {/* Required Documents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {REQUIRED_DOCS.map((req) => {
          const doc = getDoc(req.type);
          const isUploading = uploading === req.type;
          const isExpanded = expanded === req.type;
          return (
            <div key={req.type} className="border border-steel-200 rounded-lg overflow-hidden">
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  doc ? 'bg-green-50 hover:bg-green-100' : 'bg-amber-50 hover:bg-amber-100'
                }`}
                onClick={() => setExpanded(isExpanded ? null : req.type)}
              >
                <span className="text-xl">{req.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-steel-900">{req.label}</div>
                  {doc ? (
                    <div className="text-xs text-green-700">Uploaded {new Date(doc.updatedAt).toLocaleDateString()}</div>
                  ) : (
                    <div className="text-xs text-amber-700">Not uploaded</div>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); triggerFileSelect(req.type); }}
                  disabled={isUploading}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    doc
                      ? 'bg-white border border-steel-300 text-steel-700 hover:bg-steel-50'
                      : 'bg-safety text-diesel hover:bg-safety-dark'
                  }`}
                >
                  {isUploading ? 'Uploading...' : doc ? 'Replace' : 'Upload'}
                </button>
              </div>
              {isExpanded && doc && (
                <div className="p-3 border-t border-steel-200 bg-white">
                  {doc.fileUrl.endsWith('.pdf') ? (
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                      📄 View PDF
                    </a>
                  ) : (
                    <RotatableImage
                      src={doc.fileUrl}
                      alt={req.label}
                      className="w-full max-h-56 object-contain rounded bg-steel-50"
                      linkToFullSize
                    />
                  )}
                </div>
              )}
              {isExpanded && !doc && (
                <div className="p-4 border-t border-steel-200 bg-white">
                  <button
                    onClick={() => triggerFileSelect(req.type)}
                    disabled={isUploading}
                    className="w-full border-2 border-dashed border-steel-300 rounded-lg py-6 text-steel-500 hover:border-safety hover:text-diesel transition-colors text-sm"
                  >
                    {isUploading ? 'Uploading...' : 'Click to upload image or PDF'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Other Documents */}
      <div className="border-t border-steel-200 pt-4">
        <h3 className="text-sm font-semibold text-steel-700 mb-3">Other Documents</h3>

        {otherDocs.length > 0 && (
          <div className="space-y-3 mb-4">
            {otherDocs.map((doc) => (
              <div key={doc.id} className="border border-steel-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3 bg-steel-50">
                  <span className="text-lg">📎</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-steel-900">{doc.label || 'Other Document'}</div>
                    <div className="text-xs text-steel-500">{new Date(doc.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.fileUrl.endsWith('.pdf') ? (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-steel-300 text-steel-700 hover:bg-steel-50">
                        View
                      </a>
                    ) : (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-steel-300 text-steel-700 hover:bg-steel-50">
                        View
                      </a>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {!doc.fileUrl.endsWith('.pdf') && (
                  <div className="p-3 border-t border-steel-100 bg-white">
                    <RotatableImage
                      src={doc.fileUrl}
                      alt={doc.label || 'Document'}
                      className="w-full max-h-40 object-contain rounded bg-steel-50"
                      linkToFullSize
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Other */}
        <div className="flex gap-2">
          <input
            type="text"
            value={otherLabel}
            onChange={(e) => setOtherLabel(e.target.value)}
            placeholder="Document name (e.g. W-9, Insurance)"
            className="flex-1 input"
          />
          <button
            onClick={() => {
              if (!otherLabel.trim()) { setError('Enter a document name first'); return; }
              triggerFileSelect('OTHER', otherLabel.trim());
              setOtherLabel('');
            }}
            disabled={uploading === 'OTHER'}
            className="btn-accent whitespace-nowrap"
          >
            {uploading === 'OTHER' ? 'Uploading...' : '+ Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}
