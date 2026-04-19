'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Props {
  trucksContent: React.ReactNode;
  expensesContent: React.ReactNode | null;
  maintenanceContent: React.ReactNode | null;
}

const ALL_TABS = [
  { key: 'trucks', label: 'Trucks', icon: '🚛' },
  { key: 'expenses', label: 'Expenses', icon: '💳' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
] as const;

type TabKey = (typeof ALL_TABS)[number]['key'];

export default function FleetPageTabs({ trucksContent, expensesContent, maintenanceContent }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Only show tabs whose content is provided (not null)
  const visibleTabs = useMemo(() => {
    return ALL_TABS.filter((t) => {
      if (t.key === 'trucks') return true;
      if (t.key === 'expenses') return expensesContent !== null;
      if (t.key === 'maintenance') return maintenanceContent !== null;
      return false;
    });
  }, [expensesContent, maintenanceContent]);

  const visibleKeys = useMemo(() => new Set(visibleTabs.map((t) => t.key)), [visibleTabs]);

  const paramTab = searchParams.get('tab');
  const initialTab: TabKey = paramTab && visibleKeys.has(paramTab as TabKey) ? (paramTab as TabKey) : 'trucks';
  const [tab, setTab] = useState<TabKey>(initialTab);

  // If current tab is no longer visible (feature removed), reset to trucks
  useEffect(() => {
    if (!visibleKeys.has(tab)) setTab('trucks');
  }, [visibleKeys, tab]);

  useEffect(() => {
    const current = searchParams.get('tab') || 'trucks';
    if (current !== tab) {
      const url = tab === 'trucks' ? '/fleet' : `/fleet?tab=${tab}`;
      router.replace(url, { scroll: false });
    }
  }, [tab]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-6 border-b border-steel-200">
        {visibleTabs.map((t) => (
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

      {tab === 'trucks' && trucksContent}
      {tab === 'expenses' && expensesContent}
      {tab === 'maintenance' && maintenanceContent}
    </div>
  );
}
