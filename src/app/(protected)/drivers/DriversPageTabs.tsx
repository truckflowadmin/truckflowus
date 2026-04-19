'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Props {
  driversContent: React.ReactNode;
  timeOffContent: React.ReactNode;
  payrollContent: React.ReactNode;
}

const TABS = [
  { key: 'drivers', label: 'Drivers', icon: '▲' },
  { key: 'payroll', label: 'Payroll', icon: '💰' },
  { key: 'timeoff', label: 'Time Off', icon: '📅' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function DriversPageTabs({ driversContent, timeOffContent, payrollContent }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramTab = searchParams.get('tab');
  const initialTab: TabKey = paramTab === 'timeoff' ? 'timeoff' : paramTab === 'payroll' ? 'payroll' : 'drivers';
  const [tab, setTab] = useState<TabKey>(initialTab);

  // Sync URL when tab changes
  useEffect(() => {
    const current = searchParams.get('tab') || 'drivers';
    if (current !== tab) {
      const url = tab === 'drivers' ? '/drivers' : `/drivers?tab=${tab}`;
      router.replace(url, { scroll: false });
    }
  }, [tab]);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-6 border-b border-steel-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.key
                ? 'border-safety text-steel-900'
                : 'border-transparent text-steel-500 hover:text-steel-700 hover:border-steel-300'
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'drivers' && driversContent}
      {tab === 'payroll' && payrollContent}
      {tab === 'timeoff' && timeOffContent}
    </div>
  );
}
