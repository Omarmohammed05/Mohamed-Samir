'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Keeps the page in sync with the sheet while the user is inside the app:
 * - one refresh on mount (a client-side navigation may have been served
 *   from the router cache, so new containers wouldn't show otherwise)
 * - a refresh whenever the app regains focus / becomes visible
 * - a recurring refresh while the page is visible
 *
 * `router.refresh()` re-renders the server components with fresh sheet
 * data; client components keep their state, so nothing the user is
 * typing gets lost.
 */
export function AutoSync({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();

    refresh();

    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [router, intervalMs]);

  return null;
}
