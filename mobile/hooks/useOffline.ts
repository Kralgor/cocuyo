import { useNetInfo } from '@react-native-community/netinfo';
import { storage, STORAGE_KEYS } from '@/lib/storage';

// ── staleness threshold ──────────────────────────────────────────────────────
// 15-minute threshold per D-13 (staleness banner non-dismissible at 15 min).
export const STALE_THRESHOLD_MS = 15 * 60 * 1000;

// ── computeStaleness ─────────────────────────────────────────────────────────
// Pure staleness computation, extracted so the actual logic is unit-testable
// without rendering the hook (which depends on useNetInfo). The hook below is
// the only caller — keep them in lockstep by importing this, never re-deriving.
//
// "Never fetched" (stored undefined/0) is a distinct state from "infinitely old
// cache". Treating a missing timestamp as age=Date.now() renders epoch-scale
// minutes to the user ("hace 29024691 min") — CR-02.
export function computeStaleness(stored: number | undefined): {
  isStale: boolean;
  hasCache: boolean;
  ageMinutes: number;
} {
  const hasCache = typeof stored === 'number' && stored > 0;
  const ageMs = hasCache ? Date.now() - stored : 0;
  return {
    isStale: hasCache && ageMs > STALE_THRESHOLD_MS,
    hasCache,
    ageMinutes: Math.floor(ageMs / 60_000),
  };
}

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
  hasCache: boolean;
  ageMinutes: number;
} {
  const { isConnected } = useNetInfo();

  // Read cacheTimestamp synchronously from MMKV; delegate the staleness math to
  // the pure, unit-tested helper so hook and tests never drift (CR-02).
  const stored = storage.getNumber(STORAGE_KEYS.cacheTimestamp);
  const { isStale, hasCache, ageMinutes } = computeStaleness(stored);

  return {
    isOffline: isConnected === false,
    isStale,
    hasCache,
    ageMinutes,
  };
}
