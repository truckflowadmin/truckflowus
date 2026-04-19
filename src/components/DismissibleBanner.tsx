'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  children: React.ReactNode;
  /** If set, dismissing also clears search params by navigating to this path */
  clearHref?: string;
}

const STYLES = {
  info: {
    bg: 'bg-blue-50 border-blue-200',
    title: 'text-blue-900',
    icon: '⏳',
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    title: 'text-amber-900',
    icon: '⚠️',
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    title: 'text-red-900',
    icon: '✕',
  },
  success: {
    bg: 'bg-green-50 border-green-200',
    title: 'text-green-900',
    icon: '✓',
  },
};

export default function DismissibleBanner({ type, title, children, clearHref }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const router = useRouter();
  const style = STYLES[type];

  if (dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    if (clearHref) {
      router.replace(clearHref);
    }
  }

  return (
    <div className={`mb-6 border rounded-xl p-5 ${style.bg}`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{style.icon}</span>
        <div className="flex-1">
          <h3 className={`font-semibold ${style.title}`}>{title}</h3>
          {children}
        </div>
        <button
          onClick={handleDismiss}
          className="text-steel-400 hover:text-steel-600 text-lg leading-none p-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
