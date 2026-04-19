'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/sa/overview', label: 'Overview', icon: '◆' },
  { href: '/sa/tenants', label: 'Tenants', icon: '▦' },
  { href: '/sa/plans', label: 'Plans', icon: '$' },
  { href: '/sa/requests', label: 'Requests', icon: '⬆' },
  { href: '/sa/brokers', label: 'Brokers', icon: '⇆' },
];

export function SuperadminSidebar({ user }: { user: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  const sidebar = (
    <>
      <div className="p-5 border-b border-purple-900">
        <Link href="/sa/overview" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="w-9 h-9 bg-purple-600 rounded flex items-center justify-center font-black text-white">
            TF
          </div>
          <div>
            <div className="text-white font-bold tracking-tight leading-tight">TruckFlowUS</div>
            <div className="text-[10px] text-purple-300 uppercase tracking-widest">Superadmin</div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
              isActive(item.href)
                ? 'bg-purple-900 text-white'
                : 'hover:bg-purple-900 hover:text-white text-purple-200'
            }`}
          >
            <span className="text-purple-400 w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-purple-900 text-xs">
        <div className="px-3 py-2">
          <div className="text-white font-medium">{user.name}</div>
          <div className="text-purple-300">{user.email}</div>
        </div>
        <form action="/api/logout" method="post">
          <button className="w-full text-left px-3 py-2 rounded hover:bg-purple-900 text-purple-300 hover:text-white">
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      <div className="lg:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-40 shadow" style={{ background: '#1a0a2e', color: '#fff' }}>
        <button
          onClick={() => setOpen(!open)}
          className="w-10 h-10 flex items-center justify-center rounded hover:bg-purple-900"
          aria-label="Toggle menu"
        >
          <span className="text-xl">{open ? '✕' : '☰'}</span>
        </button>
        <Link href="/sa/overview" className="flex items-center gap-2 hover:opacity-80">
          <div className="w-7 h-7 bg-purple-600 rounded flex items-center justify-center font-black text-white text-sm">TF</div>
          <span className="font-bold tracking-tight">TruckFlowUS · SA</span>
        </Link>
      </div>
      {open && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 w-64 flex flex-col z-50 transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: '#1a0a2e', color: '#c4b5fd' }}
      >
        {sidebar}
      </aside>
      <aside
        className="hidden lg:flex w-60 flex-col flex-shrink-0"
        style={{ background: '#1a0a2e', color: '#c4b5fd' }}
      >
        {sidebar}
      </aside>
    </>
  );
}
