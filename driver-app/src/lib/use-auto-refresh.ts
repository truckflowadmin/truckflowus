/**
 * useAutoRefresh — polls on an interval and refetches when the app comes
 * back to the foreground or when the user switches to this tab.
 *
 * Usage:
 *   const { refreshing, onRefresh } = useAutoRefresh(loadFn, { interval: 15000 });
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useIsFocused } from './use-is-focused';

interface Options {
  /** Polling interval in ms (default 15 000 = 15 s) */
  interval?: number;
  /** Whether auto-refresh is enabled (default true) */
  enabled?: boolean;
}

export function useAutoRefresh(
  loadFn: () => Promise<void>,
  { interval = 15_000, enabled = true }: Options = {},
) {
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Manual pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await loadFn(); } finally { setRefreshing(false); }
  }, [loadFn]);

  // Fetch on mount
  useEffect(() => { loadFn(); }, [loadFn]);

  // Polling — only while the tab is focused and the app is active
  useEffect(() => {
    if (!enabled || !isFocused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      loadFn();
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [loadFn, interval, enabled, isFocused]);

  // Refetch when app comes back to foreground
  useEffect(() => {
    if (!enabled) return;

    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && next === 'active' && isFocused) {
        loadFn();
      }
      appState.current = next;
    });

    return () => sub.remove();
  }, [loadFn, enabled, isFocused]);

  return { refreshing, onRefresh };
}
