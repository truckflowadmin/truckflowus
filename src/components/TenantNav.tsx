'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '', label: 'Overview' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/tickets', label: 'Tickets' },
  { href: '/drivers', label: 'Drivers' },
  { href: '/customers', label: 'Customers' },
  { href: '/brokers', label: 'Brokers' },
  { href: '/billing', label: 'Billing' },
  { href: '/passwords', label: 'Passwords' },
  { href: '/debug', label: 'Debug' },
  { href: '/audit', label: 'Audit Log' },
  { href: '/trash', label: 'Trash' },
];

export default function TenantNav({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const pathname = usePathname();
  const base = `/sa/tenants/${tenantId}`;

  return (
    <div className="mb-6">
      <nav className="text-sm mb-4">
        <Link href="/sa/tenants" className="text-purple-400 hover:text-purple-200">
          ← Tenants
        </Link>
        <span className="text-purple-600 mx-2">/</span>
        <span className="text-white font-medium">{tenantName}</span>
      </nav>
      <div className="flex gap-1 border-b border-purple-800 overflow-x-auto">
        {TABS.map((tab) => {
          const full = base + tab.href;
          const isActive =
            tab.href === ''
              ? pathname === base || pathname === base + '/'
              : pathname.startsWith(full);
          return (
            <Link
              key={tab.href}
              href={full}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors rounded-t-lg ${
                isActive
                  ? 'bg-purple-900/50 text-white border-b-2 border-purple-400'
                  : 'text-purple-400 hover:text-purple-200 hover:bg-purple-900/20'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
