import { useNetInfo } from '@react-native-community/netinfo';
import { storage, STORAGE_KEYS } from '@/lib/storage';

// ── useOffline ─────────────────────────────────────────────────────────────────
// Combines NetInfo connectivity state with MMKV cache age for offline/staleness detection.
// isStale=true when the last successful fetchStatus() was more than 15 minutes ago (STAT-03, D-13).
// isOffline=true when the device has no network connection (NetInfo isConnected===false).
//
// Note: isOffline and isStale are independent — a device can be online with a stale cache
// (e.g., CDN returned error and the query did not update the timestamp), or offline with
// a fresh cache (rare but possible during brief network drops).
export function useOffline(): {
  isOffline: boolean;
  isStale: boolean;
  ageMinutes: number;
} {
  const { isConnected } = useNetInfo();

  // ── staleness ──────────────────────────────────────────────────────────────
  // Read cacheTimestamp synchronously from MMKV.
  // 0 = no cached data (first launch, never fetched successfully).
  const lastFetch = storage.getNumber(STORAGE_KEYS.cacheTimestamp) ?? 0;
  const ageMs = Date.now() - lastFetch;
  // 15-minute threshold per D-13 (staleness banner non-dismissible at 15 min).
  const isStale = ageMs > 15 * 60 * 1000;

  return {
    isOffline:  isConnected === false,
    isStale,
    ageMinutes: Math.floor(ageMs / 60_000),
  };
}
