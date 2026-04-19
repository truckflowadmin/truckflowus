'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Forces a router.refresh() on mount to bust Next.js client-side cache.
 * Useful on pages that rely on fresh server data after a redirect.
 */
export default function SubscribeRefresher() {
  const router = useRouter();

  useEffect(() => {
    router.refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
