import { useQuery } from '@tanstack/react-query';
import { fetchStatus } from '@/lib/api';
import { storage, STORAGE_KEYS } from '@/lib/storage';
import type { StatusJson } from '@/lib/api';

// ── useStatus ──────────────────────────────────────────────────────────────────
// React Query wrapper around fetchStatus().
// On successful fetch: writes cacheTimestamp to MMKV so useOffline can compute
// staleness (STAT-03 — cache age > 15 min triggers stale banner).
// gcTime / staleTime / networkMode inherited from queryClient defaults in lib/query.ts.
//
// Throws in queryFn when data is null — React Query treats this as an error state,
// which triggers retry logic (3 retries per query.ts defaults).
export function useStatus(refreshInterval?: number): {
  data: StatusJson | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useQuery({
    queryKey: ['status'],
    queryFn: async (): Promise<StatusJson> => {
      const result = await fetchStatus();
      if (result.data) {
        // ── write cache timestamp on success ──────────────────────────────────
        // useOffline reads this to compute ageMs and isStale (STAT-03).
        storage.set(STORAGE_KEYS.cacheTimestamp, Date.now());
        return result.data;
      }
      // Null data = failed fetch; throw so React Query retries.
      throw new Error('fetch failed');
    },
    refetchInterval: refreshInterval,
    // gcTime / staleTime / networkMode / retry from queryClient defaults (lib/query.ts).
  });

  return {
    data:      query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
    refetch:   query.refetch,
  };
}
