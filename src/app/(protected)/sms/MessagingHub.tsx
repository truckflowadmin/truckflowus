'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SmsEntry {
  id: string; direction: string; phone: string; message: string;
  driverName: string | null; brokerName: string | null;
  success: boolean; error: string | null; createdAt: string;
}
interface FaxEntry {
  id: string; direction: string; faxNumber: string; pages: number | null;
  mediaUrl: string | null; status: string; driverName: string | null;
  brokerName: string | null; error: string | null; createdAt: string;
}
interface Contact { id: string; name: string; phone: string | null; }

interface Props {
  tab: string; page: number; totalPages: number; dir: string; search: string;
  smsLogs: SmsEntry[]; faxLogs: FaxEntry[];
  drivers: Contact[]; brokers: Contact[];
  stats: { incoming: number; outgoing: number; fax: number };
}

const TABS = [
  { key: 'all', label: 'All Messages', icon: '📋' },
  { key: 'incoming', label: 'Incoming', icon: '📥' },
  { key: 'outgoing', label: 'Outgoing', icon: '📤' },
  { key: 'fax', label: 'Fax Log', icon: '📠' },
  { key: 'send-sms', label: 'Send SMS', icon: '✉️' },
  { key: 'send-fax', label: 'Send Fax', icon: '📄' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function MessagingHub({ tab, page, totalPages, dir, search, smsLogs, faxLogs, drivers, brokers, stats }: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Send SMS form state
  const [smsRecipientType, setSmsRecipientType] = useState<'driver' | 'broker' | 'custom'>('driver');
  const [smsRecipientId, setSmsRecipientId] = useState('');
  const [smsCustomPhone, setSmsCustomPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

  // Send Fax form state
  const [faxNumber, setFaxNumber] = useState('');
  const [faxFile, setFaxFile] = useState<File | null>(null);
  const [faxUploading, setFaxUploading] = useState(false);
  const [faxDragOver, setFaxDragOver] = useState(false);

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    p.set('tab', overrides.tab ?? tab);
    if (overrides.page ?? (page > 1 ? String(page) : '')) p.set('page', overrides.page ?? String(page));
    if (overrides.search ?? search) p.set('search', overrides.search ?? search);
    if (overrides.dir ?? dir) p.set('dir', overrides.dir ?? dir);
    return '/sms?' + p.toString();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(buildUrl({ search: searchInput, page: '1' }));
  };

  const handleSendSms = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendResult(null);
    let phone = smsCustomPhone;
    let driverId: string | undefined;
    let brokerId: string | undefined;

    if (smsRecipientType === 'driver' && smsRecipientId) {
      const d = drivers.find(x => x.id === smsRecipientId);
      phone = d?.phone || '';
      driverId = smsRecipientId;
    } else if (smsRecipientType === 'broker' && smsRecipientId) {
      const b = brokers.find(x => x.id === smsRecipientId);
      phone = b?.phone || '';
      brokerId = smsRecipientId;
    }

    if (!phone || !smsMessage) {
      setSendResult({ ok: false, msg: 'Phone number and message are required' });
      setSending(false);
      return;
    }

    try {
      const res = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message: smsMessage, driverId, brokerId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ ok: true, msg: 'SMS sent successfully!' });
        setSmsMessage('');
        setSmsCustomPhone('');
      } else {
        setSendResult({ ok: false, msg: data.error || 'Failed to send' });
      }
    } catch {
      setSendResult({ ok: false, msg: 'Network error' });
    }
    setSending(false);
  };

  const handleFaxFileSelect = (file: File | null) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/tiff', 'image/png', 'image/jpeg'];
    if (!allowed.includes(file.type)) {
      setSendResult({ ok: false, msg: 'Invalid file type. Allowed: PDF, TIFF, PNG, JPEG.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSendResult({ ok: false, msg: 'File too large. Maximum size is 10 MB.' });
      return;
    }
    setFaxFile(file);
    setSendResult(null);
  };

  const handleSendFax = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendResult(null);

    if (!faxNumber || !faxFile) {
      setSendResult({ ok: false, msg: 'Fax number and a document are required.' });
      setSending(false);
      return;
    }

    try {
      // Step 1: Upload the file
      setFaxUploading(true);
      const formData = new FormData();
      formData.append('file', faxFile);
      const uploadRes = await fetch('/api/fax/upload', { method: 'POST', body: formData });
      const uploadData = await uploadRes.json();
      setFaxUploading(false);

      if (!uploadRes.ok) {
        setSendResult({ ok: false, msg: uploadData.error || 'File upload failed.' });
        setSending(false);
        return;
      }

      // Step 2: Send the fax with the uploaded URL
      const res = await fetch('/api/fax/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faxNumber, mediaUrl: uploadData.url }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ ok: true, msg: 'Fax queued successfully!' });
        setFaxNumber('');
        setFaxFile(null);
      } else {
        setSendResult({ ok: false, msg: data.error || 'Failed to send fax' });
      }
    } catch {
      setFaxUploading(false);
      setSendResult({ ok: false, msg: 'Network error' });
    }
    setSending(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Communications</div>
        <h1 className="text-3xl font-bold tracking-tight">SMS &amp; Fax</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold">{stats.incoming + stats.outgoing}</div>
          <div className="text-xs text-steel-500 uppercase">Total SMS</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.incoming}</div>
          <div className="text-xs text-steel-500 uppercase">Incoming</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.outgoing}</div>
          <div className="text-xs text-steel-500 uppercase">Outgoing</div>
        </div>
        <div className="panel p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{stats.fax}</div>
          <div className="text-xs text-steel-500 uppercase">Faxes</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-4 border-b border-steel-200 pb-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={buildUrl({ tab: t.key, page: '1' })}
            className={`px-3 py-2 rounded-t text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-white border border-b-0 border-steel-200 text-steel-900'
                : 'text-steel-500 hover:text-steel-700 hover:bg-steel-50'
            }`}
          >
            <span className="mr-1">{t.icon}</span> {t.label}
          </Link>
        ))}
      </div>

      {/* Search bar for log tabs */}
      {['all', 'incoming', 'outgoing', 'fax'].includes(tab) && (
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by phone number or message..."
            className="flex-1 px-3 py-2 border border-steel-300 rounded text-sm"
          />
          <button type="submit" className="px-4 py-2 bg-diesel text-white rounded text-sm font-medium hover:bg-steel-800">
            Search
          </button>
          {search && (
            <Link href={buildUrl({ search: '', page: '1' })} className="px-4 py-2 border border-steel-300 rounded text-sm hover:bg-steel-50">
              Clear
            </Link>
          )}
        </form>
      )}

      {/* SMS Log Tables */}
      {['all', 'incoming', 'outgoing', 'sms'].includes(tab) && (
        <div className="panel overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-steel-200 bg-steel-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-steel-700">SMS Messages</h2>
            <span className="text-xs text-steel-500">{smsLogs.length} shown</span>
          </div>
          {smsLogs.length === 0 ? (
            <div className="p-10 text-center text-steel-500">No SMS messages found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                  <tr>
                    <th className="text-left px-4 py-2">Time</th>
                    <th className="text-left px-4 py-2">Direction</th>
                    <th className="text-left px-4 py-2">Contact</th>
                    <th className="text-left px-4 py-2">Phone</th>
                    <th className="text-left px-4 py-2">Message</th>
                    <th className="text-left px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {smsLogs.map((l) => (
                    <tr key={l.id} className="border-b border-steel-100 align-top hover:bg-steel-50">
                      <td className="px-4 py-3 text-xs text-steel-500 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          l.direction === 'OUTBOUND'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {l.direction === 'OUTBOUND' ? '↑ OUT' : '↓ IN'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {l.driverName || l.brokerName || <span className="text-steel-400">Unknown</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{l.phone}</td>
                      <td className="px-4 py-3 max-w-sm">
                        <pre className="whitespace-pre-wrap text-xs leading-relaxed">{l.message}</pre>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {l.success ? (
                          <span className="text-green-700 font-medium">✓ Sent</span>
                        ) : (
                          <span className="text-red-600 font-medium" title={l.error || ''}>✗ Failed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fax Log Table */}
      {['all', 'fax'].includes(tab) && (
        <div className="panel overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-steel-200 bg-steel-50 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-steel-700">Fax Log</h2>
            <span className="text-xs text-steel-500">{faxLogs.length} shown</span>
          </div>
          {faxLogs.length === 0 ? (
            <div className="p-10 text-center text-steel-500">No fax activity yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                  <tr>
                    <th className="text-left px-4 py-2">Time</th>
                    <th className="text-left px-4 py-2">Direction</th>
                    <th className="text-left px-4 py-2">Fax Number</th>
                    <th className="text-left px-4 py-2">Pages</th>
                    <th className="text-left px-4 py-2">Status</th>
                    <th className="text-left px-4 py-2">Document</th>
                  </tr>
                </thead>
                <tbody>
                  {faxLogs.map((f) => (
                    <tr key={f.id} className="border-b border-steel-100 align-top hover:bg-steel-50">
                      <td className="px-4 py-3 text-xs text-steel-500 whitespace-nowrap">{formatDate(f.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          f.direction === 'OUTBOUND'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {f.direction === 'OUTBOUND' ? '↑ OUT' : '↓ IN'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{f.faxNumber}</td>
                      <td className="px-4 py-3 text-xs">{f.pages ?? '—'}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`font-medium ${
                          f.status === 'DELIVERED' || f.status === 'RECEIVED' ? 'text-green-700' :
                          f.status === 'FAILED' ? 'text-red-600' :
                          'text-amber-600'
                        }`}>
                          {f.status}
                        </span>
                        {f.error && <div className="text-red-500 text-[10px] mt-0.5">{f.error}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {f.mediaUrl ? (
                          <a href={f.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                            View PDF
                          </a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {['all', 'incoming', 'outgoing', 'sms', 'fax'].includes(tab) && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <div className="text-steel-500">Page {page} of {totalPages}</div>
          <div className="flex gap-1">
            {page > 1 && (
              <Link href={buildUrl({ page: String(page - 1) })} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                ← Prev
              </Link>
            )}
            {page < totalPages && (
              <Link href={buildUrl({ page: String(page + 1) })} className="px-3 py-1.5 rounded border border-steel-300 bg-white hover:bg-steel-50">
                Next →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Send SMS Form */}
      {tab === 'send-sms' && (
        <div className="panel p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Send SMS Message</h2>

          {sendResult && (
            <div className={`p-3 rounded mb-4 text-sm ${sendResult.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {sendResult.msg}
            </div>
          )}

          <form onSubmit={handleSendSms} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-steel-700 mb-1">Recipient</label>
              <div className="flex gap-2 mb-2">
                {(['driver', 'broker', 'custom'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setSmsRecipientType(t); setSmsRecipientId(''); setSmsCustomPhone(''); }}
                    className={`px-3 py-1.5 rounded text-sm border ${
                      smsRecipientType === t
                        ? 'bg-diesel text-white border-diesel'
                        : 'bg-white text-steel-600 border-steel-300 hover:bg-steel-50'
                    }`}
                  >
                    {t === 'driver' ? 'Driver' : t === 'broker' ? 'Broker' : 'Custom Number'}
                  </button>
                ))}
              </div>

              {smsRecipientType === 'driver' && (
                <select
                  value={smsRecipientId}
                  onChange={(e) => setSmsRecipientId(e.target.value)}
                  className="w-full px-3 py-2 border border-steel-300 rounded text-sm"
                >
                  <option value="">Select a driver...</option>
                  {drivers.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} — {d.phone || 'No phone'}</option>
                  ))}
                </select>
              )}

              {smsRecipientType === 'broker' && (
                <select
                  value={smsRecipientId}
                  onChange={(e) => setSmsRecipientId(e.target.value)}
                  className="w-full px-3 py-2 border border-steel-300 rounded text-sm"
                >
                  <option value="">Select a broker...</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} — {b.phone || 'No phone'}</option>
                  ))}
                </select>
              )}

              {smsRecipientType === 'custom' && (
                <input
                  type="tel"
                  value={smsCustomPhone}
                  onChange={(e) => setSmsCustomPhone(e.target.value)}
                  placeholder="Phone number (e.g. 2395551234)"
                  className="w-full px-3 py-2 border border-steel-300 rounded text-sm"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-steel-700 mb-1">Message</label>
              <textarea
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                rows={4}
                maxLength={1600}
                placeholder="Type your message..."
                className="w-full px-3 py-2 border border-steel-300 rounded text-sm resize-none"
              />
              <div className="text-xs text-steel-400 mt-1">{smsMessage.length}/1600 characters</div>
            </div>

            <button
              type="submit"
              disabled={sending}
              className="px-6 py-2.5 bg-diesel text-white rounded font-medium text-sm hover:bg-steel-800 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send SMS'}
            </button>
          </form>
        </div>
      )}

      {/* Send Fax Form */}
      {tab === 'send-fax' && (
        <div className="panel p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Send Fax</h2>

          {sendResult && (
            <div className={`p-3 rounded mb-4 text-sm ${sendResult.ok ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
              {sendResult.msg}
            </div>
          )}

          <form onSubmit={handleSendFax} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-steel-700 mb-1">Fax Number</label>
              <input
                type="tel"
                value={faxNumber}
                onChange={(e) => setFaxNumber(e.target.value)}
                placeholder="Fax number (e.g. 2395551234)"
                className="w-full px-3 py-2 border border-steel-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-steel-700 mb-1">Document</label>
              <div
                onDragOver={(e) => { e.preventDefault(); setFaxDragOver(true); }}
                onDragLeave={() => setFaxDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setFaxDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleFaxFileSelect(f);
                }}
                onClick={() => document.getElementById('fax-file-input')?.click()}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  faxDragOver
                    ? 'border-safety bg-safety/5'
                    : faxFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-steel-300 hover:border-steel-400 bg-steel-50'
                }`}
              >
                <input
                  id="fax-file-input"
                  type="file"
                  accept=".pdf,.tiff,.tif,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    if (f) handleFaxFileSelect(f);
                    e.target.value = '';
                  }}
                />
                {faxFile ? (
                  <div className="space-y-1">
                    <div className="text-2xl">📄</div>
                    <div className="text-sm font-medium text-steel-800">{faxFile.name}</div>
                    <div className="text-xs text-steel-500">{(faxFile.size / 1024).toFixed(0)} KB — {faxFile.type}</div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setFaxFile(null); }}
                      className="text-xs text-red-600 hover:underline mt-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl text-steel-400">📎</div>
                    <div className="text-sm text-steel-600">
                      Drag &amp; drop a file here, or <span className="text-safety font-medium">click to browse</span>
                    </div>
                    <div className="text-xs text-steel-400">PDF, TIFF, PNG, or JPEG — max 10 MB</div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={sending || !faxFile}
              className="px-6 py-2.5 bg-diesel text-white rounded font-medium text-sm hover:bg-steel-800 disabled:opacity-50"
            >
              {faxUploading ? 'Uploading document...' : sending ? 'Sending fax...' : 'Send Fax'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
