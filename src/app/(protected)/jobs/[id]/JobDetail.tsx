'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { fmtQty } from '@/lib/format';
import RotatableImage from '@/components/RotatableImage';
import { updateJobStatusAction, recordLoadAction, deleteJobAction } from '../actions';
import { bulkCreateJobTicketsAction } from '../scanActions';
import AddressLink from '@/components/AddressLink';

interface ScanItem {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'scanned' | 'error';
  photoUrl: string | null;
  quantity: string;
  quantityType: string;
  ticketRef: string;
  scannedTons: string | null;
  scannedYards: string | null;
  scannedTicketNumber: string | null;
  scannedRawText: string | null;
  errorMsg?: string;
}

let scanNextId = 0;

function formatDriverTime(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0s';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Live ticker for dispatcher view when job is in progress */
function DispatcherLiveTimer({ driverTimeSeconds, lastResumedAt }: { driverTimeSeconds: number; lastResumedAt: string | null }) {
  const [now, setNow] = useState(Date.now());
  const running = !!lastResumedAt;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  let total = driverTimeSeconds;
  if (running && lastResumedAt) {
    total += Math.max(0, Math.round((now - new Date(lastResumedAt).getTime()) / 1000));
  }

  return (
    <span className={running ? 'text-safety-dark font-semibold' : 'text-steel-800'}>
      {formatDriverTime(total)}
      {running && <span className="ml-1 text-xs text-safety-dark animate-pulse">(active)</span>}
    </span>
  );
}

const STATUS_COLORS: Record<string, string> = {
  CREATED: 'bg-steel-100 text-steel-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  PARTIALLY_COMPLETED: 'bg-teal-100 text-teal-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  PARTIALLY_COMPLETED: 'Partially Completed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

interface JobData {
  id: string;
  jobNumber: number;
  name: string;
  status: string;
  hauledFrom: string;
  hauledFromAddress: string | null;
  hauledTo: string;
  hauledToAddress: string | null;
  material: string | null;
  truckNumber: string | null;
  quantityType: string;
  totalLoads: number;
  completedLoads: number;
  ratePerUnit: string | null;
  date: string | null;
  notes: string | null;
  openForDrivers: boolean;
  driverTimeSeconds: number;
  lastResumedAt: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string } | null;
  broker: { id: string; name: string } | null;
  driver: { id: string; name: string } | null;
  requiredTruckCount?: number;
  assignments?: {
    id: string;
    driverId: string;
    driverName: string;
    truckNumber: string | null;
    truckType: string | null;
    assignedAt: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    driverTimeSeconds: number;
    lastResumedAt: string | null;
  }[];
  tickets: {
    id: string;
    ticketNumber: number;
    status: string;
    quantity: number;
    quantityType: string;
    hauledFrom: string;
    hauledTo: string;
    material: string | null;
    ticketRef: string | null;
    date: string | null;
    ratePerUnit: string | null;
    completedAt: string | null;
    invoiceId: string | null;
    photoUrl: string | null;
    scannedTons: string | null;
    scannedYards: string | null;
    scannedTicketNumber: string | null;
    scannedDate: string | null;
    scannedAt: string | null;
  }[];
}

export default function JobDetail({ job: initialJob, invoiced = false }: { job: JobData; invoiced?: boolean }) {
  const [job, setJob] = useState(initialJob);
  const [recording, setRecording] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addingTickets, setAddingTickets] = useState(false);
  const [addCount, setAddCount] = useState(1);
  const [addFields, setAddFields] = useState({
    ticketRef: '',
    quantity: '1',
    quantityType: initialJob.quantityType || 'LOADS',
    date: initialJob.date ? initialJob.date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    ratePerUnit: initialJob.ratePerUnit ?? '',
    hauledFrom: initialJob.hauledFrom,
    hauledTo: initialJob.hauledTo,
    material: initialJob.material ?? '',
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<'scan' | 'manual'>('scan');
  const [scanItems, setScanItems] = useState<ScanItem[]>([]);
  const [scanCreating, setScanCreating] = useState(false);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const scanFileRef = useRef<HTMLInputElement>(null);

  const updateScanItem = useCallback((id: string, patch: Partial<ScanItem>) => {
    setScanItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it));
  }, []);

  async function handleScanFiles(files: FileList | null) {
    if (!files) return;
    setAddError(null);
    setScanSuccess(null);

    const newItems: ScanItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const id = `scan-${scanNextId++}`;
      newItems.push({
        id, file,
        preview: URL.createObjectURL(file),
        status: 'uploading',
        photoUrl: null,
        quantity: '1',
        quantityType: job.quantityType || 'LOADS',
        ticketRef: '',
        scannedTons: null,
        scannedYards: null,
        scannedTicketNumber: null,
        scannedRawText: null,
      });
    }

    setScanItems(prev => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        const res = await fetch('/api/tickets/scan?jobContext=true', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.success) {
          updateScanItem(item.id, { status: 'error', errorMsg: data.error || 'Scan failed' });
          continue;
        }
        const ext = data.extracted || {};
        let qty = '1';
        let qType = job.quantityType || 'LOADS';
        if (ext.tons && parseFloat(ext.tons) > 0) { qty = ext.tons; qType = 'TONS'; }
        else if (ext.yards && parseFloat(ext.yards) > 0) { qty = ext.yards; qType = 'YARDS'; }

        updateScanItem(item.id, {
          status: 'scanned',
          photoUrl: data.photoUrl,
          quantity: qty,
          quantityType: qType,
          ticketRef: ext.ticketNumber || '',
          scannedTons: ext.tons || null,
          scannedYards: ext.yards || null,
          scannedTicketNumber: ext.ticketNumber || null,
          scannedRawText: ext.rawText || null,
        });
      } catch (err: any) {
        updateScanItem(item.id, { status: 'error', errorMsg: err.message || 'Upload failed' });
      }
    }
  }

  const scanReadyItems = scanItems.filter(it => it.status === 'scanned');
  const scanUploadingCount = scanItems.filter(it => it.status === 'uploading').length;

  async function handleCreateScanned() {
    if (scanReadyItems.length === 0) return;
    setScanCreating(true);
    setAddError(null);
    setScanSuccess(null);

    const payload = scanReadyItems.map(it => ({
      jobId: job.id,
      photoUrl: it.photoUrl || '',
      quantity: parseFloat(it.quantity) || 1,
      quantityType: it.quantityType,
      ticketRef: it.ticketRef || null,
      date: job.date ? job.date.slice(0, 10) : null,
      hauledFrom: job.hauledFrom,
      hauledTo: job.hauledTo,
      material: job.material,
      customerId: job.customer?.id ?? null,
      driverId: job.driver?.id ?? null,
      brokerId: job.broker?.id ?? null,
      ratePerUnit: job.ratePerUnit ? parseFloat(job.ratePerUnit) : null,
      truckNumber: job.truckNumber,
      scannedTons: it.scannedTons,
      scannedYards: it.scannedYards,
      scannedTicketNumber: it.scannedTicketNumber,
      scannedDate: null,
      scannedRawText: it.scannedRawText,
    }));

    try {
      const result = await bulkCreateJobTicketsAction(JSON.stringify(payload));
      setScanSuccess(`Created ${result.created} ticket(s): #${result.ticketNumbers.join(', #')}`);
      setScanItems([]);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      setAddError(err.message || 'Failed to create tickets');
    } finally {
      setScanCreating(false);
    }
  }

  const unlimited = job.totalLoads === 0;
  // When loads specified: progress = tickets created / totalLoads
  // When no loads specified: progress based on job status
  const STATUS_PROGRESS: Record<string, number> = { CREATED: 0, ASSIGNED: 25, IN_PROGRESS: 50, PARTIALLY_COMPLETED: 75, COMPLETED: 100, CANCELLED: 0 };
  const ticketCount = job.tickets.length;
  const progress = unlimited
    ? (STATUS_PROGRESS[job.status] ?? 0)
    : Math.round((ticketCount / job.totalLoads) * 100);

  async function handleRecordLoad() {
    setRecording(true);
    try {
      const res = await recordLoadAction(job.id);
      setJob((j) => ({
        ...j,
        completedLoads: res.completedLoads,
        status: res.newStatus,
        completedAt: res.jobDone ? new Date().toISOString() : j.completedAt,
        startedAt: j.startedAt || new Date().toISOString(),
        tickets: [
          ...j.tickets,
          {
            id: `new-${res.ticketNumber}`,
            ticketNumber: res.ticketNumber,
            status: 'COMPLETED',
            quantity: 1,
            quantityType: j.quantityType,
            hauledFrom: j.hauledFrom,
            hauledTo: j.hauledTo,
            material: j.material,
            ticketRef: null,
            date: j.date,
            ratePerUnit: j.ratePerUnit,
            completedAt: new Date().toISOString(),
            invoiceId: null,
            photoUrl: null,
            scannedTons: null,
            scannedYards: null,
            scannedTicketNumber: null,
            scannedDate: null,
            scannedAt: null,
          },
        ],
      }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRecording(false);
    }
  }

  async function handleStatusChange(newStatus: string) {
    setUpdatingStatus(true);
    try {
      await updateJobStatusAction(job.id, newStatus);
      setJob((j) => ({
        ...j,
        status: newStatus,
        startedAt: newStatus === 'IN_PROGRESS' && !j.startedAt ? new Date().toISOString() : j.startedAt,
        completedAt: newStatus === 'COMPLETED' && !j.completedAt ? new Date().toISOString() : j.completedAt,
        // Cascade to assignments (skip for PARTIALLY_COMPLETED — that's per-driver)
        assignments: newStatus === 'PARTIALLY_COMPLETED' ? j.assignments : j.assignments?.map((a) => ({
          ...a,
          status: newStatus,
          startedAt: newStatus === 'IN_PROGRESS' && !a.startedAt ? new Date().toISOString() : a.startedAt,
          completedAt: newStatus === 'COMPLETED' && !a.completedAt ? new Date().toISOString() : a.completedAt,
        })),
      }));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleDriverStatusChange(assignmentId: string, newStatus: string) {
    try {
      await updateJobStatusAction(job.id, newStatus, assignmentId);
      setJob((j) => {
        const updatedAssignments = j.assignments?.map((a) =>
          a.id === assignmentId
            ? {
                ...a,
                status: newStatus,
                startedAt: newStatus === 'IN_PROGRESS' && !a.startedAt ? new Date().toISOString() : a.startedAt,
                completedAt: newStatus === 'COMPLETED' && !a.completedAt ? new Date().toISOString() : a.completedAt,
              }
            : a
        );
        // Derive job-level status
        const allStatuses = updatedAssignments?.map((a) => a.status) ?? [];
        let derivedStatus = j.status;
        if (allStatuses.every((s: string) => s === 'COMPLETED')) derivedStatus = 'COMPLETED';
        else if (allStatuses.every((s: string) => s === 'CANCELLED')) derivedStatus = 'CANCELLED';
        else if (allStatuses.some((s: string) => s === 'COMPLETED')) derivedStatus = 'PARTIALLY_COMPLETED';
        else if (allStatuses.some((s: string) => s === 'IN_PROGRESS')) derivedStatus = 'IN_PROGRESS';
        else if (allStatuses.some((s: string) => s === 'ASSIGNED')) derivedStatus = 'ASSIGNED';

        return { ...j, status: derivedStatus, assignments: updatedAssignments };
      });
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to permanently delete this cancelled job? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteJobAction(job.id);
    } catch (err: any) {
      alert(err.message);
      setDeleting(false);
    }
  }

  async function handleAddTickets() {
    if (!addFields.hauledFrom.trim() || !addFields.hauledTo.trim()) {
      setAddError('Hauled From and Hauled To are required');
      return;
    }
    setAddError(null);
    setAddingTickets(true);
    try {
      const tickets = Array.from({ length: addCount }, (_, i) => ({
        jobId: job.id,
        photoUrl: '',
        quantity: parseFloat(addFields.quantity) || 1,
        quantityType: addFields.quantityType,
        ticketRef: addCount === 1 ? (addFields.ticketRef || null) : null,
        date: addFields.date || null,
        hauledFrom: addFields.hauledFrom,
        hauledTo: addFields.hauledTo,
        material: addFields.material || null,
        customerId: job.customer?.id ?? null,
        driverId: job.driver?.id ?? null,
        brokerId: job.broker?.id ?? null,
        ratePerUnit: addFields.ratePerUnit ? parseFloat(addFields.ratePerUnit) : null,
        truckNumber: job.truckNumber,
        scannedTons: null,
        scannedYards: null,
        scannedTicketNumber: null,
        scannedDate: null,
        scannedRawText: null,
      }));

      const result = await bulkCreateJobTicketsAction(JSON.stringify(tickets));
      setShowAddForm(false);
      setAddCount(1);
      setAddFields((prev) => ({ ...prev, ticketRef: '' }));
      // Reload to get fresh ticket data
      setTimeout(() => window.location.reload(), 500);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add tickets');
    } finally {
      setAddingTickets(false);
    }
  }

  const canRecordLoad = !invoiced && (unlimited || ticketCount < job.totalLoads) && job.status !== 'CANCELLED' && job.status !== 'COMPLETED';
  const nextStatuses: string[] = [];
  if (!invoiced) {
    if (job.status === 'CREATED') nextStatuses.push('ASSIGNED', 'IN_PROGRESS', 'CANCELLED');
    if (job.status === 'ASSIGNED') nextStatuses.push('IN_PROGRESS', 'CANCELLED');
    if (job.status === 'IN_PROGRESS') nextStatuses.push('COMPLETED', 'CANCELLED');
    if (job.status === 'PARTIALLY_COMPLETED') nextStatuses.push('COMPLETED', 'IN_PROGRESS', 'CANCELLED');
    if (job.status === 'COMPLETED') nextStatuses.push('IN_PROGRESS', 'ASSIGNED');
    if (job.status === 'CANCELLED') nextStatuses.push('CREATED');
  }

  return (
    <div>
      {/* Invoiced lock banner */}
      {invoiced && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3">
          <span className="text-purple-600 text-lg leading-none">&#128274;</span>
          <p className="text-sm text-purple-800 font-medium flex-1">
            This job has invoiced tickets and cannot be modified.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-steel-900">Job #{job.jobNumber}</h1>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[job.status] || ''}`}>
              {STATUS_LABELS[job.status] || job.status}
            </span>
            {invoiced && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-purple-100 text-purple-700">Invoiced</span>
            )}
          </div>
          <p className="text-steel-600">{job.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {!invoiced && <Link href={`/jobs/${job.id}/edit`} className="btn-ghost text-sm">Edit</Link>}
          {nextStatuses.length > 0 && (
            <div className="flex items-center gap-1">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={updatingStatus}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    s === 'CANCELLED'
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : s === 'COMPLETED'
                        ? 'border-green-200 text-green-600 hover:bg-green-50'
                        : 'border-steel-200 text-steel-600 hover:bg-steel-50'
                  }`}
                >
                  → {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          )}
          {job.status === 'CANCELLED' && !invoiced && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-medium transition-colors"
            >
              {deleting ? 'Deleting…' : '🗑 Delete Job'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="panel p-5 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-steel-700">Load Progress</span>
          <span className="text-sm text-steel-500">
            {unlimited
              ? <>
                  <span className="font-mono font-bold text-lg text-steel-800">{progress}%</span>
                  <span className="text-steel-400 ml-2">({job.status.replace('_', ' ')})</span>
                </>
              : <>
                  <span className="font-mono font-bold text-lg text-steel-800">{ticketCount}</span>
                  <span className="text-steel-400"> / {job.totalLoads} loads</span>
                  <span className="text-steel-400 ml-2">({progress}%)</span>
                </>
            }
          </span>
        </div>
        <div className="w-full bg-steel-100 rounded-full h-4 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress >= 100 ? 'bg-green-500' : progress > 0 ? 'bg-safety' : 'bg-steel-200'
            }`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        {canRecordLoad && (
          <button
            onClick={handleRecordLoad}
            disabled={recording}
            className="btn-accent mt-4 w-full"
          >
            {recording ? 'Recording...' : unlimited
              ? `✓ Record Completed Load (#${ticketCount + 1})`
              : `✓ Record Completed Load (${ticketCount + 1} of ${job.totalLoads})`
            }
          </button>
        )}
        {progress >= 100 && (
          <p className="text-sm text-green-600 font-medium mt-3 text-center">All loads completed!</p>
        )}
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="panel p-5">
          <h3 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-3">Job Details</h3>
          <dl className="space-y-2.5 text-sm">
            <div>
              <div className="flex justify-between">
                <dt className="text-steel-500">From</dt>
                <dd className="text-steel-800 font-medium">{job.hauledFrom}</dd>
              </div>
              {job.hauledFromAddress && (
                <dd className="text-right mt-0.5">
                  <AddressLink value={job.hauledFromAddress} />
                </dd>
              )}
            </div>
            <div>
              <div className="flex justify-between">
                <dt className="text-steel-500">To</dt>
                <dd className="text-steel-800 font-medium">{job.hauledTo}</dd>
              </div>
              {job.hauledToAddress && (
                <dd className="text-right mt-0.5">
                  <AddressLink value={job.hauledToAddress} />
                </dd>
              )}
            </div>
            {job.truckNumber && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Truck #</dt>
                <dd className="text-steel-800 font-medium">{job.truckNumber}</dd>
              </div>
            )}
            {job.material && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Material</dt>
                <dd className="text-steel-800">{job.material}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-steel-500">Quantity Type</dt>
              <dd className="text-steel-800">{job.quantityType}</dd>
            </div>
            {job.ratePerUnit && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Rate</dt>
                <dd className="text-steel-800">${parseFloat(job.ratePerUnit).toFixed(2)} / {job.quantityType === 'TONS' ? 'ton' : job.quantityType === 'YARDS' ? 'yard' : 'load'}</dd>
              </div>
            )}
            {job.date && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Target Date</dt>
                <dd className="text-steel-800">{new Date(job.date).toLocaleDateString()}</dd>
              </div>
            )}
            {job.openForDrivers && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Driver Self-Assign</dt>
                <dd className="text-green-600 font-medium">Enabled</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="panel p-5">
          <h3 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-3">People</h3>
          <dl className="space-y-2.5 text-sm">
            <div>
              <div className="flex justify-between mb-1">
                <dt className="text-steel-500">
                  Drivers
                  {(job.requiredTruckCount ?? 1) > 1 && (
                    <span className="ml-1 text-xs text-steel-400">
                      ({job.assignments?.length ?? (job.driver ? 1 : 0)}/{(job.requiredTruckCount ?? 1)} trucks)
                    </span>
                  )}
                </dt>
              </div>
              {job.assignments && job.assignments.length > 0 ? (
                <dd className="space-y-1.5">
                  {job.assignments.map((a: any) => {
                    const statusColors: Record<string, string> = {
                      ASSIGNED: 'bg-blue-100 text-blue-700',
                      IN_PROGRESS: 'bg-amber-100 text-amber-700',
                      COMPLETED: 'bg-green-100 text-green-700',
                      CANCELLED: 'bg-red-100 text-red-700',
                    };
                    const statusLabels: Record<string, string> = {
                      ASSIGNED: 'Assigned',
                      IN_PROGRESS: 'In Progress',
                      COMPLETED: 'Completed',
                      CANCELLED: 'Cancelled',
                    };
                    const aStatus = a.status || 'ASSIGNED';
                    const canChange = !invoiced;
                    const statusOptions = ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].filter(s => s !== aStatus);
                    return (
                      <div key={a.id} className="flex items-center justify-between bg-steel-50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link href="/drivers" className="text-safety hover:underline text-sm font-medium truncate">{a.driverName}</Link>
                          {a.truckNumber && <span className="text-xs text-steel-400">{a.truckNumber}</span>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {a.driverTimeSeconds > 0 && (
                            <DispatcherLiveTimer driverTimeSeconds={a.driverTimeSeconds} lastResumedAt={a.lastResumedAt} />
                          )}
                          {canChange ? (
                            <select
                              value={aStatus}
                              onChange={(e) => handleDriverStatusChange(a.id, e.target.value)}
                              className={`text-xs font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer appearance-none pr-5 ${statusColors[aStatus] || 'bg-steel-100 text-steel-600'}`}
                              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 8 8'%3E%3Cpath d='M0 2l4 4 4-4z' fill='%23666'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
                            >
                              <option value={aStatus}>{statusLabels[aStatus] || aStatus}</option>
                              {statusOptions.map(s => (
                                <option key={s} value={s}>{statusLabels[s]}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[aStatus] || 'bg-steel-100 text-steel-600'}`}>
                              {statusLabels[aStatus] || aStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(job.requiredTruckCount ?? 1) > job.assignments.length && (
                    <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
                      <div className="text-xs text-amber-800">
                        <span className="font-semibold">
                          {(job.requiredTruckCount ?? 1) - job.assignments.length} driver slot{(job.requiredTruckCount ?? 1) - job.assignments.length !== 1 ? 's' : ''} still open
                        </span>
                        <span className="block text-amber-600 mt-0.5">
                          Assign {(job.requiredTruckCount ?? 1) - job.assignments.length === 1 ? 'a driver' : 'drivers'} or enable &quot;Open for Drivers&quot; so they can self-assign.
                        </span>
                      </div>
                    </div>
                  )}
                </dd>
              ) : job.driver ? (
                <dd className="text-steel-800 font-medium">
                  <Link href="/drivers" className="text-safety hover:underline">{job.driver.name}</Link>
                </dd>
              ) : (
                <dd className="text-steel-400 italic">{job.openForDrivers ? 'Open for drivers' : 'Unassigned'}</dd>
              )}
            </div>
            {job.broker && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Broker</dt>
                <dd className="text-steel-800">{job.broker.name}</dd>
              </div>
            )}
            {job.customer && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Customer</dt>
                <dd className="text-steel-800">{job.customer.name}</dd>
              </div>
            )}
          </dl>

          <h3 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mt-5 mb-3">Timeline</h3>
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-steel-500">Created</dt>
              <dd className="text-steel-800">{new Date(job.createdAt).toLocaleString()}</dd>
            </div>
            {job.assignedAt && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Assigned</dt>
                <dd className="text-steel-800">{new Date(job.assignedAt).toLocaleString()}</dd>
              </div>
            )}
            {job.startedAt && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Started</dt>
                <dd className="text-steel-800">{new Date(job.startedAt).toLocaleString()}</dd>
              </div>
            )}
            {job.completedAt && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Completed</dt>
                <dd className="text-green-600 font-medium">{new Date(job.completedAt).toLocaleString()}</dd>
              </div>
            )}
            {(job.driverTimeSeconds > 0 || job.lastResumedAt) && (
              <div className="flex justify-between">
                <dt className="text-steel-500">Driver Time</dt>
                <dd>
                  <DispatcherLiveTimer driverTimeSeconds={job.driverTimeSeconds} lastResumedAt={job.lastResumedAt} />
                </dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Notes */}
      {job.notes && (
        <div className="panel p-5 mb-6">
          <h3 className="text-xs font-semibold text-steel-500 uppercase tracking-wide mb-2">Notes</h3>
          <p className="text-sm text-steel-700 whitespace-pre-wrap">{job.notes}</p>
        </div>
      )}

      {/* Tickets / Loads */}
      <div className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-steel-500 uppercase tracking-wide">
            Completed Loads ({job.tickets.length} ticket{job.tickets.length !== 1 ? 's' : ''})
          </h3>
          {!invoiced && (
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="text-xs font-medium text-safety-dark hover:text-safety-darker flex items-center gap-1"
            >
              {showAddForm ? '✕ Cancel' : '+ Add Ticket'}
            </button>
          )}
        </div>

        {/* Add ticket form — scan photos or manual */}
        {showAddForm && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            {/* Mode tabs */}
            <div className="flex items-center gap-1 mb-3">
              <button
                type="button"
                onClick={() => setAddMode('scan')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  addMode === 'scan'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                📷 Upload &amp; Scan Photos
              </button>
              <button
                type="button"
                onClick={() => setAddMode('manual')}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  addMode === 'manual'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                ✏️ Add Manually
              </button>
            </div>

            {addError && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
                {addError}
                <button type="button" onClick={() => setAddError(null)} className="ml-2 text-red-400 hover:text-red-600">&times;</button>
              </div>
            )}
            {scanSuccess && (
              <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-700">{scanSuccess}</div>
            )}

            {/* Job prefill summary */}
            <div className="flex flex-wrap gap-1.5 mb-3 text-[10px]">
              <span className="px-2 py-0.5 bg-white/60 rounded text-steel-600">From: <span className="font-medium">{job.hauledFrom}</span></span>
              <span className="px-2 py-0.5 bg-white/60 rounded text-steel-600">To: <span className="font-medium">{job.hauledTo}</span></span>
              {job.material && <span className="px-2 py-0.5 bg-white/60 rounded text-steel-600">Material: <span className="font-medium">{job.material}</span></span>}
              {job.customer && <span className="px-2 py-0.5 bg-white/60 rounded text-blue-700">Customer: {job.customer.name}</span>}
              {job.driver && <span className="px-2 py-0.5 bg-white/60 rounded text-green-700">Driver: {job.driver.name}</span>}
              {job.date && <span className="px-2 py-0.5 bg-white/60 rounded text-steel-600">Date: {new Date(job.date).toLocaleDateString()}</span>}
              {job.ratePerUnit && <span className="px-2 py-0.5 bg-white/60 rounded text-steel-600">Rate: ${parseFloat(job.ratePerUnit).toFixed(2)}</span>}
            </div>

            {/* ─── Scan Photos Mode ─── */}
            {addMode === 'scan' && (
              <div>
                {/* Drop zone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); handleScanFiles(e.dataTransfer.files); }}
                  onClick={() => scanFileRef.current?.click()}
                  className="border-2 border-dashed border-blue-300 rounded-lg p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-100/50 transition-colors mb-3"
                >
                  <p className="text-sm text-blue-700 mb-1">Drop ticket images here or click to browse</p>
                  <p className="text-xs text-blue-500">AI scans for quantity &amp; ticket # — all other fields prefilled from job</p>
                  <input
                    ref={scanFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { handleScanFiles(e.target.files); e.target.value = ''; }}
                  />
                </div>

                {scanUploadingCount > 0 && (
                  <div className="text-xs text-blue-600 mb-2">Scanning {scanUploadingCount} image{scanUploadingCount !== 1 ? 's' : ''}...</div>
                )}

                {/* Scanned items table */}
                {scanItems.length > 0 && (
                  <div className="overflow-hidden rounded-lg border border-blue-200 mb-3 bg-white">
                    <table className="w-full text-sm">
                      <thead className="text-[10px] uppercase tracking-wide text-steel-500 border-b border-steel-200 bg-steel-50">
                        <tr>
                          <th className="text-left px-3 py-1.5 w-14">Photo</th>
                          <th className="text-left px-3 py-1.5">Ticket #</th>
                          <th className="text-right px-3 py-1.5">Qty</th>
                          <th className="text-left px-3 py-1.5">Type</th>
                          <th className="text-left px-3 py-1.5">Status</th>
                          <th className="text-right px-3 py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {scanItems.map((it) => (
                          <tr key={it.id} className={`border-b border-steel-100 ${it.status === 'error' ? 'bg-red-50/50' : ''}`}>
                            <td className="px-3 py-1.5">
                              <img src={it.preview} alt="" className="w-10 h-10 object-cover rounded border border-steel-200" />
                            </td>
                            <td className="px-3 py-1.5">
                              {it.status === 'scanned' ? (
                                <input type="text" value={it.ticketRef}
                                  onChange={(e) => updateScanItem(it.id, { ticketRef: e.target.value })}
                                  placeholder="Ticket ref" className="input text-xs py-1 w-24" />
                              ) : (
                                <span className="text-steel-400 text-xs">{it.status === 'uploading' ? 'Scanning...' : '—'}</span>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              {it.status === 'scanned' ? (
                                <input type="number" step="0.01" min="0" value={it.quantity}
                                  onChange={(e) => updateScanItem(it.id, { quantity: e.target.value })}
                                  className="input text-xs py-1 w-16 text-right" />
                              ) : <span className="text-steel-400 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-1.5">
                              {it.status === 'scanned' ? (
                                <select value={it.quantityType}
                                  onChange={(e) => updateScanItem(it.id, { quantityType: e.target.value })}
                                  className="input text-xs py-1 w-20">
                                  <option value="LOADS">Loads</option>
                                  <option value="TONS">Tons</option>
                                  <option value="YARDS">Yards</option>
                                </select>
                              ) : <span className="text-steel-400 text-xs">—</span>}
                            </td>
                            <td className="px-3 py-1.5">
                              {it.status === 'uploading' && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-700">Scanning...</span>}
                              {it.status === 'scanned' && <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">Ready</span>}
                              {it.status === 'error' && <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700" title={it.errorMsg}>Error</span>}
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <button type="button" onClick={() => setScanItems(prev => prev.filter(x => x.id !== it.id))}
                                className="text-red-400 hover:text-red-600 text-sm">&times;</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Create scanned tickets button */}
                {scanReadyItems.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={handleCreateScanned} disabled={scanCreating}
                      className="btn-accent text-xs px-4 py-1.5 disabled:opacity-50">
                      {scanCreating ? 'Creating...' : `Create ${scanReadyItems.length} Ticket${scanReadyItems.length !== 1 ? 's' : ''}`}
                    </button>
                    <button type="button" onClick={() => { setScanItems([]); setAddError(null); setScanSuccess(null); }}
                      className="btn-ghost text-xs px-3 py-1.5">Clear All</button>
                  </div>
                )}
              </div>
            )}

            {/* ─── Manual Mode ─── */}
            {addMode === 'manual' && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5"># of Tickets</label>
                    <input type="number" min="1" max="100" value={addCount}
                      onChange={(e) => setAddCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="input text-xs w-full py-1 px-2" />
                  </div>
                  {addCount === 1 && (
                    <div>
                      <label className="text-[10px] text-steel-500 block mb-0.5">Ticket Ref #</label>
                      <input type="text" value={addFields.ticketRef}
                        onChange={(e) => setAddFields((p) => ({ ...p, ticketRef: e.target.value }))}
                        className="input text-xs w-full py-1 px-2" placeholder="Optional" />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5">Quantity</label>
                    <div className="flex gap-1">
                      <input type="number" step="0.01" min="0" value={addFields.quantity}
                        onChange={(e) => setAddFields((p) => ({ ...p, quantity: e.target.value }))}
                        className="input text-xs py-1 px-2 w-16" />
                      <select value={addFields.quantityType}
                        onChange={(e) => setAddFields((p) => ({ ...p, quantityType: e.target.value }))}
                        className="input text-xs py-1 px-2 flex-1">
                        <option value="LOADS">Loads</option>
                        <option value="TONS">Tons</option>
                        <option value="YARDS">Yards</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5">Date</label>
                    <input type="date" value={addFields.date}
                      onChange={(e) => setAddFields((p) => ({ ...p, date: e.target.value }))}
                      className="input text-xs w-full py-1 px-2" />
                  </div>
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5">Rate ($/unit)</label>
                    <input type="number" step="0.01" min="0" value={addFields.ratePerUnit}
                      onChange={(e) => setAddFields((p) => ({ ...p, ratePerUnit: e.target.value }))}
                      className="input text-xs w-full py-1 px-2" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5">Hauled From</label>
                    <input type="text" value={addFields.hauledFrom}
                      onChange={(e) => setAddFields((p) => ({ ...p, hauledFrom: e.target.value }))}
                      className="input text-xs w-full py-1 px-2" placeholder="Origin" />
                  </div>
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5">Hauled To</label>
                    <input type="text" value={addFields.hauledTo}
                      onChange={(e) => setAddFields((p) => ({ ...p, hauledTo: e.target.value }))}
                      className="input text-xs w-full py-1 px-2" placeholder="Destination" />
                  </div>
                  <div>
                    <label className="text-[10px] text-steel-500 block mb-0.5">Material</label>
                    <input type="text" value={addFields.material}
                      onChange={(e) => setAddFields((p) => ({ ...p, material: e.target.value }))}
                      className="input text-xs w-full py-1 px-2" placeholder="Material" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" disabled={addingTickets} onClick={handleAddTickets}
                    className="btn-accent text-xs px-4 py-1.5 disabled:opacity-50">
                    {addingTickets ? 'Creating…' : addCount === 1 ? 'Create Ticket' : `Create ${addCount} Tickets`}
                  </button>
                  <button type="button" onClick={() => { setShowAddForm(false); setAddError(null); }}
                    className="btn-ghost text-xs px-3 py-1.5">Cancel</button>
                  {addCount > 1 && (
                    <span className="text-[10px] text-steel-400">All {addCount} tickets will share these fields (prefilled from job)</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Missing photo reminder */}
        {(() => {
          const missingCount = job.tickets.filter((t) => !t.photoUrl).length;
          return missingCount > 0 ? (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5">
              <span className="text-lg leading-none">📷</span>
              <p className="text-sm text-amber-800 font-medium">
                {missingCount} ticket{missingCount !== 1 ? 's' : ''} missing photo — each load needs an image
              </p>
            </div>
          ) : null;
        })()}
        {job.tickets.length === 0 ? (
          <p className="text-sm text-steel-400 italic">No loads recorded yet. Click &quot;Record Completed Load&quot; to create tickets.</p>
        ) : (
          <div className="space-y-1.5">
            {job.tickets.map((t, i) => (
              <TicketRow
                key={t.id}
                ticket={t}
                index={i}
                quantityType={job.quantityType}
                invoiced={invoiced}
                onDelete={(ticketId) => {
                  setJob((j) => ({
                    ...j,
                    tickets: j.tickets.filter((tk) => tk.id !== ticketId),
                  }));
                }}
                onUpdate={(ticketId, updates) => {
                  setJob((j) => ({
                    ...j,
                    tickets: j.tickets.map((tk) => tk.id === ticketId ? { ...tk, ...updates } : tk),
                  }));
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Ticket row with inline photo upload ── */

function TicketRow({
  ticket: initialTicket,
  index,
  quantityType,
  invoiced,
  onDelete,
  onUpdate,
}: {
  ticket: JobData['tickets'][number];
  index: number;
  quantityType: string;
  invoiced: boolean;
  onDelete: (ticketId: string) => void;
  onUpdate: (ticketId: string, updates: Partial<JobData['tickets'][number]>) => void;
}) {
  const [ticket, setTicket] = useState(initialTicket);
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editFields, setEditFields] = useState({
    scannedTicketNumber: ticket.scannedTicketNumber ?? '',
    scannedDate: ticket.scannedDate ?? '',
    scannedTons: ticket.scannedTons ?? '',
    scannedYards: ticket.scannedYards ?? '',
  });
  const [editingTicket, setEditingTicket] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [ticketFields, setTicketFields] = useState({
    quantity: String(ticket.quantity),
    quantityType: ticket.quantityType || quantityType,
    ticketRef: ticket.ticketRef ?? '',
    hauledFrom: ticket.hauledFrom ?? '',
    hauledTo: ticket.hauledTo ?? '',
    material: ticket.material ?? '',
    date: ticket.date ? ticket.date.slice(0, 10) : '',
    ratePerUnit: ticket.ratePerUnit ?? '',
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const canUpload = !invoiced && !ticket.invoiceId;
  const canEdit = canUpload;

  async function handleUpload(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('ticketId', ticket.id);
      form.append('file', file);
      const res = await fetch('/api/tickets/photo', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      const ext = json.extracted;
      setTicket((prev) => ({
        ...prev,
        photoUrl: json.photoUrl,
        scannedTons: ext.tons,
        scannedYards: ext.yards,
        scannedTicketNumber: ext.ticketNumber,
        scannedDate: ext.date,
        scannedAt: new Date().toISOString(),
      }));
      setEditFields({
        scannedTicketNumber: ext.ticketNumber ?? '',
        scannedDate: ext.date ?? '',
        scannedTons: ext.tons ?? '',
        scannedYards: ext.yards ?? '',
      });
      setEditing(false);
      setExpanded(true);
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleSaveCorrections() {
    setUploadError(null);
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/tickets/photo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          scannedTons: editFields.scannedTons || null,
          scannedYards: editFields.scannedYards || null,
          scannedTicketNumber: editFields.scannedTicketNumber || null,
          scannedDate: editFields.scannedDate || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setTicket((prev) => ({
        ...prev,
        scannedTons: editFields.scannedTons || null,
        scannedYards: editFields.scannedYards || null,
        scannedTicketNumber: editFields.scannedTicketNumber || null,
        scannedDate: editFields.scannedDate || null,
      }));
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setUploadError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditFields({
      scannedTicketNumber: ticket.scannedTicketNumber ?? '',
      scannedDate: ticket.scannedDate ?? '',
      scannedTons: ticket.scannedTons ?? '',
      scannedYards: ticket.scannedYards ?? '',
    });
    setEditing(false);
  }

  async function handleDeleteTicket() {
    if (!confirm('Delete this ticket? This cannot be undone.')) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tickets?id=${ticket.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      onDelete(ticket.id);
    } catch (err: any) {
      setUploadError(err.message || 'Delete failed');
      setDeleting(false);
    }
  }

  function startEditTicket() {
    setTicketFields({
      quantity: String(ticket.quantity),
      quantityType: ticket.quantityType || quantityType,
      ticketRef: ticket.ticketRef ?? '',
      hauledFrom: ticket.hauledFrom ?? '',
      hauledTo: ticket.hauledTo ?? '',
      material: ticket.material ?? '',
      date: ticket.date ? ticket.date.slice(0, 10) : '',
      ratePerUnit: ticket.ratePerUnit ?? '',
    });
    setEditingTicket(true);
    setExpanded(true);
  }

  async function handleSaveTicket() {
    setSavingTicket(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/tickets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ticket.id,
          quantity: parseFloat(ticketFields.quantity) || 1,
          quantityType: ticketFields.quantityType,
          ticketRef: ticketFields.ticketRef || null,
          hauledFrom: ticketFields.hauledFrom,
          hauledTo: ticketFields.hauledTo,
          material: ticketFields.material || null,
          date: ticketFields.date || null,
          ratePerUnit: ticketFields.ratePerUnit ? parseFloat(ticketFields.ratePerUnit) : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      // Update local + parent state
      const updates = {
        quantity: parseFloat(ticketFields.quantity) || 1,
        quantityType: ticketFields.quantityType,
        ticketRef: ticketFields.ticketRef || null,
        hauledFrom: ticketFields.hauledFrom,
        hauledTo: ticketFields.hauledTo,
        material: ticketFields.material || null,
        date: ticketFields.date ? new Date(ticketFields.date).toISOString() : null,
        ratePerUnit: ticketFields.ratePerUnit || null,
      };
      setTicket((prev) => ({ ...prev, ...updates }));
      onUpdate(ticket.id, updates);
      setEditingTicket(false);
    } catch (err: any) {
      setUploadError(err.message || 'Save failed');
    } finally {
      setSavingTicket(false);
    }
  }

  const hasExtracted = ticket.scannedTons || ticket.scannedYards || ticket.scannedTicketNumber || ticket.scannedDate;

  return (
    <div className="rounded-lg bg-steel-50 text-sm">
      <div className="flex items-center justify-between py-2 px-3">
        <div className="flex items-center gap-3">
          <span className="text-steel-400 text-xs">Load {index + 1}</span>
          <Link href={`/tickets/${ticket.id}`} className="font-mono font-semibold text-safety hover:underline">
            Ticket #{ticket.ticketNumber}
          </Link>
          {ticket.photoUrl ? (
            <span className="text-xs text-green-600" title="Has photo">📷</span>
          ) : (
            <span className="text-xs text-amber-500" title="Missing photo — upload image to complete this load">📷❗</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-steel-500">
            {ticket.quantity} {(ticket.quantityType || quantityType).toLowerCase()}
          </span>
          {ticket.completedAt && (
            <span className="text-xs text-steel-400">{new Date(ticket.completedAt).toLocaleString()}</span>
          )}
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            {ticket.status}
          </span>
          {ticket.invoiceId && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              Invoiced
            </span>
          )}
          {canEdit && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="text-xs text-safety-dark hover:underline disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : ticket.photoUrl ? 'Replace Photo' : 'Upload Photo'}
              </button>
              <button
                type="button"
                onClick={startEditTicket}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteTicket}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </>
          )}
          {(ticket.photoUrl || hasExtracted || editingTicket) && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-steel-400 hover:text-steel-600"
            >
              {expanded ? '▲' : '▼'}
            </button>
          )}
        </div>
      </div>

      {uploadError && (
        <div className="mx-3 mb-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
          {uploadError}
        </div>
      )}

      {expanded && (ticket.photoUrl || hasExtracted || editingTicket) && (
        <div className="px-3 pb-3 pt-1 border-t border-steel-200">
          {/* Inline ticket edit form */}
          {editingTicket && (
            <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-3">
              <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">Edit Ticket Fields</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Ticket #</label>
                  <input type="text" value={ticketFields.ticketRef}
                    onChange={(e) => setTicketFields((p) => ({ ...p, ticketRef: e.target.value }))}
                    className="input text-xs w-full py-1 px-2" placeholder="Ref #" />
                </div>
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Quantity</label>
                  <div className="flex gap-1">
                    <input type="number" step="0.01" min="0" value={ticketFields.quantity}
                      onChange={(e) => setTicketFields((p) => ({ ...p, quantity: e.target.value }))}
                      className="input text-xs py-1 px-2 w-16" />
                    <select value={ticketFields.quantityType}
                      onChange={(e) => setTicketFields((p) => ({ ...p, quantityType: e.target.value }))}
                      className="input text-xs py-1 px-2 flex-1">
                      <option value="LOADS">Loads</option>
                      <option value="TONS">Tons</option>
                      <option value="YARDS">Yards</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Date</label>
                  <input type="date" value={ticketFields.date}
                    onChange={(e) => setTicketFields((p) => ({ ...p, date: e.target.value }))}
                    className="input text-xs w-full py-1 px-2" />
                </div>
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Rate</label>
                  <input type="number" step="0.01" min="0" value={ticketFields.ratePerUnit}
                    onChange={(e) => setTicketFields((p) => ({ ...p, ratePerUnit: e.target.value }))}
                    className="input text-xs w-full py-1 px-2" placeholder="$/unit" />
                </div>
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Hauled From</label>
                  <input type="text" value={ticketFields.hauledFrom}
                    onChange={(e) => setTicketFields((p) => ({ ...p, hauledFrom: e.target.value }))}
                    className="input text-xs w-full py-1 px-2" placeholder="Origin" />
                </div>
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Hauled To</label>
                  <input type="text" value={ticketFields.hauledTo}
                    onChange={(e) => setTicketFields((p) => ({ ...p, hauledTo: e.target.value }))}
                    className="input text-xs w-full py-1 px-2" placeholder="Destination" />
                </div>
                <div>
                  <label className="text-[10px] text-steel-500 block mb-0.5">Material</label>
                  <input type="text" value={ticketFields.material}
                    onChange={(e) => setTicketFields((p) => ({ ...p, material: e.target.value }))}
                    className="input text-xs w-full py-1 px-2" placeholder="Material" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" disabled={savingTicket} onClick={handleSaveTicket}
                  className="btn-accent text-xs px-3 py-1 disabled:opacity-50">
                  {savingTicket ? 'Saving…' : 'Save'}
                </button>
                <button type="button" onClick={() => setEditingTicket(false)}
                  className="btn-ghost text-xs px-3 py-1">Cancel</button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ticket.photoUrl && (
              <div className="sm:col-span-2">
                <RotatableImage
                  src={ticket.photoUrl}
                  alt="Ticket photo"
                  className="rounded border border-steel-200 max-h-48 object-contain w-full bg-white"
                  linkToFullSize
                />
                <div className="text-xs text-steel-500 mt-1">
                  Click to view full size · Hover to rotate
                  {ticket.scannedAt && (
                    <> · Scanned {new Date(ticket.scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</>
                  )}
                </div>
              </div>
            )}
            {(hasExtracted || canEdit) && (
              <div className="sm:col-span-2 bg-green-50 border border-green-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-green-800 uppercase tracking-wider">
                    AI-Extracted Data
                  </div>
                  <div className="flex items-center gap-2">
                    {saveSuccess && <span className="text-xs text-green-700 font-medium">Saved</span>}
                    {canEdit && !editing && hasExtracted && (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-xs text-green-700 hover:text-green-900 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-steel-500 block mb-0.5">Physical Ticket #</label>
                        <input
                          type="text"
                          value={editFields.scannedTicketNumber}
                          onChange={(e) => setEditFields((p) => ({ ...p, scannedTicketNumber: e.target.value }))}
                          className="input text-xs w-full py-1 px-2"
                          placeholder="e.g. 12345"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 block mb-0.5">Ticket Date</label>
                        <input
                          type="text"
                          value={editFields.scannedDate}
                          onChange={(e) => setEditFields((p) => ({ ...p, scannedDate: e.target.value }))}
                          className="input text-xs w-full py-1 px-2"
                          placeholder="e.g. 04/17/2026"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 block mb-0.5">Tons</label>
                        <input
                          type="text"
                          value={editFields.scannedTons}
                          onChange={(e) => setEditFields((p) => ({ ...p, scannedTons: e.target.value, scannedYards: e.target.value ? '' : p.scannedYards }))}
                          className="input text-xs w-full py-1 px-2"
                          placeholder="e.g. 22.5"
                          disabled={!!editFields.scannedYards}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-steel-500 block mb-0.5">Yards</label>
                        <input
                          type="text"
                          value={editFields.scannedYards}
                          onChange={(e) => setEditFields((p) => ({ ...p, scannedYards: e.target.value, scannedTons: e.target.value ? '' : p.scannedTons }))}
                          className="input text-xs w-full py-1 px-2"
                          placeholder="e.g. 14"
                          disabled={!!editFields.scannedTons}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={handleSaveCorrections}
                        className="btn-accent text-xs px-2 py-1 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="btn-ghost text-xs px-2 py-1"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : hasExtracted ? (
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    {ticket.scannedTicketNumber && (
                      <div>
                        <dt className="text-steel-500">Physical Ticket #</dt>
                        <dd className="font-medium">{ticket.scannedTicketNumber}</dd>
                      </div>
                    )}
                    {ticket.scannedDate && (
                      <div>
                        <dt className="text-steel-500">Ticket Date</dt>
                        <dd className="font-medium">{ticket.scannedDate}</dd>
                      </div>
                    )}
                    {ticket.scannedTons && (
                      <div>
                        <dt className="text-steel-500">Tons</dt>
                        <dd className="font-medium">{ticket.scannedTons}</dd>
                      </div>
                    )}
                    {ticket.scannedYards && (
                      <div>
                        <dt className="text-steel-500">Yards</dt>
                        <dd className="font-medium">{ticket.scannedYards}</dd>
                      </div>
                    )}
                  </dl>
                ) : (
                  <p className="text-xs text-steel-500 italic">No data extracted yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
