'use client';

import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Tracks user activity (mouse, keyboard, touch, scroll) and auto-logs out
 * after 15 minutes of inactivity.
 *
 * For dispatcher/superadmin: POSTs to /api/logout (form submit).
 * For driver app: pass a custom onIdle callback.
 */
export default function IdleLogout({
  logoutUrl = '/api/logout',
  onIdle,
}: {
  /** URL to POST to when idle (default: /api/logout). Ignored if onIdle is set. */
  logoutUrl?: string;
  /** Custom callback when idle timeout fires (e.g. for driver app logout flow) */
  onIdle?: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doLogout = useCallback(() => {
    if (onIdle) {
      onIdle();
      return;
    }
    // Default: POST to logout endpoint via form submit
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = logoutUrl;
    document.body.appendChild(form);
    form.submit();
  }, [logoutUrl, onIdle]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [resetTimer]);

  return null;
}
