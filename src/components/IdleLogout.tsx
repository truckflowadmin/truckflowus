'use client';

import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Tracks user activity (mouse, keyboard, touch, scroll) and auto-logs out
 * after 15 minutes of inactivity.
 *
 * Uses both setTimeout AND timestamp checks on visibility change so that
 * mobile browsers (iOS Safari) correctly detect inactivity even when the
 * tab/app is suspended in the background.
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
  const lastActivityRef = useRef<number>(Date.now());

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
    lastActivityRef.current = Date.now();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [doLogout]);

  useEffect(() => {
    // Activity events reset the timer
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));
    resetTimer();

    // When the tab/app becomes visible again (iOS Safari, Android Chrome, etc.),
    // check if the idle timeout has elapsed while the app was suspended.
    // Mobile browsers freeze JS timers in the background, so setTimeout alone
    // won't fire. This catches that case.
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= IDLE_TIMEOUT_MS) {
          doLogout();
        } else {
          // Restart timer for the remaining time
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS - elapsed);
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resetTimer, doLogout]);

  return null;
}
