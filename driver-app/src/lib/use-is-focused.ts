/**
 * Lightweight useIsFocused — tracks whether the current screen is focused
 * using expo-router's useFocusEffect (re-exported from React Navigation).
 */
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

export function useIsFocused(): boolean {
  const [focused, setFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return focused;
}
