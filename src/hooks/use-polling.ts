import { useState, useEffect, useCallback, useRef } from 'react';
import { POLL_INTERVAL_MS } from '@/lib/constants';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  enabled = true
): { data: T | null; error: string | null; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Cache the serialized form of the last payload so we can skip
  // setData when the server returned an identical response — preventing
  // a cascade of consumer rerenders every poll tick.
  const lastSerializedRef = useRef<string | null>(null);

  const doFetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      const serialized = JSON.stringify(result);
      if (serialized !== lastSerializedRef.current) {
        lastSerializedRef.current = serialized;
        setData(result);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Reset state when fetcher identity changes (e.g. switching runs)
  const prevFetcherRef = useRef(fetcher);
  useEffect(() => {
    if (prevFetcherRef.current !== fetcher) {
      prevFetcherRef.current = fetcher;
      lastSerializedRef.current = null;
      setData(null);
      setLoading(true);
    }
  }, [fetcher]);

  useEffect(() => {
    // Always fetch once when the fetcher changes (e.g. opening a drawer for
    // a terminal run still needs its logs loaded). Only set up the repeating
    // interval when polling is enabled — otherwise pause without clearing
    // the last payload so consumers can keep rendering.
    doFetch();
    if (!enabled) return;
    const interval = setInterval(doFetch, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, doFetch, fetcher]);

  return { data, error, loading, refresh: doFetch };
}
