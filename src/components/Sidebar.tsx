'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NotificationBell } from './NotificationBell';
import { useLanguage } from './LanguageProvider';
import LanguageToggle from './LanguageToggle';

const NAV = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: '▦' },
  { href: '/jobs', labelKey: 'nav.jobs', icon: '◧' },
  { href: '/tickets', labelKey: 'nav.tickets', icon: '▤' },
  { href: '/drivers', labelKey: 'nav.drivers', icon: '▲' },
  { href: '/fleet', labelKey: 'nav.fleet', icon: '🚛' },
  { href: '/customers', labelKey: 'nav.customers', icon: '◉' },
  { href: '/invoices', labelKey: 'nav.invoices', icon: '$' },
  { href: '/checks', labelKey: 'nav.checks', icon: '✎' },
  { href: '/reports', labelKey: 'nav.reports', icon: '◈' },
  { href: '/sms', labelKey: 'nav.messaging', icon: '📨' },
  { href: '/brokers', labelKey: 'nav.brokers', icon: '⇆' },
  { href: '/calendar', labelKey: 'nav.calendar', icon: '📆' },
  { href: '/settings', labelKey: 'nav.settings', icon: '⚙' },
];

interface SidebarProps {
  user: { name: string; email: string };
  /** Map of href → boolean. Missing = unlocked (backwards compat). */
  unlockedTabs?: Record<string, boolean>;
}

export function Sidebar({ user, unlockedTabs }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href + '/'));

  const isLocked = (href: string) => {
    if (!unlockedTabs) return false; // no data → all unlocked (backwards compat)
    return unlockedTabs[href] === false;
  };

  const sidebar = (
    <>
      <div className="p-5 border-b border-steel-800">
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-safety rounded flex items-center justify-center font-black text-diesel">TF</div>
          <div>
            <div className="text-white font-bold tracking-tight leading-tight">TruckFlowUS</div>
            <div className="text-[10px] text-steel-500 uppercase tracking-widest">Dispatch</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const locked = isLocked(item.href);
          const active = !locked && isActive(item.href);

          if (locked) {
            return (
              <Link
                key={item.href}
                href={`/locked?tab=${encodeURIComponent(t(item.labelKey))}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2 rounded text-sm text-steel-600 cursor-pointer hover:bg-steel-800/50 group"
              >
                <span className="w-5 text-center text-steel-600 group-hover:text-steel-500">{item.icon}</span>
                <span className="flex-1">{t(item.labelKey)}</span>
                <span className="text-[10px] text-steel-600 bg-steel-800 rounded px-1.5 py-0.5">
                  {t('common.locked')}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                active
                  ? 'bg-steel-800 text-white'
                  : 'hover:bg-steel-800 hover:text-white text-steel-300'
              }`}
            >
              <span className="text-safety w-5 text-center">{item.icon}</span>
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-steel-800 text-xs space-y-2">
        <div className="px-3 py-2">
          <div className="text-white font-medium">{user.name}</div>
          <div className="text-steel-500">{user.email}</div>
        </div>
        <div className="px-3 flex items-center justify-between">
          <span className="text-steel-500 text-[10px] uppercase tracking-wider">Language</span>
          <LanguageToggle variant="dispatcher" />
        </div>
        <form action="/api/logout" method="post">
          <button className="w-full text-left px-3 py-2 rounded hover:bg-steel-800 text-steel-400 hover:text-white">
            {t('common.signOut')}
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile topbar */}
      <div className="lg:hidden bg-diesel text-white flex items-center gap-3 px-4 py-3 sticky top-0 z-40 shadow">
        <button
          onClick={() => setOpen(!open)}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-steel-800"
          aria-label="Toggle menu"
        >
          <span className="text-xl">{open ? '✕' : '☰'}</span>
        </button>
        <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 flex-1">
          <div className="w-7 h-7 bg-safety rounded flex items-center justify-center font-black text-diesel text-sm">TF</div>
          <span className="font-bold tracking-tight">TruckFlowUS</span>
        </Link>
        <NotificationBell />
      </div>

      {/* Mobile overlay */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 bg-diesel text-steel-200 flex flex-col z-50 transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebar}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 bg-diesel text-steel-200 flex-col flex-shrink-0">
        {sidebar}
      </aside>
    </>
  );
}
