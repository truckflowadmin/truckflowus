'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import RotatableImage from '@/components/RotatableImage';
import { driverUpdateStatus, uploadTicketPhoto, claimJob, driverUpdateJobStatus, requestTimeOff, cancelTimeOff, driverSubmitReviewedTickets, driverEditTicket } from './actions';
import { useLanguage } from '@/components/LanguageProvider';
import LanguageToggle from '@/components/LanguageToggle';

// ---- Types ----------------------------------------------------------------
interface TicketData {
  id: string;
  ticketNumber: number;
  status: string;
  material: string | null;
  quantityType: string;
  quantity: number;
  hauledFrom: string;
  hauledTo: string;
  truckNumber: string | null;
  ticketRef: string | null;
  date: string | null; // ISO
  driverNotes: string | null;
  ratePerUnit: number | null;
  completedAt: string | null;
  photoUrl: string | null;
  scannedTons: string | null;
  scannedYards: string | null;
  scannedTicketNumber: string | null;
  scannedDate: string | null;
  customer: { name: string } | null;
}

interface JobData2 {
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
  ticketCount: number;
  ratePerUnit: number | null;
  date: string | null;
  notes: string | null;
  driverTimeSeconds: number;
  lastResumedAt: string | null; // ISO
  startedAt: string | null; // ISO — set once job is first started
  requiredTruckCount?: number;
  assignmentCount?: number; // how many drivers already assigned
  customer: { name: string } | null;
  broker: { name: string } | null;
}

type AvailableJobData = JobData2;

interface TimeOffData {
  id: string;
  startDate: string; // ISO
  endDate: string;   // ISO
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'DENIED';
  reviewNote: string | null;
}

interface CompletedJobData {
  id: string;
  jobNumber: number;
  name: string;
  hauledFrom: string;
  hauledTo: string;
  material: string | null;
  truckNumber: string | null;
  quantityType: string;
  totalLoads: number;
  ticketCount: number;
  completedLoads: number;
  ratePerUnit: number | null;
  date: string | null;
  completedAt: string | null;
  driverTimeSeconds: number;
  customer: { name: string } | null;
  broker: { name: string } | null;
  tickets: {
    id: string;
    ticketNumber: number;
    photoUrl: string | null;
    status: string;
    hauledFrom: string;
    hauledTo: string;
    material: string;
    quantity: number;
    quantityType: string;
    truckNumber: string;
    ticketRef: string;
    date: string | null;
    driverNotes: string;
    dispatcherReviewedAt: string | null;
    scannedTons: string | null;
    scannedYards: string | null;
    scannedTicketNumber: string | null;
    scannedDate: string | null;
  }[];
}

interface DocumentData {
  id: string;
  docType: string;
  label: string | null;
  fileUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface DriverProfileData {
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

interface TripSheetData {
  id: string;
  weekEnding: string;
  status: string;
  totalDue: number | null;
  broker: { name: string } | null;
  ticketCount: number;
  driverRevenue: number;
}

interface PayrollData {
  workerType: string;
  payType: string;
  payRate: number | null;
  nextPayDate: string | null;
}

interface DriverTabsProps {
  token: string;
  driverName: string;
  companyName: string;
  truckNumber: string | null;
  completedToday: number;
  activeTickets: TicketData[];
  completedTickets: TicketData[];
  availableJobs: AvailableJobData[];
  upcomingJobs: JobData2[];
  completedJobs: CompletedJobData[];
  canReportIssues: boolean;
  canUseMaps: boolean;
  canSeeDailyStats: boolean;
  canUploadPhotos: boolean;
  canAiExtract: boolean;
  canViewCompleted: boolean;
  canClaimJobs: boolean;
  hasAssignedTruck: boolean;
  timeOffRequests: TimeOffData[];
  documents: DocumentData[];
  profile: DriverProfileData;
  driverExpenses: DriverExpenseData[];
  tripSheets: TripSheetData[];
  payroll: PayrollData;
}

interface DriverExpenseData {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string | null;
  vendor: string | null;
  receiptUrl: string | null;
  notes: string | null;
  truckNumber: string | null;
}

const QTY_ABBR: Record<string, string> = { LOADS: 'load', TONS: 'ton', YARDS: 'yard' };

function qtyStr(quantity: number, quantityType: string) {
  const unit = QTY_ABBR[quantityType] || 'load';
  const n = Number(quantity);
  const display = quantityType === 'TONS' ? n.toFixed(2) : String(Math.round(n));
  return `${display} ${unit}${n === 1 ? '' : 's'}`;
}

// ---- Time tracking helpers -------------------------------------------------
function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** Live ticking timer that displays accumulated + current segment time */
function LiveTimer({
  driverTimeSeconds,
  lastResumedAt,
  running,
}: {
  driverTimeSeconds: number;
  lastResumedAt: string | null;
  running: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  let total = driverTimeSeconds;
  if (running && lastResumedAt) {
    const elapsed = Math.max(0, Math.round((now - new Date(lastResumedAt).getTime()) / 1000));
    total += elapsed;
  }

  return (
    <div className={`flex items-center gap-1.5 ${running ? 'text-safety-dark' : 'text-steel-600'}`}>
      <span className={`text-xs ${running ? 'animate-pulse' : ''}`}>{running ? '⏱' : '⏱'}</span>
      <span className="font-mono font-bold text-sm tabular-nums">{formatDuration(total)}</span>
      {running && <span className="text-[10px] text-safety-dark font-semibold uppercase tracking-wider">Active</span>}
      {!running && total > 0 && <span className="text-[10px] text-steel-500 uppercase tracking-wider">Paused</span>}
    </div>
  );
}

// ---- Helpers --------------------------------------------------------------
/** Is the job's date today or in the past? (no date = treat as today so driver sees it) */
function isJobActiveToday(job: JobData2): boolean {
  if (!job.date) return true; // no date set → show as active now
  const jobDate = new Date(job.date);
  const today = new Date();
  // Compare year/month/day only
  jobDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return jobDate <= today;
}

// ---- Cancel Button (shared by Today + Upcoming cards) --------------------
function CancelJobButton({ loading, onCancel }: { loading: boolean; onCancel: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex gap-2 mt-1">
        <button
          onClick={onCancel}
          disabled={loading}
          className="btn-danger flex-1 py-2 text-sm"
        >
          {loading ? 'Cancelling...' : 'Yes, Cancel Job'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="btn-ghost flex-1 py-2 text-sm"
        >
          Never mind
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="w-full text-center text-xs text-red-500 hover:text-red-700 py-1 mt-1"
    >
      Cancel Job
    </button>
  );
}

// ---- Main Component -------------------------------------------------------
export default function DriverTabs(props: DriverTabsProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'active' | 'available' | 'upcoming' | 'completed' | 'calendar' | 'expenses' | 'profile'>('active');
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/driver/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
    } catch { /* ignore */ }
    router.push('/d/login?signedout=1');
  }

  const showAvailable = props.canClaimJobs;

  // Split upcoming jobs: today/past-due → Active tab, future → Upcoming tab
  const todaysJobs = props.upcomingJobs.filter(isJobActiveToday);
  const futureJobs = props.upcomingJobs.filter((j) => !isJobActiveToday(j));

  return (
    <div className="min-h-screen bg-steel-100">
      {/* Header */}
      <header className="bg-diesel text-white px-4 py-4 sticky top-0 z-10 shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-safety rounded flex items-center justify-center font-black text-diesel text-lg">
            TF
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold truncate">{props.driverName}</div>
            <div className="text-xs text-steel-400 truncate">
              {props.companyName}
            </div>
          </div>
          {props.canSeeDailyStats && (
            <div className="text-right">
              <div className="text-xs text-steel-400 uppercase tracking-wider">{t('driver.doneToday')}</div>
              <div className="font-bold text-safety tabular-nums">{props.completedToday}</div>
            </div>
          )}
          <LanguageToggle variant="driver" />
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="ml-2 p-2 rounded-lg text-steel-400 hover:text-white hover:bg-steel-700 transition-colors"
            title={t('driver.logOut')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </header>

      {/* Tabs — horizontally scrollable on small screens */}
      <div className="sticky top-[72px] z-10 bg-steel-100 border-b border-steel-300">
        <div className="overflow-x-auto scrollbar-hide max-w-lg mx-auto">
          <div className="flex min-w-max">
            <button
              onClick={() => setTab('active')}
              className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === 'active'
                  ? 'text-diesel border-b-2 border-safety'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              {t('driver.myJobs')}
            </button>
            {showAvailable && (
              <button
                onClick={() => setTab('available')}
                className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap relative ${
                  tab === 'available'
                    ? 'text-diesel border-b-2 border-safety'
                    : 'text-steel-500 hover:text-steel-700'
                }`}
              >
                {t('driver.availableJobs')}
                {props.availableJobs.length > 0 && (
                  <span className="absolute top-1 right-0.5 w-2 h-2 bg-safety rounded-full animate-pulse" />
                )}
              </button>
            )}
            {futureJobs.length > 0 && (
              <button
                onClick={() => setTab('upcoming')}
                className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  tab === 'upcoming'
                    ? 'text-diesel border-b-2 border-safety'
                    : 'text-steel-500 hover:text-steel-700'
                }`}
              >
                Upcoming
              </button>
            )}
            {props.canViewCompleted && (
              <button
                onClick={() => setTab('completed')}
                className={`px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  tab === 'completed'
                    ? 'text-diesel border-b-2 border-safety'
                    : 'text-steel-500 hover:text-steel-700'
                }`}
              >
                {t('driver.history')}
              </button>
            )}
            <button
              onClick={() => setTab('calendar')}
              className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === 'calendar'
                  ? 'text-diesel border-b-2 border-safety'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mx-auto"><path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z" clipRule="evenodd" /></svg>
            </button>
            <button
              onClick={() => setTab('expenses')}
              className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === 'expenses'
                  ? 'text-diesel border-b-2 border-safety'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mx-auto"><path fillRule="evenodd" d="M1 4a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4Zm12 4a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm13-1a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM1.75 14.5a.75.75 0 0 0 0 1.5c4.417 0 8.693.603 12.749 1.73 1.111.309 2.251-.512 2.251-1.696v-.784a.75.75 0 0 0-1.5 0v.784a.272.272 0 0 1-.35.25A49.043 49.043 0 0 0 1.75 14.5Z" clipRule="evenodd" /></svg>
            </button>
            <button
              onClick={() => setTab('profile')}
              className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap ${
                tab === 'profile'
                  ? 'text-diesel border-b-2 border-safety'
                  : 'text-steel-500 hover:text-steel-700'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 mx-auto"><path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="p-4 pb-24 max-w-lg mx-auto">
        {tab === 'expenses' ? (
          <ExpensesTab
            token={props.token}
            expenses={props.driverExpenses}
          />
        ) : tab === 'profile' ? (
          <ProfileTab
            token={props.token}
            driverName={props.driverName}
            truckNumber={props.truckNumber}
            documents={props.documents}
            profile={props.profile}
          />
        ) : tab === 'available' && showAvailable ? (
          <AvailableJobsTab
            jobs={props.availableJobs}
            token={props.token}
            canUseMaps={props.canUseMaps}
            hasAssignedTruck={props.hasAssignedTruck}
          />
        ) : tab === 'upcoming' ? (
          <UpcomingJobsTab
            jobs={futureJobs}
            token={props.token}
            canUseMaps={props.canUseMaps}
          />
        ) : tab === 'calendar' ? (
          <CalendarTab
            requests={props.timeOffRequests}
            token={props.token}
          />
        ) : tab === 'completed' && props.canViewCompleted ? (
          <CompletedTab
            tickets={props.completedTickets}
            completedJobs={props.completedJobs}
            token={props.token}
            canUploadPhotos={props.canUploadPhotos}
            canAiExtract={props.canAiExtract}
            tripSheets={props.tripSheets}
            payroll={props.payroll}
          />
        ) : (
          <ActiveJobsTab
            tickets={props.activeTickets}
            todaysJobs={todaysJobs}
            token={props.token}
            canReportIssues={props.canReportIssues}
            canUseMaps={props.canUseMaps}
          />
        )}
      </main>
    </div>
  );
}

// ---- Upcoming Jobs Tab ----------------------------------------------------
function UpcomingJobsTab({
  jobs,
  token,
  canUseMaps,
}: {
  jobs: JobData2[];
  token: string;
  canUseMaps: boolean;
}) {
  if (jobs.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-5xl mb-3">📅</div>
        <h2 className="font-bold text-lg mb-1">No upcoming jobs</h2>
        <p className="text-sm text-steel-500">Jobs assigned to you will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
        {jobs.length} upcoming job{jobs.length === 1 ? '' : 's'}
      </h2>
      {jobs.map((j) => (
        <UpcomingJobCard key={j.id} job={j} token={token} canUseMaps={canUseMaps} />
      ))}
    </div>
  );
}

// ---- Upcoming Job Card ----------------------------------------------------
function UpcomingJobCard({
  job,
  token,
  canUseMaps,
}: {
  job: JobData2;
  token: string;
  canUseMaps: boolean;
}) {
  const { t } = useLanguage();
  const [jobStatus, setJobStatus] = useState(job.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeSeconds, setTimeSeconds] = useState(job.driverTimeSeconds);
  const [resumedAt, setResumedAt] = useState(job.lastResumedAt);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueSent, setIssueSent] = useState(false);

  const mapsUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const unlimitedLoads = job.totalLoads === 0;
  const STATUS_PROGRESS: Record<string, number> = { CREATED: 0, ASSIGNED: 25, IN_PROGRESS: 50, COMPLETED: 100, CANCELLED: 0 };
  const progress = unlimitedLoads
    ? (STATUS_PROGRESS[job.status] ?? STATUS_PROGRESS[jobStatus] ?? 0)
    : Math.round((job.ticketCount / job.totalLoads) * 100);
  const isInProgress = jobStatus === 'IN_PROGRESS';
  const isAssigned = jobStatus === 'ASSIGNED';
  const isCompleted = jobStatus === 'COMPLETED';
  const isCancelled = jobStatus === 'CANCELLED';

  async function handleAction(action: 'start' | 'pause' | 'complete' | 'cancel') {
    const prevStatus = jobStatus;
    const prevTime = timeSeconds;
    const prevResumed = resumedAt;
    setLoading(true);
    setError('');
    const statusMap: Record<string, string> = { start: 'IN_PROGRESS', pause: 'ASSIGNED', complete: 'COMPLETED', cancel: 'CANCELLED' };
    setJobStatus(statusMap[action] || prevStatus);
    if (action === 'start') {
      setResumedAt(new Date().toISOString());
    } else if (action === 'pause' || action === 'complete' || action === 'cancel') {
      if (resumedAt) {
        const elapsed = Math.max(0, Math.round((Date.now() - new Date(resumedAt).getTime()) / 1000));
        setTimeSeconds((prev) => prev + elapsed);
      }
      setResumedAt(null);
    }
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('jobId', job.id);
      fd.set('action', action);
      const res = await driverUpdateJobStatus(fd);
      if (res.driverTimeSeconds !== undefined) setTimeSeconds(res.driverTimeSeconds);
      if (res.lastResumedAt !== undefined) setResumedAt(res.lastResumedAt);
    } catch (err: any) {
      setError(err.message || 'Action failed');
      setJobStatus(prevStatus);
      setTimeSeconds(prevTime);
      setResumedAt(prevResumed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-lg border-2 ${isCompleted ? 'border-green-400 bg-green-50' : isInProgress ? 'border-safety bg-safety/5' : isCancelled ? 'border-red-300 bg-red-50/50' : 'border-steel-300 bg-white'} shadow-panel overflow-hidden transition-colors`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono font-bold text-sm">Job #{job.jobNumber}</div>
          <span className={`badge ${isCompleted ? 'bg-green-200 text-green-900' : isInProgress ? 'bg-safety text-diesel' : isCancelled ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
            {jobStatus.replace('_', ' ')}
          </span>
        </div>

        {/* Job name */}
        <div className="font-semibold text-steel-800 mb-2">{job.name}</div>

        {/* Driver time tracker */}
        {(isInProgress || timeSeconds > 0) && (
          <div className="mb-3">
            <LiveTimer
              driverTimeSeconds={timeSeconds}
              lastResumedAt={resumedAt}
              running={isInProgress}
            />
          </div>
        )}

        {job.broker && (
          <div className="text-xs text-steel-500 mb-1">Broker: {job.broker.name}</div>
        )}
        {job.customer && (
          <div className="text-xs text-steel-500 mb-2">Customer: {job.customer.name}</div>
        )}

        {/* Details */}
        <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
          {job.material && (
            <div>
              <span className="text-steel-500">Material:</span>{' '}
              <span className="font-medium">{job.material}</span>
            </div>
          )}
          {job.ratePerUnit !== null && (
            <div>
              <span className="text-steel-500">Rate:</span>{' '}
              <span className="font-medium">${job.ratePerUnit.toFixed(2)}/{QTY_ABBR[job.quantityType] || 'load'}</span>
            </div>
          )}
        </div>

        {/* Load progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-steel-500">Loads</span>
            <span className="font-semibold text-steel-700">
              {unlimitedLoads ? `${progress}%` : `${job.ticketCount} / ${job.totalLoads}`}
            </span>
          </div>
          <div className="w-full h-2 bg-steel-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-safety rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>

        {/* Route */}
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">From</div>
            {canUseMaps ? (
              <a href={mapsUrl(job.hauledFromAddress || job.hauledFrom)} target="_blank" className="text-steel-900 hover:text-safety-dark">
                {job.hauledFrom} ↗
              </a>
            ) : (
              <div className="text-steel-900">{job.hauledFrom}</div>
            )}
            {job.hauledFromAddress && (
              <div className="text-xs text-steel-500">{job.hauledFromAddress}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">To</div>
            {canUseMaps ? (
              <a href={mapsUrl(job.hauledToAddress || job.hauledTo)} target="_blank" className="text-steel-900 hover:text-safety-dark">
                {job.hauledTo} ↗
              </a>
            ) : (
              <div className="text-steel-900">{job.hauledTo}</div>
            )}
            {job.hauledToAddress && (
              <div className="text-xs text-steel-500">{job.hauledToAddress}</div>
            )}
          </div>
        </div>

        {job.date && (
          <div className="text-xs text-steel-500 mt-3">
            Target Date: {format(new Date(job.date), 'MMM d, yyyy')}
          </div>
        )}

        {job.notes && (
          <div className="text-xs text-steel-500 mt-2 bg-steel-100 rounded p-2">
            {job.notes}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="border-t border-steel-200 bg-steel-50 p-3 space-y-2">
        {isAssigned && (
          <button
            onClick={() => handleAction('start')}
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? '...' : job.startedAt ? `▶ ${t('driver.resumeJob')}` : `▶ ${t('driver.startJob')}`}
          </button>
        )}
        {isInProgress && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('pause')}
                disabled={loading}
                className="btn-ghost flex-1 py-3 text-base"
              >
                {loading ? '...' : `⏸ ${t('driver.pauseJob')}`}
              </button>
              <button
                onClick={() => handleAction('complete')}
                disabled={loading}
                className="btn-accent flex-1 py-3 text-base font-bold"
              >
                {loading ? '...' : `✓ ${t('driver.completeJob')}`}
              </button>
            </div>
            {/* Report Issue */}
            {issueSent ? (
              <div className="text-center text-sm text-amber-700 bg-amber-50 rounded-lg py-2 font-medium">
                ✓ {t('driver.reportIssue')}
              </div>
            ) : showIssueForm ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setLoading(true);
                  setError('');
                  try {
                    const sfd = new FormData();
                    sfd.set('token', token);
                    sfd.set('jobId', job.id);
                    sfd.set('action', 'report_issue');
                    sfd.set('note', String(fd.get('note') || ''));
                    await driverUpdateJobStatus(sfd);
                    setIssueSent(true);
                    setShowIssueForm(false);
                  } catch (err: any) {
                    setError(err.message || 'Failed to report issue');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2"
              >
                <textarea
                  name="note"
                  required
                  rows={2}
                  placeholder="Describe the issue..."
                  className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIssueForm(false)}
                    className="btn-ghost flex-1 py-2 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    {loading ? '...' : t('common.submit')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowIssueForm(true)}
                className="w-full py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                ⚠ {t('driver.reportIssue')}
              </button>
            )}
          </>
        )}
        {isCompleted && (
          <div className="text-center text-sm text-green-700 font-semibold py-2">
            ✓ {t('driver.completeJob')}
          </div>
        )}
        {!isCompleted && !isCancelled && (
          <CancelJobButton loading={loading} onCancel={() => handleAction('cancel')} />
        )}
      </div>
    </div>
  );
}

// ---- Active Jobs Tab ------------------------------------------------------
function ActiveJobsTab({
  tickets,
  todaysJobs,
  token,
  canReportIssues,
  canUseMaps,
}: {
  tickets: TicketData[];
  todaysJobs: JobData2[];
  token: string;
  canReportIssues: boolean;
  canUseMaps: boolean;
}) {
  const { t } = useLanguage();
  const totalCount = tickets.length + todaysJobs.length;

  if (totalCount === 0) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-5xl mb-3">✓</div>
        <h2 className="font-bold text-lg mb-1">{t('driver.noAvailableJobs')}</h2>
        <p className="text-sm text-steel-500">{t('driver.noActiveTickets')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
        {totalCount} {t('driver.myJobs').toLowerCase()}
      </h2>
      {/* Today's jobs (promoted from upcoming) */}
      {todaysJobs.map((j) => (
        <TodaysJobCard key={j.id} job={j} token={token} canUseMaps={canUseMaps} />
      ))}
      {/* Active tickets */}
      {tickets.map((tk) => (
        <JobCard
          key={tk.id}
          ticket={tk}
          token={token}
          canReportIssues={canReportIssues}
          canUseMaps={canUseMaps}
        />
      ))}
    </div>
  );
}

// ---- Completed Tab --------------------------------------------------------
function CompletedTab({
  tickets,
  completedJobs,
  token,
  canUploadPhotos,
  canAiExtract,
  tripSheets,
  payroll,
}: {
  tickets: TicketData[];
  completedJobs: CompletedJobData[];
  token: string;
  canUploadPhotos: boolean;
  canAiExtract: boolean;
  tripSheets: TripSheetData[];
  payroll: PayrollData;
}) {
  const { t } = useLanguage();

  // Calculate estimated pay for percentage-based contractors
  const isPercentageContractor = payroll.workerType === 'CONTRACTOR' && payroll.payType === 'PERCENTAGE' && payroll.payRate;
  const totalTripSheetRevenue = tripSheets.reduce((sum, ts) => sum + ts.driverRevenue, 0);
  const estimatedPay = isPercentageContractor
    ? Math.round(totalTripSheetRevenue * (payroll.payRate! / 100) * 100) / 100
    : 0;

  const hasContent = tickets.length > 0 || completedJobs.length > 0 || tripSheets.length > 0;

  if (!hasContent) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-5xl mb-3">📋</div>
        <h2 className="font-bold text-lg mb-1">{t('driver.noCompletedJobs')}</h2>
        <p className="text-sm text-steel-500">{t('driver.noCompletedTickets')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Estimated Pay Card — percentage contractors only */}
      {isPercentageContractor && tripSheets.length > 0 && (
        <div className="rounded-lg border-2 border-green-300 bg-green-50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs uppercase tracking-widest text-green-700 font-semibold">
              Estimated Payment
            </h2>
            <button
              onClick={() => window.print()}
              className="text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg transition-colors"
            >
              Print Estimate
            </button>
          </div>
          <div className="text-3xl font-bold text-green-800 tabular-nums">
            ${estimatedPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-green-700 mt-1">
            {payroll.payRate}% of ${totalTripSheetRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total trip sheet revenue
          </div>
          {payroll.nextPayDate && (
            <div className="mt-3 pt-3 border-t border-green-200 text-sm text-green-800 font-medium">
              Your estimated payment of ${estimatedPay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} will be paid on{' '}
              {format(new Date(payroll.nextPayDate), 'EEEE, MMMM d, yyyy')}
            </div>
          )}
        </div>
      )}

      {/* Trip Sheets */}
      {tripSheets.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
            Trip Sheets ({tripSheets.length})
          </h2>
          {tripSheets.map((ts) => {
            const tsPayEst = isPercentageContractor
              ? Math.round(ts.driverRevenue * (payroll.payRate! / 100) * 100) / 100
              : null;
            return (
              <div key={ts.id} className="rounded-lg border border-steel-200 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">
                    Week ending {format(new Date(ts.weekEnding), 'MMM d, yyyy')}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${
                    ts.status === 'PAID' ? 'bg-green-100 text-green-800' :
                    ts.status === 'SENT' ? 'bg-blue-100 text-blue-800' :
                    'bg-steel-100 text-steel-600'
                  }`}>
                    {ts.status}
                  </span>
                </div>
                <div className="text-xs text-steel-500">
                  {ts.broker?.name ?? 'No broker'} &middot; {ts.ticketCount} ticket{ts.ticketCount !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm font-medium">
                    Revenue: ${ts.driverRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  {tsPayEst !== null && (
                    <div className="text-sm text-green-700 font-medium">
                      Your {payroll.payRate}%: ${tsPayEst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Completed Jobs — with bulk upload */}
      {completedJobs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
            {t('driver.completedJobs')} ({completedJobs.length})
          </h2>
          {completedJobs.map((j) => (
            <CompletedJobCard
              key={j.id}
              job={j}
              token={token}
              canUploadPhotos={canUploadPhotos}
              canAiExtract={canAiExtract}
            />
          ))}
        </div>
      )}

      {/* Completed Tickets — summary only, no "View" link */}
      {tickets.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
            {t('driver.completedTickets')} ({tickets.length})
          </h2>
          {tickets.map((tk) => {
            const num = String(tk.ticketNumber).padStart(4, '0');
            const rate = tk.ratePerUnit ? Number(tk.ratePerUnit) : null;
            return (
              <div key={tk.id} className="rounded-lg border border-steel-200 bg-white p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono font-bold text-sm">#{num}</span>
                  <span className="badge bg-green-100 text-green-800">DONE</span>
                </div>
                <div className="text-xs text-steel-500">
                  {tk.completedAt ? format(new Date(tk.completedAt), 'EEE MMM d, h:mm a') : '—'}
                  {tk.customer && <> &middot; {tk.customer.name}</>}
                </div>
                <div className="text-sm mt-1">
                  {tk.material && <span className="text-steel-700">{tk.material} &middot; </span>}
                  {qtyStr(tk.quantity, tk.quantityType)}
                  {rate !== null && <span className="text-steel-500"> @ ${rate.toFixed(2)}/{QTY_ABBR[tk.quantityType] || 'load'}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Scanned item for review -----------------------------------------------
interface ScannedTicketItem {
  id: string;
  fileName: string;
  photoUrl: string;
  status: 'uploading' | 'scanned' | 'error';
  error?: string;
  // Editable fields
  hauledFrom: string;
  hauledTo: string;
  material: string;
  quantity: number;
  quantityType: 'LOADS' | 'TONS' | 'YARDS';
  ticketRef: string;
  date: string;
  driverNotes: string;
  // Original AI data (preserved for the record)
  scannedTons: string | null;
  scannedYards: string | null;
  scannedTicketNumber: string | null;
  scannedDate: string | null;
  scannedRawText: string | null;
}

let _scanIdCounter = 0;

// ---- Completed Job Card with Scan → Review → Submit -----------------------
function CompletedJobCard({
  job,
  token,
  canUploadPhotos,
  canAiExtract,
}: {
  job: CompletedJobData;
  token: string;
  canUploadPhotos: boolean;
  canAiExtract: boolean;
}) {
  const { t } = useLanguage();
  const [items, setItems] = useState<ScannedTicketItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ count: number; tickets: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadingCount = items.filter((i) => i.status === 'uploading').length;
  const scannedCount = items.filter((i) => i.status === 'scanned').length;
  const readyCount = items.filter(
    (i) => i.status === 'scanned' && i.hauledFrom.trim() && i.hauledTo.trim(),
  ).length;

  function updateItem(id: string, updates: Partial<ScannedTicketItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleFiles() {
    const files = fileRef.current?.files;
    if (!files || files.length === 0) return;
    setError(null);
    setSubmitResult(null);

    // Create placeholder items
    const newItems: ScannedTicketItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      newItems.push({
        id: `scan-${++_scanIdCounter}`,
        fileName: file.name,
        photoUrl: '',
        status: 'uploading',
        hauledFrom: job.hauledFrom,
        hauledTo: job.hauledTo,
        material: job.material || '',
        quantity: 1,
        quantityType: job.quantityType as any,
        ticketRef: '',
        date: job.date ? job.date.split('T')[0] : '',
        driverNotes: '',
        scannedTons: null,
        scannedYards: null,
        scannedTicketNumber: null,
        scannedDate: null,
        scannedRawText: null,
      });
    }
    setItems((prev) => [...prev, ...newItems]);

    // Upload & scan each file
    for (let i = 0; i < newItems.length; i++) {
      const file = files[i];
      const item = newItems[i];
      const fd = new FormData();
      fd.append('token', token);
      fd.append('file', file);

      try {
        const res = await fetch('/api/driver/scan', { method: 'POST', body: fd });
        const data = await res.json();

        if (!res.ok) {
          updateItem(item.id, { status: 'error', error: data.error || 'Scan failed' });
          continue;
        }

        const ext = data.extracted || {};
        const updates: Partial<ScannedTicketItem> = {
          status: 'scanned',
          photoUrl: data.photoUrl,
          scannedTons: ext.tons ?? null,
          scannedYards: ext.yards ?? null,
          scannedTicketNumber: ext.ticketNumber ?? null,
          scannedDate: ext.date ?? null,
          scannedRawText: ext.rawText ?? null,
        };

        // Only pre-fill quantity + ticket number from scan — all other fields
        // (hauledFrom, hauledTo, material, customer, date, etc.) come from the job
        if (ext.ticketNumber) updates.ticketRef = ext.ticketNumber;
        if (ext.tons) {
          const parsed = parseFloat(ext.tons);
          if (!isNaN(parsed) && parsed > 0) {
            updates.quantity = parsed;
            updates.quantityType = 'TONS';
          }
        } else if (ext.yards) {
          const parsed = parseFloat(ext.yards);
          if (!isNaN(parsed) && parsed > 0) {
            updates.quantity = parsed;
            updates.quantityType = 'YARDS';
          }
        }

        updateItem(item.id, updates);
      } catch (err: any) {
        updateItem(item.id, { status: 'error', error: err.message || 'Upload failed' });
      }
    }

    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleSubmit() {
    const valid = items.filter(
      (i) => i.status === 'scanned' && i.hauledFrom.trim() && i.hauledTo.trim(),
    );
    if (!valid.length) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = valid.map((i) => ({
        photoUrl: i.photoUrl,
        hauledFrom: i.hauledFrom,
        hauledTo: i.hauledTo,
        material: i.material,
        quantity: i.quantity,
        quantityType: i.quantityType,
        ticketRef: i.ticketRef,
        date: i.date,
        driverNotes: i.driverNotes,
        scannedTons: i.scannedTons,
        scannedYards: i.scannedYards,
        scannedTicketNumber: i.scannedTicketNumber,
        scannedDate: i.scannedDate,
        scannedRawText: i.scannedRawText,
      }));

      const fd = new FormData();
      fd.set('token', token);
      fd.set('jobId', job.id);
      fd.set('items', JSON.stringify(payload));

      const res = await driverSubmitReviewedTickets(fd);
      if (res.success) {
        setSubmitResult({ count: res.count, tickets: res.tickets });
        setItems([]);
      }
    } catch (err: any) {
      setError(err.message || 'Submit failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg border border-steel-200 bg-white overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono font-bold text-sm">Job #{job.jobNumber}</span>
          <span className="badge bg-green-100 text-green-800">COMPLETED</span>
        </div>

        <div className="font-semibold text-steel-800 text-sm mb-1">{job.name}</div>

        <div className="text-xs text-steel-500">
          {job.completedAt ? format(new Date(job.completedAt), 'EEE MMM d, h:mm a') : '—'}
          {job.customer && <> · {job.customer.name}</>}
          {job.broker && <> · {job.broker.name}</>}
        </div>

        {/* Job details */}
        <div className="flex items-center gap-3 text-xs text-steel-600 mt-2 flex-wrap">
          {job.material && <span>{job.material}</span>}
          <span>{job.totalLoads > 0 ? `${job.ticketCount}/${job.totalLoads} loads` : 'Open loads'}</span>
          {job.driverTimeSeconds > 0 && (
            <span>⏱ {formatDuration(job.driverTimeSeconds)}</span>
          )}
          {job.ratePerUnit !== null && (
            <span>${job.ratePerUnit.toFixed(2)}/{QTY_ABBR[job.quantityType] || 'load'}</span>
          )}
        </div>

        {/* Route */}
        <div className="mt-2 text-xs">
          <span className="text-steel-500">From:</span>{' '}
          <span className="text-steel-700">{job.hauledFrom}</span>
          <span className="text-steel-400 mx-1">&rarr;</span>
          <span className="text-steel-500">To:</span>{' '}
          <span className="text-steel-700">{job.hauledTo}</span>
        </div>

        {/* Missing photo reminder for completed job */}
        {(() => {
          const missingCount = job.tickets.filter((tk) => !tk.photoUrl).length;
          return missingCount > 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
              <span className="text-lg leading-none">📷</span>
              <p className="text-xs text-amber-800 font-medium">
                {missingCount} ticket{missingCount !== 1 ? 's' : ''} missing photo — upload images to complete {missingCount !== 1 ? 'these loads' : 'this load'}
              </p>
            </div>
          ) : null;
        })()}

        {/* Submitted tickets — editable if not reviewed, locked if reviewed */}
        {job.tickets.length > 0 && (
          <div className="mt-3 space-y-2">
            <h3 className="text-xs uppercase tracking-widest text-steel-500 font-semibold">
              {t('driver.submitTicket')} ({job.tickets.length})
            </h3>
            {job.tickets.map((tk) => (
              <SubmittedTicketCard key={tk.id} ticket={tk} token={token} />
            ))}
          </div>
        )}

        {/* Submit success */}
        {submitResult && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-1">
              ✓ {submitResult.count} Ticket{submitResult.count !== 1 ? 's' : ''} Submitted
            </div>
            <div className="text-xs text-blue-700">
              Ticket numbers: {submitResult.tickets.map((tk: any) => `#${String(tk.ticketNumber).padStart(4, '0')}`).join(', ')}
            </div>
          </div>
        )}

        {/* Upload area — always show so driver can add more */}
        {canUploadPhotos && items.length === 0 && (
          <div className="mt-3 border-t border-steel-200 pt-3">
            <label className="block cursor-pointer">
              <div className="flex flex-col items-center justify-center gap-1 py-5 px-3 rounded-lg border-2 border-dashed border-steel-300 bg-steel-50 hover:border-safety transition-colors">
                <span className="text-3xl">📸</span>
                <span className="text-sm font-medium text-steel-700">
                  Upload ticket photos for this job
                </span>
                <span className="text-xs text-steel-500">
                  {canAiExtract
                    ? 'Select multiple photos — AI will scan, then you review before submitting'
                    : 'Select multiple photos — review & edit before submitting'}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFiles}
              />
            </label>
          </div>
        )}

        {/* ── Review Section ── */}
        {items.length > 0 && (
          <div className="mt-3 border-t border-steel-200 pt-3">
            {/* Status bar */}
            <div className="flex items-center justify-between bg-steel-50 rounded-lg px-3 py-2 mb-3">
              <div className="text-xs text-steel-600">
                {uploadingCount > 0 && (
                  <span className="inline-flex items-center gap-1 mr-3">
                    <span className="animate-spin text-[10px]">⏳</span> Scanning {uploadingCount}...
                  </span>
                )}
                <span>{scannedCount} scanned</span>
                <span className="mx-1">·</span>
                <span>{readyCount} ready</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Add more photos */}
                <label className="text-xs text-steel-500 hover:text-steel-700 cursor-pointer">
                  + Add more
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFiles}
                  />
                </label>
                <button
                  onClick={() => { setItems([]); setError(null); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Scanned items for review */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border ${
                    item.status === 'error'
                      ? 'border-red-300 bg-red-50/30'
                      : 'border-steel-200 bg-steel-50/30'
                  } p-3`}
                >
                  {item.status === 'uploading' ? (
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded bg-steel-100 flex items-center justify-center flex-shrink-0">
                        <span className="animate-spin text-lg">⏳</span>
                      </div>
                      <div>
                        <p className="text-sm text-steel-600">Scanning {item.fileName}...</p>
                        <p className="text-xs text-steel-400">AI is extracting ticket data</p>
                      </div>
                    </div>
                  ) : item.status === 'error' ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-700">{item.fileName}</p>
                        <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-steel-400 hover:text-red-500"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Photo + header */}
                      <div className="flex gap-3 mb-2">
                        <div className="w-20 h-20 rounded overflow-hidden bg-steel-100 flex-shrink-0">
                          {item.photoUrl ? (
                            <img src={item.photoUrl} alt="Ticket" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-steel-400 text-xs">
                              No preview
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                              {canAiExtract ? 'AI Scanned' : 'Photo Saved'}
                            </span>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="text-xs text-steel-400 hover:text-red-500"
                            >
                              Remove
                            </button>
                          </div>
                          <p className="text-[10px] text-steel-400 mt-0.5 truncate">{item.fileName}</p>

                          {/* AI extraction summary */}
                          {canAiExtract && (item.scannedTons || item.scannedYards || item.scannedTicketNumber) && (
                            <div className="text-[10px] text-blue-600 bg-blue-50 rounded px-2 py-1 mt-1 flex flex-wrap gap-x-3">
                              {item.scannedTicketNumber && <span>Ticket: <strong>{item.scannedTicketNumber}</strong></span>}
                              {item.scannedTons && <span>Tons: <strong>{item.scannedTons}</strong></span>}
                              {item.scannedYards && <span>Yards: <strong>{item.scannedYards}</strong></span>}
                              {item.scannedDate && <span>Date: <strong>{item.scannedDate}</strong></span>}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Editable fields */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-steel-500 uppercase">Hauled From *</label>
                          <input
                            className="input text-xs"
                            value={item.hauledFrom}
                            onChange={(e) => updateItem(item.id, { hauledFrom: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-steel-500 uppercase">Hauled To *</label>
                          <input
                            className="input text-xs"
                            value={item.hauledTo}
                            onChange={(e) => updateItem(item.id, { hauledTo: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-steel-500 uppercase">Material</label>
                          <input
                            className="input text-xs"
                            value={item.material}
                            onChange={(e) => updateItem(item.id, { material: e.target.value })}
                          />
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
                          <label className="text-[10px] text-steel-500 uppercase">Quantity</label>
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
                        <div className="col-span-2">
                          <label className="text-[10px] text-steel-500 uppercase">Notes (optional)</label>
                          <input
                            className="input text-xs"
                            placeholder="Any notes for the dispatcher..."
                            value={item.driverNotes}
                            onChange={(e) => updateItem(item.id, { driverNotes: e.target.value })}
                          />
                        </div>
                      </div>

                      {(!item.hauledFrom.trim() || !item.hauledTo.trim()) && (
                        <p className="text-[10px] text-amber-600 mt-1.5">
                          Fill in Hauled From and Hauled To to include this ticket.
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Submit button */}
            {scannedCount > 0 && (
              <div className="mt-3">
                <button
                  onClick={handleSubmit}
                  disabled={submitting || readyCount === 0}
                  className="btn-accent w-full py-3 text-base font-bold disabled:opacity-50"
                >
                  {submitting
                    ? '...'
                    : `${t('driver.submitTicket')} (${readyCount})`}
                </button>
                {readyCount === 0 && scannedCount > 0 && (
                  <p className="text-xs text-amber-600 text-center mt-1">
                    Fill in required fields (Hauled From & To) to submit.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>
    </div>
  );
}

// ---- Submitted Ticket Card (editable if not reviewed) --------------------
function SubmittedTicketCard({
  ticket,
  token,
}: {
  ticket: CompletedJobData['tickets'][number];
  token: string;
}) {
  const num = String(ticket.ticketNumber).padStart(4, '0');
  const isReviewed = !!ticket.dispatcherReviewedAt;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable state
  const [hauledFrom, setHauledFrom] = useState(ticket.hauledFrom);
  const [hauledTo, setHauledTo] = useState(ticket.hauledTo);
  const [material, setMaterial] = useState(ticket.material);
  const [truckNumber, setTruckNumber] = useState(ticket.truckNumber);
  const [ticketRef, setTicketRef] = useState(ticket.ticketRef);
  const [quantity, setQuantity] = useState(ticket.quantity);
  const [quantityType, setQuantityType] = useState(ticket.quantityType);
  const [date, setDate] = useState(ticket.date ? ticket.date.split('T')[0] : '');
  const [driverNotes, setDriverNotes] = useState(ticket.driverNotes);

  async function handleSave() {
    if (!hauledFrom.trim() || !hauledTo.trim()) {
      setError('Hauled From and Hauled To are required');
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('ticketId', ticket.id);
      fd.set('hauledFrom', hauledFrom);
      fd.set('hauledTo', hauledTo);
      fd.set('material', material);
      fd.set('truckNumber', truckNumber);
      fd.set('ticketRef', ticketRef);
      fd.set('quantity', String(quantity));
      fd.set('quantityType', quantityType);
      fd.set('date', date);
      fd.set('driverNotes', driverNotes);
      await driverEditTicket(fd);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // Reviewed — locked display
  if (isReviewed) {
    const qtyDisplay = qtyStr(ticket.quantity, ticket.quantityType);
    return (
      <div className="rounded-lg border border-green-200 bg-green-50/30 p-3">
        <div className="flex items-center gap-3">
          {ticket.photoUrl ? (
            <div className="w-14 h-14 rounded overflow-hidden bg-steel-100 flex-shrink-0">
              <img src={ticket.photoUrl} alt={`#${num}`} className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded overflow-hidden bg-amber-100 border border-amber-300 flex-shrink-0 flex items-center justify-center">
              <span className="text-xl">📷</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs">#{num}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-200 text-green-800 font-semibold">
                REVIEWED
              </span>
              {!ticket.photoUrl && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                  NEEDS PHOTO
                </span>
              )}
            </div>
            <div className="text-xs text-steel-600 mt-0.5">
              {ticket.hauledFrom} → {ticket.hauledTo}
              {ticket.material && <> · {ticket.material}</>}
              <> · {qtyDisplay}</>
            </div>
            {(ticket.scannedTicketNumber || ticket.ticketRef) && (
              <div className="text-[10px] text-steel-500 mt-0.5">
                {ticket.scannedTicketNumber ? `Ticket #${ticket.scannedTicketNumber}` : `Ref: ${ticket.ticketRef}`}
                {ticket.scannedDate && <> · {ticket.scannedDate}</>}
              </div>
            )}
          </div>
          <span className="text-[10px] text-green-600 flex-shrink-0">Locked</span>
        </div>
      </div>
    );
  }

  // Not reviewed — editable
  return (
    <div className={`rounded-lg border ${editing ? 'border-blue-300 bg-blue-50/20' : 'border-amber-200 bg-amber-50/20'} p-3`}>
      <div className="flex items-center gap-3">
        {ticket.photoUrl ? (
          <div className="w-14 h-14 rounded overflow-hidden bg-steel-100 flex-shrink-0">
            <img src={ticket.photoUrl} alt={`#${num}`} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-14 h-14 rounded overflow-hidden bg-amber-100 border border-amber-300 flex-shrink-0 flex items-center justify-center">
            <span className="text-xl">📷</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs">#{num}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-800 font-semibold">
              PENDING REVIEW
            </span>
            {!ticket.photoUrl && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-semibold">
                NEEDS PHOTO
              </span>
            )}
            {saved && (
              <span className="text-[10px] text-green-600 font-medium">✓ Saved</span>
            )}
          </div>
          {!editing && (
            <div className="text-xs text-steel-600 mt-0.5">
              {hauledFrom} → {hauledTo}
              {material && <> · {material}</>}
              <> · {qtyStr(ticket.quantity, ticket.quantityType)}</>
            </div>
          )}
          {!editing && (ticket.scannedTicketNumber || ticketRef) && (
            <div className="text-[10px] text-steel-500 mt-0.5">
              {ticket.scannedTicketNumber ? `Ticket #${ticket.scannedTicketNumber}` : `Ref: ${ticketRef}`}
              {ticket.scannedDate && <> · {ticket.scannedDate}</>}
            </div>
          )}
          {!editing && driverNotes && (
            <div className="text-[10px] text-steel-500 mt-0.5">Notes: {driverNotes}</div>
          )}
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex-shrink-0"
          >
            Edit
          </button>
        )}
      </div>

      {/* Edit form */}
      {editing && (
        <div className="mt-3 pt-3 border-t border-steel-200">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-steel-500 uppercase">Hauled From *</label>
              <input
                className="input text-xs"
                value={hauledFrom}
                onChange={(e) => setHauledFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-steel-500 uppercase">Hauled To *</label>
              <input
                className="input text-xs"
                value={hauledTo}
                onChange={(e) => setHauledTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-steel-500 uppercase">Material</label>
              <input
                className="input text-xs"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-steel-500 uppercase">Truck #</label>
              <input
                className="input text-xs"
                value={truckNumber}
                onChange={(e) => setTruckNumber(e.target.value)}
                placeholder="Truck number"
              />
            </div>
            <div>
              <label className="text-[10px] text-steel-500 uppercase">Ticket #</label>
              <input
                className="input text-xs"
                value={ticketRef}
                onChange={(e) => setTicketRef(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[10px] text-steel-500 uppercase">Quantity</label>
              <div className="flex gap-1">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input text-xs w-20"
                  value={quantity}
                  onChange={(e) => setQuantity(parseFloat(e.target.value) || 1)}
                />
                <select
                  className="input text-xs flex-1"
                  value={quantityType}
                  onChange={(e) => setQuantityType(e.target.value)}
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] text-steel-500 uppercase">Notes</label>
              <input
                className="input text-xs"
                placeholder="Notes for the dispatcher..."
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 p-2 rounded mt-2">{error}</div>
          )}

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-accent px-4 py-1.5 text-sm"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setError(null);
                // Reset to original values
                setHauledFrom(ticket.hauledFrom);
                setHauledTo(ticket.hauledTo);
                setMaterial(ticket.material);
                setTruckNumber(ticket.truckNumber);
                setTicketRef(ticket.ticketRef);
                setQuantity(ticket.quantity);
                setQuantityType(ticket.quantityType);
                setDate(ticket.date ? ticket.date.split('T')[0] : '');
                setDriverNotes(ticket.driverNotes);
              }}
              className="text-xs text-steel-500 hover:text-steel-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Completed Card with Photo Upload ------------------------------------
function CompletedCard({
  ticket,
  token,
  canUploadPhotos,
  canAiExtract,
}: {
  ticket: TicketData;
  token: string;
  canUploadPhotos: boolean;
  canAiExtract: boolean;
}) {
  const num = String(ticket.ticketNumber).padStart(4, '0');
  const rate = ticket.ratePerUnit ? Number(ticket.ratePerUnit) : null;
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{
    extracted: boolean;
    data: { tons: string | null; yards: string | null; ticketNumber: string | null; date: string | null };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const hasPhoto = !!ticket.photoUrl || !!result;
  const hasScanned = !!ticket.scannedTons || !!ticket.scannedYards || !!ticket.scannedTicketNumber || !!ticket.scannedDate;

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('ticketId', ticket.id);
      fd.set('photo', file);
      const res = await uploadTicketPhoto(fd);
      if (res.success) {
        setResult({ extracted: res.extracted, data: res.data });
      }
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-steel-200 bg-white overflow-hidden">
      <div className="p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono font-bold text-sm">#{num}</span>
          <span className="badge bg-green-100 text-green-800">DONE</span>
        </div>
        <div className="text-xs text-steel-500">
          {ticket.completedAt ? format(new Date(ticket.completedAt), 'EEE MMM d, h:mm a') : '—'}
          {ticket.customer && <> • {ticket.customer.name}</>}
        </div>
        <div className="text-sm mt-1">
          {ticket.material && <span className="text-steel-700">{ticket.material} • </span>}
          {qtyStr(ticket.quantity, ticket.quantityType)}
          {rate !== null && <span className="text-steel-500"> @ ${rate.toFixed(2)}/{QTY_ABBR[ticket.quantityType] || 'load'}</span>}
        </div>

        {/* Existing scanned data from a previous upload */}
        {hasScanned && !result && (
          <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-xs font-semibold text-green-800 uppercase tracking-wider mb-2">
              AI Scanned Data
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {ticket.scannedTicketNumber && (
                <div>
                  <span className="text-steel-500">Ticket #:</span>{' '}
                  <span className="font-medium">{ticket.scannedTicketNumber}</span>
                </div>
              )}
              {ticket.scannedDate && (
                <div>
                  <span className="text-steel-500">Date:</span>{' '}
                  <span className="font-medium">{ticket.scannedDate}</span>
                </div>
              )}
              {ticket.scannedTons && (
                <div>
                  <span className="text-steel-500">Tons:</span>{' '}
                  <span className="font-medium">{ticket.scannedTons}</span>
                </div>
              )}
              {ticket.scannedYards && (
                <div>
                  <span className="text-steel-500">Yards:</span>{' '}
                  <span className="font-medium">{ticket.scannedYards}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Just-extracted result */}
        {result && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">
              {result.extracted ? 'AI Extracted' : 'Photo Uploaded'}
            </div>
            {result.extracted ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-steel-500">Ticket #:</span>{' '}
                  <span className="font-medium">{result.data.ticketNumber || '—'}</span>
                </div>
                <div>
                  <span className="text-steel-500">Date:</span>{' '}
                  <span className="font-medium">{result.data.date || '—'}</span>
                </div>
                <div>
                  <span className="text-steel-500">Tons:</span>{' '}
                  <span className="font-medium">{result.data.tons || '—'}</span>
                </div>
                <div>
                  <span className="text-steel-500">Yards:</span>{' '}
                  <span className="font-medium">{result.data.yards || '—'}</span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-700">Photo saved. Dispatcher will review manually.</p>
            )}
          </div>
        )}

        {/* Missing photo reminder */}
        {!hasPhoto && !hasScanned && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <span className="text-lg leading-none">📷</span>
            <p className="text-xs text-amber-800 font-medium">
              Upload a ticket image to complete this load
            </p>
          </div>
        )}

        {/* Upload area */}
        {canUploadPhotos && !hasPhoto && !hasScanned && (
          <div className="mt-3 border-t border-steel-200 pt-3">
            <label className="block">
              <div className="flex items-center justify-center gap-2 py-4 px-3 rounded-lg border-2 border-dashed border-steel-300 bg-steel-50 cursor-pointer hover:border-safety transition-colors">
                <span className="text-2xl">📸</span>
                <span className="text-sm font-medium text-steel-700">
                  {canAiExtract ? 'Upload ticket photo for AI scan' : 'Upload ticket photo'}
                </span>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>
        )}

        {/* Re-upload if already has photo */}
        {canUploadPhotos && (hasPhoto || hasScanned) && (
          <div className="mt-2">
            <label className="block">
              <span className="text-xs text-steel-500 cursor-pointer hover:text-steel-700 underline">
                Re-upload photo
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleUpload}
              />
            </label>
          </div>
        )}

        {/* Upload spinner */}
        {uploading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-steel-500">
            <div className="w-4 h-4 border-2 border-safety border-t-transparent rounded-full animate-spin" />
            {canAiExtract ? 'Scanning ticket...' : 'Uploading...'}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>
    </div>
  );
}

// ---- Available Jobs Tab ---------------------------------------------------
function AvailableJobsTab({
  jobs,
  token,
  canUseMaps,
  hasAssignedTruck,
}: {
  jobs: AvailableJobData[];
  token: string;
  canUseMaps: boolean;
  hasAssignedTruck: boolean;
}) {
  const { t } = useLanguage();

  if (jobs.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <div className="text-5xl mb-3">📋</div>
        <h2 className="font-bold text-lg mb-1">{t('driver.noAvailableJobs')}</h2>
        <p className="text-sm text-steel-500">{t('driver.noAvailableJobs')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!hasAssignedTruck && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">{t('driver.truck')}: —</span> You cannot claim jobs until your dispatcher assigns a truck to your profile.
        </div>
      )}
      <h2 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
        {jobs.length} {t('driver.availableJobs').toLowerCase()}
      </h2>
      {jobs.map((j) => (
        <AvailableJobCard key={j.id} job={j} token={token} canUseMaps={canUseMaps} hasAssignedTruck={hasAssignedTruck} />
      ))}
    </div>
  );
}

// ---- Available Job Card ---------------------------------------------------
function AvailableJobCard({
  job,
  token,
  canUseMaps,
  hasAssignedTruck,
}: {
  job: AvailableJobData;
  token: string;
  canUseMaps: boolean;
  hasAssignedTruck: boolean;
}) {
  const { t } = useLanguage();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState('');

  async function handleClaim() {
    setClaiming(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('jobId', job.id);
      await claimJob(fd);
      setClaimed(true); // Optimistic — hide the card
    } catch (err: any) {
      setError(err.message || 'Failed to claim job');
      setClaiming(false);
    }
  }

  const mapsUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  if (claimed) {
    return (
      <div className="rounded-lg border-2 border-green-300 bg-green-50 shadow-panel p-4 text-center">
        <div className="text-green-700 font-semibold">✓ Job #{job.jobNumber} claimed!</div>
        <div className="text-xs text-green-600 mt-1">Check Active tab to get started.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-blue-300 bg-blue-50/50 shadow-panel overflow-hidden">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono font-bold text-sm">Job #{job.jobNumber}</div>
          <div className="flex items-center gap-2">
            {(job.requiredTruckCount ?? 1) > 1 && (
              <span className="badge bg-steel-100 text-steel-700">
                {(job.assignmentCount ?? 0)}/{job.requiredTruckCount} trucks
              </span>
            )}
            <span className="badge bg-blue-100 text-blue-800">OPEN</span>
          </div>
        </div>

        {/* Job name / customer */}
        <div className="font-semibold text-steel-800 mb-2">{job.name}</div>

        {job.broker && (
          <div className="text-xs text-steel-500 mb-2">Broker: {job.broker.name}</div>
        )}
        {job.customer && (
          <div className="text-xs text-steel-500 mb-2">Customer: {job.customer.name}</div>
        )}

        {/* Details row */}
        <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
          {job.material && (
            <div>
              <span className="text-steel-500">Material:</span>{' '}
              <span className="font-medium">{job.material}</span>
            </div>
          )}
          <div>
            <span className="text-steel-500">Loads:</span>{' '}
            <span className="font-medium">{job.totalLoads > 0 ? `${job.ticketCount}/${job.totalLoads}` : 'Open'}</span>
          </div>
          {job.ratePerUnit !== null && (
            <div>
              <span className="text-steel-500">Rate:</span>{' '}
              <span className="font-medium">${job.ratePerUnit.toFixed(2)}/{QTY_ABBR[job.quantityType] || 'load'}</span>
            </div>
          )}
        </div>

        {/* Route */}
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">From</div>
            {canUseMaps ? (
              <a href={mapsUrl(job.hauledFromAddress || job.hauledFrom)} target="_blank" className="text-steel-900 hover:text-safety-dark">
                {job.hauledFrom} ↗
              </a>
            ) : (
              <div className="text-steel-900">{job.hauledFrom}</div>
            )}
            {job.hauledFromAddress && (
              <div className="text-xs text-steel-500">{job.hauledFromAddress}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">To</div>
            {canUseMaps ? (
              <a href={mapsUrl(job.hauledToAddress || job.hauledTo)} target="_blank" className="text-steel-900 hover:text-safety-dark">
                {job.hauledTo} ↗
              </a>
            ) : (
              <div className="text-steel-900">{job.hauledTo}</div>
            )}
            {job.hauledToAddress && (
              <div className="text-xs text-steel-500">{job.hauledToAddress}</div>
            )}
          </div>
        </div>

        {job.date && (
          <div className="text-xs text-steel-500 mt-3">
            Date: {format(new Date(job.date), 'MMM d, yyyy')}
          </div>
        )}

        {job.notes && (
          <div className="text-xs text-steel-500 mt-2 bg-steel-100 rounded p-2">
            {job.notes}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>

      {/* Claim button */}
      <div className="border-t border-blue-200 bg-blue-50 p-3">
        {!hasAssignedTruck ? (
          <div className="text-center text-sm text-amber-700 font-medium py-2">
            No truck assigned — contact dispatcher
          </div>
        ) : (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="btn-accent w-full py-3 text-base font-bold"
          >
            {claiming ? '...' : `✋ ${t('driver.claimJob')}`}
          </button>
        )}
      </div>
    </div>
  );
}

// ---- Today's Job Card (promoted from upcoming into Active) ----------------
function TodaysJobCard({
  job: initialJob,
  token,
  canUseMaps,
}: {
  job: JobData2;
  token: string;
  canUseMaps: boolean;
}) {
  const { t } = useLanguage();
  const [jobStatus, setJobStatus] = useState(initialJob.status);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeSeconds, setTimeSeconds] = useState(initialJob.driverTimeSeconds);
  const [resumedAt, setResumedAt] = useState(initialJob.lastResumedAt);
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [issueSent, setIssueSent] = useState(false);
  const job = initialJob;

  const mapsUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const unlimitedLoads = job.totalLoads === 0;
  const STATUS_PROGRESS: Record<string, number> = { CREATED: 0, ASSIGNED: 25, IN_PROGRESS: 50, COMPLETED: 100, CANCELLED: 0 };
  const progress = unlimitedLoads
    ? (STATUS_PROGRESS[job.status] ?? STATUS_PROGRESS[jobStatus] ?? 0)
    : Math.round((job.ticketCount / job.totalLoads) * 100);
  const isInProgress = jobStatus === 'IN_PROGRESS';
  const isAssigned = jobStatus === 'ASSIGNED';
  const isCompleted = jobStatus === 'COMPLETED';
  const isCancelled = jobStatus === 'CANCELLED';

  async function handleAction(action: 'start' | 'pause' | 'complete' | 'cancel') {
    const prevStatus = jobStatus;
    const prevTime = timeSeconds;
    const prevResumed = resumedAt;
    setLoading(true);
    setError('');
    // Optimistic update
    const statusMap: Record<string, string> = { start: 'IN_PROGRESS', pause: 'ASSIGNED', complete: 'COMPLETED', cancel: 'CANCELLED' };
    setJobStatus(statusMap[action] || prevStatus);
    // Optimistic time tracking
    if (action === 'start') {
      setResumedAt(new Date().toISOString());
    } else if (action === 'pause' || action === 'complete' || action === 'cancel') {
      if (resumedAt) {
        const elapsed = Math.max(0, Math.round((Date.now() - new Date(resumedAt).getTime()) / 1000));
        setTimeSeconds((prev) => prev + elapsed);
      }
      setResumedAt(null);
    }
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('jobId', job.id);
      fd.set('action', action);
      const res = await driverUpdateJobStatus(fd);
      // Sync with server values
      if (res.driverTimeSeconds !== undefined) setTimeSeconds(res.driverTimeSeconds);
      if (res.lastResumedAt !== undefined) setResumedAt(res.lastResumedAt);
    } catch (err: any) {
      setError(err.message || 'Action failed');
      setJobStatus(prevStatus);
      setTimeSeconds(prevTime);
      setResumedAt(prevResumed);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-lg border-2 ${isCompleted ? 'border-green-400 bg-green-50' : isInProgress ? 'border-safety bg-safety/5' : isCancelled ? 'border-red-300 bg-red-50/50' : 'border-amber-400 bg-amber-50/50'} shadow-panel overflow-hidden transition-colors`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono font-bold text-sm">Job #{job.jobNumber}</div>
          <div className="flex items-center gap-2">
            <span className="badge bg-amber-200 text-amber-900 text-[10px]">TODAY</span>
            <span className={`badge ${isCompleted ? 'bg-green-200 text-green-900' : isInProgress ? 'bg-safety text-diesel' : isCancelled ? 'bg-red-200 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
              {jobStatus.replace('_', ' ')}
            </span>
          </div>
        </div>

        <div className="font-semibold text-steel-800 mb-2">{job.name}</div>

        {/* Driver time tracker */}
        {(isInProgress || timeSeconds > 0) && (
          <div className="mb-3">
            <LiveTimer
              driverTimeSeconds={timeSeconds}
              lastResumedAt={resumedAt}
              running={isInProgress}
            />
          </div>
        )}

        {job.broker && (
          <div className="text-xs text-steel-500 mb-1">Broker: {job.broker.name}</div>
        )}
        {job.customer && (
          <div className="text-xs text-steel-500 mb-2">Customer: {job.customer.name}</div>
        )}

        <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
          {job.material && (
            <div>
              <span className="text-steel-500">Material:</span>{' '}
              <span className="font-medium">{job.material}</span>
            </div>
          )}
          {job.ratePerUnit !== null && (
            <div>
              <span className="text-steel-500">Rate:</span>{' '}
              <span className="font-medium">${job.ratePerUnit.toFixed(2)}/{QTY_ABBR[job.quantityType] || 'load'}</span>
            </div>
          )}
        </div>

        {/* Load progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-steel-500">Loads</span>
            <span className="font-semibold text-steel-700">
              {unlimitedLoads ? `${progress}%` : `${job.ticketCount} / ${job.totalLoads}`}
            </span>
          </div>
          <div className="w-full h-2 bg-steel-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-safety rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>

        {/* Route */}
        <div className="space-y-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">From</div>
            {canUseMaps ? (
              <a href={mapsUrl(job.hauledFromAddress || job.hauledFrom)} target="_blank" className="text-steel-900 hover:text-safety-dark">
                {job.hauledFrom} ↗
              </a>
            ) : (
              <div className="text-steel-900">{job.hauledFrom}</div>
            )}
            {job.hauledFromAddress && (
              <div className="text-xs text-steel-500">{job.hauledFromAddress}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">To</div>
            {canUseMaps ? (
              <a href={mapsUrl(job.hauledToAddress || job.hauledTo)} target="_blank" className="text-steel-900 hover:text-safety-dark">
                {job.hauledTo} ↗
              </a>
            ) : (
              <div className="text-steel-900">{job.hauledTo}</div>
            )}
            {job.hauledToAddress && (
              <div className="text-xs text-steel-500">{job.hauledToAddress}</div>
            )}
          </div>
        </div>

        {job.notes && (
          <div className="text-xs text-steel-500 mt-2 bg-steel-100 rounded p-2">
            {job.notes}
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="border-t border-steel-200 bg-steel-50 p-3 space-y-2">
        {isAssigned && (
          <button
            onClick={() => handleAction('start')}
            disabled={loading}
            className="btn-primary w-full py-3 text-base font-bold"
          >
            {loading ? '...' : job.startedAt ? `▶ ${t('driver.resumeJob')}` : `▶ ${t('driver.startJob')}`}
          </button>
        )}
        {isInProgress && (
          <>
            <div className="flex gap-2">
              <button
                onClick={() => handleAction('pause')}
                disabled={loading}
                className="btn-ghost flex-1 py-3 text-base"
              >
                {loading ? '...' : `⏸ ${t('driver.pauseJob')}`}
              </button>
              <button
                onClick={() => handleAction('complete')}
                disabled={loading}
                className="btn-accent flex-1 py-3 text-base font-bold"
              >
                {loading ? '...' : `✓ ${t('driver.completeJob')}`}
              </button>
            </div>
            {/* Report Issue */}
            {issueSent ? (
              <div className="text-center text-sm text-amber-700 bg-amber-50 rounded-lg py-2 font-medium">
                ✓ {t('driver.reportIssue')}
              </div>
            ) : showIssueForm ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  setLoading(true);
                  setError('');
                  try {
                    const sfd = new FormData();
                    sfd.set('token', token);
                    sfd.set('jobId', job.id);
                    sfd.set('action', 'report_issue');
                    sfd.set('note', String(fd.get('note') || ''));
                    await driverUpdateJobStatus(sfd);
                    setIssueSent(true);
                    setShowIssueForm(false);
                  } catch (err: any) {
                    setError(err.message || 'Failed to report issue');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2"
              >
                <textarea
                  name="note"
                  required
                  rows={2}
                  placeholder="Describe the issue..."
                  className="w-full rounded-lg border border-amber-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowIssueForm(false)}
                    className="btn-ghost flex-1 py-2 text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                  >
                    {loading ? '...' : t('common.submit')}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowIssueForm(true)}
                className="w-full py-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
              >
                ⚠ {t('driver.reportIssue')}
              </button>
            )}
          </>
        )}
        {isCompleted && (
          <div className="text-center text-sm text-green-700 font-semibold py-2">
            ✓ {t('driver.completeJob')}
          </div>
        )}
        {!isCompleted && !isCancelled && (
          <CancelJobButton loading={loading} onCancel={() => handleAction('cancel')} />
        )}
      </div>
    </div>
  );
}

// ---- Active Job Card ------------------------------------------------------
function JobCard({
  ticket: initialTicket,
  token,
  canReportIssues,
  canUseMaps,
}: {
  ticket: TicketData;
  token: string;
  canReportIssues: boolean;
  canUseMaps: boolean;
}) {
  const { t } = useLanguage();
  const [ticket, setTicket] = useState(initialTicket);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const num = String(ticket.ticketNumber).padStart(4, '0');
  const statusColor =
    ticket.status === 'IN_PROGRESS'
      ? 'border-safety bg-safety/5'
      : ticket.status === 'ISSUE'
        ? 'border-red-400 bg-red-50'
        : ticket.status === 'COMPLETED'
          ? 'border-green-400 bg-green-50'
          : 'border-steel-300 bg-white';

  async function handleStatus(newStatus: string, note?: string) {
    const prevStatus = ticket.status;
    setLoading(true);
    setError('');
    // Optimistic update
    setTicket((prev) => ({ ...prev, status: newStatus }));
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('ticketId', ticket.id);
      fd.set('status', newStatus);
      if (note) fd.set('note', note);
      await driverUpdateStatus(fd);
    } catch (err: any) {
      setError(err.message || 'Action failed');
      // Rollback
      setTicket((prev) => ({ ...prev, status: prevStatus }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`rounded-lg border-2 ${statusColor} shadow-panel overflow-hidden transition-colors`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono font-bold">#{num}</div>
          <span
            className={`badge ${
              ticket.status === 'IN_PROGRESS'
                ? 'bg-safety text-diesel'
                : ticket.status === 'ISSUE'
                  ? 'bg-red-200 text-red-900'
                  : ticket.status === 'COMPLETED'
                    ? 'bg-green-200 text-green-900'
                    : 'bg-blue-100 text-blue-800'
            }`}
          >
            {ticket.status.replace('_', ' ')}
          </span>
        </div>

        {ticket.customer && (
          <div className="text-sm text-steel-600 mb-2">{ticket.customer.name}</div>
        )}

        <div className="flex items-center gap-4 text-sm mb-3 flex-wrap">
          {ticket.truckNumber && (
            <div>
              <span className="text-steel-500">Truck:</span>{' '}
              <span className="font-medium">{ticket.truckNumber}</span>
            </div>
          )}
          {ticket.material && (
            <div>
              <span className="text-steel-500">Material:</span>{' '}
              <span className="font-medium">{ticket.material}</span>
            </div>
          )}
          <div>
            <span className="text-steel-500">Qty:</span>{' '}
            <span className="font-medium">
              {qtyStr(ticket.quantity, ticket.quantityType)}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">
              From
            </div>
            {canUseMaps ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.hauledFrom)}`}
                target="_blank"
                className="text-steel-900 hover:text-safety-dark"
              >
                {ticket.hauledFrom} ↗
              </a>
            ) : (
              <div className="text-steel-900">{ticket.hauledFrom}</div>
            )}
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">
              To
            </div>
            {canUseMaps ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ticket.hauledTo)}`}
                target="_blank"
                className="text-steel-900 hover:text-safety-dark"
              >
                {ticket.hauledTo} ↗
              </a>
            ) : (
              <div className="text-steel-900">{ticket.hauledTo}</div>
            )}
          </div>
        </div>

        {ticket.date && (
          <div className="text-xs text-steel-500 mt-3">
            Date: {format(new Date(ticket.date), 'MMM d, yyyy')}
          </div>
        )}

        {/* Missing photo reminder */}
        {!ticket.photoUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <span className="text-lg leading-none">📷</span>
            <p className="text-xs text-amber-800 font-medium">
              Upload a ticket image to complete this load
            </p>
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>
        )}
      </div>

      <div className="border-t border-steel-200 bg-steel-50 p-3 space-y-2">
        {ticket.status === 'DISPATCHED' && (
          <button
            onClick={() => handleStatus('IN_PROGRESS')}
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? '...' : `▶ ${t('driver.startJob')}`}
          </button>
        )}
        {ticket.status === 'IN_PROGRESS' && (
          <button
            onClick={() => handleStatus('COMPLETED')}
            disabled={loading}
            className="btn-accent w-full py-3 text-base font-bold"
          >
            {loading ? '...' : `✓ ${t('driver.completeJob')}`}
          </button>
        )}
        {ticket.status === 'COMPLETED' && (
          <div className="text-center text-sm text-green-700 font-semibold py-2">
            ✓ {t('driver.completeJob')}
          </div>
        )}
        {canReportIssues &&
          (ticket.status === 'DISPATCHED' || ticket.status === 'IN_PROGRESS') && (
            <details>
              <summary className="text-center text-sm text-red-700 cursor-pointer py-2">
                {t('driver.reportIssue')}
              </summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  handleStatus('ISSUE', String(fd.get('note') || ''));
                }}
                className="mt-2 space-y-2"
              >
                <textarea name="note" required placeholder="What's wrong?" rows={2} className="input" />
                <button className="btn-danger w-full" type="submit" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Issue'}
                </button>
              </form>
            </details>
          )}
      </div>
    </div>
  );
}

// ---- Calendar / Time-Off Tab -----------------------------------------------
function CalendarTab({
  requests,
  token,
}: {
  requests: TimeOffData[];
  token: string;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [showForm, setShowForm] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // -- Build calendar grid --
  const firstDay = new Date(viewYear, viewMonth, 1);
  const startDow = firstDay.getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const monthLabel = firstDay.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Build a set of dates that have time-off
  type DayInfo = { status: 'PENDING' | 'APPROVED' | 'DENIED'; requestId: string };
  const dayMap = new Map<string, DayInfo>();
  for (const r of requests) {
    const s = new Date(r.startDate);
    const e = new Date(r.endDate);
    const cursor = new Date(s);
    while (cursor <= e) {
      const key = `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}-${cursor.getUTCDate()}`;
      // Show highest priority status (APPROVED > PENDING > DENIED)
      const existing = dayMap.get(key);
      if (!existing || statusPriority(r.status) > statusPriority(existing.status)) {
        dayMap.set(key, { status: r.status, requestId: r.id });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  function statusPriority(s: string) {
    if (s === 'APPROVED') return 3;
    if (s === 'PENDING') return 2;
    return 1;
  }

  function getDayInfo(day: number): DayInfo | undefined {
    const key = `${viewYear}-${viewMonth}-${day}`;
    return dayMap.get(key);
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  }

  async function handleSubmit() {
    if (!startDate || !endDate) { setError('Please select dates'); return; }
    setSubmitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('startDate', startDate);
      fd.set('endDate', endDate);
      fd.set('reason', reason);
      await requestTimeOff(fd);
      setShowForm(false);
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId: string) {
    setCancellingId(requestId);
    try {
      const fd = new FormData();
      fd.set('token', token);
      fd.set('requestId', requestId);
      await cancelTimeOff(fd);
    } catch {
      // Will refresh on revalidation anyway
    } finally {
      setCancellingId(null);
    }
  }

  const isToday = (day: number) =>
    viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();

  const STATUS_COLORS: Record<string, string> = {
    PENDING: 'bg-amber-400',
    APPROVED: 'bg-green-500',
    DENIED: 'bg-red-400',
  };

  const STATUS_LABEL: Record<string, string> = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    DENIED: 'Denied',
  };

  const STATUS_BADGE: Record<string, string> = {
    PENDING: 'bg-amber-100 text-amber-800',
    APPROVED: 'bg-green-100 text-green-800',
    DENIED: 'bg-red-100 text-red-800',
  };

  // Upcoming/pending requests list
  const activeRequests = requests.filter((r) => r.status !== 'DENIED' || new Date(r.endDate) >= today);

  return (
    <div className="space-y-4">
      {/* Month navigator */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="btn-ghost px-3 py-1 text-sm">← Prev</button>
          <h2 className="font-bold text-steel-800">{monthLabel}</h2>
          <button onClick={nextMonth} className="btn-ghost px-3 py-1 text-sm">Next →</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-steel-500 uppercase tracking-wider mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: startDow }).map((_, i) => (
            <div key={`e-${i}`} className="h-10" />
          ))}
          {/* Day cells */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const info = getDayInfo(day);
            const todayHighlight = isToday(day);

            return (
              <div
                key={day}
                className={`h-10 rounded-md flex flex-col items-center justify-center text-sm relative
                  ${todayHighlight ? 'ring-2 ring-safety font-bold' : ''}
                  ${info ? 'text-white' : 'text-steel-700'}
                  ${info ? STATUS_COLORS[info.status] : 'bg-steel-100'}
                `}
              >
                {day}
                {info && (
                  <div className="text-[8px] leading-none opacity-80">
                    {info.status === 'PENDING' ? '...' : info.status === 'APPROVED' ? '✓' : '✕'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-[10px] text-steel-500">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400" /> Pending</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500" /> Approved</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Denied</div>
        </div>
      </div>

      {/* Request time off button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary w-full py-3 text-base"
        >
          + {t('driver.requestTimeOff')}
        </button>
      )}

      {/* Request form */}
      {showForm && (
        <div className="panel p-4 space-y-3">
          <h3 className="font-bold text-sm text-steel-800">{t('driver.requestTimeOff')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-steel-500 block mb-1">{t('driver.startDate')}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || e.target.value > endDate) setEndDate(e.target.value);
                }}
                min={new Date().toISOString().slice(0, 10)}
                className="input"
              />
            </div>
            <div>
              <label className="text-xs text-steel-500 block mb-1">{t('driver.endDate')}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || new Date().toISOString().slice(0, 10)}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-steel-500 block mb-1">{t('common.reason')}</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Vacation, appointment, etc."
              rows={2}
              className="input"
            />
          </div>
          {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-accent flex-1 py-2"
            >
              {submitting ? '...' : t('common.submit')}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(''); }}
              className="btn-ghost flex-1 py-2"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Requests list */}
      {activeRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs uppercase tracking-widest text-steel-500 font-semibold px-1">
            Your Requests
          </h3>
          {activeRequests.map((r) => {
            const s = new Date(r.startDate);
            const e = new Date(r.endDate);
            const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
            const range = s.getTime() === e.getTime() ? fmtDate(s) : `${fmtDate(s)} – ${fmtDate(e)}`;
            const canCancel = r.status === 'PENDING' || r.status === 'APPROVED';

            return (
              <div key={r.id} className="panel p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-steel-800">{range}</span>
                  <span className={`badge text-[10px] ${STATUS_BADGE[r.status]}`}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                {r.reason && (
                  <div className="text-xs text-steel-500 mb-1">{r.reason}</div>
                )}
                {r.reviewNote && (
                  <div className="text-xs text-steel-600 bg-steel-50 rounded p-2 mb-2">
                    Dispatcher: {r.reviewNote}
                  </div>
                )}
                {canCancel && (
                  <button
                    onClick={() => handleCancel(r.id)}
                    disabled={cancellingId === r.id}
                    className="text-xs text-red-500 hover:text-red-700"
                  >
                    {cancellingId === r.id ? '...' : t('driver.cancelRequest')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Expenses Tab -----------------------------------------------------------
const EXPENSE_CATEGORIES = [
  { value: 'FUEL', label: 'Diesel / Fuel', icon: '⛽' },
  { value: 'PARTS', label: 'Parts', icon: '🔧' },
  { value: 'OTHER', label: 'Other', icon: '📋' },
] as const;

function ExpensesTab({
  token,
  expenses: initialExpenses,
}: {
  token: string;
  expenses: DriverExpenseData[];
}) {
  const [expenses, setExpenses] = useState<DriverExpenseData[]>(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const receiptRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('FUEL');
  const [vendor, setVendor] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setCategory('FUEL');
    setVendor('');
    setDescription('');
    setNotes('');
    if (receiptRef.current) receiptRef.current.value = '';
  };

  const handleSubmit = async () => {
    if (!date || !amount || !category) {
      setError('Date, amount, and category are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('date', date);
      fd.append('amount', amount);
      fd.append('category', category);
      if (vendor.trim()) fd.append('vendor', vendor.trim());
      if (description.trim()) fd.append('description', description.trim());
      if (notes.trim()) fd.append('notes', notes.trim());
      const file = receiptRef.current?.files?.[0];
      if (file) fd.append('receipt', file);

      const res = await fetch('/api/driver/expenses', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit');

      setExpenses((prev) => [data.expense, ...prev]);
      resetForm();
      setShowForm(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const catIcon = (cat: string) => EXPENSE_CATEGORIES.find((c) => c.value === cat)?.icon ?? '📋';
  const catLabel = (cat: string) => EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;

  const { t } = useLanguage();
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-diesel">{t('driver.expenses')}</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-safety text-diesel hover:bg-safety/80 transition-colors"
        >
          {showForm ? t('common.cancel') : `+ ${t('driver.expenses')}`}
        </button>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-3 py-2 rounded-lg">
          Expense submitted successfully!
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {/* Add Expense Form */}
      {showForm && (
        <div className="bg-white border border-steel-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-steel-700">New Expense</h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Date *</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-steel-300 rounded-lg text-sm focus:ring-2 focus:ring-safety focus:border-safety"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Amount *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 border border-steel-300 rounded-lg text-sm focus:ring-2 focus:ring-safety focus:border-safety"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-600 mb-1">Category *</label>
            <div className="grid grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={`py-2 px-2 rounded-lg text-sm font-medium text-center border transition-colors ${
                    category === c.value
                      ? 'bg-safety/20 border-safety text-diesel'
                      : 'bg-white border-steel-200 text-steel-600 hover:bg-steel-50'
                  }`}
                >
                  <span className="text-lg block">{c.icon}</span>
                  <span className="text-xs">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-600 mb-1">Vendor / Station</label>
            <input
              type="text"
              placeholder="e.g. Pilot, AutoZone"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full px-3 py-2 border border-steel-300 rounded-lg text-sm focus:ring-2 focus:ring-safety focus:border-safety"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-600 mb-1">Description</label>
            <input
              type="text"
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-steel-300 rounded-lg text-sm focus:ring-2 focus:ring-safety focus:border-safety"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-600 mb-1">Notes</label>
            <textarea
              placeholder="Any additional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-steel-300 rounded-lg text-sm focus:ring-2 focus:ring-safety focus:border-safety resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-steel-600 mb-1">Receipt Photo</label>
            <input
              ref={receiptRef}
              type="file"
              accept="image/*,.pdf"
              className="w-full text-sm text-steel-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-steel-100 file:text-steel-700 hover:file:bg-steel-200"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 rounded-lg text-sm font-bold bg-safety text-diesel hover:bg-safety/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? '...' : t('common.submit')}
          </button>
        </div>
      )}

      {/* Summary */}
      {expenses.length > 0 && (
        <div className="bg-diesel/5 border border-diesel/10 rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-steel-600">{expenses.length} expense{expenses.length !== 1 ? 's' : ''}</span>
          <span className="text-lg font-bold text-diesel">${total.toFixed(2)}</span>
        </div>
      )}

      {/* Expense List */}
      {expenses.length === 0 && !showForm ? (
        <div className="text-center py-12 text-steel-400">
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm">No expenses submitted yet</p>
          <p className="text-xs mt-1">Tap &quot;+ Add Expense&quot; to log fuel, parts, or other receipts</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-white border border-steel-200 rounded-xl p-3 flex items-start gap-3">
              <span className="text-2xl mt-0.5">{catIcon(exp.category)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-diesel">${exp.amount.toFixed(2)}</span>
                  <span className="text-xs text-steel-400">
                    {format(new Date(exp.date), 'MMM d, yyyy')}
                  </span>
                </div>
                <p className="text-xs text-steel-600 mt-0.5">{catLabel(exp.category)}</p>
                {exp.vendor && <p className="text-xs text-steel-500">{exp.vendor}</p>}
                {exp.description && <p className="text-xs text-steel-400 mt-0.5">{exp.description}</p>}
                {exp.truckNumber && (
                  <p className="text-xs text-steel-400 mt-0.5">Truck: {exp.truckNumber}</p>
                )}
                {exp.receiptUrl && (
                  <a
                    href={exp.receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 text-xs text-blue-600 hover:underline"
                  >
                    View Receipt
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Profile / Documents Tab ------------------------------------------------
const REQUIRED_DOCS = [
  { type: 'LICENSE_FRONT', label: 'License (Front)', icon: '🪪' },
  { type: 'LICENSE_BACK', label: 'License (Back)', icon: '🪪' },
  { type: 'MEDICAL_CERT', label: 'Medical Examiner Certificate', icon: '🏥' },
  { type: 'VOID_CHECK', label: 'Void Check', icon: '💳' },
] as const;

function ProfileTab({
  token,
  driverName,
  truckNumber,
  documents,
  profile: initialProfile,
}: {
  token: string;
  driverName: string;
  truckNumber: string | null;
  documents: DocumentData[];
  profile: DriverProfileData;
}) {
  const [docs, setDocs] = useState<DocumentData[]>(documents);
  const [uploading, setUploading] = useState<string | null>(null); // docType being uploaded
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();
  const [otherLabel, setOtherLabel] = useState('');
  const otherFileRef = useRef<HTMLInputElement>(null);

  // Profile editing state
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileData, setProfileData] = useState<DriverProfileData>(initialProfile);
  const [profileForm, setProfileForm] = useState<DriverProfileData>(initialProfile);

  function updateField(field: keyof DriverProfileData, value: string) {
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleProfileSave() {
    setError(null);
    setProfileSaving(true);
    setProfileSuccess(false);
    try {
      const res = await fetch('/api/driver/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileForm.email || '',
          phone: profileForm.phone,
          address: profileForm.address || '',
          city: profileForm.city || '',
          state: profileForm.state || '',
          zip: profileForm.zip || '',
          emergencyContactName: profileForm.emergencyContactName || '',
          emergencyContactPhone: profileForm.emergencyContactPhone || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      const d = data.driver;
      const updated: DriverProfileData = {
        phone: d.phone,
        email: d.email ?? null,
        address: d.address ?? null,
        city: d.city ?? null,
        state: d.state ?? null,
        zip: d.zip ?? null,
        emergencyContactName: d.emergencyContactName ?? null,
        emergencyContactPhone: d.emergencyContactPhone ?? null,
      };
      setProfileData(updated);
      setProfileForm(updated);
      setEditingProfile(false);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  }

  function getDoc(docType: string): DocumentData | undefined {
    return docs.find((d) => d.docType === docType);
  }

  const otherDocs = docs.filter((d) => d.docType === 'OTHER');

  async function handleUpload(file: File, docType: string, label?: string) {
    setError(null);
    setUploading(docType);
    try {
      const fd = new FormData();
      fd.append('token', token);
      fd.append('file', file);
      fd.append('docType', docType);
      if (label) fd.append('label', label);

      const res = await fetch('/api/driver/documents', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      const newDoc: DocumentData = {
        id: data.document.id,
        docType: data.document.docType,
        label: data.document.label,
        fileUrl: data.document.fileUrl,
        createdAt: new Date().toISOString(),
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

  async function handleDeleteOther(docId: string) {
    setError(null);
    try {
      const res = await fetch(`/api/driver/documents?token=${token}&id=${docId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      setError(err.message || 'Delete failed');
    }
  }

  function handleFileSelect(docType: string, label?: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,application/pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleUpload(file, docType, label);
    };
    input.click();
  }

  return (
    <div className="space-y-5">
      {/* Driver Info Header + Profile */}
      <div className="bg-white rounded-xl shadow-sm border border-steel-200 overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-diesel flex items-center justify-center text-white text-xl font-bold">
              {driverName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg text-steel-900">{driverName}</div>
              {truckNumber && <div className="text-sm text-steel-500">{t('driver.truck')} {truckNumber}</div>}
            </div>
            {!editingProfile && (
              <button
                onClick={() => { setEditingProfile(true); setProfileForm(profileData); setError(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-steel-100 text-steel-700 hover:bg-steel-200 transition-colors"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {profileSuccess && (
          <div className="mx-5 mb-3 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg text-center">
            Profile updated!
          </div>
        )}

        {editingProfile ? (
          <div className="border-t border-steel-200 p-5 space-y-4">
            <h3 className="text-sm font-bold text-steel-700 uppercase tracking-wider">Contact Info</h3>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Phone</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Email</label>
              <input
                type="email"
                value={profileForm.email || ''}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder="your@email.com"
                className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
              />
            </div>

            <h3 className="text-sm font-bold text-steel-700 uppercase tracking-wider pt-2">Address</h3>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Street Address</label>
              <input
                type="text"
                value={profileForm.address || ''}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-steel-600 mb-1">City</label>
                <input
                  type="text"
                  value={profileForm.city || ''}
                  onChange={(e) => updateField('city', e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">State</label>
                <input
                  type="text"
                  value={profileForm.state || ''}
                  onChange={(e) => updateField('state', e.target.value)}
                  placeholder="FL"
                  maxLength={2}
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-steel-600 mb-1">ZIP</label>
                <input
                  type="text"
                  value={profileForm.zip || ''}
                  onChange={(e) => updateField('zip', e.target.value)}
                  placeholder="33901"
                  maxLength={10}
                  className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
                />
              </div>
            </div>

            <h3 className="text-sm font-bold text-steel-700 uppercase tracking-wider pt-2">Emergency Contact</h3>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Contact Name</label>
              <input
                type="text"
                value={profileForm.emergencyContactName || ''}
                onChange={(e) => updateField('emergencyContactName', e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-steel-600 mb-1">Contact Phone</label>
              <input
                type="tel"
                value={profileForm.emergencyContactPhone || ''}
                onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                placeholder="(239) 555-1234"
                className="w-full px-3 py-2.5 rounded-lg border border-steel-300 text-sm focus:outline-none focus:ring-2 focus:ring-safety"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setEditingProfile(false); setProfileForm(profileData); setError(null); }}
                className="flex-1 py-2.5 border border-steel-300 rounded-lg text-steel-700 text-sm font-medium hover:bg-steel-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={handleProfileSave}
                disabled={profileSaving}
                className="flex-1 py-2.5 bg-safety text-diesel text-sm font-bold rounded-lg hover:bg-safety-dark transition-colors disabled:opacity-50"
              >
                {profileSaving ? '...' : t('common.save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="border-t border-steel-200 px-5 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-steel-400 uppercase tracking-wider">Phone</div>
                <div className="text-steel-800 font-medium">{profileData.phone}</div>
              </div>
              <div>
                <div className="text-xs text-steel-400 uppercase tracking-wider">Email</div>
                <div className="text-steel-800 font-medium">{profileData.email || '—'}</div>
              </div>
            </div>
            {(profileData.address || profileData.city || profileData.state) && (
              <div className="text-sm">
                <div className="text-xs text-steel-400 uppercase tracking-wider">Address</div>
                <div className="text-steel-800 font-medium">
                  {[profileData.address, [profileData.city, profileData.state, profileData.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ')}
                </div>
              </div>
            )}
            {(profileData.emergencyContactName || profileData.emergencyContactPhone) && (
              <div className="text-sm">
                <div className="text-xs text-steel-400 uppercase tracking-wider">Emergency Contact</div>
                <div className="text-steel-800 font-medium">
                  {[profileData.emergencyContactName, profileData.emergencyContactPhone].filter(Boolean).join(' — ')}
                </div>
              </div>
            )}
            {!profileData.address && !profileData.emergencyContactName && (
              <p className="text-xs text-steel-400 italic">
                Tap Edit to add your address and emergency contact info.
              </p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>
      )}

      {/* Required Documents */}
      <div>
        <h3 className="text-sm font-bold text-steel-700 uppercase tracking-wider mb-3">{t('driver.documents')}</h3>
        <div className="space-y-3">
          {REQUIRED_DOCS.map((req) => {
            const doc = getDoc(req.type);
            const isUploading = uploading === req.type;
            return (
              <div key={req.type} className="bg-white rounded-xl border border-steel-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <span className="text-2xl">{req.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-steel-900">{req.label}</div>
                    {doc ? (
                      <div className="text-xs text-green-600 mt-0.5">✓ Uploaded</div>
                    ) : (
                      <div className="text-xs text-amber-600 mt-0.5">⚠ Not uploaded</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleFileSelect(req.type)}
                    disabled={isUploading}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      doc
                        ? 'bg-steel-100 text-steel-700 hover:bg-steel-200'
                        : 'bg-safety text-diesel hover:bg-safety-dark'
                    }`}
                  >
                    {isUploading ? 'Uploading…' : doc ? 'Update' : 'Upload'}
                  </button>
                </div>
                {doc && (
                  <div className="border-t border-steel-100 p-3 bg-steel-50">
                    {doc.fileUrl.endsWith('.pdf') ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        📄 View PDF
                      </a>
                    ) : (
                      <RotatableImage
                        src={doc.fileUrl}
                        alt={req.label}
                        className="w-full max-h-48 object-contain rounded-lg bg-white"
                        linkToFullSize
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Checklist Summary */}
      {(() => {
        const uploaded = REQUIRED_DOCS.filter((r) => getDoc(r.type)).length;
        const total = REQUIRED_DOCS.length;
        const allDone = uploaded === total;
        return (
          <div className={`rounded-xl px-4 py-3 text-sm font-medium ${
            allDone ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            {allDone
              ? '✅ All required documents uploaded!'
              : `📋 ${uploaded} of ${total} required documents uploaded`}
          </div>
        );
      })()}

      {/* Other Documents */}
      <div>
        <h3 className="text-sm font-bold text-steel-700 uppercase tracking-wider mb-3">Other Documents</h3>

        {otherDocs.length > 0 && (
          <div className="space-y-3 mb-3">
            {otherDocs.map((doc) => (
              <div key={doc.id} className="bg-white rounded-xl border border-steel-200 shadow-sm overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  <span className="text-2xl">📎</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-steel-900">{doc.label || 'Other Document'}</div>
                    <div className="text-xs text-green-600 mt-0.5">✓ Uploaded</div>
                  </div>
                  <button
                    onClick={() => handleDeleteOther(doc.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    Remove
                  </button>
                </div>
                {doc.fileUrl.endsWith('.pdf') ? (
                  <div className="border-t border-steel-100 p-3 bg-steel-50">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      📄 View PDF
                    </a>
                  </div>
                ) : (
                  <div className="border-t border-steel-100 p-3 bg-steel-50">
                    <RotatableImage
                      src={doc.fileUrl}
                      alt={doc.label || 'Document'}
                      className="w-full max-h-48 object-contain rounded-lg bg-white"
                      linkToFullSize
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add Other Document */}
        <div className="bg-white rounded-xl border border-steel-200 shadow-sm p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={otherLabel}
              onChange={(e) => setOtherLabel(e.target.value)}
              placeholder="Document name (e.g. W-9 Form)"
              className="flex-1 rounded-lg border border-steel-300 px-3 py-2 text-sm focus:ring-2 focus:ring-safety focus:border-safety outline-none"
            />
            <button
              onClick={() => {
                if (!otherLabel.trim()) { setError('Enter a name for the document'); return; }
                handleFileSelect('OTHER', otherLabel.trim());
                setOtherLabel('');
              }}
              disabled={uploading === 'OTHER'}
              className="px-4 py-2 rounded-lg bg-safety text-diesel text-sm font-semibold hover:bg-safety-dark transition-colors whitespace-nowrap"
            >
              {uploading === 'OTHER' ? 'Uploading…' : '+ Add'}
            </button>
          </div>
          <input ref={otherFileRef} type="file" accept="image/*,application/pdf" className="hidden" />
        </div>
      </div>
    </div>
  );
}
