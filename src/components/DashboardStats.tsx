'use client';

import { useEffect, useState, useCallback } from 'react';

interface Stats {
  pending: number;
  inProgress: number;
  completedToday: number;
  completedWeek: number;
  driversActive: number;
  openInvoiceTotal: number;
  openInvoiceCount: number;
}

function StatCard({ label, value, subtle, accent }: { label: string; value: string | number; subtle?: string; accent?: boolean }) {
  return (
    <div className={`panel p-4 ${accent ? 'ring-2 ring-safety' : ''}`}>
      <div className="text-[10px] uppercase tracking-widest text-steel-500 font-semibold">{label}</div>
      <div className="text-2xl font-bold mt-1 tabular-nums">{value}</div>
      {subtle && <div className="text-xs text-steel-500 mt-0.5">{subtle}</div>}
    </div>
  );
}

function StatSkeleton() {
  return (
    <div className="panel p-4 animate-pulse">
      <div className="h-3 w-16 bg-steel-200 rounded mb-2" />
      <div className="h-7 w-10 bg-steel-200 rounded" />
    </div>
  );
}

export default function DashboardStats({ labels }: { labels: {
  pending: string;
  inProgress: string;
  doneToday: string;
  doneThisWeek: string;
  activeDrivers: string;
  openAR: string;
  invoice: string;
  invoices: string;
} }) {
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/dashboard/stats', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load();
    // Refresh every 15 seconds while the tab is open
    const interval = setInterval(load, 15_000);

    // Re-fetch immediately when the tab becomes visible again
    function onVisibility() {
      if (document.visibilityState === 'visible') load();
    }
    document.addEventListener('visibilitychange', onVisibility);

    // Re-fetch when the window regains focus (covers tab switches + alt-tab)
    window.addEventListener('focus', load);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', load);
    };
  }, [load]);

  if (!stats) {
    return (
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {Array.from({ length: 6 }).map((_, i) => <StatSkeleton key={i} />)}
      </section>
    );
  }

  const invoiceWord = stats.openInvoiceCount === 1 ? labels.invoice : labels.invoices;
  const arDisplay = `$${stats.openInvoiceTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
      <StatCard label={labels.pending} value={stats.pending} accent />
      <StatCard label={labels.inProgress} value={stats.inProgress} />
      <StatCard label={labels.doneToday} value={stats.completedToday} />
      <StatCard label={labels.doneThisWeek} value={stats.completedWeek} />
      <StatCard label={labels.activeDrivers} value={stats.driversActive} />
      <StatCard label={labels.openAR} value={arDisplay} subtle={`${stats.openInvoiceCount} ${invoiceWord}`} />
    </section>
  );
}
