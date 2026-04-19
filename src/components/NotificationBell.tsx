'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
}

interface Toast {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  type: string;
}

// Notification type → icon + color
const TYPE_STYLE: Record<string, { icon: string; color: string }> = {
  JOB_STARTED: { icon: '▶', color: 'text-green-600' },
  JOB_PAUSED: { icon: '⏸', color: 'text-amber-600' },
  JOB_COMPLETED: { icon: '✓', color: 'text-green-700' },
  JOB_CANCELLED: { icon: '✕', color: 'text-red-600' },
  JOB_CLAIMED: { icon: '✋', color: 'text-blue-600' },
  JOB_ISSUE: { icon: '⚠', color: 'text-red-600' },
  TICKET_STARTED: { icon: '▶', color: 'text-green-600' },
  TICKET_COMPLETED: { icon: '✓', color: 'text-green-700' },
  TICKET_ISSUE: { icon: '⚠', color: 'text-red-600' },
  TICKET_UPDATED: { icon: '✎', color: 'text-blue-600' },
  TICKET_PHOTO_UPLOADED: { icon: '📷', color: 'text-purple-600' },
  TICKET_PHOTOS_UPLOADED: { icon: '📷', color: 'text-purple-600' },
  TIME_OFF_REQUEST: { icon: '🗓', color: 'text-amber-600' },
  TIME_OFF_CANCELLED: { icon: '✕', color: 'text-red-500' },
  TIME_OFF_APPROVED: { icon: '✓', color: 'text-green-600' },
  TIME_OFF_DENIED: { icon: '✕', color: 'text-red-600' },
  INSPECTION_EXPIRING: { icon: '🔍', color: 'text-amber-600' },
};

const POLL_INTERVAL = 10_000; // 10 seconds
const TOAST_DURATION = 5_000; // 5 seconds

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const lastPollRef = useRef<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // -- Fetch notifications --------------------------------------------------
  const fetchNotifications = useCallback(async (isInitial = false) => {
    try {
      const params = new URLSearchParams({ limit: '30', unreadOnly: 'true' });
      if (!isInitial && lastPollRef.current) {
        params.set('after', lastPollRef.current);
      }
      const res = await fetch(`/api/notifications?${params}`);
      if (!res.ok) return;
      const data = await res.json();

      setUnreadCount(data.unreadCount);

      if (isInitial) {
        setNotifications(data.notifications);
        // Seed seen IDs so we don't toast on first load
        for (const n of data.notifications) seenIdsRef.current.add(n.id);
        if (data.notifications.length > 0) {
          lastPollRef.current = data.notifications[0].createdAt;
        }
      } else if (data.notifications.length > 0) {
        // New notifications since last poll → add to list + toast
        const newOnes = data.notifications.filter(
          (n: Notification) => !seenIdsRef.current.has(n.id)
        );
        if (newOnes.length > 0) {
          setNotifications((prev) => {
            const merged = [...newOnes, ...prev];
            // Deduplicate
            const seen = new Set<string>();
            return merged.filter((n) => {
              if (seen.has(n.id)) return false;
              seen.add(n.id);
              return true;
            });
          });
          // Show toasts for new ones
          for (const n of newOnes) {
            seenIdsRef.current.add(n.id);
            showToast(n);
          }
          lastPollRef.current = newOnes[0].createdAt;
        }
      }
    } catch {
      // Silently fail — next poll will retry
    }
  }, []);

  // -- Toast helpers --------------------------------------------------------
  function showToast(n: Notification) {
    const toast: Toast = {
      id: n.id,
      title: n.title,
      body: n.body,
      link: n.link,
      type: n.type,
    };
    setToasts((prev) => [toast, ...prev].slice(0, 5));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, TOAST_DURATION);
  }

  function dismissToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  // -- Mark as read ---------------------------------------------------------
  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }

  // -- Clear all (marks as read in DB, clears dropdown — history preserved) --
  async function clearAll() {
    await fetch('/api/notifications', { method: 'DELETE' });
    setNotifications([]);
    setUnreadCount(0);
  }

  // -- Polling --------------------------------------------------------------
  useEffect(() => {
    fetchNotifications(true);
    const interval = setInterval(() => fetchNotifications(false), POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // -- Close on outside click -----------------------------------------------
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        open &&
        dropdownRef.current &&
        bellRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // -- Time formatting ------------------------------------------------------
  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  const style = (type: string) => TYPE_STYLE[type] || { icon: '●', color: 'text-steel-500' };

  return (
    <>
      {/* Bell button */}
      <div className="relative">
        <button
          ref={bellRef}
          onClick={() => setOpen(!open)}
          className="relative w-10 h-10 flex items-center justify-center rounded hover:bg-steel-800 transition-colors"
          aria-label="Notifications"
        >
          <svg
            className="w-5 h-5 text-steel-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {open && (
          <div
            ref={dropdownRef}
            className="absolute right-0 top-12 w-80 max-h-[28rem] bg-white rounded-lg shadow-lg border border-steel-200 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-steel-200">
              <h3 className="font-bold text-sm text-steel-800">Notifications</h3>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-red-500 hover:text-red-700 font-medium"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-steel-500">
                  No notifications yet
                </div>
              ) : (
                notifications.map((n) => {
                  const s = style(n.type);
                  return (
                    <a
                      key={n.id}
                      href={n.link || '#'}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 border-b border-steel-100 hover:bg-steel-50 transition-colors ${
                        !n.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`text-base mt-0.5 ${s.color}`}>{s.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm leading-snug ${!n.read ? 'font-semibold text-steel-900' : 'text-steel-700'}`}>
                            {n.title}
                          </div>
                          {n.body && (
                            <div className="text-xs text-steel-500 mt-0.5 truncate">{n.body}</div>
                          )}
                          <div className="text-[10px] text-steel-400 mt-1">{timeAgo(n.createdAt)}</div>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                        )}
                      </div>
                    </a>
                  );
                })
              )}
            </div>

            {/* View History link */}
            <a
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-blue-600 hover:text-blue-800 py-2.5 border-t border-steel-200 hover:bg-steel-50 transition-colors"
            >
              View All History
            </a>
          </div>
        )}
      </div>

      {/* Toast popups — fixed in viewport */}
      {toasts.length > 0 && (
        <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
          {toasts.map((t) => {
            const s = style(t.type);
            return (
              <div
                key={t.id}
                className="pointer-events-auto w-80 bg-white rounded-lg shadow-lg border border-steel-200 p-3 animate-slide-in cursor-pointer"
                onClick={() => {
                  dismissToast(t.id);
                  if (t.link) window.location.href = t.link;
                }}
              >
                <div className="flex items-start gap-2.5">
                  <span className={`text-base ${s.color}`}>{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-steel-900 leading-snug">{t.title}</div>
                    {t.body && (
                      <div className="text-xs text-steel-500 mt-0.5 truncate">{t.body}</div>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissToast(t.id);
                    }}
                    className="text-steel-400 hover:text-steel-600 text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
