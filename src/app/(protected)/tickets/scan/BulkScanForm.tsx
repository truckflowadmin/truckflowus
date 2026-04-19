'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

import Link from 'next/link';
import RotatableImage from '@/components/RotatableImage';
import { bulkCreateTicketsAction } from './actions';

/* ── Image / AI-extracted fields (source) ── */
const AI_FIELDS = [
  { key: 'ticketNumber', label: 'Ticket #' },
  { key: 'date', label: 'Date' },
  { key: 'tons', label: 'Tons' },
  { key: 'yards', label: 'Yards' },
  { key: 'hauledFrom', label: 'Hauled From / Origin' },
  { key: 'hauledTo', label: 'Hauled To / Destination' },
  { key: 'material', label: 'Material / Product' },
  { key: 'customerName', label: 'Customer Name' },
  { key: 'driverName', label: 'Driver Name' },
  { key: 'truckNumber', label: 'Truck #' },
  { key: 'grossWeight', label: 'Gross Weight' },
  { key: 'tareWeight', label: 'Tare Weight' },
  { key: 'netWeight', label: 'Net Weight' },
  { key: 'orderNumber', label: 'Order / PO #' },
  { key: 'notes', label: 'Notes' },
] as const;

type AiFieldKey = (typeof AI_FIELDS)[number]['key'];

/* ── Ticket form fields (destination — matches broker trip sheet columns) ── */
const TICKET_FIELDS = [
  { key: 'date', label: 'Date', tripSheet: true },
  { key: 'customerMatch', label: 'Customer Name', tripSheet: true },
  { key: 'hauledFrom', label: 'Hauled From', tripSheet: true },
  { key: 'hauledTo', label: 'Hauled To', tripSheet: true },
  { key: 'ticketRef', label: 'Ticket Number', tripSheet: true },
  { key: 'quantity', label: 'Quantity', tripSheet: true },
  { key: 'ratePerUnit', label: 'Rate', tripSheet: true },
  { key: 'driverMatch', label: 'Driver (Pay To)', tripSheet: true },
  { key: 'material', label: 'Material', tripSheet: false },
] as const;

type TicketFieldKey = (typeof TICKET_FIELDS)[number]['key'];

type FieldMapping = Record<TicketFieldKey, AiFieldKey | 'none'>;
type FieldMode = Record<TicketFieldKey, 'ai' | 'prefill'>;
type PrefillValues = Record<TicketFieldKey, string>;

const DEFAULT_MAPPING: FieldMapping = {
  hauledFrom: 'hauledFrom',
  hauledTo: 'hauledTo',
  material: 'material',
  ticketRef: 'ticketNumber',
  quantity: 'tons',
  date: 'date',
  customerMatch: 'customerName',
  driverMatch: 'driverName',
  ratePerUnit: 'none',
};

const DEFAULT_MODES: FieldMode = {
  hauledFrom: 'ai', hauledTo: 'ai', material: 'ai', ticketRef: 'ai',
  quantity: 'ai', date: 'ai', customerMatch: 'ai', driverMatch: 'ai', ratePerUnit: 'ai',
};

const DEFAULT_PREFILLS: PrefillValues = {
  hauledFrom: '', hauledTo: '', material: '', ticketRef: '',
  quantity: '', date: '', customerMatch: '', driverMatch: '', ratePerUnit: '',
};

/* ── LocalStorage persistence ── */
const LS_MAPPING = 'bulkScan_mapping';
const LS_MODES = 'bulkScan_modes';
const LS_PREFILLS = 'bulkScan_prefills';
const LS_HISTORY = 'bulkScan_prefillHistory';
const MAX_HISTORY = 20; // max suggestions per field

type PrefillHistory = Record<string, string[]>;

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch { return fallback; }
}
function saveLS(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function loadHistory(): PrefillHistory {
  try {
    const raw = localStorage.getItem(LS_HISTORY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function savePrefillToHistory(pf: PrefillValues) {
  try {
    const hist = loadHistory();
    for (const [key, val] of Object.entries(pf)) {
      if (!val || key === 'date' || key === 'customerMatch' || key === 'driverMatch') continue;
      if (!hist[key]) hist[key] = [];
      // Add to front, dedupe, cap at MAX_HISTORY
      hist[key] = [val, ...hist[key].filter((v) => v !== val)].slice(0, MAX_HISTORY);
    }
    saveLS(LS_HISTORY, hist);
  } catch {}
}

const AI_SOURCE_OPTIONS: { key: AiFieldKey | 'none'; label: string }[] = [
  { key: 'none', label: '— None (manual) —' },
  ...AI_FIELDS.map((f) => ({ key: f.key, label: f.label })),
];

/* ── Scanned item interface ── */
interface ScannedItem {
  id: string;
  file: File;
  photoUrl: string;
  status: 'uploading' | 'scanned' | 'error';
  error?: string;
  extracted: Record<string, string | null>;
  hauledFrom: string;
  hauledTo: string;
  material: string;
  quantityType: 'LOADS' | 'TONS' | 'YARDS';
  quantity: number;
  ticketRef: string;
  date: string;
  customerId: string;
  driverId: string;
  ratePerUnit: string;
}

interface Props {
  customers: { id: string; name: string }[];
  drivers: { id: string; name: string }[];
  materials: string[];
  brokers: { id: string; name: string }[];
  companyName: string;
}

/* ── Helpers ── */
let idCounter = 0;
const customerIdSet = new Set<string>();
const driverIdSet = new Set<string>();

export default function BulkScanForm({ customers, drivers, materials, brokers, companyName }: Props) {
  // Build ID lookup sets (stable across renders since props don't change)
  customerIdSet.clear(); customers.forEach((c) => customerIdSet.add(c.id));
  driverIdSet.clear(); drivers.forEach((d) => driverIdSet.add(d.id));
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ created: number; ticketNumbers: number[] } | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({ ...DEFAULT_MAPPING });
  const [fieldModes, setFieldModes] = useState<FieldMode>({ ...DEFAULT_MODES });
  const [prefills, setPrefills] = useState<PrefillValues>({ ...DEFAULT_PREFILLS });
  const [history, setHistory] = useState<PrefillHistory>({});
  const [hydrated, setHydrated] = useState(false);
  // Broker selection — auto-select if only one broker exists
  const [brokerId, setBrokerId] = useState<string>(brokers.length === 1 ? brokers[0].id : '');
  // Auto-expand field mapping when a broker is set so user sees trip sheet labels
  const [showMapping, setShowMapping] = useState(brokers.length === 1);
  const fileRef = useRef<HTMLInputElement>(null);
  const mappingRef = useRef<FieldMapping>(mapping);
  const modesRef = useRef<FieldMode>(fieldModes);
  const prefillsRef = useRef<PrefillValues>(prefills);

  /* Load saved settings on mount — date always resets */
  useEffect(() => {
    const m = loadLS<FieldMapping>(LS_MAPPING, DEFAULT_MAPPING);
    const fm = loadLS<FieldMode>(LS_MODES, DEFAULT_MODES);
    const pf = loadLS<PrefillValues>(LS_PREFILLS, DEFAULT_PREFILLS);
    fm.date = 'ai'; pf.date = '';
    setMapping(m); setFieldModes(fm); setPrefills(pf);
    setHistory(loadHistory());
    if (Object.values(fm).some((v) => v === 'prefill')) setShowMapping(true);
    setHydrated(true);
  }, []);

  useEffect(() => { mappingRef.current = mapping; if (hydrated) saveLS(LS_MAPPING, mapping); }, [mapping, hydrated]);
  useEffect(() => { modesRef.current = fieldModes; if (hydrated) saveLS(LS_MODES, fieldModes); }, [fieldModes, hydrated]);
  useEffect(() => { prefillsRef.current = prefills; if (hydrated) saveLS(LS_PREFILLS, prefills); }, [prefills, hydrated]);

  /* ── Fuzzy name match helpers ── */
  const matchCustomer = useCallback(
    (name: string | null) => {
      if (!name) return '';
      const lower = name.toLowerCase().trim();
      const match = customers.find(
        (c) =>
          c.name.toLowerCase() === lower ||
          c.name.toLowerCase().includes(lower) ||
          lower.includes(c.name.toLowerCase()),
      );
      return match?.id ?? '';
    },
    [customers],
  );

  const matchDriver = useCallback(
    (name: string | null) => {
      if (!name) return '';
      const lower = name.toLowerCase().trim();
      const match = drivers.find(
        (d) =>
          d.name.toLowerCase() === lower ||
          d.name.toLowerCase().includes(lower) ||
          lower.includes(d.name.toLowerCase()),
      );
      return match?.id ?? '';
    },
    [drivers],
  );

  /* ── Company-name driver fallback ── */
  const companyDriverId = (() => {
    if (!companyName) return '';
    const lower = companyName.toLowerCase().trim();
    const match = drivers.find(
      (d) =>
        d.name.toLowerCase() === lower ||
        d.name.toLowerCase().includes(lower) ||
        lower.includes(d.name.toLowerCase()),
    );
    return match?.id ?? '';
  })();

  /* ── Apply mapping — AI or prefill per field ── */
  function applyMappingToExtracted(
    extracted: Record<string, string | null>,
    m: FieldMapping = mappingRef.current,
    modes: FieldMode = modesRef.current,
    pf: PrefillValues = prefillsRef.current,
  ): Partial<ScannedItem> {
    const result: Partial<ScannedItem> = {};

    const val = (tk: TicketFieldKey): string | null => {
      if (modes[tk] === 'prefill') return pf[tk] || null;
      const src = m[tk];
      return src === 'none' ? null : (extracted[src] ?? null);
    };

    if (val('hauledFrom')) result.hauledFrom = val('hauledFrom')!;
    if (val('hauledTo')) result.hauledTo = val('hauledTo')!;
    if (val('material')) result.material = val('material')!;
    if (val('ticketRef')) result.ticketRef = val('ticketRef')!;
    if (val('date')) result.date = val('date')!;
    if (val('ratePerUnit')) result.ratePerUnit = val('ratePerUnit')!;

    if (modes.quantity === 'prefill') {
      if (pf.quantity) result.quantity = parseFloat(pf.quantity) || 1;
    } else {
      const qtySource = m.quantity;
      if (qtySource !== 'none') {
        const raw = extracted[qtySource];
        if (raw) {
          result.quantity = parseFloat(raw) || 1;
          if (qtySource === 'tons' || qtySource === 'netWeight' || qtySource === 'grossWeight') {
            result.quantityType = 'TONS';
          } else if (qtySource === 'yards') {
            result.quantityType = 'YARDS';
          }
        }
      }
    }

    if (modes.customerMatch === 'prefill') {
      if (pf.customerMatch) result.customerId = pf.customerMatch;
    } else if (val('customerMatch')) {
      result.customerId = matchCustomer(val('customerMatch'));
    }

    if (modes.driverMatch === 'prefill') {
      if (pf.driverMatch) result.driverId = pf.driverMatch;
    } else if (val('driverMatch')) {
      result.driverId = matchDriver(val('driverMatch'));
    }

    // Fallback: if no driver was set, use the company-name driver
    if (!result.driverId && companyDriverId) {
      result.driverId = companyDriverId;
    }

    return result;
  }

  function updateItem(id: string, updates: Partial<ScannedItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function reapplyMapping(
    nm: FieldMapping = mappingRef.current,
    nfm: FieldMode = modesRef.current,
    npf: PrefillValues = prefillsRef.current,
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.status !== 'scanned') return item;
        const updates = applyMappingToExtracted(item.extracted, nm, nfm, npf);
        return { ...item, ...updates };
      }),
    );
  }

  async function handleFiles(files: FileList) {
    const newItems: ScannedItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const item: ScannedItem = {
        id: `scan-${++idCounter}`,
        file,
        photoUrl: '',
        status: 'uploading',
        extracted: {},
        hauledFrom: '',
        hauledTo: '',
        material: '',
        quantityType: 'LOADS',
        quantity: 1,
        ticketRef: '',
        date: '',
        customerId: '',
        driverId: '',
        ratePerUnit: '',
      };
      newItems.push(item);
    }

    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      const fd = new FormData();
      fd.append('file', item.file);

      try {
        const res = await fetch('/api/tickets/scan', { method: 'POST', body: fd });
        const data = await res.json();

        if (!res.ok) {
          updateItem(item.id, { status: 'error', error: data.error || 'Scan failed' });
          continue;
        }

        const ext = data.extracted || {};
        const extracted: Record<string, string | null> = {
          tons: ext.tons ?? null,
          yards: ext.yards ?? null,
          ticketNumber: ext.ticketNumber ?? null,
          date: ext.date ?? null,
          hauledFrom: ext.hauledFrom ?? null,
          hauledTo: ext.hauledTo ?? null,
          material: ext.material ?? null,
          customerName: ext.customerName ?? null,
          driverName: ext.driverName ?? null,
          truckNumber: ext.truckNumber ?? null,
          grossWeight: ext.grossWeight ?? null,
          tareWeight: ext.tareWeight ?? null,
          netWeight: ext.netWeight ?? null,
          orderNumber: ext.orderNumber ?? null,
          notes: ext.notes ?? null,
          rawText: ext.rawText ?? null,
          _error: ext._error ?? null,
        };

        const prefill = applyMappingToExtracted(extracted);

        updateItem(item.id, {
          status: 'scanned',
          photoUrl: data.photoUrl,
          extracted,
          ...prefill,
        });
      } catch (err: any) {
        updateItem(item.id, { status: 'error', error: err.message });
      }
    }
  }

  async function handleCreate() {
    const valid = items.filter(
      (i) => i.status === 'scanned' && i.hauledFrom.trim() && i.hauledTo.trim(),
    );
    if (!valid.length) return;

    setCreating(true);
    try {
      const payload = valid.map((i) => ({
        photoUrl: i.photoUrl,
        hauledFrom: i.hauledFrom,
        hauledTo: i.hauledTo,
        material: i.material || null,
        quantityType: i.quantityType,
        quantity: i.quantity,
        ticketRef: i.ticketRef || null,
        date: i.date || null,
        customerId: (i.customerId && customerIdSet.has(i.customerId)) ? i.customerId : null,
        driverId: (i.driverId && driverIdSet.has(i.driverId)) ? i.driverId : null,
        brokerId: brokerId || null,
        ratePerUnit: i.ratePerUnit ? parseFloat(i.ratePerUnit) : null,
        scannedTons: i.extracted.tons ?? null,
        scannedYards: i.extracted.yards ?? null,
        scannedTicketNumber: i.extracted.ticketNumber ?? null,
        scannedDate: i.extracted.date ?? null,
        scannedRawText: i.extracted.rawText ?? null,
      }));

      const res = await bulkCreateTicketsAction(JSON.stringify(payload));
      setResult(res);
      // Save current prefills to history for future suggestions
      savePrefillToHistory(prefills);
      setHistory(loadHistory());
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  const scannedCount = items.filter((i) => i.status === 'scanned').length;
  const readyCount = items.filter(
    (i) => i.status === 'scanned' && i.hauledFrom.trim() && i.hauledTo.trim(),
  ).length;
  const uploadingCount = items.filter((i) => i.status === 'uploading').length;
  const selectedBrokerName = brokers.find((b) => b.id === brokerId)?.name;

  // Success view
  if (result) {
    return (
      <div className="text-center py-16">
        <div className="text-5xl mb-4">✓</div>
        <h2 className="text-2xl font-bold text-steel-900 mb-2">
          {result.created} Ticket{result.created !== 1 ? 's' : ''} Created
        </h2>
        <p className="text-steel-600 mb-2">
          Ticket numbers: {result.ticketNumbers.join(', ')}
        </p>
        {selectedBrokerName && (
          <p className="text-sm text-steel-500 mb-6">
            Assigned to broker: <strong>{selectedBrokerName}</strong>
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <Link href="/tickets" className="btn-primary">
            View Tickets
          </Link>
          <button
            onClick={() => { setResult(null); setItems([]); }}
            className="btn-ghost"
          >
            Scan More
          </button>
        </div>
      </div>
    );
  }

  /* Collect which AI fields have data across all scanned items */
  const extractedFieldsWithData = new Set<string>();
  items.forEach((i) => {
    if (i.status !== 'scanned') return;
    for (const f of AI_FIELDS) {
      if (i.extracted[f.key]) extractedFieldsWithData.add(f.key);
    }
  });

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/tickets" className="text-sm text-steel-500 hover:text-steel-700">
            ← Back to Tickets
          </Link>
          <h1 className="text-2xl font-bold text-steel-900 mt-1">Bulk Scan Tickets</h1>
          <p className="text-sm text-steel-500 mt-1">
            Upload photos of physical tickets. AI will extract data for you to review before creating.
          </p>
        </div>
      </header>

      {/* ── Broker Selection ── */}
      <div className="panel mb-6 p-5">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <label className="text-xs font-semibold text-steel-500 uppercase tracking-wide block mb-1.5">
              Broker
              <span className="text-steel-400 font-normal normal-case tracking-normal ml-1">
                — all scanned tickets will be assigned to this broker for trip sheet grouping
              </span>
            </label>
            {brokers.length === 0 ? (
              <div className="text-sm text-amber-600 bg-amber-50 rounded-lg px-4 py-2.5">
                No active brokers found.{' '}
                <Link href="/brokers/new" className="underline font-medium">Create a broker</Link>{' '}
                first to enable trip sheet assignment.
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  className="input text-sm flex-1"
                  value={brokerId}
                  onChange={(e) => setBrokerId(e.target.value)}
                >
                  <option value="">— No Broker —</option>
                  {brokers.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {brokerId && (
                  <button
                    onClick={() => setBrokerId('')}
                    className="text-xs text-steel-400 hover:text-red-500 whitespace-nowrap"
                  >Clear</button>
                )}
              </div>
            )}
          </div>
        </div>
        {!brokerId && brokers.length > 0 && (
          <p className="text-xs text-amber-600 mt-2">
            Select a broker to link these tickets for weekly trip sheet creation.
          </p>
        )}
      </div>

      {/* ── Field Mapping Panel ── */}
      <div className="panel mb-6">
        <button
          onClick={() => setShowMapping(!showMapping)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">⚙️</span>
            <span className="font-semibold text-steel-800">Field Mapping</span>
            <span className="text-xs text-steel-500">
              — Choose which image field fills each ticket field
            </span>
          </div>
          <span className="text-steel-400 text-sm">{showMapping ? '▲' : '▼'}</span>
        </button>

        {showMapping && (
          <div className="border-t border-steel-200 px-5 py-4">
            <p className="text-xs text-steel-500 mb-2">
              For each field choose <strong>AI</strong> (extract from image) or <strong>Prefill</strong> (fixed value for all images).
              Prefill values are remembered for future imports (except date).
            </p>
            {brokerId && (
              <p className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-1.5 mb-3">
                Fields marked with <span className="font-bold">TS</span> are used on the broker&apos;s weekly trip sheet.
              </p>
            )}

            <div className="space-y-1.5">
              {TICKET_FIELDS.filter((tf) => !brokerId || tf.tripSheet).map((tf) => {
                const mode = fieldModes[tf.key];
                const sourceKey = mapping[tf.key];
                const sourceHasData = mode === 'ai' && sourceKey !== 'none' && extractedFieldsWithData.has(sourceKey);
                const isTripSheetField = tf.tripSheet && !!brokerId;
                const isConfigured = mode === 'prefill' ? !!prefills[tf.key] : sourceKey !== 'none';
                const unmapped = isTripSheetField && !isConfigured;

                return (
                  <div
                    key={tf.key}
                    className={`flex items-center gap-2 p-2 rounded-lg border ${
                      unmapped
                        ? 'border-amber-200 bg-amber-50/50'
                        : mode === 'prefill' && prefills[tf.key]
                          ? 'border-purple-200 bg-purple-50/50'
                          : sourceHasData
                            ? 'border-green-200 bg-green-50/50'
                            : 'border-steel-100 bg-white'
                    }`}
                  >
                    {/* TS badge */}
                    <div className="w-7 flex-shrink-0 text-center">
                      {isTripSheetField ? (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1 py-0.5 rounded">TS</span>
                      ) : <span className="w-1.5" />}
                    </div>

                    {/* Field label */}
                    <div className="w-[120px] flex-shrink-0 flex items-center gap-1.5">
                      {sourceHasData && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                      {mode === 'prefill' && prefills[tf.key] && <span className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />}
                      <span className="text-sm font-medium text-steel-800 truncate">{tf.label}</span>
                    </div>

                    {/* AI / Prefill toggle */}
                    <div className="w-[90px] flex-shrink-0 flex">
                      <button
                        onClick={() => { const nm = { ...fieldModes, [tf.key]: 'ai' as const }; setFieldModes(nm); reapplyMapping(mapping, nm, prefills); }}
                        className={`text-[10px] px-2.5 py-1 rounded-l border ${mode === 'ai' ? 'bg-steel-700 text-white border-steel-700' : 'bg-white text-steel-500 border-steel-200 hover:bg-steel-50'}`}
                      >AI</button>
                      <button
                        onClick={() => { const nm = { ...fieldModes, [tf.key]: 'prefill' as const }; setFieldModes(nm); reapplyMapping(mapping, nm, prefills); }}
                        className={`text-[10px] px-2.5 py-1 rounded-r border-t border-r border-b ${mode === 'prefill' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-steel-500 border-steel-200 hover:bg-steel-50'}`}
                      >Prefill</button>
                    </div>

                    {/* Value area */}
                    <div className="flex-1 min-w-0">
                      {mode === 'ai' ? (
                        <select
                          className="input text-xs py-1.5 px-2 w-full"
                          value={mapping[tf.key]}
                          onChange={(e) => { const nm = { ...mapping, [tf.key]: e.target.value as AiFieldKey | 'none' }; setMapping(nm); reapplyMapping(nm, fieldModes, prefills); }}
                        >
                          {AI_SOURCE_OPTIONS.map((opt) => (
                            <option key={opt.key} value={opt.key}>
                              {opt.label}{opt.key !== 'none' && extractedFieldsWithData.has(opt.key) ? ' ●' : ''}
                            </option>
                          ))}
                        </select>
                      ) : tf.key === 'date' ? (
                        <input type="date" className="input text-xs py-1.5 px-2 w-full" value={prefills.date}
                          onChange={(e) => { const np = { ...prefills, date: e.target.value }; setPrefills(np); reapplyMapping(mapping, fieldModes, np); }} />
                      ) : tf.key === 'customerMatch' ? (
                        <div className="flex gap-1.5 w-full">
                          <select className="input text-xs py-1.5 px-2 flex-1 min-w-0" value={prefills.customerMatch}
                            onChange={(e) => { const np = { ...prefills, customerMatch: e.target.value }; setPrefills(np); reapplyMapping(mapping, fieldModes, np); }}>
                            <option value="">— Select Customer —</option>
                            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                          <input className="input text-xs py-1.5 px-2 flex-1 min-w-0" placeholder="or type name..."
                            list="pf-cust-dl"
                            value={prefills.customerMatch && !customers.find((c) => c.id === prefills.customerMatch) ? prefills.customerMatch : ''}
                            onChange={(e) => {
                              const typed = e.target.value;
                              const lower = typed.toLowerCase().trim();
                              const match = lower ? customers.find((c) => c.name.toLowerCase() === lower || c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase())) : undefined;
                              const np = { ...prefills, customerMatch: match ? match.id : typed };
                              setPrefills(np); reapplyMapping(mapping, fieldModes, np);
                            }} />
                          <datalist id="pf-cust-dl">{customers.map((c) => <option key={c.id} value={c.name} />)}</datalist>
                        </div>
                      ) : tf.key === 'driverMatch' ? (
                        <div className="flex gap-1.5 w-full">
                          <select className="input text-xs py-1.5 px-2 flex-1 min-w-0" value={prefills.driverMatch}
                            onChange={(e) => { const np = { ...prefills, driverMatch: e.target.value }; setPrefills(np); reapplyMapping(mapping, fieldModes, np); }}>
                            <option value="">— Select Driver —</option>
                            {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <input className="input text-xs py-1.5 px-2 flex-1 min-w-0" placeholder="or type name..."
                            list="pf-drv-dl"
                            value={prefills.driverMatch && !drivers.find((d) => d.id === prefills.driverMatch) ? prefills.driverMatch : ''}
                            onChange={(e) => {
                              const typed = e.target.value;
                              const lower = typed.toLowerCase().trim();
                              const match = lower ? drivers.find((d) => d.name.toLowerCase() === lower || d.name.toLowerCase().includes(lower) || lower.includes(d.name.toLowerCase())) : undefined;
                              const np = { ...prefills, driverMatch: match ? match.id : typed };
                              setPrefills(np); reapplyMapping(mapping, fieldModes, np);
                            }} />
                          <datalist id="pf-drv-dl">{drivers.map((d) => <option key={d.id} value={d.name} />)}</datalist>
                        </div>
                      ) : tf.key === 'material' ? (
                        <>
                          <input className="input text-xs py-1.5 px-2 w-full" list="pf-materials" placeholder="e.g. Fill dirt"
                            value={prefills.material}
                            onChange={(e) => { const np = { ...prefills, material: e.target.value }; setPrefills(np); reapplyMapping(mapping, fieldModes, np); }} />
                          <datalist id="pf-materials">
                            {materials.map((m) => <option key={m} value={m} />)}
                            {(history.material ?? []).filter((v) => !materials.includes(v)).map((v) => <option key={`h-${v}`} value={v} />)}
                          </datalist>
                        </>
                      ) : tf.key === 'quantity' || tf.key === 'ratePerUnit' ? (
                        <>
                          <input type="number" min="0" step="0.01" className="input text-xs py-1.5 px-2 w-full"
                            list={`pf-hist-${tf.key}`}
                            placeholder={tf.key === 'quantity' ? 'e.g. 22.5' : 'e.g. 12.50'}
                            value={prefills[tf.key]}
                            onChange={(e) => { const np = { ...prefills, [tf.key]: e.target.value }; setPrefills(np); reapplyMapping(mapping, fieldModes, np); }} />
                          {(history[tf.key]?.length ?? 0) > 0 && (
                            <datalist id={`pf-hist-${tf.key}`}>
                              {history[tf.key]!.map((v) => <option key={v} value={v} />)}
                            </datalist>
                          )}
                        </>
                      ) : (
                        <>
                          <input className="input text-xs py-1.5 px-2 w-full" placeholder={`Enter ${tf.label.toLowerCase()}...`}
                            list={`pf-hist-${tf.key}`}
                            value={prefills[tf.key]}
                            onChange={(e) => { const np = { ...prefills, [tf.key]: e.target.value }; setPrefills(np); reapplyMapping(mapping, fieldModes, np); }} />
                          {(history[tf.key]?.length ?? 0) > 0 && (
                            <datalist id={`pf-hist-${tf.key}`}>
                              {history[tf.key]!.map((v) => <option key={v} value={v} />)}
                            </datalist>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-3 text-xs">
              <button
                onClick={() => {
                  setMapping({ ...DEFAULT_MAPPING }); setFieldModes({ ...DEFAULT_MODES }); setPrefills({ ...DEFAULT_PREFILLS });
                  reapplyMapping({ ...DEFAULT_MAPPING }, { ...DEFAULT_MODES }, { ...DEFAULT_PREFILLS });
                  try { localStorage.removeItem(LS_MAPPING); localStorage.removeItem(LS_MODES); localStorage.removeItem(LS_PREFILLS); } catch {}
                }}
                className="text-steel-500 hover:text-steel-700 underline"
              >Reset to defaults</button>
              <span className="text-steel-400">● = data found in scans</span>
              {brokerId && <span className="text-blue-500"><span className="font-bold">TS</span> = trip sheet field</span>}
            </div>
          </div>
        )}
      </div>

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-steel-300 rounded-xl p-8 text-center mb-6 hover:border-safety transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-safety', 'bg-safety/5'); }}
        onDragLeave={(e) => { e.currentTarget.classList.remove('border-safety', 'bg-safety/5'); }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('border-safety', 'bg-safety/5');
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
      >
        <div className="text-4xl mb-2">📸</div>
        <p className="font-semibold text-steel-700">
          Drop ticket images here or click to browse
        </p>
        <p className="text-sm text-steel-500 mt-1">
          JPG, PNG, or WebP — select multiple files at once
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Status bar */}
      {items.length > 0 && (
        <div className="flex items-center justify-between bg-steel-50 rounded-lg px-4 py-3 mb-4">
          <div className="text-sm text-steel-600">
            {uploadingCount > 0 && (
              <span className="inline-flex items-center gap-1 mr-4">
                <span className="animate-spin text-xs">⏳</span> Scanning {uploadingCount}...
              </span>
            )}
            <span>{scannedCount} scanned</span>
            <span className="mx-2">·</span>
            <span>{readyCount} ready to create</span>
            {selectedBrokerName && (
              <>
                <span className="mx-2">·</span>
                <span>Broker: <strong>{selectedBrokerName}</strong></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setItems([])} className="btn-ghost text-sm">
              Clear All
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || readyCount === 0}
              className="btn-accent text-sm"
            >
              {creating ? 'Creating...' : `Create ${readyCount} Ticket${readyCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {/* Scanned items */}
      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`panel p-4 ${item.status === 'error' ? 'border-red-300' : ''}`}
          >
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-32 h-32 rounded-lg overflow-hidden bg-steel-100 flex items-center justify-center">
                {item.status === 'uploading' ? (
                  <div className="text-center">
                    <div className="animate-spin text-2xl mb-1">⏳</div>
                    <div className="text-[10px] text-steel-500">Scanning...</div>
                  </div>
                ) : item.photoUrl ? (
                  <RotatableImage src={item.photoUrl} alt="Ticket scan" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-steel-400 text-xs">No preview</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                {item.status === 'error' ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-red-700">{item.file.name}</p>
                      <p className="text-xs text-red-500 mt-1">{item.error}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-xs text-steel-400 hover:text-red-500">
                      Remove
                    </button>
                  </div>
                ) : item.status === 'uploading' ? (
                  <p className="text-sm text-steel-500">Scanning {item.file.name}...</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                          AI Scanned
                        </span>
                        <span className="text-xs text-steel-500">{item.file.name}</span>
                      </div>
                      <button onClick={() => removeItem(item.id)} className="text-xs text-steel-400 hover:text-red-500">
                        Remove
                      </button>
                    </div>

                    {/* Extracted info summary */}
                    {(() => {
                      const chips = AI_FIELDS.filter((f) => item.extracted[f.key]).map((f) => (
                        <span key={f.key}>
                          {f.label}: <strong>{item.extracted[f.key]}</strong>
                        </span>
                      ));
                      const extractionError = item.extracted._error;
                      return chips.length > 0 ? (
                        <div className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-1.5 mb-3 flex flex-wrap gap-x-4 gap-y-0.5">
                          {chips}
                        </div>
                      ) : (
                        <div className="text-xs text-amber-700 bg-amber-50 rounded px-3 py-1.5 mb-3">
                          {extractionError
                            ? <>AI extraction failed: <strong>{extractionError}</strong> — fill fields manually.</>
                            : 'No data extracted — check your terminal for errors. Fill fields manually.'}
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Hauled From *</label>
                        <input
                          className="input text-xs"
                          placeholder="Pickup location"
                          value={item.hauledFrom}
                          onChange={(e) => updateItem(item.id, { hauledFrom: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Hauled To *</label>
                        <input
                          className="input text-xs"
                          placeholder="Delivery location"
                          value={item.hauledTo}
                          onChange={(e) => updateItem(item.id, { hauledTo: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Material</label>
                        <input
                          className="input text-xs"
                          list={`materials-${item.id}`}
                          placeholder="e.g. Fill dirt"
                          value={item.material}
                          onChange={(e) => updateItem(item.id, { material: e.target.value })}
                        />
                        <datalist id={`materials-${item.id}`}>
                          {materials.map((m) => <option key={m} value={m} />)}
                        </datalist>
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Ticket #</label>
                        <input
                          className="input text-xs"
                          placeholder="Ref number"
                          value={item.ticketRef}
                          onChange={(e) => updateItem(item.id, { ticketRef: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Qty</label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input text-xs w-20"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, { quantity: parseFloat(e.target.value) || 1 })}
                          />
                          <select
                            className="input text-xs flex-1"
                            value={item.quantityType}
                            onChange={(e) => updateItem(item.id, { quantityType: e.target.value as any })}
                          >
                            <option value="LOADS">Loads</option>
                            <option value="TONS">Tons</option>
                            <option value="YARDS">Yards</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Date</label>
                        <input
                          type="date"
                          className="input text-xs"
                          value={item.date}
                          onChange={(e) => updateItem(item.id, { date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Customer</label>
                        <select
                          className="input text-xs"
                          value={item.customerId}
                          onChange={(e) => updateItem(item.id, { customerId: e.target.value })}
                        >
                          <option value="">— None —</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 uppercase">Driver</label>
                        <select
                          className="input text-xs"
                          value={item.driverId}
                          onChange={(e) => updateItem(item.id, { driverId: e.target.value })}
                        >
                          <option value="">— None —</option>
                          {drivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {(!item.hauledFrom.trim() || !item.hauledTo.trim()) && (
                      <p className="text-xs text-amber-600 mt-2">
                        Fill in Hauled From and Hauled To to include this ticket.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom create button */}
      {items.length > 2 && readyCount > 0 && (
        <div className="sticky bottom-4 mt-4 flex justify-end">
          <button
            onClick={handleCreate}
            disabled={creating || readyCount === 0}
            className="btn-accent shadow-lg"
          >
            {creating ? 'Creating...' : `Create ${readyCount} Ticket${readyCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
