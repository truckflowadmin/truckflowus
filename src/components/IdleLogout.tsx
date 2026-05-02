'use client';

import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const STORAGE_KEY = 'idle_last_activity';

/**
 * Tracks user activity (mouse, keyboard, touch, scroll) and auto-logs out
 * after 15 minutes of inactivity.
 *
 * Persists last-activity timestamp to sessionStorage so that on iOS Safari
 * (which evicts background tabs from memory), the timeout is enforced even
 * after a full page re-mount. Also checks on visibilitychange for tabs that
 * are suspended but not evicted.
 *
 * For dispatcher/superadmin: redirects to /api/logout.
 * For driver app: pass a custom onIdle callback.
 */
export default function IdleLogout({
  logoutUrl = '/api/logout',
  onIdle,
}: {
  /** URL to redirect to when idle (default: /api/logout). Ignored if onIdle is set. */
  logoutUrl?: string;
  /** Custom callback when idle timeout fires (e.g. for driver app logout flow) */
  onIdle?: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const loggingOutRef = useRef(false);

  // Read persisted timestamp (survives iOS tab eviction)
  const getLastActivity = useCallback((): number => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) return parseInt(stored, 10);
    } catch { /* sessionStorage unavailable */ }
    return Date.now();
  }, []);

  const setLastActivity = useCallback((ts: number) => {
    lastActivityRef.current = ts;
    try {
      sessionStorage.setItem(STORAGE_KEY, String(ts));
    } catch { /* ignore */ }
  }, []);

  const doLogout = useCallback(() => {
    if (loggingOutRef.current) return; // prevent double-fire
    loggingOutRef.current = true;
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }

    if (onIdle) {
      onIdle();
      return;
    }
    // Use direct navigation — more reliable than form.submit() on iOS Safari
    // after the browser restores a suspended/evicted tab
    window.location.href = logoutUrl;
  }, [logoutUrl, onIdle]);

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS);
  }, [doLogout, setLastActivity]);

  useEffect(() => {
    // On mount (including re-mount after iOS eviction), check if already expired
    const lastActivity = getLastActivity();
    const elapsed = Date.now() - lastActivity;
    if (elapsed >= IDLE_TIMEOUT_MS) {
      doLogout();
      return;
    }

    // Initialize from stored value
    lastActivityRef.current = lastActivity;

    // Start timer for remaining time
    timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS - elapsed);

    // Activity events reset the timer
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    // When the tab/app becomes visible again (iOS Safari, Android Chrome, etc.),
    // check if the idle timeout has elapsed while the app was suspended.
    // Mobile browsers freeze JS timers in the background, so setTimeout alone
    // won't fire. This catches tabs that were suspended but not fully evicted.
    function onVisibility() {
      if (document.visibilityState === 'visible') {
        const stored = getLastActivity();
        const elapsedSinceActivity = Date.now() - stored;
        if (elapsedSinceActivity >= IDLE_TIMEOUT_MS) {
          doLogout();
        } else {
          // Restart timer for the remaining time
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(doLogout, IDLE_TIMEOUT_MS - elapsedSinceActivity);
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [resetTimer, doLogout, getLastActivity]);

  return null;
}
