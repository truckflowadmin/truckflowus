'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface SmsEntry {
  id: string; direction: string; phone: string; message: string;
  driverName: string | null; brokerName: string | null;
  success: boolean; error: string | null; createdAt: string;
}
interface Contact { id: string; name: string; phone: string | null; }

interface Props {
  tab: string; page: number; totalPages: number; dir: string; search: string;
  smsLogs: SmsEntry[];
  drivers: Contact[]; brokers: Contact[];
  stats: { incoming: number; outgoing: number };
}

const TABS = [
  { key: 'all', label: 'All Messages', icon: '📋' },
  { key: 'incoming', label: 'Incoming', icon: '📥' },
  { key: 'outgoing', label: 'Outgoing', icon: '📤' },
  { key: 'send-sms', label: 'Send SMS', icon: '✉️' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export function MessagingHub({ tab, page, totalPages, dir, search, smsLogs, drivers, brokers, stats }: Props) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(search);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Send SMS form state
  const [smsRecipientType, setSmsRecipientType] = useState<'driver' | 'broker' | 'custom'>('driver');
  const [smsRecipientId, setSmsRecipientId] = useState('');
  const [smsCustomPhone, setSmsCustomPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');

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

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      {/* Header */}
      <header className="mb-6">
        <div className="text-xs uppercase tracking-widest text-steel-500 font-semibold">Communications</div>
        <h1 className="text-3xl font-bold tracking-tight">SMS Messages</h1>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
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
      {['all', 'incoming', 'outgoing'].includes(tab) && (
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

      {/* SMS Log Table */}
      {['all', 'incoming', 'outgoing'].includes(tab) && (
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

      {/* Pagination */}
      {['all', 'incoming', 'outgoing'].includes(tab) && totalPages > 1 && (
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
    </div>
  );
}
